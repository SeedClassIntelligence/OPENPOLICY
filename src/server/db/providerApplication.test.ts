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

test('direct-carrier application records evidence reference without granting carrier authority', async () => {
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
  } finally {
    await store.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
