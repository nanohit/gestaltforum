import type { LayoutServerLoad } from './$types';
import { ADMIN_ROLES, requireRole } from '$lib/server/permissions';

export const load: LayoutServerLoad = ({ locals }) => {
  return { adminUser: requireRole(locals.user, ADMIN_ROLES) };
};
