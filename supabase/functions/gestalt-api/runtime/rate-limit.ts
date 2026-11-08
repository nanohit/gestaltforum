import { connection, sqlite } from './db.ts';
export async function consumeRateLimit(key: string, options: { capacity: number; refillPerMinute: number; cost?: number }) {
  return await sqlite.transaction(async () => {
    const sql = connection();
    const now = Date.now();
    await sql`INSERT INTO rate_limits(key,tokens,updated_at) VALUES(${key},${options.capacity},${now}) ON CONFLICT DO NOTHING`;
    const [row] = await sql`SELECT tokens,updated_at FROM rate_limits WHERE key=${key} FOR UPDATE`;
    const tokens = Math.min(options.capacity, row.tokens + (now - row.updated_at) * options.refillPerMinute / 60000);
    const allowed = tokens >= (options.cost ?? 1);
    await sql`UPDATE rate_limits SET tokens=${allowed ? tokens - (options.cost ?? 1) : tokens}, updated_at=${now} WHERE key=${key}`;
    return allowed;
  })();
}
export function clientKey(request: Request, scope: string) {
  // The gateway overwrites x-forwarded-for; use its last hop, never a client-selected first hop.
  const hops = (request.headers.get('x-forwarded-for') || '').split(',').map(s => s.trim());
  return `${scope}:${hops.at(-1) || 'unknown'}`;
}
