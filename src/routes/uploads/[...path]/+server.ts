import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { config } from '$lib/server/config';

export const GET: RequestHandler = async ({ params, request }) => {
  const root = resolve(config.uploadsDir);
  const path = resolve(root, params.path);
  if (path !== root && !path.startsWith(`${root}${sep}`)) error(400, 'Некорректный путь');

  let info;
  try {
    info = await stat(path);
  } catch {
    error(404, 'Файл не найден');
  }
  if (!info.isFile()) error(404, 'Файл не найден');
  const etag = `"${createHash('sha1').update(`${info.size}:${info.mtimeMs}`).digest('hex')}"`;
  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: { etag } });
  }
  const body = await readFile(path);
  const extension = path.split('.').pop()?.toLowerCase();
  const contentType =
    extension === 'webp'
      ? 'image/webp'
      : extension === 'png'
        ? 'image/png'
        : extension === 'jpg' || extension === 'jpeg'
          ? 'image/jpeg'
          : 'application/octet-stream';
  return new Response(new Uint8Array(body), {
    headers: {
      'content-type': contentType,
      'content-length': String(body.length),
      'cache-control': 'public, max-age=31536000, immutable',
      etag
    }
  });
};
