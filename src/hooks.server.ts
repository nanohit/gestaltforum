import type { Handle } from '@sveltejs/kit';
import { getUserFromToken, SESSION_COOKIE } from '$lib/server/auth';
import { maybeRunScheduledBackup } from '$lib/server/backup';
import { publicHtmlCache } from '$lib/server/cache';

const schedulerState = globalThis as typeof globalThis & {
  __gestaltBackupSchedulerStarted?: boolean;
};

export const handle: Handle = async ({ event, resolve }) => {
  if (!schedulerState.__gestaltBackupSchedulerStarted) {
    schedulerState.__gestaltBackupSchedulerStarted = true;
    maybeRunScheduledBackup();
    setInterval(maybeRunScheduledBackup, 60 * 60 * 1000).unref();
  }

  const unsafeMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(event.request.method);
  const isPaymentWebhook =
    event.url.pathname === '/api/payments/cloudpayments-webhook' &&
    event.request.method === 'POST';
  if (
    unsafeMethod &&
    !isPaymentWebhook &&
    event.request.headers.get('origin') !== event.url.origin
  ) {
    return new Response('Cross-site request forbidden', { status: 403 });
  }

  const session = getUserFromToken(event.cookies.get(SESSION_COOKIE));
  event.locals.user = session?.user ?? null;
  event.locals.sessionId = session?.sessionId ?? null;

  const htmlCacheKey =
    event.request.method === 'GET' &&
    !event.locals.user &&
    /^\/materials\/[^/]+$/.test(event.url.pathname)
      ? `${event.url.pathname}${event.url.search}`
      : null;
  if (htmlCacheKey) {
    const cached = publicHtmlCache.get(htmlCacheKey);
    if (cached) return new Response(cached.body, { status: cached.status, headers: cached.headers });
  }

  let response = await resolve(event);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');

  if (response.headers.get('cache-control')?.includes('public')) {
    response.headers.append('Vary', 'Cookie');
  }

  if (event.url.pathname.startsWith('/admin') || event.url.pathname.startsWith('/account')) {
    response.headers.set('Cache-Control', 'private, no-store');
  }

  if (
    htmlCacheKey &&
    response.status === 200 &&
    response.headers.get('x-gestalt-cacheable') === '1' &&
    response.headers.get('content-type')?.includes('text/html')
  ) {
    response.headers.delete('x-gestalt-cacheable');
    const body = await response.text();
    const headers = [...response.headers.entries()].filter(
      ([name]) => name.toLowerCase() !== 'set-cookie'
    );
    publicHtmlCache.set(htmlCacheKey, { body, status: response.status, headers });
    response = new Response(body, { status: response.status, headers });
  } else {
    response.headers.delete('x-gestalt-cacheable');
  }

  return response;
};
