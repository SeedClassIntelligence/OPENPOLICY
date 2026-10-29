export type CandidatePreviewRole = 'CONSUMER' | 'PROVIDER' | 'ADMIN';

const ROLE_BY_QUERY: Record<string, CandidatePreviewRole> = {
  consumer: 'CONSUMER',
  provider: 'PROVIDER',
  owner: 'ADMIN',
  admin: 'ADMIN'
};

export function candidatePreviewRole(): CandidatePreviewRole | null {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname.toLowerCase();
  // Never expose synthetic identities on the canonical public domain. Preview
  // URLs are available only on tagged Cloud Run acceptance hosts.
  if (!host.endsWith('.a.run.app')) return null;
  return ROLE_BY_QUERY[new URLSearchParams(window.location.search).get('preview') || ''] || null;
}

export function isCandidatePreview(): boolean {
  return candidatePreviewRole() !== null;
}

