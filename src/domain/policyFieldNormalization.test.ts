import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePolicyFields } from './policyFieldNormalization';

const ocr = (text: string) => ({
  runId: 'OCR-1', sourceSha256: 'a'.repeat(64), sourceGeneration: '9',
  extractor: 'GOOGLE_DOCUMENT_AI' as const, extractorVersion: 'test', processedAt: '',
  pages: [{ pageNumber: 3, text, regions: [{ textStart: 0, textEnd: text.length, confidence: .99, normalizedVertices: [] }] }]
});

test('normalizes bounded policy fields with page-level evidence and no invented values', () => {
  const result = normalizePolicyFields({ documentId: 'DOC-1', now: '2026-10-07T00:00:00Z', ocr: ocr([
    'Policy Number: ABC-12345', 'Insurance Company: Root Insurance Company', 'Named Insured: Jane Consumer',
    'Policy State: NV', 'Effective Date: 10/05/2025', 'Expiration Date: 10/05/2026', 'Total Premium: $1,234.50'
  ].join('\n')) });
  assert.equal(result.status, 'READY_FOR_CONSUMER');
  assert.equal(result.fields.find(field => field.fieldPath === 'annualPremium')?.value, 1234.5);
  assert.equal(result.fields.find(field => field.fieldPath === 'effectiveDate')?.value, '2025-10-05');
  assert.ok(result.fields.every(field => field.evidence.pageNumber === 3 && field.evidence.verifiedByConsumer === false));
  assert.equal(result.sourceSha256, 'a'.repeat(64));
});

test('fails closed to review when critical fields are absent', () => {
  const result = normalizePolicyFields({ documentId: 'DOC-2', ocr: ocr('Policy Number: ONLY-ONE') });
  assert.equal(result.status, 'REVIEW_REQUIRED');
  assert.ok(result.criticalIssues.includes('Missing required field: carrier'));
  assert.equal(result.fields.some(field => field.fieldPath === 'carrier'), false);
});
