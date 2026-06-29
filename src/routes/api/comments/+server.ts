import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { sqlite } from '$lib/server/db';
import { assertSameOrigin, readJson } from '$lib/server/http';
import { consumeRateLimit } from '$lib/server/rate-limit';
import { isMuted } from '$lib/server/auth';
import { canReadArticle } from '$lib/server/access';

const schema = z.object({
  target: z.enum(['article', 'thread']),
  targetId: z.number().int().positive(),
  parentId: z.number().int().positive().nullable().optional(),
  body: z.string().trim().min(2).max(3000)
});

export const POST: RequestHandler = async ({ request, url, locals }) => {
  if (!locals.user) error(401, 'Требуется вход');
  if (isMuted(locals.user)) error(403, 'Возможность писать временно ограничена');
  assertSameOrigin(request, url);
  if (!consumeRateLimit(`comment:${locals.user.id}`, { capacity: 6, refillPerMinute: 1 })) {
    error(429, 'Слишком много сообщений. Немного подождите.');
  }
  const parsed = schema.safeParse(await readJson<unknown>(request));
  if (!parsed.success) error(400, parsed.error.issues[0]?.message || 'Некорректные данные');

  if (parsed.data.target === 'article') {
    const article = sqlite
      .prepare('SELECT comments_enabled, status, access FROM articles WHERE id = ?')
      .get(parsed.data.targetId) as
      | { comments_enabled: number; status: string; access: string }
      | undefined;
    if (!article || !canReadArticle(article, locals.user)) error(404, 'Материал не найден');
    if (!article.comments_enabled) error(403, 'Комментарии к материалу закрыты');
  } else if (!sqlite.prepare('SELECT 1 FROM threads WHERE id = ?').get(parsed.data.targetId)) {
    error(404, 'Тема не найдена');
  }

  const autoApprove = ['admin', 'chief_editor', 'editor', 'moderator'].includes(locals.user.role);
  const status = autoApprove ? 'approved' : 'pending';
  const result = sqlite
    .prepare(`
      INSERT INTO comments (target, target_id, user_id, parent_id, body, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(
      parsed.data.target,
      parsed.data.targetId,
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
      message: autoApprove ? 'Комментарий опубликован' : 'Комментарий отправлен на модерацию'
    },
    { status: 201 }
  );
};
