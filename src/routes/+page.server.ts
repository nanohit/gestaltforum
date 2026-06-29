import type { PageServerLoad } from './$types';
import { sqlite } from '$lib/server/db';
import { parsePageBlock } from '$lib/server/content';

export const load: PageServerLoad = ({ setHeaders }) => {
  const page = sqlite.prepare("SELECT id FROM pages WHERE slug = 'home'").get() as { id: number };
  const rows = sqlite
    .prepare('SELECT id, type, payload_json, position FROM blocks WHERE page_id = ? ORDER BY position, id')
    .all(page.id) as Array<{ id: number; type: string; payload_json: string; position: number }>;

  const articles = sqlite
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
      LIMIT 6
    `)
    .all();

  const latestVolume = sqlite
    .prepare(`
      SELECT v.id, v.slug, v.number, v.title, v.published_at, COUNT(a.id) AS article_count
      FROM volumes v
      LEFT JOIN articles a ON a.volume_id = v.id AND a.status = 'published'
      WHERE v.published_at IS NOT NULL
      GROUP BY v.id
      ORDER BY v.number DESC
      LIMIT 1
    `)
    .get();

  setHeaders({ 'cache-control': 'public, max-age=60, stale-while-revalidate=300' });
  return { blocks: rows.map(parsePageBlock), articles, latestVolume };
};
