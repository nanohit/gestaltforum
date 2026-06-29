import { describe, expect, it } from 'vitest';
import { cloudPaymentsSign, verifyCloudPaymentsSignature } from './cloudpayments';

describe('CloudPayments HMAC', () => {
  it('accepts Content-HMAC for the raw POST body', () => {
    const body = 'TransactionId=42&Amount=490.00&AccountId=7';
    const secret = 'test-secret';
    const headers = new Headers({ 'Content-HMAC': cloudPaymentsSign(body, secret) });
    expect(verifyCloudPaymentsSignature(body, headers, secret)).toBe(true);
  });

  it('rejects a changed payload', () => {
    const body = 'TransactionId=42&Amount=490.00';
    const secret = 'test-secret';
    const headers = new Headers({ 'Content-HMAC': cloudPaymentsSign(body, secret) });
    expect(verifyCloudPaymentsSignature(`${body}0`, headers, secret)).toBe(false);
  });
});
