import { createHash } from 'node:crypto';

export type ProviderAuthorityEvidenceStatus = 'VERIFIED' | 'REJECTED' | 'STALE';
export type ProviderAuthoritySubjectType = 'ORGANIZATION_LICENSE' | 'INDIVIDUAL_LICENSE' | 'CARRIER_AUTHORITY' | 'CARRIER_RELATIONSHIP';

export interface ProviderAuthorityEvidence {
  id: string;
  applicationId: string;
  providerOrganizationId: string;
  providerUserId?: string;
  subjectType: ProviderAuthoritySubjectType;
  jurisdiction: string;
  insuranceLine?: string;
  authorityNumber: string;
  sourceName: string;
  sourceUrl: string;
  sourceRecordId: string;
  retrievedAt: string;
  effectiveDate?: string;
  expirationDate?: string;
  status: ProviderAuthorityEvidenceStatus;
  evidenceSha256: string;
  evidencePayload: string;
  submittedBy: string;
  verifiedBy: string;
  verifiedAt: string;
  nextReviewAt: string;
}

export interface AuthoritySourceDefinition {
  code: string;
  name: string;
  jurisdictions: string[];
  allowedHosts: string[];
}

// Source policy is data-driven. Nevada is the first activated jurisdiction;
// additional state registries are added as their regional RulePacks mature.
export const AUTHORITY_SOURCE_REGISTRY: AuthoritySourceDefinition[] = [
  {
    code: 'NV_DOI',
    name: 'Nevada Division of Insurance',
    jurisdictions: ['NV'],
    allowedHosts: ['doi.nv.gov', 'di.nv.gov']
  },
  {
    code: 'NIPR',
    name: 'National Insurance Producer Registry',
    jurisdictions: ['NV'],
    allowedHosts: ['nipr.com', 'www.nipr.com', 'pdb.nipr.com']
  },
  {
    code: 'SIRCON',
    name: 'Sircon',
    jurisdictions: ['NV'],
    allowedHosts: ['sircon.com', 'www.sircon.com']
  }
];

export function resolveAuthoritySource(jurisdiction: string, sourceUrl: string): AuthoritySourceDefinition {
  let parsed: URL;
  try { parsed = new URL(sourceUrl); }
  catch { throw Object.assign(new Error('Authority evidence requires a valid authoritative source URL.'), { statusCode: 400 }); }
  if (parsed.protocol !== 'https:') {
    throw Object.assign(new Error('Authority evidence source URL must use HTTPS.'), { statusCode: 400 });
  }
  const host = parsed.hostname.toLowerCase();
  const source = AUTHORITY_SOURCE_REGISTRY.find(item =>
    item.jurisdictions.includes(jurisdiction.toUpperCase()) &&
    item.allowedHosts.some(allowed => host === allowed || host.endsWith(`.${allowed}`))
  );
  if (!source) {
    throw Object.assign(new Error(`No approved authority source is registered for ${jurisdiction} at ${host}.`), { statusCode: 400 });
  }
  return source;
}

export function normalizeEvidencePayload(payload: unknown): string {
  const value = typeof payload === 'string' ? payload.trim() : JSON.stringify(payload);
  if (!value || value.length < 20) {
    throw Object.assign(new Error('A captured authority-source result is required.'), { statusCode: 400 });
  }
  return value;
}

export function authorityEvidenceSha256(payload: string): string {
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

export function nextAuthorityReviewDate(verifiedAt: string, expirationDate?: string): string {
  const thirtyDays = new Date(new Date(verifiedAt).getTime() + 30 * 86_400_000).toISOString().slice(0, 10);
  if (!expirationDate) return thirtyDays;
  const advance = new Date(`${expirationDate.slice(0, 10)}T00:00:00.000Z`);
  advance.setUTCDate(advance.getUTCDate() - 30);
  return advance.toISOString().slice(0, 10) < thirtyDays ? advance.toISOString().slice(0, 10) : thirtyDays;
}
