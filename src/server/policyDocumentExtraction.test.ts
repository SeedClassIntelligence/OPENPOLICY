import test from 'node:test';
import assert from 'node:assert/strict';
import type { PolicyDocumentRecord } from '../types/insurance';
import { extractAndClassifyPolicyDocument } from './policyDocumentExtraction';

const document = (overrides: Partial<PolicyDocumentRecord> = {}): PolicyDocumentRecord => ({
  id: 'DOC-1', ownerId: 'consumer-1', idempotencyKey: 'request-00000001', originalFileName: 'policy.pdf',
  mimeType: 'application/pdf', byteLength: 4, sha256: 'a'.repeat(64), storageBucket: 'evidence',
  objectName: 'quarantine/x/DOC-1/original.pdf', objectGeneration: '9', status: 'UPLOADED',
  malwareStatus: 'CLEAN', createdAt: '', updatedAt: '', ...overrides
});

test('reads the exact clean generation, classifies provider-neutral OCR, and commits once', async () => {
  const reads: unknown[][] = [];
  const commits: any[] = [];
  const result = await extractAndClassifyPolicyDocument({
    document: document(),
    objectReader: { async readQuarantinedPdf(...args) { reads.push(args); return Buffer.from('data'); } },
    ocrProvider: { async extract() { return {
      runId: 'OCR-1', sourceSha256: 'a'.repeat(64), sourceGeneration: '9',
      extractor: 'GOOGLE_DOCUMENT_AI' as const, extractorVersion: 'test', processedAt: '', pages: [
        { pageNumber: 1, text: 'Declarations coverage limits and total premium', regions: [] },
        { pageNumber: 2, text: 'Personal Auto Insurance Policy definitions exclusions', regions: [] }
      ]
    }; } },
    repository: { async commitPolicyDocumentClassification(value) { commits.push(value); return value; } }
  });
  assert.deepEqual(reads[0], ['quarantine/x/DOC-1/original.pdf', '9', 'a'.repeat(64)]);
  assert.equal(result.classification.classification, 'FULL_POLICY');
  assert.equal(commits.length, 1);
  assert.equal(result.classification.sourceSha256, 'a'.repeat(64));
});

test('refuses pending, malicious, and mismatched OCR evidence before classification commit', async () => {
  const reader = { async readQuarantinedPdf() { return Buffer.from('data'); } };
  const repository = { async commitPolicyDocumentClassification(value: any) { return value; } };
  const ocrProvider = { async extract() { return {
    runId: 'OCR-1', sourceSha256: 'b'.repeat(64), sourceGeneration: '9', extractor: 'GOOGLE_DOCUMENT_AI' as const,
    extractorVersion: 'test', processedAt: '', pages: [{ pageNumber: 1, text: 'x', regions: [] }]
  }; } };
  await assert.rejects(() => extractAndClassifyPolicyDocument({
    document: document({ malwareStatus: 'PENDING_SCAN' }), objectReader: reader, ocrProvider, repository
  }), /CLEAN/);
  await assert.rejects(() => extractAndClassifyPolicyDocument({
    document: document({ malwareStatus: 'REJECTED_MALICIOUS' }), objectReader: reader, ocrProvider, repository
  }), /CLEAN/);
  await assert.rejects(() => extractAndClassifyPolicyDocument({
    document: document(), objectReader: reader, ocrProvider, repository
  }), /not bound/);
});
