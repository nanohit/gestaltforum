import type { PageServerLoad } from './$types';
import { sqlite } from '$lib/server/db';

export const load: PageServerLoad = ({ locals }) => {
  const threads = sqlite
    .prepare(`
      SELECT t.id, t.title, t.created_at,
             u.first_name, u.last_name,
             COUNT(CASE WHEN c.status = 'approved' THEN 1 END) AS post_count,
             MAX(CASE WHEN c.status = 'approved' THEN c.created_at END) AS last_post_at
      FROM threads t
      JOIN users u ON u.id = t.user_id
      LEFT JOIN comments c ON c.target = 'thread' AND c.target_id = t.id
      GROUP BY t.id
      ORDER BY COALESCE(last_post_at, t.created_at) DESC
      LIMIT 100
    `)
    .all();
  return { threads, isAuthenticated: Boolean(locals.user) };
};
