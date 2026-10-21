import type { JurisdictionRule, JurisdictionRuleSet, RegulatoryAuthority, RegulatorySource } from '../types/jurisdiction';

export const NEVADA_WAVE0_RULESET_ID = 'NV-PERSONAL-AUTO-PROVIDER-AUTHORITY-2026-10-20';
export const NEVADA_WAVE0_AUTHOR_ID = 'CODEX_STAGE_2_AUTHOR';
export const NEVADA_WAVE0_FOUNDER_ID = 'OPEN_POLICI_FOUNDER';
export const NEVADA_WAVE0_FOUNDER_VERIFIED_AT = '2026-10-20T00:00:00.000Z';

export const nevadaWave0Authority: RegulatoryAuthority = {
  id: 'NV-LEGISLATURE', jurisdictionCode: 'NV', name: 'Nevada Legislature', kind: 'LEGISLATURE',
  officialUrl: 'https://www.leg.state.nv.us/'
};

export const nevadaWave0ProviderAuthoritySources: RegulatorySource[] = [
  {
    id: 'NV-NRS-683A-CURRENT-2026-10-07', jurisdictionCode: 'NV', authorityId: nevadaWave0Authority.id,
    sourceType: 'STATUTE', citation: 'NRS 683A.201, 683A.251, 683A.261 and 683A.321',
    title: 'Nevada Revised Statutes Chapter 683A — Persons Involved in Sale or Administration of Insurance',
    officialUrl: 'https://www.leg.state.nv.us/NRS/NRS-683A.html', retrievedAt: '2026-10-07T22:09:55.543Z',
    contentSha256: '9aff9233a4d3e484c532c86a45d6c300131e7d8bb02aaaa9b9f06c61bd676ae6',
    archivedCopyRef: 'research/pr0b/NV/sources/9aff9233a4d3e484c532c86a45d6c300131e7d8bb02aaaa9b9f06c61bd676ae6.html'
  },
  {
    id: 'NV-NRS-680A-CURRENT-2026-10-07', jurisdictionCode: 'NV', authorityId: nevadaWave0Authority.id,
    sourceType: 'STATUTE', citation: 'NRS 680A.060',
    title: 'Nevada Revised Statutes Chapter 680A — Authorization of Insurers and General Requirements',
    officialUrl: 'https://www.leg.state.nv.us/NRS/NRS-680A.html', retrievedAt: '2026-10-07T22:09:55.000Z',
    contentSha256: 'a32839dde731f94399b5e68ac9372b48d4f2283fc6b51f77542c31132c0c5071',
    archivedCopyRef: 'research/pr0b/NV/sources/a32839dde731f94399b5e68ac9372b48d4f2283fc6b51f77542c31132c0c5071.html'
  }
];

export const nevadaWave0ProviderAuthorityCandidateRuleSet: JurisdictionRuleSet = {
  id: NEVADA_WAVE0_RULESET_ID, jurisdictionCode: 'NV', insuranceLine: 'PERSONAL_AUTO', version: 1,
  status: 'DRAFT', publicationScope: 'SANDBOX_ONLY', authoredBy: NEVADA_WAVE0_AUTHOR_ID, createdAt: '2026-10-20T00:00:00.000Z'
};

/** Narrow current-transaction pack, founder-approved for local publication testing only. */
export const nevadaWave0ProviderAuthorityCandidateRules: JurisdictionRule[] = [
  {
    id: 'NV-PROVIDER-AUTHORITY-CURRENT-001', ruleSetId: NEVADA_WAVE0_RULESET_ID,
    ruleCode: 'NV.PERSONAL_AUTO.PROVIDER_AUTHORITY.CURRENT', ruleCategory: 'PRODUCER_LICENSING',
    enforcementPoint: 'PROVIDER_AUTHORITY', temporalBasis: 'transactionDate',
    requirementText: 'For a current Nevada personal-auto transaction, a producer organization and the authenticated natural-person producer must hold applicable active authority. An agent must have an active appointment with the insurer; a broker does not require appointment but must place through a licensed agent of an authorized insurer.',
    sourceIds: ['NV-NRS-683A-CURRENT-2026-10-07'], effectiveFrom: '2023-10-01',
    verificationStatus: 'VERIFIED', verifiedAt: NEVADA_WAVE0_FOUNDER_VERIFIED_AT, verifiedBy: NEVADA_WAVE0_FOUNDER_ID,
    machineRule: {
      kind: 'PRODUCER_AUTHORITY',
      acceptedLicenseClasses: ['PERSONAL_LINES', 'PROPERTY', 'CASUALTY', 'PROPERTY_CASUALTY', 'PROPERTY_AND_CASUALTY', 'PROPERTY_CASUALTY_BROKER', 'AGENT', 'BROKER'],
      entityLicenseRequired: true, individualLicenseRequired: true, appointmentRequired: false,
      carrierRelationshipRequirementByTransactionRole: { AGENT: ['APPOINTED'], BROKER: ['AUTHORIZED_BROKER'] }
    }
  },
  {
    id: 'NV-CARRIER-AUTHORITY-CURRENT-001', ruleSetId: NEVADA_WAVE0_RULESET_ID,
    ruleCode: 'NV.PERSONAL_AUTO.CARRIER_AUTHORITY.CURRENT', ruleCategory: 'CARRIER_AUTHORITY',
    enforcementPoint: 'PROVIDER_AUTHORITY', temporalBasis: 'transactionDate',
    requirementText: 'A direct carrier transacting Nevada personal-auto insurance must hold current verified certificate-of-authority evidence for Nevada.',
    sourceIds: ['NV-NRS-680A-CURRENT-2026-10-07'], effectiveFrom: '1985-10-01',
    verificationStatus: 'VERIFIED', verifiedAt: NEVADA_WAVE0_FOUNDER_VERIFIED_AT, verifiedBy: NEVADA_WAVE0_FOUNDER_ID,
    machineRule: { kind: 'CARRIER_AUTHORITY', certificateOfAuthorityRequired: true }
  }
];
