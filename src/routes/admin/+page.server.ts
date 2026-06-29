import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { z } from 'zod';
import { sqlite } from '$lib/server/db';
import {
  ADMIN_ROLES,
  CONTENT_ROLES,
  MODERATION_ROLES,
  requireRole
} from '$lib/server/permissions';
import { articleCache, publicHtmlCache } from '$lib/server/cache';
import { createBackup, listBackups } from '$lib/server/backup';
import { ROLES } from '$lib/types';

export const load: PageServerLoad = ({ locals }) => {
  const adminUser = requireRole(locals.user, ADMIN_ROLES);
  const stats = {
    users: (sqlite.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }).count,
    published: (
      sqlite.prepare("SELECT COUNT(*) AS count FROM articles WHERE status = 'published'").get() as {
        count: number;
      }
    ).count,
    pending: (
      sqlite.prepare("SELECT COUNT(*) AS count FROM comments WHERE status = 'pending'").get() as {
        count: number;
      }
    ).count,
    tickets: (
      sqlite.prepare("SELECT COUNT(*) AS count FROM support_tickets WHERE status != 'closed'").get() as {
        count: number;
      }
    ).count
  };
  const articles = sqlite
    .prepare(`
      SELECT a.id, a.slug, a.title, a.status, a.access, a.comments_enabled,
             a.updated_at, v.number AS volume_number
      FROM articles a LEFT JOIN volumes v ON v.id = a.volume_id
      ORDER BY a.updated_at DESC
    `)
    .all();
  const volumes = sqlite.prepare('SELECT * FROM volumes ORDER BY number DESC').all();
  const comments = sqlite
    .prepare(`
      SELECT c.*, u.first_name, u.last_name,
             CASE WHEN c.target = 'article' THEN a.title ELSE t.title END AS target_title
      FROM comments c
      JOIN users u ON u.id = c.user_id
      LEFT JOIN articles a ON c.target = 'article' AND a.id = c.target_id
      LEFT JOIN threads t ON c.target = 'thread' AND t.id = c.target_id
      WHERE c.status = 'pending' OR c.reported_at IS NOT NULL
      ORDER BY c.reported_at DESC, c.created_at
      LIMIT 200
    `)
    .all();
  const users = sqlite
    .prepare(`
      SELECT u.id, u.email, u.phone, u.first_name, u.last_name, u.role, u.status,
             u.muted_until, u.created_at,
             MAX(e.ends_at) AS entitlement_end
      FROM users u LEFT JOIN entitlements e ON e.user_id = u.id
      GROUP BY u.id ORDER BY u.created_at DESC LIMIT 500
    `)
    .all();
  const tickets = sqlite
    .prepare(`
      SELECT s.*, u.email, u.first_name, u.last_name
      FROM support_tickets s JOIN users u ON u.id = s.user_id
      ORDER BY CASE s.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, s.created_at DESC
    `)
    .all();
  const subscriptions = sqlite
    .prepare(`
      SELECT s.*, u.email, u.first_name, u.last_name, p.title AS plan_title
      FROM subscriptions s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN plans p ON p.id = s.plan_id
      ORDER BY s.id DESC
      LIMIT 500
    `)
    .all();
  const pages = sqlite.prepare('SELECT * FROM pages ORDER BY id').all();
  const blocks = sqlite.prepare('SELECT * FROM blocks ORDER BY page_id, position, id').all();
  const settings = sqlite.prepare('SELECT * FROM settings ORDER BY key').all();
  return {
    adminUser,
    stats,
    articles,
    volumes,
    comments,
    users,
    subscriptions,
    tickets,
    pages,
    blocks,
    settings,
    backups: listBackups(),
    roles: ROLES
  };
};

const volumeSchema = z.object({
  id: z.coerce.number().int().nonnegative(),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(100),
  number: z.coerce.number().int().positive(),
  title: z.string().trim().min(2).max(200),
  publishedAt: z.string().trim().max(40)
});

