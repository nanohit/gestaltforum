type Bucket = { tokens: number; updatedAt: number; lastSeen: number };

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

export function consumeRateLimit(
  key: string,
  options: { capacity: number; refillPerMinute: number; cost?: number }
): boolean {
  const now = Date.now();
  const cost = options.cost ?? 1;
  const refillPerMs = options.refillPerMinute / 60_000;
  const current = buckets.get(key) ?? { tokens: options.capacity, updatedAt: now, lastSeen: now };
  current.tokens = Math.min(
    options.capacity,
    current.tokens + (now - current.updatedAt) * refillPerMs
  );
  current.updatedAt = now;
  current.lastSeen = now;

  if (now - lastSweep > 10 * 60_000) {
    for (const [bucketKey, bucket] of buckets) {
      if (now - bucket.lastSeen > 60 * 60_000) buckets.delete(bucketKey);
    }
    lastSweep = now;
  }

  if (current.tokens < cost) {
    buckets.set(key, current);
    return false;
  }
  current.tokens -= cost;
  buckets.set(key, current);
  return true;
}

export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return `${scope}:${forwarded || request.headers.get('x-real-ip') || 'local'}`;
}
