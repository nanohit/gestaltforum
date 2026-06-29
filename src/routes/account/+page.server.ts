import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { z } from 'zod';
import { sqlite } from '$lib/server/db';
import { requireUser } from '$lib/server/permissions';
import { hashPassword, verifyPassword } from '$lib/server/auth';
import { config } from '$lib/server/config';

export const load: PageServerLoad = ({ locals, url }) => {
  const user = requireUser(locals.user, '/account');
  const profile = sqlite
    .prepare(`
      SELECT id, email, phone, first_name, last_name, role, created_at
      FROM users WHERE id = ?
    `)
    .get(user.id);
  const subscriptions = sqlite
    .prepare(`
      SELECT s.*, p.title AS plan_title, p.code AS plan_code
      FROM subscriptions s
      LEFT JOIN plans p ON p.id = s.plan_id
      WHERE s.user_id = ?
      ORDER BY s.id DESC
    `)
    .all(user.id);
  const entitlements = sqlite
    .prepare(`
      SELECT * FROM entitlements WHERE user_id = ? ORDER BY ends_at DESC
    `)
    .all(user.id);
  const favorites = sqlite
    .prepare(`
      SELECT f.id, f.kind, f.created_at, a.slug, a.title, a.abstract
      FROM favorites f JOIN articles a ON a.id = f.article_id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .all(user.id);
  const annotations = sqlite
    .prepare(`
      SELECT n.id, n.type, n.quote, n.note, n.created_at, a.slug, a.title
      FROM annotations n JOIN articles a ON a.id = n.article_id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT 100
    `)
    .all(user.id);
  const payments = sqlite
    .prepare('SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 100')
    .all(user.id);
  const plans = sqlite.prepare('SELECT * FROM plans ORDER BY amount').all();
  const tickets = sqlite
    .prepare('SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC')
    .all(user.id);
  return {
    profile,
    subscriptions,
    entitlements,
    favorites,
    annotations,
    payments,
    plans,
    tickets,
    welcome: url.searchParams.get('welcome') === '1',
    cloudPaymentsPublicId: config.cloudPaymentsPublicId
  };
};

const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(7).max(30)
});

export const actions: Actions = {
  profile: async ({ request, locals }) => {
    const user = requireUser(locals.user);
    const data = await request.formData();
    const parsed = profileSchema.safeParse({
      firstName: String(data.get('firstName') || ''),
      lastName: String(data.get('lastName') || ''),
      phone: String(data.get('phone') || '')
    });
    if (!parsed.success) return fail(400, { profileError: 'Проверьте имя и телефон.' });
    sqlite
      .prepare('UPDATE users SET first_name = ?, last_name = ?, phone = ? WHERE id = ?')
      .run(parsed.data.firstName, parsed.data.lastName, parsed.data.phone, user.id);
    return { profileSuccess: true };
  },
  password: async ({ request, locals }) => {
    const user = requireUser(locals.user);
    const data = await request.formData();
    const currentPassword = String(data.get('currentPassword') || '');
    const newPassword = String(data.get('newPassword') || '');
    if (newPassword.length < 10) return fail(400, { passwordError: 'Новый пароль слишком короткий.' });
    const row = sqlite.prepare('SELECT pwd_hash FROM users WHERE id = ?').get(user.id) as {
      pwd_hash: string;
    };
    if (!(await verifyPassword(row.pwd_hash, currentPassword))) {
      return fail(400, { passwordError: 'Текущий пароль неверен.' });
    }
    sqlite.prepare('UPDATE users SET pwd_hash = ? WHERE id = ?').run(await hashPassword(newPassword), user.id);
    sqlite.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').run(user.id, locals.sessionId);
    return { passwordSuccess: true };
  }
};
