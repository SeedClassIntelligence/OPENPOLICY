import assert from 'node:assert/strict';
import test from 'node:test';
import {
  authorityEvidenceSha256,
  nextAuthorityReviewDate,
  normalizeEvidencePayload,
  resolveAuthoritySource
} from './providerAuthorityVerification';

test('Nevada authority evidence accepts only registered HTTPS sources', () => {
  assert.equal(resolveAuthoritySource('NV', 'https://doi.nv.gov/licensing/lookup').code, 'NV_DOI');
  assert.equal(resolveAuthoritySource('NV', 'https://pdb.nipr.com/producer/record').code, 'NIPR');
  assert.throws(() => resolveAuthoritySource('NV', 'http://doi.nv.gov/licensing/lookup'), /HTTPS/);
  assert.throws(() => resolveAuthoritySource('NV', 'https://example.com/fake-license'), /No approved authority source/);
  assert.throws(() => resolveAuthoritySource('OH', 'https://doi.nv.gov/licensing/lookup'), /No approved authority source/);
});

test('authority evidence is normalized, hashed deterministically, and scheduled for review', () => {
  const payload = normalizeEvidencePayload({ license: 'NV-12345', status: 'ACTIVE' });
  assert.equal(authorityEvidenceSha256(payload), authorityEvidenceSha256(payload));
  assert.equal(authorityEvidenceSha256(payload).length, 64);
  assert.throws(() => normalizeEvidencePayload('too short'), /captured authority-source result/);
  assert.equal(nextAuthorityReviewDate('2026-10-24T00:00:00.000Z', '2026-12-01'), '2026-11-01');
  assert.equal(nextAuthorityReviewDate('2026-10-24T00:00:00.000Z', '2028-12-01'), '2027-01-22');
});
