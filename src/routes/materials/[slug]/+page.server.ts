import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { sqlite } from '$lib/server/db';
import { canReadArticle } from '$lib/server/access';
import { parseArticleBody } from '$lib/server/content';
import { articleCache } from '$lib/server/cache';

type ArticleRow = {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  abstract: string;
  body_json: string;
  body_text: string;
  status: string;
  access: string;
  comments_enabled: number;
  published_at: string | null;
  updated_at: string;
  volume_id: number | null;
  volume_number: number | null;
  volume_title: string | null;
  authors: string | null;
};

export const load: PageServerLoad = ({ params, locals, setHeaders }) => {
  const cacheKey = `article:${params.slug}`;
  let article = articleCache.get(cacheKey) as ArticleRow | undefined;
  if (!article) {
    article = sqlite
      .prepare(`
        SELECT a.*, v.number AS volume_number, v.title AS volume_title,
               GROUP_CONCAT(TRIM(u.first_name || ' ' || u.last_name), ', ') AS authors
        FROM articles a
        LEFT JOIN volumes v ON v.id = a.volume_id
        LEFT JOIN article_authors aa ON aa.article_id = a.id
        LEFT JOIN users u ON u.id = aa.user_id
        WHERE a.slug = ?
        GROUP BY a.id
      `)
      .get(params.slug) as ArticleRow | undefined;
    if (article) articleCache.set(cacheKey, article);
  }
  if (!article) error(404, 'Материал не найден');

  const readable = canReadArticle(article, locals.user);
  if (article.status !== 'published' && !readable) error(404, 'Материал не найден');

  const annotations = locals.user && readable
    ? sqlite
        .prepare(`
          SELECT id, article_id, paragraph_id, type, quote, prefix, suffix,
                 start_off, end_off, note, color, created_at
          FROM annotations
          WHERE user_id = ? AND article_id = ?
          ORDER BY created_at
        `)
        .all(locals.user.id, article.id)
    : [];

  const favorites = locals.user
    ? (sqlite
        .prepare('SELECT kind FROM favorites WHERE user_id = ? AND article_id = ?')
        .all(locals.user.id, article.id) as Array<{ kind: string }>).map((row) => row.kind)
    : [];

  const comments = article.comments_enabled
    ? sqlite
        .prepare(`
          SELECT c.id, c.body, c.parent_id, c.created_at,
                 u.first_name, u.last_name, u.role
          FROM comments c
          JOIN users u ON u.id = c.user_id
          WHERE c.target = 'article' AND c.target_id = ? AND c.status = 'approved'
          ORDER BY c.created_at
        `)
        .all(article.id)
    : [];

  if (article.status === 'published' && article.access === 'public' && !locals.user) {
    setHeaders({
      'cache-control': 'public, max-age=0, s-maxage=120, stale-while-revalidate=600',
      'x-gestalt-cacheable': '1'
    });
  } else {
    setHeaders({ 'cache-control': 'private, no-store' });
  }

  return {
    article: {
      ...article,
      body_json: undefined,
      body_text: undefined,
      blocks: readable ? parseArticleBody(article.body_json) : []
    },
    locked: !readable,
    annotations,
    favorites,
    comments
  };
};
