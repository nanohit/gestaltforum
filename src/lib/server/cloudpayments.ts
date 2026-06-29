import { createHmac, timingSafeEqual } from 'node:crypto';
import { sqlite } from '$lib/server/db';

export type CloudPaymentsEventType =
  | 'check'
  | 'pay'
  | 'fail'
  | 'confirm'
  | 'refund'
  | 'recurrent'
  | 'cancel';

export function cloudPaymentsSign(message: string, secret: string): string {
  return createHmac('sha256', secret).update(message, 'utf8').digest('base64');
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyCloudPaymentsSignature(
  rawBody: string,
  headers: Headers,
  secret: string
): boolean {
  if (!secret) return false;
  const contentSignature = headers.get('content-hmac') || '';
  const decodedSignature = headers.get('x-content-hmac') || '';
  const decodedBody = decodeURIComponent(rawBody.replaceAll('+', ' '));
  const expectedRaw = cloudPaymentsSign(rawBody, secret);
  const expectedDecoded = cloudPaymentsSign(decodedBody, secret);
  return (
    (contentSignature.length > 0 && safeEqual(contentSignature, expectedRaw)) ||
    (decodedSignature.length > 0 && safeEqual(decodedSignature, expectedDecoded)) ||
    (decodedSignature.length > 0 && safeEqual(decodedSignature, expectedRaw))
  );
}

function parseMetadata(value: string | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function resolveUser(params: URLSearchParams, metadata: Record<string, unknown>): number | null {
  const metadataUserId = Number(metadata.userId);
  if (Number.isInteger(metadataUserId) && metadataUserId > 0) {
    const user = sqlite.prepare('SELECT id FROM users WHERE id = ?').get(metadataUserId) as
      | { id: number }
      | undefined;
    if (user) return user.id;
  }
  const accountId = params.get('AccountId') || '';
  const numericId = Number(accountId);
  if (Number.isInteger(numericId) && numericId > 0) {
    const user = sqlite.prepare('SELECT id FROM users WHERE id = ?').get(numericId) as
      | { id: number }
      | undefined;
    if (user) return user.id;
  }
  const email = params.get('Email') || accountId;
  if (email) {
    const user = sqlite.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(email) as
      | { id: number }
      | undefined;
    if (user) return user.id;
  }
  return null;
}

function resolvePlan(params: URLSearchParams, metadata: Record<string, unknown>) {
  const code = typeof metadata.planCode === 'string' ? metadata.planCode : '';
  if (code) {
    return sqlite.prepare('SELECT * FROM plans WHERE code = ?').get(code) as
      | { id: number; code: string; amount: number; period: string }
      | undefined;
  }
  const amount = Math.round(Number(params.get('Amount') || 0) * 100);
  return sqlite.prepare('SELECT * FROM plans WHERE amount = ? LIMIT 1').get(amount) as
    | { id: number; code: string; amount: number; period: string }
    | undefined;
}

function addPeriod(date: Date, period: string): Date {
  const result = new Date(date);
  if (period === 'year') result.setUTCFullYear(result.getUTCFullYear() + 1);
  else if (period === 'month') result.setUTCMonth(result.getUTCMonth() + 1);
  else result.setUTCFullYear(result.getUTCFullYear() + 100);
  return result;
}

function eventKey(type: CloudPaymentsEventType, params: URLSearchParams): string {
  const identifier = params.get('TransactionId') || params.get('Id') || 'unknown';
  return `${type}:${identifier}:${params.get('Status') || params.get('DateTime') || ''}`;
}

function logEvent(
  type: CloudPaymentsEventType,
  params: URLSearchParams,
  rawBody: string
): boolean {
  const result = sqlite
    .prepare('INSERT OR IGNORE INTO payment_events (event_key, raw_json) VALUES (?, ?)')
    .run(
      eventKey(type, params),
      JSON.stringify({ type, params: Object.fromEntries(params), raw: rawBody })
    );
  return result.changes > 0;
}

export function inferCloudPaymentsEvent(params: URLSearchParams): CloudPaymentsEventType {
  if (params.has('SuccessfulTransactionsNumber') && params.has('Id')) return 'recurrent';
  if (params.has('PaymentTransactionId')) return 'refund';
  if (params.has('Reason') || params.has('ReasonCode')) return 'fail';
  if (params.get('Status') === 'Completed' || params.get('Status') === 'Authorized') return 'pay';
  return 'cancel';
}

export function processCloudPaymentsEvent(
  type: CloudPaymentsEventType,
  params: URLSearchParams,
  rawBody: string
): number {
  const metadata = parseMetadata(params.get('Data') || params.get('Metadata') || undefined);
  const userId = resolveUser(params, metadata);
  const plan = resolvePlan(params, metadata);
  const amount = Math.round(Number(params.get('Amount') || 0) * 100);
  const currency = params.get('Currency') || 'RUB';

  if (type === 'check') {
    if (!userId) return 11;
    if (!plan) return 10;
    if (currency !== 'RUB' || amount !== plan.amount) return 12;
    return 0;
  }

  if (type === 'pay' || type === 'confirm') {
    if (!userId || !plan || currency !== 'RUB' || amount !== plan.amount) {
      throw new Error('CloudPayments Pay payload did not match user/plan/amount');
    }
    const transactionId = params.get('TransactionId');
    if (!transactionId) throw new Error('CloudPayments TransactionId missing');
    const status = params.get('Status') || 'Completed';
    const subscriptionId = params.get('SubscriptionId');
    const now = new Date();

    sqlite.transaction(() => {
      if (!logEvent(type, params, rawBody)) return;
      const payment = sqlite
        .prepare(`
          INSERT OR IGNORE INTO payments
            (user_id, cp_transaction_id, amount, status, created_at)
          VALUES (?, ?, ?, ?, ?)
        `)
        .run(userId, transactionId, amount, status.toLowerCase(), now.toISOString());
      if (!payment.changes) return;

      const latest = sqlite
        .prepare(`
          SELECT MAX(ends_at) AS ends_at FROM entitlements
          WHERE user_id = ? AND datetime(ends_at) > datetime('now')
        `)
        .get(userId) as { ends_at: string | null };
      const base =
        latest.ends_at && new Date(latest.ends_at).getTime() > now.getTime()
          ? new Date(latest.ends_at)
          : now;
      const periodEnd = addPeriod(base, plan.period);
      sqlite
        .prepare(`
          INSERT INTO entitlements (user_id, type, starts_at, ends_at, source)
          VALUES (?, 'subscription', ?, ?, ?)
        `)
        .run(userId, now.toISOString(), periodEnd.toISOString(), `cp:${transactionId}`);

      if (subscriptionId) {
        sqlite
          .prepare(`
            INSERT INTO subscriptions
              (user_id, cp_subscription_id, cp_customer_id, plan_id, status, period_end)
            VALUES (?, ?, ?, ?, 'Active', ?)
            ON CONFLICT(cp_subscription_id) DO UPDATE SET
              user_id = excluded.user_id,
              cp_customer_id = excluded.cp_customer_id,
              plan_id = excluded.plan_id,
              status = excluded.status,
              period_end = excluded.period_end
          `)
          .run(userId, subscriptionId, params.get('AccountId'), plan.id, periodEnd.toISOString());
      }
    })();
    return 0;
  }

  if (type === 'fail' || type === 'cancel' || type === 'refund') {
    const transactionId = params.get('TransactionId');
    sqlite.transaction(() => {
      if (!logEvent(type, params, rawBody)) return;
      if (userId && transactionId) {
        sqlite
          .prepare(`
            INSERT INTO payments (user_id, cp_transaction_id, amount, status)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(cp_transaction_id) DO UPDATE SET status = excluded.status
          `)
          .run(userId, transactionId, amount, type);
      }
      const subscriptionId = params.get('SubscriptionId');
      if (subscriptionId) {
        sqlite
          .prepare('UPDATE subscriptions SET status = ? WHERE cp_subscription_id = ?')
          .run(
            type === 'fail' ? 'PastDue' : type === 'cancel' ? 'Cancelled' : 'Refunded',
            subscriptionId
          );
      }
    })();
    // Paid access is intentionally left untouched until its current ends_at.
    return 0;
  }

  if (type === 'recurrent') {
    const subscriptionId = params.get('Id');
    if (!userId || !subscriptionId) throw new Error('Invalid recurrent notification');
    const status = params.get('Status') || 'Unknown';
    const periodEnd = params.get('NextTransactionDate') || params.get('LastTransactionDate');
    sqlite.transaction(() => {
      if (!logEvent(type, params, rawBody)) return;
      sqlite
        .prepare(`
          INSERT INTO subscriptions
            (user_id, cp_subscription_id, cp_customer_id, plan_id, status, period_end)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(cp_subscription_id) DO UPDATE SET
            user_id = excluded.user_id,
            plan_id = COALESCE(excluded.plan_id, subscriptions.plan_id),
            status = excluded.status,
            period_end = COALESCE(excluded.period_end, subscriptions.period_end)
        `)
        .run(userId, subscriptionId, params.get('AccountId'), plan?.id ?? null, status, periodEnd);
    })();
    return 0;
  }

  logEvent(type, params, rawBody);
  return 0;
}
