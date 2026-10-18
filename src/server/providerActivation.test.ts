import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { CommercialStore } from './db/commercialStore';
import { PostgresStore } from './db/postgresStore';
import { activateApprovedProviderApplication } from './providerActivation';

test('provider activation fails closed until authority, matching V2 agreement, and payment all exist', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpolicy-provider-activation-'));
  const postgres = new PostgresStore(dataDir);
  const commercial = new CommercialStore(postgres);
  try {
    await commercial.seedCanonicalPlans();
    const application = await postgres.submitProviderApplication({
      firebaseUid: 'firebase-activation-provider', applicantName: 'Activation Owner',
      applicantEmail: 'activation@example.com', legalName: 'Activation Agency LLC', displayName: 'Activation Agency',
      organizationType: 'INDEPENDENT_AGENCY', jurisdictionCode: 'NV', insuranceLines: ['PERSONAL_AUTO'],
      producerLicenseNumber: 'NV-ACTIVATE-1', producerNpn: '7654321', requestedPlanCode: 'PLAN_AGENCY'
    });
    const activate = (synchronizeIdentity?: () => Promise<void>) => activateApprovedProviderApplication({
      applicationId: application.id, actorId: 'admin-owner', reason: 'Acceptance activation',
      postgresStore: postgres, commercialStore: commercial,
      synchronizeIdentity: synchronizeIdentity ? async () => synchronizeIdentity() : undefined
    });

    await assert.rejects(activate(), /must be approved/);
    const approved = await postgres.reviewProviderApplication({
      applicationId: application.id, decision: 'APPROVE', actorId: 'admin-owner', reason: 'Verified authority.',
      licenseType: 'PROPERTY_CASUALTY', licenseExpirationDate: '2027-12-31', verificationSource: 'Nevada DOI producer lookup'
    });
    assert.equal((await postgres.getProviderOrganization(approved.providerOrganizationId!))?.marketplaceStatus, 'PENDING');
    await assert.rejects(activate(), /active V2 commercial agreement/);

    await commercial.enrollCommercialAgreement({ providerOrgId: approved.providerOrganizationId!, planId: 'PLAN_SOLO', actorRole: 'ADMIN' });
    await assert.rejects(activate(), /does not match the application requested/);
    const enrollment = await commercial.enrollCommercialAgreement({ providerOrgId: approved.providerOrganizationId!, planId: 'PLAN_AGENCY', actorRole: 'ADMIN' });
    await assert.rejects(activate(), /fully settled V2 membership subscription invoice/);

    const now = new Date().toISOString();
    const period = { id: 'bp_provider_activation', providerOrganizationId: approved.providerOrganizationId!,
      commercialAgreementId: enrollment.agreement.id, commercialPlanVersionId: enrollment.planVersion.id,
      periodStart: '2026-10-01T00:00:00.000Z', periodEnd: '2026-11-01T00:00:00.000Z',
      status: 'OPEN' as const, createdAt: now };
    await commercial.saveBillingPeriod(period);
    const draft = await commercial.generateDraftInvoice({ providerOrganizationId: approved.providerOrganizationId!,
      billingPeriodId: period.id, idempotencyKey: 'provider-activation-subscription' });
    const invoice = await commercial.finalizeInvoiceById(draft.invoice.id);
    assert.ok(invoice.totalDueCents > 0);
    await commercial.recordPayment({ providerOrganizationId: approved.providerOrganizationId!, invoiceId: invoice.id,
      amountCents: invoice.totalDueCents, paymentMethod: 'CREDIT_CARD', externalReference: 'pi_provider_activation',
      idempotencyKey: 'provider-activation-payment' });
    let identitySynchronizations = 0;
    const activated = await activate(async () => { identitySynchronizations += 1; });
    assert.equal(activated.organization.marketplaceStatus, 'ACTIVE');
    assert.equal(activated.agreement.id, enrollment.agreement.id);
    assert.equal(identitySynchronizations, 1);
  } finally {
    await postgres.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('direct-carrier activation remains unavailable without modeled certificate-of-authority verification', async () => {
  const fakeApplication = { id: 'carrier-app', status: 'APPROVED', organizationType: 'DIRECT_CARRIER',
    providerOrganizationId: 'org-carrier', providerUserId: 'user-carrier' } as any;
  await assert.rejects(activateApprovedProviderApplication({ applicationId: fakeApplication.id, actorId: 'admin', reason: 'test',
    postgresStore: { listProviderApplications: async () => [fakeApplication] } as any,
    commercialStore: {} as any }), /Direct-carrier activation is unavailable/);
});
