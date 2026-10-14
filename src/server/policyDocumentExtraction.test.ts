import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { PolicyDocumentRecord } from '../types/insurance';
import { applyClassificationReviewGate, extractAndClassifyPolicyDocument } from './policyDocumentExtraction';
import { PostgresStore } from './db/postgresStore';
import { getPolicyLineSchema } from '../domain/policyLineSchemas';

const document = (overrides: Partial<PolicyDocumentRecord> = {}): PolicyDocumentRecord => ({
  id: 'DOC-1', ownerId: 'consumer-1', idempotencyKey: 'request-00000001', originalFileName: 'policy.pdf',
  mimeType: 'application/pdf', byteLength: 4, sha256: 'a'.repeat(64), storageBucket: 'evidence',
  objectName: 'quarantine/x/DOC-1/original.pdf', objectGeneration: '9', status: 'UPLOADED',
  malwareStatus: 'CLEAN', createdAt: '', updatedAt: '', ...overrides
});

test('line conflict forces the durable extraction disposition to review required', () => {
  const gated = applyClassificationReviewGate({
    id:'C1',documentId:'D1',documentGeneration:'1',sourceSha256:'a'.repeat(64),classification:'DECLARATIONS_PAGE',
    confidence:.99,classifier:'test',classifierVersion:'1',evidencePageNumbers:[1],evidenceReferences:[],requiresReview:true,
    classifiedAt:'2026-10-12T00:00:00Z',lineAssessment:{declaredLine:'HOMEOWNERS',detectedLine:'COMMERCIAL_GENERAL_LIABILITY',disposition:'CONFLICT',confidence:.95,evidenceReferences:['LINE_CGL_TITLE']}
  }, {
    extractionRunId:'E1',documentId:'D1',documentGeneration:'1',sourceSha256:'a'.repeat(64),normalizer:'test',normalizerVersion:'1',
    fields:[],criticalIssues:[],status:'READY_FOR_CONSUMER',normalizedAt:'2026-10-12T00:00:00Z'
  });
  assert.equal(gated.status, 'REVIEW_REQUIRED');
  assert.match(gated.criticalIssues[0], /conflicts with document evidence/);
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
    assert.equal(committed.normalization.status, 'REVIEW_REQUIRED');
    assert.ok(committed.normalization.criticalIssues.includes('Missing required field: vehicle.ownership'));
    const correction = await first.recordPolicyFieldCorrection({
      ownerId: pending.ownerId, documentId: pending.id, fieldPath: 'annualPremium', afterValue: 1195
    });
    assert.equal(correction.beforeValue, 1200);
    for (const [fieldPath, afterValue] of [
      ['vehicle.vin','1HGCM82633A004352'],['vehicle.year',2022],['vehicle.make','Honda'],['vehicle.model','Accord'],
      ['vehicle.usage','COMMUTE'],['vehicle.annualMileage',10000],['vehicle.garagingZip','89101'],['vehicle.ownership','OWNED'],
      ['coverage.bodilyInjury.perPersonLimit',100000],['coverage.bodilyInjury.perAccidentLimit',300000],
      ['coverage.propertyDamage.propertyLimit',100000],
      ['coverage.medicalPayments.included',1],['coverage.rentalReimbursement.included',1],
      ['coverage.umUim.included',1],['coverage.comprehensive.included',1],
      ['coverage.collision.included',1],['coverage.roadsideAssistance.included',0]
    ] as const) await first.recordPolicyFieldCorrection({ ownerId:pending.ownerId,documentId:pending.id,fieldPath,afterValue });
    const verified = await first.verifyPolicyDocumentEvidence({ ownerId:pending.ownerId,documentId:pending.id });
    const retried = await first.verifyPolicyDocumentEvidence({ ownerId:pending.ownerId,documentId:pending.id });
    assert.equal(retried.policy.id,verified.policy.id);
    assert.equal(retried.baseline.id,verified.baseline.id);
    await first.close();
    const restarted = new PostgresStore(dataDir);
    const restored = await restarted.getPolicyDocumentExtraction(pending.ownerId, pending.id);
    const workflow = await restarted.getPolicyDocument(pending.ownerId, pending.id);
    assert.equal(restored?.extractionRunId, 'OCR-DURABLE');
    assert.equal(restored?.fields.find(field => field.fieldPath === 'annualPremium')?.value, 1200);
    const corrections = await restarted.getPolicyFieldCorrections(pending.ownerId, pending.id);
    assert.equal(workflow?.status, 'BASELINE_CREATED');
    assert.equal(corrections[0]?.afterValue, 1195);
    assert.equal(restored?.fields.find(field => field.fieldPath === 'annualPremium')?.value, 1200);
    assert.equal(await restarted.getPolicyDocumentExtraction('other-owner', pending.id), undefined);
    assert.deepEqual(await restarted.getPolicyFieldCorrections('other-owner', pending.id), []);
    const restoredVerified = await restarted.verifyPolicyDocumentEvidence({ ownerId:pending.ownerId,documentId:pending.id });
    assert.equal(restoredVerified.policy.id,verified.policy.id);
    assert.equal(restoredVerified.baseline.baselineAnnualPremium,1195);
    await restarted.close();
  } finally {
    await first.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('a non-auto verified baseline preserves line facts across restart without a manufactured vehicle', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpolicy-home-baseline-restart-'));
  const first = new PostgresStore(dataDir);
  try {
    const pending = document({
      id:'DOC-HOME',ownerId:'consumer-home',idempotencyKey:'home-request-0001',
      objectName:'quarantine/home/DOC-HOME/original.pdf',status:'UPLOAD_PENDING',objectGeneration:'PENDING',
      malwareStatus:'PENDING_SCAN',insuranceLine:'HOMEOWNERS'
    });
    await first.beginPolicyDocumentIngestion(pending);
    await first.completePolicyDocumentUpload({ownerId:pending.ownerId,documentId:pending.id,objectGeneration:'10'});
    await first.recordPolicyDocumentMalwareDisposition({
      documentId:pending.id,objectGeneration:'10',sourceSha256:pending.sha256,status:'CLEAN',scanner:'CLAMAV',scannerVersion:'test'
    });
    const schema = getPolicyLineSchema('HOMEOWNERS')!;
    const fields = schema.fields.map((definition,index) => ({
      fieldPath:definition.path as any,
      value:definition.path==='effectiveDate'?'2027-01-01'
        :definition.path==='expirationDate'?'2028-01-01'
          :definition.kind==='MONEY'||definition.kind==='LIMIT'||definition.kind==='DEDUCTIBLE'||definition.kind==='INTEGER'?1000+index
            :definition.kind==='BOOLEAN'?1
              :definition.path==='jurisdiction'?'NV':`${definition.label} value`,
      confidence:.99,evidence:{documentId:pending.id,documentName:pending.originalFileName,pageNumber:1,extractedSnippet:definition.label,confidence:.99,verifiedByConsumer:false}
    }));
    await first.commitPolicyDocumentExtraction({
      id:'CLS-HOME',documentId:pending.id,documentGeneration:'10',sourceSha256:pending.sha256,
      classification:'DECLARATIONS_PAGE',confidence:.99,classifier:'test',classifierVersion:'1',evidencePageNumbers:[1],
      evidenceReferences:['HOME_DECLARATIONS'],requiresReview:false,classifiedAt:'2026-10-13T00:00:00Z',
      lineAssessment:{declaredLine:'HOMEOWNERS',detectedLine:'HOMEOWNERS',disposition:'MATCH',confidence:.99,evidenceReferences:['HOME_DECLARATIONS']}
    },{
      extractionRunId:'OCR-HOME',documentId:pending.id,documentGeneration:'10',sourceSha256:pending.sha256,
      normalizer:'OPENPOLICY_HOMEOWNERS_FIELDS',normalizerVersion:'1.0.0',fields,criticalIssues:[],
      status:'READY_FOR_CONSUMER',normalizedAt:'2026-10-13T00:00:00Z'
    });
    const verified = await first.verifyPolicyDocumentEvidence({ownerId:pending.ownerId,documentId:pending.id});
    assert.equal(verified.policy.insuranceLine,'HOMEOWNERS');
    assert.deepEqual(verified.policy.vehicles,[]);
    assert.equal(verified.baseline.vehicle,undefined);
    assert.equal(verified.baseline.verifiedFacts?.['coverage.dwelling.limit'],1011);
    await first.close();

    const restarted = new PostgresStore(dataDir);
    const restored = await restarted.verifyPolicyDocumentEvidence({ownerId:pending.ownerId,documentId:pending.id});
    assert.equal(restored.policy.id,verified.policy.id);
    assert.equal(restored.baseline.insuranceLine,'HOMEOWNERS');
    assert.equal(restored.baseline.vehicle,undefined);
    assert.equal(restored.baseline.verifiedFacts?.['coverage.dwelling.limit'],1011);
    await restarted.close();
  } finally {
    await first.close();
    fs.rmSync(dataDir,{recursive:true,force:true});
  }
});
