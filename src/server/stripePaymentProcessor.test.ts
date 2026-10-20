import test from 'node:test';
import assert from 'node:assert/strict';
import { mapStripeIntentStatus, shouldApplyStripePaymentStatus, stripeRefundLedgerKey, StripePaymentProcessor, stripePaymentMethod, stripeProcessorConfig } from './stripePaymentProcessor';

test('Stripe configuration fails closed and production requires HTTPS', () => {
  assert.throws(() => stripeProcessorConfig({ NODE_ENV: 'production' } as NodeJS.ProcessEnv), /STRIPE_SECRET_KEY/);
  assert.throws(() => stripeProcessorConfig({
    NODE_ENV: 'production', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x', APP_URL: 'http://example.test'
  } as NodeJS.ProcessEnv), (error: any) => error.code === 'PAYMENT_PROCESSOR_RETURN_URL_INSECURE');
  assert.equal(stripeProcessorConfig({
    NODE_ENV: 'production', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x', APP_URL: 'https://example.test/path'
  } as NodeJS.ProcessEnv).publicAppUrl, 'https://example.test');
});

test('Stripe asynchronous and terminal states map conservatively', () => {
  assert.equal(mapStripeIntentStatus('succeeded'), 'SUCCEEDED');
  assert.equal(mapStripeIntentStatus('processing'), 'PENDING');
  assert.equal(mapStripeIntentStatus('requires_action'), 'PENDING');
  assert.equal(mapStripeIntentStatus('canceled'), 'FAILED');
  assert.equal(mapStripeIntentStatus('requires_payment_method'), 'FAILED');
});

test('out-of-order processor delivery cannot downgrade a terminal payment success', () => {
  assert.equal(shouldApplyStripePaymentStatus('SUCCEEDED', 'PENDING'), false);
  assert.equal(shouldApplyStripePaymentStatus('SUCCEEDED', 'FAILED'), false);
  assert.equal(shouldApplyStripePaymentStatus('FAILED', 'PENDING'), false);
  assert.equal(shouldApplyStripePaymentStatus('FAILED', 'SUCCEEDED'), true);
  assert.equal(shouldApplyStripePaymentStatus('PENDING', 'SUCCEEDED'), true);
});

test('refund ledger idempotency is anchored to immutable processor identity', () => {
  assert.equal(stripeRefundLedgerKey('re_123'), 'stripe-refund:re_123');
  assert.throws(() => stripeRefundLedgerKey('  '), /refund identity/);
});

test('Stripe payment methods map card and US bank debit into the existing ledger vocabulary', () => {
  assert.equal(stripePaymentMethod({ payment_method_types: ['card'] } as any), 'CREDIT_CARD');
  assert.equal(stripePaymentMethod({ payment_method_types: ['us_bank_account'] } as any), 'ACH_TRANSFER');
});

test('hosted invoice sessions preserve invoice/org provenance and allow only card and US bank debit', async () => {
  let captured: any;
  const fakeStripe = {
    checkout: { sessions: { create: async (params: any, options: any) => {
      captured = { params, options }; return { id: 'cs_test_1', url: 'https://checkout.stripe.test/session' };
    } } }
  } as any;
  const processor = new StripePaymentProcessor({
    secretKey: 'sk_test_x', webhookSecret: 'whsec_x', publicAppUrl: 'https://openpolicy.test'
  }, fakeStripe);
  await processor.createInvoicePaymentSession({
    customerId: 'cus_1', invoiceId: 'inv_1', invoiceNumber: 'INV-1',
    providerOrganizationId: 'org_1', amountCents: 12_500
  });
  assert.deepEqual(captured.params.payment_method_types, ['card', 'us_bank_account']);
  assert.equal(captured.params.line_items[0].price_data.unit_amount, 12_500);
  assert.equal(captured.params.payment_intent_data.metadata.openPolicyInvoiceId, 'inv_1');
  assert.equal(captured.params.payment_intent_data.metadata.openPolicyProviderOrganizationId, 'org_1');
  assert.equal(captured.options.idempotencyKey, 'openpolicy-checkout-inv_1-12500');
});

