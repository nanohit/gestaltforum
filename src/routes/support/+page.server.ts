import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { z } from 'zod';
import { requireUser } from '$lib/server/permissions';
import { sqlite } from '$lib/server/db';
import { consumeRateLimit } from '$lib/server/rate-limit';

export const load: PageServerLoad = ({ locals, url }) => {
  requireUser(locals.user, `/support${url.search}`);
  return { subject: (url.searchParams.get('subject') || '').slice(0, 160) };
};

const ticketSchema = z.object({
  subject: z.string().trim().min(3, 'Опишите тему').max(160),
  body: z.string().trim().min(10, 'Расскажите чуть подробнее').max(5000)
});

export const actions: Actions = {
  default: async ({ request, locals }) => {
    const user = requireUser(locals.user);
    if (!consumeRateLimit(`support:${user.id}`, { capacity: 3, refillPerMinute: 0.1 })) {
      return fail(429, { error: 'Слишком много обращений. Попробуйте позже.' });
    }
    const data = await request.formData();
    const values = {
      subject: String(data.get('subject') || ''),
      body: String(data.get('body') || '')
    };
    const parsed = ticketSchema.safeParse(values);
    if (!parsed.success) {
      return fail(400, { error: parsed.error.issues[0]?.message, values });
    }
    const result = sqlite
      .prepare('INSERT INTO support_tickets (user_id, subject, body) VALUES (?, ?, ?)')
      .run(user.id, parsed.data.subject, parsed.data.body);
    return { success: true, ticketId: Number(result.lastInsertRowid) };
  }
};
