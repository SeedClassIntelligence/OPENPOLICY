import crypto from 'crypto';
import type { PolicyDocumentRecord } from '../types/insurance';
import { buildQuarantineObjectName, validateDeclarationsPdf } from '../domain/documentIntelligence';
import type { DocumentObjectStore } from './documentObjectStore';

export interface PolicyDocumentRepository {
  beginPolicyDocumentIngestion(record: PolicyDocumentRecord): Promise<PolicyDocumentRecord>;
  completePolicyDocumentUpload(input: {
    ownerId: string; documentId: string; objectGeneration: string;
  }): Promise<PolicyDocumentRecord>;
}

export async function ingestPolicyDocument(input: {
  ownerId: string;
  idempotencyKey: string;
  fileName?: string;
  contentType?: string;
  bytes: Buffer;
  repository: PolicyDocumentRepository;
  objectStore: DocumentObjectStore;
}): Promise<PolicyDocumentRecord> {
  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(input.idempotencyKey)) {
    throw Object.assign(new Error('A valid Idempotency-Key header is required.'), { statusCode: 400 });
  }
  const validation = validateDeclarationsPdf({
    bytes: input.bytes, contentType: input.contentType, fileName: input.fileName
  });
  if (!validation.valid) {
    throw Object.assign(new Error(validation.message), { statusCode: 400, code: validation.code });
  }

  const now = new Date().toISOString();
  const documentId = `DOC-${crypto.randomUUID()}`;
  const proposed: PolicyDocumentRecord = {
    id: documentId,
    ownerId: input.ownerId,
    idempotencyKey: input.idempotencyKey,
    originalFileName: validation.normalizedFileName,
    mimeType: 'application/pdf',
    byteLength: validation.byteLength,
    sha256: validation.sha256,
    storageBucket: input.objectStore.quarantineBucket,
    objectName: buildQuarantineObjectName(input.ownerId, documentId),
    objectGeneration: 'PENDING',
    status: 'UPLOAD_PENDING',
    malwareStatus: 'PENDING_SCAN',
    createdAt: now,
    updatedAt: now
  };
  const workflow = await input.repository.beginPolicyDocumentIngestion(proposed);
  if (workflow.sha256 !== validation.sha256 || workflow.byteLength !== validation.byteLength) {
    throw Object.assign(new Error('Idempotency key was already used for different evidence bytes.'), { statusCode: 409 });
  }
  if (workflow.status !== 'UPLOAD_PENDING') return workflow;

  let stored = await input.objectStore.findQuarantinedPdf(workflow.objectName, workflow.sha256);
  if (!stored) {
    try {
      stored = await input.objectStore.putQuarantinedPdf({
        objectName: workflow.objectName,
        bytes: input.bytes,
        sha256: workflow.sha256,
        documentId: workflow.id
      });
    } catch (error) {
      // A retry can race an earlier response. Reconcile only when the immutable object
      // metadata proves it is the same evidence; otherwise preserve UPLOAD_PENDING.
      stored = await input.objectStore.findQuarantinedPdf(workflow.objectName, workflow.sha256);
      if (!stored) throw error;
    }
  }
  return input.repository.completePolicyDocumentUpload({
    ownerId: input.ownerId, documentId: workflow.id, objectGeneration: stored.generation
  });
}
