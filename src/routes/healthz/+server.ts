import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sqlite } from '$lib/server/db';

export const GET: RequestHandler = () => {
  try {
    const result = sqlite.prepare('SELECT 1 AS ok').get() as { ok: number };
    return json({ ok: result.ok === 1, database: 'ready' });
  } catch {
    return json({ ok: false, database: 'unavailable' }, { status: 503 });
  }
};
