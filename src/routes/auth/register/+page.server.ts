import { randomInt } from 'node:crypto';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { z } from 'zod';
import { createSession, hashPassword, verifyPassword } from '$lib/server/auth';
import { config } from '$lib/server/config';
import { sqlite } from '$lib/server/db';
import { sendRegistrationCodeEmail } from '$lib/server/email';
import { clientKey, consumeRateLimit } from '$lib/server/rate-limit';

const registration = z.object({
  email: z.email('Некорректная почта').transform((value) => value.toLowerCase()),
  phone: z.string().trim().min(7, 'Укажите телефон').max(30),
  firstName: z.string().trim().min(1, 'Укажите имя').max(80),
  lastName: z.string().trim().min(1, 'Укажите фамилию').max(80),
  password: z.string().min(10, 'Пароль должен быть не короче 10 символов').max(200)
});

const emailOnly = z.object({
  email: z.email('Некорректная почта').transform((value) => value.toLowerCase())
});

const codeVerification = emailOnly.extend({
  code: z
    .string()
    .regex(/^\d{6}$/, 'Введите шестизначный код из письма')
});

type RegistrationValues = z.input<typeof registration>;
type PendingRegistrationRow = {
  id: number;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  pwd_hash: string;
  code_hash: string;
  attempts: number;
};

const safeValues = (values: Partial<RegistrationValues>) => ({
  email: values.email || '',
  phone: values.phone || '',
  firstName: values.firstName || '',
  lastName: values.lastName || ''
});

const safeValuesFromPending = (row: PendingRegistrationRow) => ({
  email: row.email,
  phone: row.phone,
  firstName: row.first_name,
  lastName: row.last_name
});

const valuesFromFormData = (data: FormData): RegistrationValues => ({
  email: String(data.get('email') || ''),
  phone: String(data.get('phone') || ''),
  firstName: String(data.get('firstName') || ''),
  lastName: String(data.get('lastName') || ''),
  password: String(data.get('password') || '')
});

const userExists = (email: string) =>
  Boolean(sqlite.prepare('SELECT 1 FROM users WHERE email = ?').get(email));

const normalizeVerificationCode = (value: string) => value.replace(/\D/g, '');

const latestPendingRegistration = (email: string, options: { unexpiredOnly: boolean }) =>
  sqlite
    .prepare(`
      SELECT id, email, phone, first_name, last_name, pwd_hash, code_hash, attempts
      FROM email_verification_codes
      WHERE email = ?
        AND consumed_at IS NULL
        ${options.unexpiredOnly ? "AND datetime(expires_at) > datetime('now')" : ''}
      ORDER BY datetime(created_at) DESC, id DESC
      LIMIT 1
    `)
    .get(email) as PendingRegistrationRow | undefined;

const markVerificationFailed = (id: number, attempts: number) => {
  sqlite
    .prepare(`
      UPDATE email_verification_codes
      SET attempts = attempts + 1,
          consumed_at = CASE WHEN attempts + 1 >= 5 THEN datetime('now') ELSE consumed_at END
      WHERE id = ?
    `)
    .run(id);

  return attempts + 1 >= 5
    ? 'Слишком много неверных попыток. Запросите новый код.'
    : 'Код не подошёл. Проверьте письмо или запросите новый код.';
};

