import type { PageServerLoad } from './$types';
import { sqlite } from '$lib/server/db';

export const load: PageServerLoad = ({ setHeaders }) => {
  const volumes = sqlite
    .prepare(`
      SELECT v.id, v.slug, v.number, v.title, v.published_at, COUNT(a.id) AS article_count
      FROM volumes v
      LEFT JOIN articles a ON a.volume_id = v.id AND a.status = 'published'
      WHERE v.published_at IS NOT NULL
      GROUP BY v.id
      ORDER BY v.number DESC
    `)
    .all();
  setHeaders({ 'cache-control': 'public, max-age=300' });
  return { volumes };
};
