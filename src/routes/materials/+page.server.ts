import type { PageServerLoad } from './$types';
import { sqlite } from '$lib/server/db';

function ftsExpression(query: string): string {
  const russianEndings = [
    'иями',
    'ями',
    'ами',
    'ией',
    'ого',
    'ему',
    'ыми',
    'ими',
    'ия',
    'ие',
    'ию',
    'ии',
    'ий',
    'ый',
    'ая',
    'яя',
    'ое',
    'ее',
    'ов',
    'ев',
    'ам',
    'ям',
    'ах',
    'ях',
    'ы',
    'и',
    'а',
    'я',
    'у',
    'ю',
    'е',
    'о'
  ];
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .map((token) => {
      const escaped = token.replaceAll('"', '""');
      const lower = token.toLowerCase();
      const ending = russianEndings.find(
        (candidate) => lower.endsWith(candidate) && lower.length - candidate.length >= 5
      );
      if (!ending) return `"${escaped}"*`;
      const stem = token.slice(0, -ending.length).replaceAll('"', '""');
      return `("${escaped}"* OR "${stem}"*)`;
    })
    .join(' AND ');
}

export const load: PageServerLoad = ({ url, setHeaders }) => {
  const query = (url.searchParams.get('q') || '').trim().slice(0, 120);
  let articles: unknown[];

  if (query) {
    const expression = ftsExpression(query);
    articles = expression
      ? sqlite
          .prepare(`
            SELECT a.id, a.slug, a.title, a.subtitle, a.abstract, a.access, a.published_at,
                   v.number AS volume_number,
                   (
                     SELECT GROUP_CONCAT(TRIM(u.first_name || ' ' || u.last_name), ', ')
                     FROM article_authors aa
                     JOIN users u ON u.id = aa.user_id
                     WHERE aa.article_id = a.id
                   ) AS authors,
                   bm25(articles_fts, 8.0, 3.0, 1.0) AS rank
            FROM articles_fts
            JOIN articles a ON a.id = articles_fts.rowid
            LEFT JOIN volumes v ON v.id = a.volume_id
            WHERE articles_fts MATCH ? AND a.status = 'published'
            ORDER BY rank, a.published_at DESC
            LIMIT 60
          `)
          .all(expression)
      : [];
  } else {
    articles = sqlite
      .prepare(`
        SELECT a.id, a.slug, a.title, a.subtitle, a.abstract, a.access, a.published_at,
               v.number AS volume_number,
               GROUP_CONCAT(TRIM(u.first_name || ' ' || u.last_name), ', ') AS authors
        FROM articles a
        LEFT JOIN volumes v ON v.id = a.volume_id
        LEFT JOIN article_authors aa ON aa.article_id = a.id
        LEFT JOIN users u ON u.id = aa.user_id
        WHERE a.status = 'published'
        GROUP BY a.id
        ORDER BY a.published_at DESC
        LIMIT 60
      `)
      .all();
  }

  setHeaders({ 'cache-control': query ? 'public, max-age=30' : 'public, max-age=120' });
  return { articles, query };
};
