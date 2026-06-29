import type { LayoutServerLoad } from './$types';
import { sqlite } from '$lib/server/db';

export const load: LayoutServerLoad = ({ locals }) => {
  const siteName = (
    sqlite.prepare("SELECT value FROM settings WHERE key = 'site_name'").get() as
      | { value: string }
      | undefined
  )?.value;
  return {
    user: locals.user,
    siteName: siteName || 'Gestalt.forum'
  };
};
