import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clearSession, SESSION_COOKIE } from '$lib/server/auth';

export const POST: RequestHandler = ({ cookies }) => {
  clearSession(cookies, cookies.get(SESSION_COOKIE));
  redirect(303, '/');
};
