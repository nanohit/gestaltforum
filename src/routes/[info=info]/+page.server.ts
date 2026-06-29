import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { sqlite } from '$lib/server/db';
import { parsePageBlock } from '$lib/server/content';

export const load: PageServerLoad = ({ params, setHeaders }) => {
  const page = sqlite.prepare('SELECT id, slug, title FROM pages WHERE slug = ?').get(params.info) as
    | { id: number; slug: string; title: string }
    | undefined;
  if (!page) error(404, 'Страница не найдена');
  const rows = sqlite
    .prepare('SELECT id, type, payload_json, position FROM blocks WHERE page_id = ? ORDER BY position, id')
    .all(page.id) as Array<{ id: number; type: string; payload_json: string; position: number }>;
  setHeaders({ 'cache-control': 'public, max-age=120' });
  return { page, blocks: rows.map(parsePageBlock) };
};
