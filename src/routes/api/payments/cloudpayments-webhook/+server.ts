import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { config } from '$lib/server/config';
import {
  inferCloudPaymentsEvent,
  processCloudPaymentsEvent,
  type CloudPaymentsEventType,
  verifyCloudPaymentsSignature
} from '$lib/server/cloudpayments';

const eventTypes = new Set([
  'check',
  'pay',
  'fail',
  'confirm',
  'refund',
  'recurrent',
  'cancel'
]);

export const POST: RequestHandler = async ({ request, url }) => {
  const rawBody = await request.text();
  if (!verifyCloudPaymentsSignature(rawBody, request.headers, config.cloudPaymentsWebhookSecret)) {
    return json({ code: 13 }, { status: 401 });
  }
  const params = new URLSearchParams(rawBody);
  const requestedType = (url.searchParams.get('type') || '').toLowerCase();
  const type = eventTypes.has(requestedType)
    ? (requestedType as CloudPaymentsEventType)
    : inferCloudPaymentsEvent(params);
  try {
    const code = processCloudPaymentsEvent(type, params, rawBody);
    return json({ code });
  } catch (error) {
    console.error('CloudPayments webhook failed', error);
    return json({ code: 13 }, { status: 422 });
  }
};
