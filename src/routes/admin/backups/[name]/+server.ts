import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from '$lib/server/config';
import { isSafeBackupName } from '$lib/server/backup';
import { requireRole } from '$lib/server/permissions';

export const GET: RequestHandler = async ({ params, locals }) => {
  requireRole(locals.user, ['admin', 'chief_editor']);
  if (!isSafeBackupName(params.name)) error(400, 'Некорректное имя копии');
  let body: Buffer;
  try {
    body = await readFile(join(config.backupsDir, params.name));
  } catch {
    error(404, 'Копия не найдена');
  }
  return new Response(new Uint8Array(body), {
    headers: {
      'content-type': 'application/gzip',
      'content-length': String(body.length),
      'content-disposition': `attachment; filename="${params.name}"`,
      'cache-control': 'private, no-store'
    }
  });
};