export const actions: Actions = {
  articleState: async ({ request, locals }) => {
    requireRole(locals.user, CONTENT_ROLES);
    const data = await request.formData();
    const id = Number(data.get('id'));
    const status = String(data.get('status'));
    if (!Number.isInteger(id) || !['draft', 'review', 'published', 'archived'].includes(status)) {
      return fail(400, { error: 'Некорректный материал' });
    }
    sqlite
      .prepare(`
        UPDATE articles SET status = ?,
          published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, datetime('now')) ELSE published_at END,
          updated_at = datetime('now')
        WHERE id = ?
      `)
      .run(status, status, id);
    articleCache.clear();
    publicHtmlCache.clear();
    return { success: true };
  },
  toggleComments: async ({ request, locals }) => {
    requireRole(locals.user, CONTENT_ROLES);
    const data = await request.formData();
    const id = Number(data.get('id'));
    sqlite
      .prepare('UPDATE articles SET comments_enabled = NOT comments_enabled, updated_at = datetime(\'now\') WHERE id = ?')
      .run(id);
    articleCache.clear();
    publicHtmlCache.clear();
    return { success: true };
  },
  volume: async ({ request, locals }) => {
    requireRole(locals.user, CONTENT_ROLES);
    const data = await request.formData();
    const parsed = volumeSchema.safeParse({
      id: data.get('id') || 0,
      slug: data.get('slug'),
      number: data.get('number'),
      title: data.get('title'),
      publishedAt: data.get('publishedAt') || ''
    });
    if (!parsed.success) return fail(400, { error: 'Проверьте данные выпуска.' });
    try {
      if (parsed.data.id) {
        sqlite
          .prepare('UPDATE volumes SET slug = ?, number = ?, title = ?, published_at = ? WHERE id = ?')
          .run(
            parsed.data.slug,
            parsed.data.number,
            parsed.data.title,
            parsed.data.publishedAt || null,
            parsed.data.id
          );
      } else {
        sqlite
          .prepare('INSERT INTO volumes (slug, number, title, published_at) VALUES (?, ?, ?, ?)')
          .run(
            parsed.data.slug,
            parsed.data.number,
            parsed.data.title,
            parsed.data.publishedAt || null
          );
      }
    } catch {
      return fail(409, { error: 'Номер или slug выпуска уже занят.' });
    }
    return { success: true };
  },
  deleteVolume: async ({ request, locals }) => {
    requireRole(locals.user, CONTENT_ROLES);
    const data = await request.formData();
    sqlite.prepare('DELETE FROM volumes WHERE id = ?').run(Number(data.get('id')));
    return { success: true };
  },
  moderate: async ({ request, locals }) => {
    requireRole(locals.user, MODERATION_ROLES);
    const data = await request.formData();
    const id = Number(data.get('id'));
    const status = String(data.get('status'));
    if (!['approved', 'rejected'].includes(status)) return fail(400, { error: 'Некорректный статус' });
    sqlite
      .prepare('UPDATE comments SET status = ?, reported_at = NULL WHERE id = ?')
      .run(status, id);
    return { success: true };
  },
  user: async ({ request, locals }) => {
    requireRole(locals.user, ['admin', 'chief_editor']);
    const data = await request.formData();
    const id = Number(data.get('id'));
    const role = String(data.get('role'));
    const status = String(data.get('status'));
    const mutedUntil = String(data.get('mutedUntil') || '');
    if (!ROLES.includes(role as (typeof ROLES)[number]) || !['active', 'banned'].includes(status)) {
      return fail(400, { error: 'Некорректные права' });
    }
    if (id === locals.user!.id && (status === 'banned' || role !== locals.user!.role)) {
      return fail(400, { error: 'Нельзя заблокировать себя или снять собственную роль.' });
    }
    sqlite
      .prepare('UPDATE users SET role = ?, status = ?, muted_until = ? WHERE id = ?')
      .run(role, status, mutedUntil || null, id);
    if (status === 'banned') sqlite.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    return { success: true };
  },
  grant: async ({ request, locals }) => {
    requireRole(locals.user, ['admin', 'chief_editor']);
    const data = await request.formData();
    const userId = Number(data.get('userId'));
    const endsAt = String(data.get('endsAt') || '');
    const type = String(data.get('type') || 'manual');
    if (!Number.isInteger(userId) || !['manual', 'grant'].includes(type) || !endsAt) {
      return fail(400, { error: 'Проверьте параметры доступа.' });
    }
    const parsedEnd = new Date(endsAt);
    if (Number.isNaN(parsedEnd.getTime())) {
      return fail(400, { error: 'Некорректная дата окончания доступа.' });
    }
    sqlite
      .prepare(`
        INSERT INTO entitlements (user_id, type, starts_at, ends_at, source)
        VALUES (?, ?, datetime('now'), ?, ?)
      `)
      .run(userId, type, parsedEnd.toISOString(), `admin:${locals.user!.id}`);
    return { success: true };
  },
  subscription: async ({ request, locals }) => {
    requireRole(locals.user, ['admin', 'chief_editor']);
    const data = await request.formData();
    const id = Number(data.get('id'));
    const status = String(data.get('status') || '').trim().slice(0, 40);
    const periodEnd = String(data.get('periodEnd') || '').trim();
    if (!Number.isInteger(id) || !status) {
      return fail(400, { error: 'Проверьте подписку.' });
    }
    const parsedEnd = periodEnd ? new Date(periodEnd) : null;
    if (parsedEnd && Number.isNaN(parsedEnd.getTime())) {
      return fail(400, { error: 'Некорректная дата подписки.' });
    }
    sqlite
      .prepare('UPDATE subscriptions SET status = ?, period_end = ? WHERE id = ?')
      .run(status, parsedEnd?.toISOString() ?? null, id);
    return { success: true };
  },
  ticket: async ({ request, locals }) => {
    requireRole(locals.user, ADMIN_ROLES);
    const data = await request.formData();
    const id = Number(data.get('id'));
    const status = String(data.get('status'));
    if (!['open', 'in_progress', 'closed'].includes(status)) return fail(400, { error: 'Статус неверен' });
    sqlite.prepare('UPDATE support_tickets SET status = ? WHERE id = ?').run(status, id);
    return { success: true };
  },
  block: async ({ request, locals }) => {
    requireRole(locals.user, CONTENT_ROLES);
    const data = await request.formData();
    const id = Number(data.get('id') || 0);
    const pageId = Number(data.get('pageId'));
    const type = String(data.get('type') || '').trim();
    const payload = String(data.get('payload') || '{}');
    const position = Number(data.get('position') || 0);
    try {
      JSON.parse(payload);
    } catch {
      return fail(400, { error: 'Payload блока должен быть корректным JSON.' });
    }
    if (!pageId || !type) return fail(400, { error: 'Страница и тип обязательны.' });
    if (id) {
      sqlite
        .prepare('UPDATE blocks SET page_id = ?, type = ?, payload_json = ?, position = ? WHERE id = ?')
        .run(pageId, type, payload, position, id);
    } else {
      sqlite
        .prepare('INSERT INTO blocks (page_id, type, payload_json, position) VALUES (?, ?, ?, ?)')
        .run(pageId, type, payload, position);
    }
    return { success: true };
  },
  page: async ({ request, locals }) => {
    requireRole(locals.user, CONTENT_ROLES);
    const data = await request.formData();
    const id = Number(data.get('id'));
    const title = String(data.get('title') || '').trim();
    if (!Number.isInteger(id) || title.length < 2) {
      return fail(400, { error: 'Проверьте страницу.' });
    }
    sqlite.prepare('UPDATE pages SET title = ? WHERE id = ?').run(title, id);
    return { success: true };
  },
  deleteBlock: async ({ request, locals }) => {
    requireRole(locals.user, CONTENT_ROLES);
    const data = await request.formData();
    sqlite.prepare('DELETE FROM blocks WHERE id = ?').run(Number(data.get('id')));
    return { success: true };
  },
  setting: async ({ request, locals }) => {
    requireRole(locals.user, ['admin', 'chief_editor']);
    const data = await request.formData();
    const key = String(data.get('key') || '').trim();
    const value = String(data.get('value') || '').trim();
    if (!/^[a-z0-9_]+$/.test(key)) return fail(400, { error: 'Некорректный ключ настройки.' });
    sqlite
      .prepare(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
      `)
      .run(key, value);
    return { success: true };
  },
  backup: async ({ locals }) => {
    requireRole(locals.user, ['admin', 'chief_editor']);
    const name = await createBackup();
    return { success: true, backupName: name };
  }
};
