import { sqlite } from '$lib/server/db';
import type { PublicUser } from '$lib/server/auth';
import { CONTENT_ROLES } from '$lib/server/permissions';

const activeEntitlement = sqlite.prepare(`
  SELECT 1 FROM entitlements
  WHERE user_id = ?
    AND datetime(starts_at) <= datetime('now')
    AND datetime(ends_at) >= datetime('now')
  LIMIT 1
`);

export function hasActiveEntitlement(userId: number): boolean {
  return Boolean(activeEntitlement.get(userId));
}

export function canReadArticle(
  article: { status: string; access: string },
  user: PublicUser | null
): boolean {
  if (user && CONTENT_ROLES.includes(user.role)) return true;
  if (article.status !== 'published') return false;
  if (article.access === 'public') return true;
  return Boolean(user && hasActiveEntitlement(user.id));
}
