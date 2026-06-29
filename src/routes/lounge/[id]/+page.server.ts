import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { sqlite } from '$lib/server/db';

export const load: PageServerLoad = ({ params, locals }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) error(404, 'Тема не найдена');
  const thread = sqlite
    .prepare(`
      SELECT t.id, t.title, t.created_at, u.first_name, u.last_name
      FROM threads t JOIN users u ON u.id = t.user_id WHERE t.id = ?
    `)
    .get(id);
  if (!thread) error(404, 'Тема не найдена');
  const posts = sqlite
    .prepare(`
      SELECT c.id, c.body, c.parent_id, c.status, c.created_at,
             u.first_name, u.last_name, u.role
      FROM comments c JOIN users u ON u.id = c.user_id
      WHERE c.target = 'thread' AND c.target_id = ?
        AND (c.status = 'approved' OR c.user_id = ?)
      ORDER BY c.created_at
    `)
    .all(id, locals.user?.id ?? -1);
  const pollSetting = sqlite
    .prepare("SELECT value FROM settings WHERE key = 'lounge_poll_seconds'")
    .get() as { value: string } | undefined;
  return {
    thread,
    posts,
    pollSeconds: Math.max(10, Number(pollSetting?.value || 20)),
    isAuthenticated: Boolean(locals.user)
  };
};
