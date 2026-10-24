import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { PostgresStore } from './postgresStore';

test('provider application intake is durable, idempotent, and grants no authority', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpolicy-provider-application-'));
  const store = new PostgresStore(dataDir);
  try {
    const input = {
      firebaseUid: 'firebase-provider-applicant', applicantName: 'Alex Applicant',
      applicantEmail: 'alex@example.com', legalName: 'Applicant Agency LLC', displayName: 'Applicant Agency',
      organizationType: 'INDEPENDENT_AGENCY' as const, jurisdictionCode: 'NV',
      insuranceLines: ['PERSONAL_AUTO'], producerLicenseNumber: 'NV-12345', producerNpn: '998877',
      organizationNpn: 'ORG-998877', organizationLicenseNumber: 'NV-ORG-12345', transactionRole: 'BROKER' as const,
      requestedPlanCode: 'PLAN_AGENCY'
    };
    const first = await store.submitProviderApplication(input);
    const retry = await store.submitProviderApplication({ ...input, displayName: 'Applicant Agency Updated' });
    assert.equal(retry.id, first.id);
    assert.equal(retry.displayName, 'Applicant Agency Updated');
    assert.equal(retry.status, 'SUBMITTED');
    assert.equal(retry.providerOrganizationId, undefined);
    assert.equal(retry.providerUserId, undefined);
    assert.equal(await store.getProviderUser(input.firebaseUid), undefined);
    assert.equal((await store.getProviderOrganizations()).some(org => org.legalName === input.legalName), false);
    await store.close();

    const restarted = new PostgresStore(dataDir);
    const durable = await restarted.getProviderApplicationByFirebaseUid(input.firebaseUid);
    assert.equal(durable?.requestedPlanCode, 'PLAN_AGENCY');
    assert.deepEqual(durable?.insuranceLines, ['PERSONAL_AUTO']);
    assert.equal((await restarted.listProviderApplications()).length, 1);
    await restarted.close();
  } finally {
    await store.close().catch(() => undefined);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('direct-carrier application requires independently verified certificate evidence before approval', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpolicy-carrier-application-'));
  const store = new PostgresStore(dataDir);
  try {
    const application = await store.submitProviderApplication({
      firebaseUid: 'firebase-carrier-applicant', applicantName: 'Carrier Applicant',
      applicantEmail: 'carrier@example.com', legalName: 'Example Carrier', displayName: 'Example Carrier',
      organizationType: 'DIRECT_CARRIER', jurisdictionCode: 'NV', insuranceLines: ['PERSONAL_AUTO'],
      carrierAuthorityReference: 'NV-COA-REVIEW-REFERENCE', requestedPlanCode: 'PLAN_ENTERPRISE'
    });
    assert.equal(application.carrierAuthorityReference, 'NV-COA-REVIEW-REFERENCE');
    assert.equal(application.status, 'SUBMITTED');
    assert.equal(application.providerOrganizationId, undefined);
    await assert.rejects(() => store.reviewProviderApplication({
      applicationId: application.id, decision: 'APPROVE', actorId: 'admin-owner', reason: 'Attempted review',
      verificationSource: 'Nevada DOI', licenseType: 'CARRIER', licenseExpirationDate: '2027-12-31',
      verificationSourceUrl: 'https://doi.nv.gov/licensing/lookup', verificationRecordId: 'NV-COA-REVIEW-REFERENCE',
      verificationEvidence: '{"certificate":"NV-COA-REVIEW-REFERENCE","status":"ACTIVE"}'
    }), /CARRIER_CERTIFICATE_OF_AUTHORITY/);
    const approved = await store.reviewProviderApplication({
      applicationId: application.id, decision: 'APPROVE', actorId: 'admin-owner',
      reason: 'Nevada certificate of authority independently verified.',
      verificationSource: 'Nevada Division of Insurance certificate lookup',
      licenseType: 'CARRIER_CERTIFICATE_OF_AUTHORITY', licenseExpirationDate: '2027-12-31',
      verificationSourceUrl: 'https://doi.nv.gov/licensing/lookup', verificationRecordId: 'NV-COA-REVIEW-REFERENCE',
      verificationEvidence: '{"certificate":"NV-COA-REVIEW-REFERENCE","status":"ACTIVE"}'
    });
    assert.equal(approved.status, 'APPROVED');
    const licenses = await store.getProviderLicenses(approved.providerOrganizationId!);
    assert.equal(licenses.length, 1);
    assert.equal(licenses[0].licenseNumber, 'NV-COA-REVIEW-REFERENCE');
    assert.equal(licenses[0].licenseType, 'CARRIER_CERTIFICATE_OF_AUTHORITY');
    assert.equal(licenses[0].providerUserId, undefined);
    assert.equal(licenses[0].verificationStatus, 'VERIFIED');
  } finally {
    await store.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('administrator review creates pending mappings atomically without marketplace activation', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpolicy-provider-review-'));
  const store = new PostgresStore(dataDir);
  try {
    const application = await store.submitProviderApplication({
      firebaseUid: 'firebase-reviewed-provider', applicantName: 'Reviewed Owner',
      applicantEmail: 'owner@reviewed.example', legalName: 'Reviewed Agency LLC', displayName: 'Reviewed Agency',
      organizationType: 'INDEPENDENT_AGENCY', jurisdictionCode: 'NV', insuranceLines: ['PERSONAL_AUTO'],
      producerLicenseNumber: 'NV-REVIEWED-1', producerNpn: '1234567', organizationNpn: '7654321',
      organizationLicenseNumber: 'NV-ORG-REVIEWED-1', transactionRole: 'AGENT',
      claimedCarrierName: 'Example Carrier', claimedCarrierNaicCode: '99999', requestedPlanCode: 'PLAN_SOLO'
    });
    await assert.rejects(() => store.reviewProviderApplication({
      applicationId: application.id, decision: 'APPROVE', actorId: application.firebaseUid,
      reason: 'Applicant attempts to approve their own authority.', licenseType: 'PROPERTY_CASUALTY',
      licenseExpirationDate: '2027-12-31', verificationSource: 'Nevada DOI producer lookup',
      verificationSourceUrl: 'https://doi.nv.gov/licensing/lookup', verificationRecordId: 'NV-REVIEWED-1',
      verificationEvidence: '{"license":"NV-REVIEWED-1","status":"ACTIVE","npn":"1234567"}',
      organizationVerificationSourceUrl: 'https://doi.nv.gov/licensing/lookup',
      organizationVerificationRecordId: 'NV-ORG-REVIEWED-1',
      organizationVerificationEvidence: '{"license":"NV-ORG-REVIEWED-1","status":"ACTIVE","npn":"7654321"}',
      relationshipVerificationSourceUrl: 'https://doi.nv.gov/licensing/lookup',
      relationshipVerificationRecordId: 'NV-APPOINTMENT-99999',
      relationshipVerificationEvidence: '{"carrier":"Example Carrier","naic":"99999","status":"ACTIVE"}'
    }), /other than the applicant/);
    const approved = await store.reviewProviderApplication({
      applicationId: application.id, decision: 'APPROVE', actorId: 'admin-owner',
      reason: 'License evidence verified for intake mapping.', licenseType: 'PROPERTY_CASUALTY',
      licenseExpirationDate: '2027-12-31', verificationSource: 'Nevada DOI producer lookup',
      verificationSourceUrl: 'https://doi.nv.gov/licensing/lookup', verificationRecordId: 'NV-REVIEWED-1',
      verificationEvidence: '{"license":"NV-REVIEWED-1","status":"ACTIVE","npn":"1234567"}',
      organizationVerificationSourceUrl: 'https://doi.nv.gov/licensing/lookup',
      organizationVerificationRecordId: 'NV-ORG-REVIEWED-1',
      organizationVerificationEvidence: '{"license":"NV-ORG-REVIEWED-1","status":"ACTIVE","npn":"7654321"}',
      relationshipVerificationSourceUrl: 'https://doi.nv.gov/licensing/lookup',
      relationshipVerificationRecordId: 'NV-APPOINTMENT-99999',
      relationshipVerificationEvidence: '{"carrier":"Example Carrier","naic":"99999","status":"ACTIVE"}'
    });
    assert.equal(approved.status, 'APPROVED');
    assert.ok(approved.providerOrganizationId);
    assert.ok(approved.providerUserId);
    const organization = await store.getProviderOrganization(approved.providerOrganizationId!);
    const user = await store.getProviderUser(approved.providerUserId!);
    const licenses = await store.getProviderLicenses(approved.providerOrganizationId!);
    assert.equal(organization?.marketplaceStatus, 'PENDING');
    assert.equal(organization?.verificationStatus, 'MARKETPLACE_APPROVED');
    assert.equal(user?.role, 'OWNER');
    assert.equal(licenses[0]?.verificationStatus, 'VERIFIED');
    assert.ok(licenses[0]?.authorityEvidenceId);
    const evidence = await store.getProviderAuthorityEvidence(approved.providerOrganizationId!);
    assert.equal(evidence.length, 3);
    const individualEvidence = evidence.find(item => item.subjectType === 'INDIVIDUAL_LICENSE')!;
    assert.equal(individualEvidence.id, licenses[0].authorityEvidenceId);
    assert.equal(individualEvidence.authorityNumber, 'NV-REVIEWED-1');
    assert.equal(individualEvidence.status, 'VERIFIED');
    assert.equal(individualEvidence.evidenceSha256.length, 64);
    assert.notEqual(individualEvidence.submittedBy, individualEvidence.verifiedBy);
    assert.equal(evidence.find(item => item.subjectType === 'ORGANIZATION_LICENSE')?.authorityNumber, 'NV-ORG-REVIEWED-1');
    assert.equal(evidence.find(item => item.subjectType === 'CARRIER_RELATIONSHIP')?.authorityNumber, '99999');
    const retry = await store.reviewProviderApplication({
      applicationId: application.id, decision: 'APPROVE', actorId: 'admin-owner', reason: 'retry'
    });
    assert.equal(retry.providerOrganizationId, approved.providerOrganizationId);
    assert.equal((await store.getProviderUsers(approved.providerOrganizationId!)).length, 1);
    assert.equal((await store.getProviderLicenses(approved.providerOrganizationId!)).length, 1);
  } finally {
    await store.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('rejected application creates no provider mappings', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpolicy-provider-rejection-'));
  const store = new PostgresStore(dataDir);
  try {
    const application = await store.submitProviderApplication({
      firebaseUid: 'firebase-rejected-provider', applicantName: 'Rejected Applicant',
      applicantEmail: 'rejected@example.com', legalName: 'Rejected Agency LLC', displayName: 'Rejected Agency',
      organizationType: 'BROKERAGE', jurisdictionCode: 'NV', insuranceLines: ['PERSONAL_AUTO'],
      producerLicenseNumber: 'INVALID', requestedPlanCode: 'PLAN_SOLO'
    });
    const rejected = await store.reviewProviderApplication({
      applicationId: application.id, decision: 'REJECT', actorId: 'admin-owner', reason: 'Authority evidence could not be verified.'
    });
    assert.equal(rejected.status, 'REJECTED');
    assert.equal(rejected.providerOrganizationId, undefined);
    assert.equal((await store.getProviderOrganizations()).some(org => org.legalName === application.legalName), false);
  } finally {
    await store.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
