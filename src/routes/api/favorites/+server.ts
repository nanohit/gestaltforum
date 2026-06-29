import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { sqlite } from '$lib/server/db';
import { assertSameOrigin, readJson } from '$lib/server/http';

const schema = z.object({
  articleId: z.number().int().positive(),
  kind: z.enum(['fav', 'read_later'])
});

export const POST: RequestHandler = async ({ request, url, locals }) => {
  if (!locals.user) error(401, 'Требуется вход');
  assertSameOrigin(request, url);
  const parsed = schema.safeParse(await readJson<unknown>(request));
  if (!parsed.success) error(400, 'Некорректные данные');
  if (
    !sqlite
      .prepare("SELECT 1 FROM articles WHERE id = ? AND status = 'published'")
      .get(parsed.data.articleId)
  ) {
    error(404, 'Материал не найден');
  }
  sqlite
    .prepare('INSERT OR IGNORE INTO favorites (user_id, article_id, kind) VALUES (?, ?, ?)')
    .run(locals.user.id, parsed.data.articleId, parsed.data.kind);
  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ request, url, locals }) => {
  if (!locals.user) error(401, 'Требуется вход');
  assertSameOrigin(request, url);
  const parsed = schema.safeParse(await readJson<unknown>(request));
  if (!parsed.success) error(400, 'Некорректные данные');
  sqlite
    .prepare('DELETE FROM favorites WHERE user_id = ? AND article_id = ? AND kind = ?')
    .run(locals.user.id, parsed.data.articleId, parsed.data.kind);
  return json({ ok: true });
};
