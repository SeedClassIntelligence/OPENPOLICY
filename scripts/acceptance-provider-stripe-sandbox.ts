import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Stripe from 'stripe';
import { CommercialStore } from '../src/server/db/commercialStore';
import { PostgresStore } from '../src/server/db/postgresStore';
import { activateApprovedProviderApplication } from '../src/server/providerActivation';
import { StripePaymentProcessor, mapStripeIntentStatus, stripePaymentMethod } from '../src/server/stripePaymentProcessor';

async function run() {
  const configuredSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const configuredWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!(configuredSecretKey?.startsWith('sk_test_') || configuredSecretKey?.startsWith('rk_test_'))) throw new Error('A Stripe test-mode key is required.');
  if (!configuredWebhookSecret?.startsWith('whsec_')) throw new Error('A Stripe test webhook secret is required.');
  const secretKey = configuredSecretKey;
  const webhookSecret = configuredWebhookSecret;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpolicy-provider-stripe-acceptance-'));
  const postgres = new PostgresStore(dataDir);
  const commercial = new CommercialStore(postgres);
  const stripe = new Stripe(secretKey);
  try {
    await commercial.seedCanonicalPlans();
    const application = await postgres.submitProviderApplication({
      firebaseUid: `stripe-sandbox-${Date.now()}`, applicantName: 'Open Policy Sandbox Provider',
      applicantEmail: 'sandbox-provider@openpolicy.test', legalName: 'Open Policy Sandbox Agency LLC',
      displayName: 'Open Policy Sandbox Agency', organizationType: 'INDEPENDENT_AGENCY',
      jurisdictionCode: 'NV', insuranceLines: ['PERSONAL_AUTO'], producerLicenseNumber: 'SANDBOX-NV-001',
      producerNpn: '0000000', requestedPlanCode: 'PLAN_SOLO'
    });
    const approved = await postgres.reviewProviderApplication({ applicationId: application.id, decision: 'APPROVE',
      actorId: 'sandbox-admin', reason: 'Sandbox authority fixture verified.', licenseType: 'PROPERTY_CASUALTY',
      licenseExpirationDate: '2027-12-31', verificationSource: 'SANDBOX_ACCEPTANCE_FIXTURE' });
    const enrollment = await commercial.enrollCommercialAgreement({ providerOrgId: approved.providerOrganizationId!,
      planId: approved.requestedPlanCode, actorRole: 'ADMIN' });
    const now = new Date().toISOString();
    const period = { id: `bp_stripe_${Date.now()}`, providerOrganizationId: approved.providerOrganizationId!,
      commercialAgreementId: enrollment.agreement.id, commercialPlanVersionId: enrollment.planVersion.id,
      periodStart: now, periodEnd: new Date(Date.now() + 30 * 86400000).toISOString(), status: 'OPEN' as const, createdAt: now };
    await commercial.saveBillingPeriod(period);
    const draft = await commercial.generateDraftInvoice({ providerOrganizationId: approved.providerOrganizationId!,
      billingPeriodId: period.id, idempotencyKey: `sandbox-subscription:${application.id}` });
    const invoice = await commercial.finalizeInvoiceById(draft.invoice.id);
    assert(invoice.totalDueCents > 0 && invoice.balanceDueCents === invoice.totalDueCents);

    const intent = await stripe.paymentIntents.create({ amount: invoice.totalDueCents, currency: 'usd',
      payment_method: 'pm_card_visa', confirm: true, automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      description: 'Open Policy provider activation sandbox acceptance', metadata: {
        openPolicyInvoiceId: invoice.id, openPolicyProviderOrganizationId: approved.providerOrganizationId!,
        openPolicyAcceptance: 'provider-activation-sandbox'
      }
    }, { idempotencyKey: `openpolicy-provider-acceptance-${application.id}` });
    assert.equal(mapStripeIntentStatus(intent.status), 'SUCCEEDED');

    const eventPayload = JSON.stringify({ id: `evt_acceptance_${intent.id}`, object: 'event',
      api_version: '2025-10-29.clover', created: Math.floor(Date.now()/1000), data: { object: intent },
      livemode: false, pending_webhooks: 1, request: null, type: 'payment_intent.succeeded' });
    const signature = Stripe.webhooks.generateTestHeaderString({ payload: eventPayload, secret: webhookSecret });
    const processor = new StripePaymentProcessor({ secretKey, webhookSecret, publicAppUrl: 'https://sandbox.openpolicy.test' });
    const verifiedEvent = processor.constructWebhookEvent(Buffer.from(eventPayload), signature);
    assert.equal(verifiedEvent.type, 'payment_intent.succeeded');

    const settlement = await commercial.recordPayment({ providerOrganizationId: approved.providerOrganizationId!,
      invoiceId: invoice.id, amountCents: Number(intent.amount_received || intent.amount),
      paymentMethod: stripePaymentMethod(intent), externalReference: intent.id,
      idempotencyKey: `stripe-payment:${intent.id}` });
    const replay = await commercial.recordPayment({ providerOrganizationId: approved.providerOrganizationId!,
      invoiceId: invoice.id, amountCents: Number(intent.amount_received || intent.amount),
      paymentMethod: stripePaymentMethod(intent), externalReference: intent.id,
      idempotencyKey: `stripe-payment:${intent.id}` });
    assert.equal(replay.payment.id, settlement.payment.id);
    assert.equal(replay.updatedInvoice?.status, 'PAID');
    assert.equal(replay.updatedInvoice?.balanceDueCents, 0);
    assert.equal((await commercial.getPaymentsForOrg(approved.providerOrganizationId!)).filter(item=>item.status==='SUCCEEDED').length, 1);

    const activated = await activateApprovedProviderApplication({ applicationId: application.id, actorId: 'sandbox-admin',
      reason: 'Real Stripe sandbox payment, signed webhook, and settled V2 subscription verified.',
      postgresStore: postgres, commercialStore: commercial });
    assert.equal(activated.organization.marketplaceStatus, 'ACTIVE');
    console.log(JSON.stringify({ result: 'PASS', livemode: intent.livemode, planCode: approved.requestedPlanCode,
      invoiceStatus: replay.updatedInvoice?.status, balanceDueCents: replay.updatedInvoice?.balanceDueCents,
      succeededPayments: 1, duplicateMutation: false, marketplaceStatus: activated.organization.marketplaceStatus,
      stripePaymentIntentId: intent.id }, null, 2));
  } finally {
    await postgres.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

run().catch(error => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
