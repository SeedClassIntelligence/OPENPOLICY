import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { CommercialStore } from './db/commercialStore';
import { OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2 } from '../domain/commercialPriceBook';
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
      producerLicenseNumber: 'NV-ACTIVATE-1', producerNpn: '7654321', organizationNpn: 'ORG-7654321',
      organizationLicenseNumber: 'NV-ORG-ACTIVATE-1', transactionRole: 'BROKER', requestedPlanCode: 'PLAN_AGENCY'
    });
    const activate = (synchronizeIdentity?: () => Promise<void>) => activateApprovedProviderApplication({
      applicationId: application.id, actorId: 'admin-owner', reason: 'Acceptance activation',
      postgresStore: postgres, commercialStore: commercial,
      synchronizeIdentity: synchronizeIdentity ? async () => synchronizeIdentity() : undefined
    });

    await assert.rejects(activate(), /must be approved/);
    const approved = await postgres.reviewProviderApplication({
      applicationId: application.id, decision: 'APPROVE', actorId: 'admin-owner', reason: 'Verified authority.',
      licenseType: 'PROPERTY_CASUALTY', licenseExpirationDate: '2027-12-31', verificationSource: 'Nevada DOI producer lookup',
      verificationSourceUrl: 'https://doi.nv.gov/licensing/lookup', verificationRecordId: 'NV-ACTIVATION-001',
      verificationEvidence: '{"subjectType":"INDIVIDUAL_LICENSE","legalName":"Activation Owner","jurisdiction":"NV","authorityNumber":"NV-ACTIVATE-1","sourceRecordId":"NV-ACTIVATION-001","status":"ACTIVE","expirationDate":"2027-12-31","qualifications":["PROPERTY","CASUALTY"],"npn":"7654321","fixture":true}',
      organizationVerificationSourceUrl: 'https://doi.nv.gov/licensing/lookup',
      organizationVerificationRecordId: 'NV-ORG-ACTIVATE-1',
      organizationLicenseExpirationDate: '2027-12-31',
      organizationVerificationEvidence: '{"subjectType":"ORGANIZATION_LICENSE","legalName":"Activation Agency LLC","jurisdiction":"NV","authorityNumber":"NV-ORG-ACTIVATE-1","sourceRecordId":"NV-ORG-ACTIVATE-1","status":"ACTIVE","expirationDate":"2027-12-31","qualifications":["PROPERTY","CASUALTY"],"npn":"ORG-7654321","fixture":true}'
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

test('new enrollment catalog exposes only the governing V2 version while retaining V1 history', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpolicy-v2-enrollment-'));
  const postgres = new PostgresStore(dataDir);
  const commercial = new CommercialStore(postgres);
  try {
    await commercial.seedCanonicalPlans();
    const enrollmentPlans = await commercial.listEnrollmentPlans(OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.id);
    assert.equal(enrollmentPlans.length, 5);
    assert.deepEqual(new Set(enrollmentPlans.map(plan => plan.code)), new Set([
      'PLAN_SOLO', 'PLAN_AGENCY', 'PLAN_OPEN_POLICY_PREMIUM', 'PLAN_NETWORK', 'PLAN_ENTERPRISE'
    ]));
    assert.ok(enrollmentPlans.every(plan => plan.planVersion.termsSnapshot.priceBookId === OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.id));
    const premium = enrollmentPlans.find(plan => plan.code === 'PLAN_OPEN_POLICY_PREMIUM');
    assert.equal(premium?.planVersion.version, 2);
    assert.ok(await commercial.getCommercialPlanVersion('cpv_open_policy_premium_v1'), 'immutable V1 version remains queryable');
  } finally {
    await postgres.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('direct-carrier activation fails closed without a current independently verified certificate', async () => {
  const fakeApplication = { id: 'carrier-app', status: 'APPROVED', organizationType: 'DIRECT_CARRIER',
    providerOrganizationId: 'org-carrier', providerUserId: 'user-carrier', jurisdictionCode: 'NV',
    carrierAuthorityReference: 'NV-COA-MISSING' } as any;
  await assert.rejects(activateApprovedProviderApplication({ applicationId: fakeApplication.id, actorId: 'admin', reason: 'test',
    postgresStore: { listProviderApplications: async () => [fakeApplication], getProviderLicenses: async () => [],
      getProviderAuthorityEvidence: async () => [] } as any,
    commercialStore: {} as any }), /authoritative evidence/);
});

test('direct carrier activates only after verified certificate, matching V2 agreement, and settled subscription', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpolicy-carrier-activation-'));
  const postgres = new PostgresStore(dataDir);
  const commercial = new CommercialStore(postgres);
  try {
    await commercial.seedCanonicalPlans();
    const application = await postgres.submitProviderApplication({
      firebaseUid: 'firebase-direct-carrier', applicantName: 'Carrier Administrator',
      applicantEmail: 'administrator@carrier.example', legalName: 'Verified Carrier Inc.',
      displayName: 'Verified Carrier', organizationType: 'DIRECT_CARRIER', jurisdictionCode: 'NV',
      insuranceLines: ['PERSONAL_AUTO'], carrierAuthorityReference: 'NV-COA-2026-001',
      requestedPlanCode: 'PLAN_ENTERPRISE'
    });
    const approved = await postgres.reviewProviderApplication({
      applicationId: application.id, decision: 'APPROVE', actorId: 'admin-owner',
      reason: 'Certificate independently verified against the regulator record.',
      licenseType: 'CARRIER_CERTIFICATE_OF_AUTHORITY', licenseExpirationDate: '2027-12-31',
      verificationSource: 'Nevada Division of Insurance certificate lookup',
      verificationSourceUrl: 'https://doi.nv.gov/licensing/lookup', verificationRecordId: 'NV-COA-2026-001',
      verificationEvidence: '{"subjectType":"CARRIER_AUTHORITY","legalName":"Verified Carrier Inc.","jurisdiction":"NV","authorityNumber":"NV-COA-2026-001","sourceRecordId":"NV-COA-2026-001","status":"ACTIVE","expirationDate":"2027-12-31","fixture":true}'
    });
    const enrollment = await commercial.enrollCommercialAgreement({
      providerOrgId: approved.providerOrganizationId!, planId: 'PLAN_ENTERPRISE', actorRole: 'ADMIN'
    });
    const now = new Date().toISOString();
    await commercial.saveBillingPeriod({ id: 'bp_carrier_activation',
      providerOrganizationId: approved.providerOrganizationId!, commercialAgreementId: enrollment.agreement.id,
      commercialPlanVersionId: enrollment.planVersion.id, periodStart: '2026-10-01T00:00:00.000Z',
      periodEnd: '2026-11-01T00:00:00.000Z', status: 'OPEN', createdAt: now });
    const draft = await commercial.generateDraftInvoice({ providerOrganizationId: approved.providerOrganizationId!,
      billingPeriodId: 'bp_carrier_activation', idempotencyKey: 'carrier-activation-subscription' });
    const invoice = await commercial.finalizeInvoiceById(draft.invoice.id);
    await commercial.recordPayment({ providerOrganizationId: approved.providerOrganizationId!, invoiceId: invoice.id,
      amountCents: invoice.totalDueCents, paymentMethod: 'CREDIT_CARD', externalReference: 'pi_carrier_activation',
      idempotencyKey: 'carrier-activation-payment' });
    const activated = await activateApprovedProviderApplication({ applicationId: application.id,
      actorId: 'admin-owner', reason: 'Carrier activation acceptance.', postgresStore: postgres, commercialStore: commercial });
    assert.equal(activated.organization.marketplaceStatus, 'ACTIVE');
    assert.equal(activated.agreement.id, enrollment.agreement.id);
  } finally {
    await postgres.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
