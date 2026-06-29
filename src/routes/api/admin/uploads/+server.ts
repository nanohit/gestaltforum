import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { config } from '$lib/server/config';
import { CONTENT_ROLES, requireRole } from '$lib/server/permissions';
import { assertSameOrigin } from '$lib/server/http';
import { consumeRateLimit } from '$lib/server/rate-limit';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const POST: RequestHandler = async ({ request, url, locals }) => {
  const user = requireRole(locals.user, CONTENT_ROLES);
  assertSameOrigin(request, url);
  if (!consumeRateLimit(`upload:${user.id}`, { capacity: 10, refillPerMinute: 2 })) {
    error(429, 'Слишком много загрузок');
  }
  const data = await request.formData();
  const file = data.get('image');
  if (!(file instanceof File)) error(400, 'Файл не выбран');
  if (!allowedTypes.has(file.type)) error(415, 'Поддерживаются JPEG, PNG и WebP');
  if (file.size > 10 * 1024 * 1024) error(413, 'Файл больше 10 МБ');

  const buffer = Buffer.from(await file.arrayBuffer());
  let output: Buffer;
  try {
    output = await sharp(buffer, { failOn: 'error', limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
  } catch {
    error(400, 'Не удалось обработать изображение');
  }

  const name = `${Date.now()}-${randomBytes(8).toString('hex')}.webp`;
  await writeFile(join(config.uploadsDir, name), output);
  return json(
    {
      ok: true,
      url: `/uploads/${name}`,
      name,
      originalSize: file.size,
      size: output.length
    },
    { status: 201 }
  );
};
