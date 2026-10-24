import assert from 'node:assert/strict';
import test from 'node:test';
import {
  authorityEvidenceSha256,
  assertAuthorityEvidenceMatches,
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

test('structured Nevada organization evidence is bound to identity, license, status, expiration, and qualifications', () => {
  const evidence = {
    subjectType: 'ORGANIZATION_LICENSE', legalName: 'All Nevada Insurance Inc.', jurisdiction: 'NV',
    authorityNumber: '16331', sourceRecordId: '16331', status: 'ACTIVE', expirationDate: '2029-11-30',
    qualifications: ['Casualty', 'Health', 'Life', 'Property']
  };
  assert.equal(assertAuthorityEvidenceMatches({ payload: evidence, subjectType: 'ORGANIZATION_LICENSE',
    legalName: 'All Nevada Insurance Inc', jurisdiction: 'NV', authorityNumber: '16331',
    sourceRecordId: '16331',
    expirationDate: '2029-11-30', requiredQualifications: ['PROPERTY', 'CASUALTY'] }).authorityNumber, '16331');
  assert.throws(() => assertAuthorityEvidenceMatches({ payload: { ...evidence, authorityNumber: '47854' },
    subjectType: 'ORGANIZATION_LICENSE', legalName: 'All Nevada Insurance Inc', jurisdiction: 'NV',
    authorityNumber: '16331', sourceRecordId: '16331', expirationDate: '2029-11-30' }), /number does not match/);
  assert.throws(() => assertAuthorityEvidenceMatches({ payload: { ...evidence, legalName: 'Fabricated Agency LLC' },
    subjectType: 'ORGANIZATION_LICENSE', legalName: 'All Nevada Insurance Inc', jurisdiction: 'NV',
    authorityNumber: '16331', sourceRecordId: '16331', expirationDate: '2029-11-30' }), /legal name does not match/);
  assert.throws(() => assertAuthorityEvidenceMatches({ payload: { ...evidence, qualifications: ['HEALTH'] },
    subjectType: 'ORGANIZATION_LICENSE', legalName: 'All Nevada Insurance Inc', jurisdiction: 'NV',
    authorityNumber: '16331', sourceRecordId: '16331', expirationDate: '2029-11-30', requiredQualifications: ['PROPERTY', 'CASUALTY'] }), /missing required qualification/);
});

test('free-form, expired, inactive, and wrong-jurisdiction evidence fails closed', () => {
  const input = { subjectType: 'INDIVIDUAL_LICENSE' as const, legalName: 'Test Producer', jurisdiction: 'NV',
    authorityNumber: '51989', sourceRecordId: '51989', expirationDate: '2028-01-31', requiredQualifications: ['PROPERTY_CASUALTY'] };
  assert.throws(() => assertAuthorityEvidenceMatches({ ...input, payload: 'looks valid but is not structured JSON' }), /structured JSON/);
  const valid = { subjectType: 'INDIVIDUAL_LICENSE', legalName: 'Test Producer', jurisdiction: 'NV',
    authorityNumber: '51989', sourceRecordId: '51989', status: 'ACTIVE', expirationDate: '2028-01-31', qualifications: ['PROPERTY', 'CASUALTY'] };
  assert.throws(() => assertAuthorityEvidenceMatches({ ...input, payload: { ...valid, status: 'EXPIRED' } }), /ACTIVE status/);
  assert.throws(() => assertAuthorityEvidenceMatches({ ...input, payload: { ...valid, jurisdiction: 'CA' } }), /jurisdiction/);
  assert.throws(() => assertAuthorityEvidenceMatches({ ...input, payload: { ...valid, expirationDate: '2027-01-31' } }), /expiration date/);
});

test('authority evidence is normalized, hashed deterministically, and scheduled for review', () => {
  const payload = normalizeEvidencePayload({ license: 'NV-12345', status: 'ACTIVE' });
  assert.equal(authorityEvidenceSha256(payload), authorityEvidenceSha256(payload));
  assert.equal(authorityEvidenceSha256(payload).length, 64);
  assert.throws(() => normalizeEvidencePayload('too short'), /captured authority-source result/);
  assert.equal(nextAuthorityReviewDate('2026-10-24T00:00:00.000Z', '2026-12-01'), '2026-11-01');
  assert.equal(nextAuthorityReviewDate('2026-10-24T00:00:00.000Z', '2028-12-01'), '2026-11-23');
});
