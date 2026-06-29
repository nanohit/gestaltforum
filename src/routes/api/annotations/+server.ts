import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { sqlite } from '$lib/server/db';
import { assertSameOrigin, readJson } from '$lib/server/http';
import { consumeRateLimit } from '$lib/server/rate-limit';
import { canReadArticle } from '$lib/server/access';

const annotationSchema = z.object({
  articleId: z.number().int().positive(),
  paragraphId: z.string().trim().min(1).max(120),
  type: z.enum(['highlight', 'underline', 'note']),
  quote: z.string().trim().min(2).max(1200),
  prefix: z.string().max(80).default(''),
  suffix: z.string().max(80).default(''),
  startOff: z.number().int().nonnegative(),
  endOff: z.number().int().positive(),
  note: z.string().trim().max(2000).default(''),
  color: z.string().trim().max(30).default('yellow')
});

export const GET: RequestHandler = ({ url, locals }) => {
  if (!locals.user) error(401, 'Требуется вход');
  const articleId = Number(url.searchParams.get('articleId'));
  if (!Number.isInteger(articleId) || articleId <= 0) error(400, 'Некорректный материал');
  const annotations = sqlite
    .prepare(`
      SELECT id, article_id, paragraph_id, type, quote, prefix, suffix,
             start_off, end_off, note, color, created_at
      FROM annotations WHERE user_id = ? AND article_id = ? ORDER BY created_at
    `)
    .all(locals.user.id, articleId);
  return json({ annotations });
};

export const POST: RequestHandler = async ({ request, url, locals }) => {
  if (!locals.user) error(401, 'Требуется вход');
  assertSameOrigin(request, url);
  if (!consumeRateLimit(`annotation:${locals.user.id}`, { capacity: 30, refillPerMinute: 20 })) {
    error(429, 'Слишком много запросов');
  }
  const parsed = annotationSchema.safeParse(await readJson<unknown>(request));
  if (!parsed.success) error(400, parsed.error.issues[0]?.message || 'Некорректные данные');
  if (parsed.data.endOff <= parsed.data.startOff) error(400, 'Некорректный диапазон');
  const article = sqlite
    .prepare('SELECT id, status, access FROM articles WHERE id = ?')
    .get(parsed.data.articleId) as
    | { id: number; status: string; access: string }
    | undefined;
  if (!article || !canReadArticle(article, locals.user)) error(404, 'Материал не найден');

  const result = sqlite
    .prepare(`
      INSERT INTO annotations
        (user_id, article_id, paragraph_id, type, quote, prefix, suffix,
         start_off, end_off, note, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      locals.user.id,
      parsed.data.articleId,
      parsed.data.paragraphId,
      parsed.data.type,
      parsed.data.quote,
      parsed.data.prefix,
      parsed.data.suffix,
      parsed.data.startOff,
      parsed.data.endOff,
      parsed.data.note,
      parsed.data.color
    );
  const annotation = sqlite
    .prepare(`
      SELECT id, article_id, paragraph_id, type, quote, prefix, suffix,
             start_off, end_off, note, color, created_at
      FROM annotations WHERE id = ?
    `)
    .get(result.lastInsertRowid);
  return json({ ok: true, annotation }, { status: 201 });
};

export const DELETE: RequestHandler = async ({ request, url, locals }) => {
  if (!locals.user) error(401, 'Требуется вход');
  assertSameOrigin(request, url);
  const body = await readJson<{ id?: number }>(request);
  if (!Number.isInteger(body.id)) error(400, 'Некорректный идентификатор');
  const result = sqlite
    .prepare('DELETE FROM annotations WHERE id = ? AND user_id = ?')
    .run(body.id, locals.user.id);
  if (!result.changes) error(404, 'Пометка не найдена');
  return json({ ok: true });
};