async function sendAndStoreCode(row: {
  id?: number | bigint;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
}) {
  const code = String(randomInt(100_000, 1_000_000));
  const codeHash = await hashPassword(`${row.email}:${code}`);
  const expires = new Date(Date.now() + config.registrationCodeMinutes * 60_000);
  const hadExistingRow = Boolean(row.id);

  if (row.id) {
    sqlite
      .prepare(`
        UPDATE email_verification_codes
        SET code_hash = ?, attempts = 0, expires_at = ?, created_at = datetime('now')
        WHERE id = ?
      `)
      .run(codeHash, expires.toISOString(), row.id);
  } else {
    const inserted = sqlite
      .prepare(`
        INSERT INTO email_verification_codes
          (email, phone, first_name, last_name, pwd_hash, code_hash, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        row.email,
        row.phone,
        row.firstName,
        row.lastName,
        row.passwordHash,
        codeHash,
        expires.toISOString()
      );
    row.id = inserted.lastInsertRowid;
  }

  const email = await sendRegistrationCodeEmail({
    to: row.email,
    firstName: row.firstName,
    code
  });

  if (!email.ok) {
    if (!hadExistingRow) sqlite.prepare('DELETE FROM email_verification_codes WHERE id = ?').run(row.id);
    return email;
  }

  return email;
}

export const load: PageServerLoad = ({ locals }) => {
  if (locals.user) redirect(303, '/account');
};

export const actions: Actions = {
  sendCode: async ({ request }) => {
    if (
      !consumeRateLimit(clientKey(request, 'register-code'), {
        capacity: 6,
        refillPerMinute: 0.1
      })
    ) {
      return fail(429, { error: 'Слишком много запросов кода. Попробуйте позже.', step: 'details' });
    }

    const data = await request.formData();
    const values = valuesFromFormData(data);
    const parsed = registration.safeParse(values);

    if (!parsed.success) {
      return fail(400, {
        error: parsed.error.issues[0]?.message,
        values: safeValues(values),
        step: 'details'
      });
    }

    if (
      !consumeRateLimit(`register-code-email:${parsed.data.email}`, {
        capacity: 3,
        refillPerMinute: 0.05
      })
    ) {
      return fail(429, {
        error: 'Код для этой почты запрашивали слишком часто. Попробуйте позже.',
        values: safeValues(values),
        step: 'details'
      });
    }

    if (userExists(parsed.data.email)) {
      return fail(409, {
        error: 'Аккаунт с такой почтой уже существует.',
        values: safeValues(values),
        step: 'details'
      });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const email = await sendAndStoreCode({
      email: parsed.data.email,
      phone: parsed.data.phone,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      passwordHash
    });

    if (!email.ok) {
      return fail(503, {
        error: 'Не удалось отправить код регистрации. Проверьте настройки Resend и попробуйте снова.',
        detail: email.message,
        values: safeValues(values),
        step: 'details'
      });
    }

    sqlite
      .prepare(`
        DELETE FROM email_verification_codes
        WHERE datetime(expires_at) <= datetime('now', '-1 day')
           OR (email = ? AND consumed_at IS NOT NULL)
      `)
      .run(parsed.data.email);

    return {
      success: `Мы отправили шестизначный код на ${parsed.data.email}. Он действует ${config.registrationCodeMinutes} минут.`,
      values: safeValues(parsed.data),
      step: 'verify'
    };
  },

  resendCode: async ({ request }) => {
    if (
      !consumeRateLimit(clientKey(request, 'register-resend-code'), {
        capacity: 4,
        refillPerMinute: 0.1
      })
    ) {
      return fail(429, { error: 'Слишком много повторных отправок. Попробуйте позже.', step: 'verify' });
    }

    const data = await request.formData();
    const parsed = emailOnly.safeParse({ email: String(data.get('email') || '') });
    if (!parsed.success) {
      return fail(400, { error: parsed.error.issues[0]?.message, step: 'details' });
    }

    if (
      !consumeRateLimit(`register-code-email:${parsed.data.email}`, {
        capacity: 3,
        refillPerMinute: 0.05
      })
    ) {
      return fail(429, {
        error: 'Код для этой почты запрашивали слишком часто. Попробуйте позже.',
        values: { email: parsed.data.email },
        step: 'verify'
      });
    }

    if (userExists(parsed.data.email)) {
      return fail(409, {
        error: 'Аккаунт с такой почтой уже существует.',
        values: { email: parsed.data.email },
        step: 'details'
      });
    }

    const pending = latestPendingRegistration(parsed.data.email, { unexpiredOnly: false });
    if (!pending) {
      return fail(400, {
        error: 'Не нашли ожидающую регистрацию. Заполните форму ещё раз.',
        values: { email: parsed.data.email },
        step: 'details'
      });
    }

    const email = await sendAndStoreCode({
      id: pending.id,
      email: pending.email,
      phone: pending.phone,
      firstName: pending.first_name,
      lastName: pending.last_name,
      passwordHash: pending.pwd_hash
    });

    if (!email.ok) {
      return fail(503, {
        error: 'Не удалось отправить новый код. Проверьте настройки Resend и попробуйте снова.',
        detail: email.message,
        values: safeValuesFromPending(pending),
        step: 'verify'
      });
    }

    return {
      success: `Мы отправили новый код на ${pending.email}. Он действует ${config.registrationCodeMinutes} минут.`,
      values: safeValuesFromPending(pending),
      step: 'verify'
    };
  },

  verify: async ({ request, cookies }) => {
    if (
      !consumeRateLimit(clientKey(request, 'register-verify'), {
        capacity: 10,
        refillPerMinute: 1
      })
    ) {
      return fail(429, { error: 'Слишком много попыток. Попробуйте позже.', step: 'verify' });
    }

    const data = await request.formData();
    const parsed = codeVerification.safeParse({
      email: String(data.get('email') || ''),
      code: normalizeVerificationCode(String(data.get('code') || ''))
    });

    if (!parsed.success) {
      return fail(400, {
        error: parsed.error.issues[0]?.message,
        values: { email: String(data.get('email') || '') },
        step: 'verify'
      });
    }

    if (userExists(parsed.data.email)) {
      return fail(409, {
        error: 'Аккаунт с такой почтой уже существует.',
        values: { email: parsed.data.email },
        step: 'details'
      });
    }

    const pending = latestPendingRegistration(parsed.data.email, { unexpiredOnly: true });
    if (!pending || pending.attempts >= 5) {
      return fail(400, {
        error: 'Код истёк или уже использован. Заполните форму ещё раз.',
        values: { email: parsed.data.email },
        step: 'details'
      });
    }

    const codeMatches = await verifyPassword(pending.code_hash, `${parsed.data.email}:${parsed.data.code}`);
    if (!codeMatches) {
      const message = markVerificationFailed(pending.id, pending.attempts);
      return fail(400, {
        error: message,
        values: safeValuesFromPending(pending),
        step: 'verify'
      });
    }

    try {
      const userId = sqlite.transaction(() => {
        sqlite
          .prepare("UPDATE email_verification_codes SET consumed_at = datetime('now') WHERE id = ?")
          .run(pending.id);

        const result = sqlite
          .prepare(`
            INSERT INTO users (email, phone, first_name, last_name, pwd_hash, role)
            VALUES (?, ?, ?, ?, ?, 'user')
          `)
          .run(pending.email, pending.phone, pending.first_name, pending.last_name, pending.pwd_hash);

        return Number(result.lastInsertRowid);
      })();

      createSession(userId, cookies);
    } catch {
      return fail(409, {
        error: 'Не удалось создать аккаунт. Возможно, эта почта уже зарегистрирована.',
        values: safeValuesFromPending(pending),
        step: 'details'
      });
    }

    redirect(303, '/account?welcome=1');
  }
};
