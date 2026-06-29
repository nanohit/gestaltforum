import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { sqlite } from '$lib/server/db';

export const load: PageServerLoad = ({ params, setHeaders }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) error(404, 'Выпуск не найден');
  const volume = sqlite
    .prepare('SELECT id, slug, number, title, published_at FROM volumes WHERE id = ? AND published_at IS NOT NULL')
    .get(id);
  if (!volume) error(404, 'Выпуск не найден');
  const articles = sqlite
    .prepare(`
      SELECT a.id, a.slug, a.title, a.subtitle, a.abstract, a.access, a.published_at,
             GROUP_CONCAT(TRIM(u.first_name || ' ' || u.last_name), ', ') AS authors
      FROM articles a
      LEFT JOIN article_authors aa ON aa.article_id = a.id
      LEFT JOIN users u ON u.id = aa.user_id
      WHERE a.volume_id = ? AND a.status = 'published'
      GROUP BY a.id
      ORDER BY a.published_at, a.id
    `)
    .all(id);
  setHeaders({ 'cache-control': 'public, max-age=300' });
  return { volume, articles };
};
