import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createSession, getUserByEmail, verifyPassword } from '$lib/server/auth';
import { clientKey, consumeRateLimit } from '$lib/server/rate-limit';

function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/account';
}

export const load: PageServerLoad = ({ locals, url }) => {
  if (locals.user) redirect(303, safeNext(url.searchParams.get('next')));
  return { next: safeNext(url.searchParams.get('next')) };
};

export const actions: Actions = {
  default: async ({ request, cookies, url }) => {
    const data = await request.formData();
    const email = String(data.get('email') || '').trim().toLowerCase();
    const password = String(data.get('password') || '');
    const next = safeNext(String(data.get('next') || url.searchParams.get('next') || ''));

    if (
      !consumeRateLimit(clientKey(request, 'login'), {
        capacity: 8,
        refillPerMinute: 1
      })
    ) {
      return fail(429, { error: 'Слишком много попыток. Подождите несколько минут.', email });
    }
    if (!email || !password) return fail(400, { error: 'Введите почту и пароль.', email });

    const user = getUserByEmail(email);
    if (!user || !(await verifyPassword(user.pwd_hash, password))) {
      return fail(400, { error: 'Неверная почта или пароль.', email });
    }
    if (user.status === 'banned') {
      return fail(403, { error: 'Аккаунт заблокирован. Обратитесь в поддержку.', email });
    }

    createSession(user.id, cookies);
    redirect(303, next);
  }
};
