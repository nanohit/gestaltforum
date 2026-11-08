import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { z } from 'zod';
import { sqlite } from '$lib/server/db';
import { CONTENT_ROLES, requireRole } from '$lib/server/permissions';
import { articleBodyText, parseArticleBody } from '$lib/server/content';
import { articleCache, publicHtmlCache } from '$lib/server/cache';

const articleSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9-]+$/, 'Slug: латиница, цифры и дефисы').max(120),
  volumeId: z.coerce.number().int().nonnegative(),
  title: z.string().trim().min(3).max(300),
  subtitle: z.string().trim().max(500),
  abstract: z.string().trim().min(10).max(3000),
  bodyJson: z.string().min(2).max(500_000),
  status: z.enum(['draft', 'review', 'published', 'archived']),
  access: z.enum(['public', 'subscribers'])
});

export const load: PageServerLoad = ({ params, locals }) => {
  requireRole(locals.user, CONTENT_ROLES);
  const isNew = params.id === 'new';
  const id = isNew ? 0 : Number(params.id);
  if (!isNew && !Number.isInteger(id)) error(404, 'Материал не найден');
  const article = isNew
    ? null
    : sqlite.prepare('SELECT * FROM articles WHERE id = ?').get(id);
  if (!isNew && !article) error(404, 'Материал не найден');
  const selectedAuthors = isNew
    ? [locals.user!.id]
    : (sqlite.prepare('SELECT user_id FROM article_authors WHERE article_id = ?').all(id) as Array<{
        user_id: number;
      }>).map((row) => row.user_id);
  const volumes = sqlite.prepare('SELECT id, number, title FROM volumes ORDER BY number DESC').all();
  const authors = sqlite
    .prepare(`
      SELECT id, first_name, last_name, email, role FROM users
      WHERE status = 'active'
      ORDER BY last_name, first_name
    `)
    .all();
  return { article, isNew, volumes, authors, selectedAuthors };
};

export const actions: Actions = {
  save: async ({ request, params, locals }) => {
    const user = requireRole(locals.user, CONTENT_ROLES);
    const data = await request.formData();
    const parsed = articleSchema.safeParse({
      slug: data.get('slug'),
      volumeId: data.get('volumeId') || 0,
      title: data.get('title'),
      subtitle: data.get('subtitle') || '',
      abstract: data.get('abstract'),
      bodyJson: data.get('bodyJson'),
      status: data.get('status'),
      access: data.get('access')
    });
    if (!parsed.success) {
      return fail(400, { error: parsed.error.issues[0]?.message || 'Проверьте поля.' });
    }
    let bodyJson: string;
    try {
      const blocks = parseArticleBody(parsed.data.bodyJson);
      if (!blocks.length) return fail(400, { error: 'Добавьте текст материала.' });
      bodyJson = JSON.stringify(blocks);
    } catch {
      return fail(400, { error: 'Не удалось прочитать текст материала.' });
    }
    const bodyText = articleBodyText(bodyJson);
    const commentsEnabled = data.get('commentsEnabled') === 'on' ? 1 : 0;
    const authorIds = data
      .getAll('authorIds')
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0);
    if (!authorIds.length) authorIds.push(user.id);
    const isNew = params.id === 'new';
    const existingId = isNew ? 0 : Number(params.id);

    let articleId = existingId;
    try {
      articleId = sqlite.transaction(() => {
        let id = existingId;
        if (isNew) {
          const result = sqlite
            .prepare(`
              INSERT INTO articles
                (slug, volume_id, title, subtitle, abstract, body_json, body_text,
                 status, access, comments_enabled, published_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'published' THEN datetime('now') END, datetime('now'))
            `)
            .run(
              parsed.data.slug,
              parsed.data.volumeId || null,
              parsed.data.title,
              parsed.data.subtitle,
              parsed.data.abstract,
              bodyJson,
              bodyText,
              parsed.data.status,
              parsed.data.access,
              commentsEnabled,
              parsed.data.status
            );
          id = Number(result.lastInsertRowid);
        } else {
          sqlite
            .prepare(`
              UPDATE articles SET
                slug = ?, volume_id = ?, title = ?, subtitle = ?, abstract = ?,
                body_json = ?, body_text = ?, status = ?, access = ?, comments_enabled = ?,
                published_at = CASE
                  WHEN ? = 'published' THEN COALESCE(published_at, datetime('now'))
                  ELSE published_at
                END,
                updated_at = datetime('now')
              WHERE id = ?
            `)
            .run(
              parsed.data.slug,
              parsed.data.volumeId || null,
              parsed.data.title,
              parsed.data.subtitle,
              parsed.data.abstract,
              bodyJson,
              bodyText,
              parsed.data.status,
              parsed.data.access,
              commentsEnabled,
              parsed.data.status,
              id
            );
        }
        sqlite.prepare('DELETE FROM article_authors WHERE article_id = ?').run(id);
        const addAuthor = sqlite.prepare(
          'INSERT OR IGNORE INTO article_authors (article_id, user_id) VALUES (?, ?)'
        );
        for (const authorId of authorIds) addAuthor.run(id, authorId);
        return id;
      })();
      articleCache.clear();
      publicHtmlCache.clear();
    } catch (cause) {
      return fail(409, { error: 'Не удалось сохранить: возможно, slug уже занят.' });
    }
    if (isNew) redirect(303, `/admin/articles/${articleId}?saved=1`);
    return { success: true };
  },
  delete: async ({ params, locals }) => {
    requireRole(locals.user, ['admin', 'chief_editor']);
    const id = Number(params.id);
    if (!Number.isInteger(id)) return fail(400, { error: 'Некорректный материал.' });
    sqlite.prepare('DELETE FROM articles WHERE id = ?').run(id);
    articleCache.clear();
    publicHtmlCache.clear();
    redirect(303, '/admin#articles');
  }
};
