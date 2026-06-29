import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { z } from 'zod';
import { createSession, hashPassword } from '$lib/server/auth';
import { sqlite } from '$lib/server/db';
import { clientKey, consumeRateLimit } from '$lib/server/rate-limit';

const registration = z.object({
  email: z.email('Некорректная почта').transform((value) => value.toLowerCase()),
  phone: z.string().trim().min(7, 'Укажите телефон').max(30),
  firstName: z.string().trim().min(1, 'Укажите имя').max(80),
  lastName: z.string().trim().min(1, 'Укажите фамилию').max(80),
  password: z.string().min(10, 'Пароль должен быть не короче 10 символов').max(200)
});

export const load: PageServerLoad = ({ locals }) => {
  if (locals.user) redirect(303, '/account');
};

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    if (
      !consumeRateLimit(clientKey(request, 'register'), {
        capacity: 4,
        refillPerMinute: 0.2
      })
    ) {
      return fail(429, { error: 'Слишком много регистраций. Попробуйте позже.' });
    }
    const data = await request.formData();
    const values = {
      email: String(data.get('email') || ''),
      phone: String(data.get('phone') || ''),
      firstName: String(data.get('firstName') || ''),
      lastName: String(data.get('lastName') || ''),
      password: String(data.get('password') || '')
    };
    const parsed = registration.safeParse(values);
    const safeValues = {
      email: values.email,
      phone: values.phone,
      firstName: values.firstName,
      lastName: values.lastName
    };
    if (!parsed.success) {
      return fail(400, { error: parsed.error.issues[0]?.message, values: safeValues });
    }
    if (sqlite.prepare('SELECT 1 FROM users WHERE email = ?').get(parsed.data.email)) {
      return fail(409, { error: 'Аккаунт с такой почтой уже существует.', values: safeValues });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const result = sqlite
      .prepare(`
        INSERT INTO users (email, phone, first_name, last_name, pwd_hash, role)
        VALUES (?, ?, ?, ?, ?, 'user')
      `)
      .run(
        parsed.data.email,
        parsed.data.phone,
        parsed.data.firstName,
        parsed.data.lastName,
        passwordHash
      );
    createSession(Number(result.lastInsertRowid), cookies);
    redirect(303, '/account?welcome=1');
  }
};
