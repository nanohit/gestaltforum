import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { sqlite } from '$lib/server/db';
import { assertSameOrigin, readJson } from '$lib/server/http';
import { consumeRateLimit } from '$lib/server/rate-limit';
import { isMuted } from '$lib/server/auth';

const schema = z.object({
  title: z.string().trim().min(3).max(160),
  body: z.string().trim().min(3).max(3000)
});

export const GET: RequestHandler = () => {
  const threads = sqlite
    .prepare(`
      SELECT t.id, t.title, t.created_at, u.first_name, u.last_name,
             COUNT(CASE WHEN c.status = 'approved' THEN 1 END) AS post_count
      FROM threads t JOIN users u ON u.id = t.user_id
      LEFT JOIN comments c ON c.target = 'thread' AND c.target_id = t.id
      GROUP BY t.id ORDER BY t.created_at DESC LIMIT 100
    `)
    .all();
  return json({ threads });
};

export const POST: RequestHandler = async ({ request, url, locals }) => {
  if (!locals.user) error(401, 'Требуется вход');
  if (isMuted(locals.user)) error(403, 'Возможность писать временно ограничена');
  assertSameOrigin(request, url);
  if (!consumeRateLimit(`thread:${locals.user.id}`, { capacity: 2, refillPerMinute: 0.1 })) {
    error(429, 'Новые темы можно создавать не так часто.');
  }
  const parsed = schema.safeParse(await readJson<unknown>(request));
  if (!parsed.success) error(400, parsed.error.issues[0]?.message || 'Некорректные данные');
  const autoApprove = ['admin', 'chief_editor', 'editor', 'moderator'].includes(locals.user.role);
  const transaction = sqlite.transaction(() => {
    const result = sqlite
      .prepare('INSERT INTO threads (user_id, title) VALUES (?, ?)')
      .run(locals.user!.id, parsed.data.title);
    const threadId = Number(result.lastInsertRowid);
    sqlite
      .prepare(`
        INSERT INTO comments (target, target_id, user_id, body, status)
        VALUES ('thread', ?, ?, ?, ?)
      `)
      .run(threadId, locals.user!.id, parsed.data.body, autoApprove ? 'approved' : 'pending');
    return threadId;
  });
  return json({ ok: true, threadId: transaction() }, { status: 201 });
};
