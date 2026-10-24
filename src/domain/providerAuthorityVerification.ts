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
  sourceRecordId: string;
  sourceName: string;
  sourceUrl: string;
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

export interface StructuredAuthorityEvidence {
  subjectType: ProviderAuthoritySubjectType;
  legalName?: string;
  carrierName?: string;
  jurisdiction: string;
  authorityNumber: string;
  sourceRecordId: string;
  status: string;
  expirationDate?: string;
  qualifications?: string[];
  insuranceLine?: string;
  npn?: string;
}

function normalizeIdentity(value: string): string {
  return value.normalize('NFKC').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function evidenceError(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 400 });
}

export function parseStructuredAuthorityEvidence(payload: unknown): StructuredAuthorityEvidence {
  let parsed: unknown = payload;
  if (typeof payload === 'string') {
    try { parsed = JSON.parse(payload); }
    catch { throw evidenceError('Authority evidence must be a structured JSON snapshot.'); }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw evidenceError('Authority evidence must be a structured JSON object.');
  }
  const value = parsed as Record<string, unknown>;
  const qualifications = value.qualifications;
  if (!value.subjectType || !value.jurisdiction || !value.authorityNumber || !value.sourceRecordId || !value.status) {
    throw evidenceError('Authority evidence requires subjectType, jurisdiction, authorityNumber, sourceRecordId, and status.');
  }
  if (qualifications !== undefined && (!Array.isArray(qualifications) || qualifications.some(item => typeof item !== 'string'))) {
    throw evidenceError('Authority evidence qualifications must be an array of strings.');
  }
  return {
    subjectType: String(value.subjectType) as ProviderAuthoritySubjectType,
    legalName: value.legalName ? String(value.legalName) : undefined,
    carrierName: value.carrierName ? String(value.carrierName) : undefined,
    jurisdiction: String(value.jurisdiction).toUpperCase(),
    authorityNumber: String(value.authorityNumber),
    sourceRecordId: String(value.sourceRecordId),
    status: String(value.status).toUpperCase(),
    expirationDate: value.expirationDate ? String(value.expirationDate).slice(0, 10) : undefined,
    qualifications: qualifications as string[] | undefined,
    insuranceLine: value.insuranceLine ? String(value.insuranceLine).toUpperCase() : undefined,
    npn: value.npn ? String(value.npn) : undefined
  };
}

export function assertAuthorityEvidenceMatches(input: {
  payload: unknown;
  subjectType: ProviderAuthoritySubjectType;
  legalName?: string;
  carrierName?: string;
  jurisdiction: string;
  authorityNumber: string;
  sourceRecordId: string;
  npn?: string;
  expirationDate?: string;
  insuranceLine?: string;
  requiredQualifications?: string[];
}): StructuredAuthorityEvidence {
  const evidence = parseStructuredAuthorityEvidence(input.payload);
  if (evidence.subjectType !== input.subjectType) throw evidenceError(`Authority evidence subjectType must be ${input.subjectType}.`);
  if (evidence.jurisdiction !== input.jurisdiction.toUpperCase()) throw evidenceError('Authority evidence jurisdiction does not match the application.');
  if (normalizeIdentity(evidence.authorityNumber) !== normalizeIdentity(input.authorityNumber)) throw evidenceError('Authority evidence number does not match the application.');
  if (normalizeIdentity(evidence.sourceRecordId) !== normalizeIdentity(input.sourceRecordId)) throw evidenceError('Authority evidence source record does not match the reviewed record.');
  if (input.npn && normalizeIdentity(evidence.npn || '') !== normalizeIdentity(input.npn)) throw evidenceError('Authority evidence NPN does not match the application.');
  if (evidence.status !== 'ACTIVE') throw evidenceError('Authority evidence must report ACTIVE status.');
  if (input.legalName && normalizeIdentity(evidence.legalName || '') !== normalizeIdentity(input.legalName)) {
    throw evidenceError('Authority evidence legal name does not match the application.');
  }
  if (input.carrierName && normalizeIdentity(evidence.carrierName || '') !== normalizeIdentity(input.carrierName)) {
    throw evidenceError('Authority evidence carrier name does not match the application.');
  }
  if (input.expirationDate && evidence.expirationDate !== input.expirationDate.slice(0, 10)) {
    throw evidenceError('Authority evidence expiration date does not match the reviewed expiration date.');
  }
  if (input.insuranceLine && evidence.insuranceLine !== input.insuranceLine.toUpperCase()) {
    throw evidenceError('Authority evidence insurance line does not match the application.');
  }
  const qualifications = new Set((evidence.qualifications || []).map(item => normalizeIdentity(item)));
  const expandedRequirements = (input.requiredQualifications || []).flatMap(required =>
    normalizeIdentity(required) === 'PROPERTY CASUALTY' ? ['PROPERTY', 'CASUALTY'] : [required]
  );
  for (const required of expandedRequirements) {
    if (!qualifications.has(normalizeIdentity(required))) throw evidenceError(`Authority evidence is missing required qualification ${required}.`);
  }
  return evidence;
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
