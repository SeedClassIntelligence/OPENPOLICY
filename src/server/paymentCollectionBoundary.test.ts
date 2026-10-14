import test from 'node:test';
import assert from 'node:assert/strict';
import { assertDirectSettlementMutationAllowed } from './paymentCollectionBoundary';

test('direct settlement mutation remains available to non-production ledger validators', () => {
  assert.doesNotThrow(() => assertDirectSettlementMutationAllowed({ NODE_ENV: 'test' } as NodeJS.ProcessEnv));
});

test('production fails closed until a verified external payment processor integration exists', () => {
  assert.throws(
    () => assertDirectSettlementMutationAllowed({ NODE_ENV: 'production' } as NodeJS.ProcessEnv),
    (error: any) => error?.statusCode === 503 && error?.code === 'PAYMENT_PROCESSOR_NOT_CONFIGURED'
  );
});

