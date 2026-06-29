import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { sqlite } from '$lib/server/db';
import { assertSameOrigin, readJson } from '$lib/server/http';
import { consumeRateLimit } from '$lib/server/rate-limit';

const schema = z.object({
  subject: z.string().trim().min(3).max(160),
  body: z.string().trim().min(10).max(5000)
});

export const GET: RequestHandler = ({ locals }) => {
  if (!locals.user) error(401, 'Требуется вход');
  const tickets = sqlite
    .prepare(`
      SELECT id, subject, body, status, created_at
      FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC
    `)
    .all(locals.user.id);
  return json({ tickets });
};

export const POST: RequestHandler = async ({ request, url, locals }) => {
  if (!locals.user) error(401, 'Требуется вход');
  assertSameOrigin(request, url);
  if (!consumeRateLimit(`support:${locals.user.id}`, { capacity: 3, refillPerMinute: 0.1 })) {
    error(429, 'Слишком много обращений. Попробуйте позже.');
  }
  const parsed = schema.safeParse(await readJson<unknown>(request));
  if (!parsed.success) error(400, parsed.error.issues[0]?.message || 'Некорректные данные');
  const result = sqlite
    .prepare('INSERT INTO support_tickets (user_id, subject, body) VALUES (?, ?, ?)')
    .run(locals.user.id, parsed.data.subject, parsed.data.body);
  return json({ ok: true, ticketId: Number(result.lastInsertRowid) }, { status: 201 });
};
