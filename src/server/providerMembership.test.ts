import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { CommercialStore } from './db/commercialStore';
import { PostgresStore } from './db/postgresStore';
import { getProviderMembershipState, prepareProviderMembership } from './providerMembership';

test('approved provider membership preparation is V2-priced, finalized, idempotent, and does not grant access', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpolicy-provider-membership-'));
  const postgres = new PostgresStore(dataDir);
  const commercial = new CommercialStore(postgres);
  try {
    await commercial.seedCanonicalPlans();
    const application = await postgres.submitProviderApplication({
      firebaseUid: 'firebase-membership-provider', applicantName: 'Agency Owner',
      applicantEmail: 'owner@example.com', legalName: 'Provider Agency LLC', displayName: 'Provider Agency',
      organizationType: 'INDEPENDENT_AGENCY', jurisdictionCode: 'NV', insuranceLines: ['PERSONAL_AUTO'],
      producerLicenseNumber: 'NV-10001', requestedPlanCode: 'PLAN_AGENCY'
    });
    await assert.rejects(() => prepareProviderMembership({ applicationId: application.id, postgresStore: postgres,
      commercialStore: commercial, now: '2026-10-23T00:00:00.000Z' }), /must be approved/);

    const approved = await postgres.reviewProviderApplication({
      applicationId: application.id, decision: 'APPROVE', actorId: 'owner-admin', reason: 'Authority verified.',
      licenseType: 'PROPERTY_CASUALTY', licenseExpirationDate: '2027-10-23', verificationSource: 'Nevada DOI',
      verificationSourceUrl: 'https://doi.nv.gov/licensing/lookup', verificationRecordId: 'NV-10001',
      verificationEvidence: '{"license":"NV-10001","status":"ACTIVE","fixture":true}'
    });
    const first = await prepareProviderMembership({ applicationId: application.id, postgresStore: postgres,
      commercialStore: commercial, now: '2026-10-23T00:00:00.000Z' });
    const retry = await prepareProviderMembership({ applicationId: application.id, postgresStore: postgres,
      commercialStore: commercial, now: '2026-10-24T00:00:00.000Z' });

    assert.equal(first.invoice?.totalDueCents, 24_900);
    assert.equal(first.invoice?.status, 'FINALIZED');
    assert.equal(first.invoice?.id, retry.invoice?.id);
    assert.equal((await commercial.getInvoicesForOrg(approved.providerOrganizationId!)).length, 1);
    assert.equal(first.paymentRequired, true);
    assert.equal(first.paymentComplete, false);
    assert.equal(first.marketplaceAccessGranted, false);
    assert.equal((await postgres.getProviderOrganization(approved.providerOrganizationId!))?.marketplaceStatus, 'PENDING');
  } finally {
    await postgres.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('membership state recognizes settlement but never grants marketplace access', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpolicy-provider-membership-paid-'));
  const postgres = new PostgresStore(dataDir);
  const commercial = new CommercialStore(postgres);
  try {
    await commercial.seedCanonicalPlans();
    const submitted = await postgres.submitProviderApplication({
      firebaseUid: 'firebase-paid-provider', applicantName: 'Solo Owner', applicantEmail: 'solo@example.com',
      legalName: 'Solo Provider LLC', displayName: 'Solo Provider', organizationType: 'INDEPENDENT_AGENCY',
      jurisdictionCode: 'NV', insuranceLines: ['PERSONAL_AUTO'], producerLicenseNumber: 'NV-20002', requestedPlanCode: 'PLAN_SOLO'
    });
    const approved = await postgres.reviewProviderApplication({ applicationId: submitted.id, decision: 'APPROVE',
      actorId: 'owner-admin', reason: 'Authority verified.', licenseType: 'PROPERTY_CASUALTY',
      licenseExpirationDate: '2027-10-23', verificationSource: 'Nevada DOI',
      verificationSourceUrl: 'https://doi.nv.gov/licensing/lookup', verificationRecordId: 'NV-20002',
      verificationEvidence: '{"license":"NV-20002","status":"ACTIVE","fixture":true}' });
    const prepared = await prepareProviderMembership({ applicationId: submitted.id, postgresStore: postgres,
      commercialStore: commercial, now: '2026-10-23T00:00:00.000Z' });
    assert.equal(prepared.invoice?.totalDueCents, 9_900);
    await commercial.recordPayment({ providerOrganizationId: approved.providerOrganizationId!, invoiceId: prepared.invoice!.id,
      amountCents: prepared.invoice!.totalDueCents, paymentMethod: 'CREDIT_CARD', externalReference: 'pi_membership_paid',
      idempotencyKey: 'provider-membership-paid' });
    const durableApplication = await postgres.getProviderApplicationByFirebaseUid(submitted.firebaseUid);
    const state = await getProviderMembershipState({ application: durableApplication!, commercialStore: commercial });
    assert.equal(state.paymentComplete, true);
    assert.equal(state.paymentRequired, false);
    assert.equal(state.marketplaceAccessGranted, false);
    assert.equal((await postgres.getProviderOrganization(approved.providerOrganizationId!))?.marketplaceStatus, 'PENDING');
  } finally {
    await postgres.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
