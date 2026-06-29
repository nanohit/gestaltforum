import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { sqlite } from '$lib/server/db';
import { assertSameOrigin, readJson } from '$lib/server/http';
import { consumeRateLimit } from '$lib/server/rate-limit';
import { isMuted } from '$lib/server/auth';

const postSchema = z.object({
  threadId: z.number().int().positive(),
  body: z.string().trim().min(2).max(3000),
  parentId: z.number().int().positive().optional()
});

export const GET: RequestHandler = ({ url, locals }) => {
  const threadId = Number(url.searchParams.get('threadId'));
  if (!Number.isInteger(threadId)) error(400, 'Некорректная тема');
  const posts = sqlite
    .prepare(`
      SELECT c.id, c.body, c.parent_id, c.status, c.created_at,
             u.first_name, u.last_name, u.role
      FROM comments c JOIN users u ON u.id = c.user_id
      WHERE c.target = 'thread' AND c.target_id = ?
        AND (c.status = 'approved' OR c.user_id = ?)
      ORDER BY c.created_at
    `)
    .all(threadId, locals.user?.id ?? -1);
  return json({ posts });
};

export const POST: RequestHandler = async ({ request, url, locals }) => {
  if (!locals.user) error(401, 'Требуется вход');
  if (isMuted(locals.user)) error(403, 'Возможность писать временно ограничена');
  assertSameOrigin(request, url);
  if (!consumeRateLimit(`lounge-post:${locals.user.id}`, { capacity: 6, refillPerMinute: 1 })) {
    error(429, 'Слишком много сообщений. Немного подождите.');
  }
  const parsed = postSchema.safeParse(await readJson<unknown>(request));
  if (!parsed.success) error(400, parsed.error.issues[0]?.message || 'Некорректные данные');
  if (!sqlite.prepare('SELECT 1 FROM threads WHERE id = ?').get(parsed.data.threadId)) {
    error(404, 'Тема не найдена');
  }
  const autoApprove = ['admin', 'chief_editor', 'editor', 'moderator'].includes(locals.user.role);
  const status = autoApprove ? 'approved' : 'pending';
  const result = sqlite
    .prepare(`
      INSERT INTO comments (target, target_id, user_id, parent_id, body, status)
      VALUES ('thread', ?, ?, ?, ?, ?)
    `)
    .run(
      parsed.data.threadId,
      locals.user.id,
      parsed.data.parentId ?? null,
      parsed.data.body,
      status
    );
  return json(
    {
      ok: true,
      id: Number(result.lastInsertRowid),
      status,
      message: autoApprove ? 'Сообщение опубликовано' : 'Сообщение отправлено на модерацию'
    },
    { status: 201 }
  );
};

export const PATCH: RequestHandler = async ({ request, url, locals }) => {
  if (!locals.user) error(401, 'Требуется вход');
  assertSameOrigin(request, url);
  if (!consumeRateLimit(`report:${locals.user.id}`, { capacity: 5, refillPerMinute: 0.2 })) {
    error(429, 'Слишком много жалоб');
  }
  const body = await readJson<{ id?: number }>(request);
  if (!Number.isInteger(body.id)) error(400, 'Некорректное сообщение');
  const result = sqlite
    .prepare("UPDATE comments SET reported_at = datetime('now') WHERE id = ? AND status = 'approved'")
    .run(body.id);
  if (!result.changes) error(404, 'Сообщение не найдено');
  return json({ ok: true });
};
