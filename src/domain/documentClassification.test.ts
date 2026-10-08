import test from 'node:test';
import assert from 'node:assert/strict';
import type { PolicyDocumentRecord } from '../types/insurance';
import { classifyCleanPolicyDocument, classifyInsuranceDocument } from './documentClassification';

const base = {
  documentId: 'DOC-test', documentGeneration: '9', sourceSha256: 'b'.repeat(64)
};

test('classifies declarations evidence from page text rather than filename or endpoint', () => {
  const result = classifyInsuranceDocument({ ...base, pages: [
    { pageNumber: 1, text: 'Auto insurance amended declarations' },
    { pageNumber: 2, text: 'Coverage premiums, limits and deductibles. Total premium.' }
  ] });
  assert.equal(result.classification, 'DECLARATIONS_PAGE');
  assert.equal(result.requiresReview, false);
  assert.deepEqual(result.evidencePageNumbers, [1, 2]);
});

test('classifies a full policy containing declarations and contract terms', () => {
  const result = classifyInsuranceDocument({ ...base, pages: [
    { pageNumber: 1, text: 'Declarations and total premium coverage limits' },
    { pageNumber: 3, text: 'Personal Auto Insurance Policy' },
    { pageNumber: 4, text: 'Definitions and policy exclusions' }
  ] });
  assert.equal(result.classification, 'FULL_POLICY');
  assert.equal(result.confidence, 0.99);
});

test('insurance card remains supporting evidence rather than declarations', () => {
  const result = classifyInsuranceDocument({ ...base, pages: [
    { pageNumber: 1, text: 'Nevada Insurance Identification Card. Evidence must be carried for production upon demand.' }
  ] });
  assert.equal(result.classification, 'INSURANCE_CARD');
});

test('uncertain and unsupported documents require review and never become policy truth', () => {
  const uncertain = classifyInsuranceDocument({ ...base, pages: [{ pageNumber: 1, text: 'Endorsement notice' }] });
  assert.equal(uncertain.classification, 'ENDORSEMENT');
  assert.equal(uncertain.requiresReview, true);
  const unsupported = classifyInsuranceDocument({ ...base, pages: [{ pageNumber: 1, text: 'Restaurant receipt' }] });
  assert.equal(unsupported.classification, 'UNSUPPORTED_NON_POLICY');
  assert.equal(unsupported.requiresReview, true);
});

test('classification refuses evidence without a clean security disposition', () => {
  const document = {
    id: 'DOC-test', ownerId: 'consumer', idempotencyKey: 'request-00000001', originalFileName: 'x.pdf',
    mimeType: 'application/pdf', byteLength: 10, sha256: 'b'.repeat(64), storageBucket: 'private',
    objectName: 'quarantine/x', objectGeneration: '9', status: 'UPLOADED', malwareStatus: 'PENDING_SCAN',
    createdAt: '', updatedAt: ''
  } satisfies PolicyDocumentRecord;
  assert.throws(() => classifyCleanPolicyDocument({ document, pages: [] }), /CLEAN/);
  assert.doesNotThrow(() => classifyCleanPolicyDocument({ document: { ...document, malwareStatus: 'CLEAN' }, pages: [] }));
});
