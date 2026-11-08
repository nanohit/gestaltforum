import { error, json } from './kit.ts';
export function assertSameOrigin(request: Request, url: URL) {
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) error(403, 'Недопустимый источник запроса');
}
export async function readJson<T>(request: Request): Promise<T> {
  if(!request.headers.get('content-type')?.includes('application/json'))error(415, 'Ожидался JSON');
  try { return await request.json(); } catch { error(400, 'Некорректный JSON'); }
}
export const apiOk = (data: Record<string, unknown> = {}) => json({ ok: true, ...data });
