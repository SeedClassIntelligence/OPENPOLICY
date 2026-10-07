import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { PolicyDocumentRecord } from '../types/insurance';
import { extractAndClassifyPolicyDocument } from './policyDocumentExtraction';
import { PostgresStore } from './db/postgresStore';

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
    repository: { async commitPolicyDocumentExtraction(classification, normalization) {
      commits.push({ classification, normalization }); return { classification, normalization };
    } }
  });
  assert.deepEqual(reads[0], ['quarantine/x/DOC-1/original.pdf', '9', 'a'.repeat(64)]);
  assert.equal(result.classification.classification, 'FULL_POLICY');
  assert.equal(commits.length, 1);
  assert.equal(result.classification.sourceSha256, 'a'.repeat(64));
});

test('refuses pending, malicious, and mismatched OCR evidence before classification commit', async () => {
  const reader = { async readQuarantinedPdf() { return Buffer.from('data'); } };
  const repository = { async commitPolicyDocumentExtraction(classification: any, normalization: any) {
    return { classification, normalization };
  } };
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

test('classification, normalized facts, workflow status, and audit survive restart as one durable result', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpolicy-extraction-restart-'));
  const first = new PostgresStore(dataDir);
  try {
    const pending = document({ status: 'UPLOAD_PENDING', objectGeneration: 'PENDING', malwareStatus: 'PENDING_SCAN' });
    await first.beginPolicyDocumentIngestion(pending);
    await first.completePolicyDocumentUpload({ ownerId: pending.ownerId, documentId: pending.id, objectGeneration: '9' });
    await first.recordPolicyDocumentMalwareDisposition({
      documentId: pending.id, objectGeneration: '9', sourceSha256: pending.sha256,
      status: 'CLEAN', scanner: 'CLAMAV', scannerVersion: 'test'
    });
    const committed = await extractAndClassifyPolicyDocument({
      document: document(),
      objectReader: { async readQuarantinedPdf() { return Buffer.from('data'); } },
      ocrProvider: { async extract() { return {
        runId: 'OCR-DURABLE', sourceSha256: 'a'.repeat(64), sourceGeneration: '9',
        extractor: 'GOOGLE_DOCUMENT_AI' as const, extractorVersion: 'test', processedAt: '', pages: [{
          pageNumber: 1,
          text: 'Policy Number: A-1234\nInsurance Company: Root Insurance\nNamed Insured: Consumer One\nPolicy State: NV\nEffective Date: 10/05/2025\nExpiration Date: 10/05/2026\nTotal Premium: $1,200.00',
          regions: []
        }]
      }; } }, repository: first
    });
    assert.equal(committed.normalization.status, 'READY_FOR_CONSUMER');
    const correction = await first.recordPolicyFieldCorrection({
      ownerId: pending.ownerId, documentId: pending.id, fieldPath: 'annualPremium', afterValue: 1195
    });
    assert.equal(correction.beforeValue, 1200);
    await first.close();
    const restarted = new PostgresStore(dataDir);
    const restored = await restarted.getPolicyDocumentExtraction(pending.ownerId, pending.id);
    const workflow = await restarted.getPolicyDocument(pending.ownerId, pending.id);
    assert.equal(restored?.extractionRunId, 'OCR-DURABLE');
    assert.equal(restored?.fields.find(field => field.fieldPath === 'annualPremium')?.value, 1200);
    const corrections = await restarted.getPolicyFieldCorrections(pending.ownerId, pending.id);
    assert.equal(workflow?.status, 'CONSUMER_CORRECTED');
    assert.equal(corrections[0]?.afterValue, 1195);
    assert.equal(restored?.fields.find(field => field.fieldPath === 'annualPremium')?.value, 1200);
    assert.equal(await restarted.getPolicyDocumentExtraction('other-owner', pending.id), undefined);
    assert.deepEqual(await restarted.getPolicyFieldCorrections('other-owner', pending.id), []);
    await restarted.close();
  } finally {
    await first.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
