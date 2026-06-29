import { error, redirect } from '@sveltejs/kit';
import type { PublicUser } from '$lib/server/auth';
import type { Role } from '$lib/types';

export const ADMIN_ROLES: Role[] = ['admin', 'chief_editor', 'editor', 'moderator'];
export const CONTENT_ROLES: Role[] = ['admin', 'chief_editor', 'editor'];
export const MODERATION_ROLES: Role[] = ['admin', 'chief_editor', 'moderator'];

export function requireUser(user: PublicUser | null, next?: string): PublicUser {
  if (!user) {
    const suffix = next ? `?next=${encodeURIComponent(next)}` : '';
    redirect(303, `/auth/login${suffix}`);
  }
  return user;
}

export function requireRole(user: PublicUser | null, roles: Role[]): PublicUser {
  if (!user) redirect(303, '/auth/login');
  if (!roles.includes(user.role)) error(403, 'Недостаточно прав');
  return user;
}

export function hasRole(user: PublicUser | null, roles: Role[]): boolean {
  return Boolean(user && roles.includes(user.role));
}
