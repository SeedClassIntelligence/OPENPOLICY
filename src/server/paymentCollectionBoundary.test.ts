import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertDirectSettlementMutationAllowed,
  assertPaymentCollectionEnabled
} from './paymentCollectionBoundary';

test('direct settlement mutation remains available to non-production ledger validators', () => {
  assert.doesNotThrow(() => assertDirectSettlementMutationAllowed({ NODE_ENV: 'test' } as NodeJS.ProcessEnv));
});

test('production fails closed until a verified external payment processor integration exists', () => {
  assert.throws(
    () => assertDirectSettlementMutationAllowed({ NODE_ENV: 'production' } as NodeJS.ProcessEnv),
    (error: any) => error?.statusCode === 503 && error?.code === 'PAYMENT_PROCESSOR_NOT_CONFIGURED'
  );
});

test('payment collection fails closed when operational enablement is absent or false', () => {
  for (const value of [undefined, '', 'false', 'TRUE', '1']) {
    assert.throws(
      () => assertPaymentCollectionEnabled({ OPENPOLICY_LIVE_COLLECTIONS_ENABLED: value } as NodeJS.ProcessEnv),
      (error: any) => error?.statusCode === 503 && error?.code === 'LIVE_COLLECTIONS_DISABLED'
    );
  }
});

test('payment collection is enabled only by the exact true setting', () => {
  assert.doesNotThrow(() => assertPaymentCollectionEnabled({
    OPENPOLICY_LIVE_COLLECTIONS_ENABLED: 'true'
  } as NodeJS.ProcessEnv));
});

