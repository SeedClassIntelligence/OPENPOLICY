/**
 * The CE settlement ledger is not a payment processor.
 *
 * Non-production validators may record simulated settlements directly so the
 * invoice, allocation, refund, and balance mathematics can be tested. A
 * production request must instead arrive through a verified external payment
 * processor integration. Until that integration exists, direct HTTP settlement
 * mutations fail closed rather than manufacturing a successful payment.
 */
export function assertDirectSettlementMutationAllowed(
  env: NodeJS.ProcessEnv = process.env
): void {
  if (env.NODE_ENV === 'production') {
    throw Object.assign(
      new Error('External payment collection is not configured. Direct settlement mutation is disabled in production.'),
      { statusCode: 503, code: 'PAYMENT_PROCESSOR_NOT_CONFIGURED' }
    );
  }
}

/**
 * New processor-hosted collection sessions require an explicit operational
 * enablement. Webhook processing and refunds intentionally do not use this
 * guard: disabling new collections must not prevent reconciliation or returning
 * money that was already collected.
 */
export function assertPaymentCollectionEnabled(
  env: NodeJS.ProcessEnv = process.env
): void {
  if (env.OPENPOLICY_LIVE_COLLECTIONS_ENABLED !== 'true') {
    throw Object.assign(
      new Error('Payment collection is disabled by platform administration.'),
      { statusCode: 503, code: 'LIVE_COLLECTIONS_DISABLED' }
    );
  }
}

