import { error, json } from '@sveltejs/kit';

export function assertSameOrigin(request: Request, url: URL): void {
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) error(403, 'Недопустимый источник запроса');
}

export async function readJson<T>(request: Request): Promise<T> {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) error(415, 'Ожидался JSON');
  try {
    return (await request.json()) as T;
  } catch {
    error(400, 'Некорректный JSON');
  }
}

export const apiOk = (data: Record<string, unknown> = {}) => json({ ok: true, ...data });
