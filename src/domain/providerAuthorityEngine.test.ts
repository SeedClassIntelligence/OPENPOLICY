import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateProviderJurisdictionAuthority } from './providerAuthorityEngine';

const organization = {
  id: 'org-direct-carrier', legalName: 'Carrier LLC', displayName: 'Carrier',
  organizationType: 'DIRECT_CARRIER', verificationStatus: 'MARKETPLACE_APPROVED',
  marketplaceStatus: 'ACTIVE', states: ['NV'], linesOfBusiness: ['PERSONAL_AUTO'],
  createdAt: '2026-10-18T00:00:00.000Z'
} as any;

const carrierRule = {
  id: 'rule-nv-carrier-authority', ruleCode: 'NV-CARRIER-AUTHORITY',
  enforcementPoint: 'PROVIDER_AUTHORITY', effectiveFrom: '2026-01-01', effectiveTo: undefined,
  machineRule: { kind: 'CARRIER_AUTHORITY', certificateOfAuthorityRequired: true }
} as any;

test('direct carrier is denied when a carrier-authority rule requires missing certificate evidence', () => {
  const result = evaluateProviderJurisdictionAuthority({ organization: undefined, org: organization,
    licenses: [], carrierRelationships: [], rules: [carrierRule], jurisdictionCode: 'NV',
    insuranceLine: 'PERSONAL_AUTO', evaluationDate: '2026-10-18' } as any);
  assert.equal(result.outcome, 'NOT_AUTHORIZED');
  assert.match(result.reasons.join(' '), /no current verified certificate-of-authority evidence/);
});

test('direct carrier is authorized only from current verified organization-level certificate evidence', () => {
  const result = evaluateProviderJurisdictionAuthority({ org: organization, carrierRelationships: [],
    rules: [carrierRule], jurisdictionCode: 'NV', insuranceLine: 'PERSONAL_AUTO', evaluationDate: '2026-10-18',
    licenses: [{ id: 'coa-nv', providerOrganizationId: organization.id, jurisdiction: 'NV',
      licenseNumber: 'NV-COA-001', licenseType: 'CARRIER_CERTIFICATE_OF_AUTHORITY', status: 'ACTIVE',
      expirationDate: '2027-12-31', verificationStatus: 'VERIFIED',
      verificationSource: 'Nevada Division of Insurance', verifiedBy: 'platform-admin',
      createdAt: '2026-10-17T00:00:00.000Z' }]
  } as any);
  assert.equal(result.outcome, 'AUTHORIZED');
  assert.match(result.reasons.join(' '), /verified certificate NV-COA-001/);
});
