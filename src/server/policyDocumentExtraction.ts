import type { PolicyDocumentClassificationResult, PolicyDocumentRecord, PolicyNormalizationResult } from '../types/insurance';
import { classifyCleanPolicyDocument } from '../domain/documentClassification';
import type { DocumentAiOcrProvider, ProviderNeutralOcrDocument } from './documentAiOcrProvider';
import { normalizePolicyFields } from '../domain/policyFieldNormalization';

export interface ExactDocumentReader {
  readQuarantinedPdf(objectName: string, generation: string, sha256: string): Promise<Buffer>;
}

export interface PolicyDocumentClassificationRepository {
  commitPolicyDocumentExtraction(
    classification: PolicyDocumentClassificationResult,
    normalization: PolicyNormalizationResult
  ): Promise<{ classification: PolicyDocumentClassificationResult; normalization: PolicyNormalizationResult }>;
}

export async function extractAndClassifyPolicyDocument(input: {
  document: PolicyDocumentRecord;
  objectReader: ExactDocumentReader;
  ocrProvider: Pick<DocumentAiOcrProvider, 'extract'>;
  repository: PolicyDocumentClassificationRepository;
}): Promise<{ ocr: ProviderNeutralOcrDocument; classification: PolicyDocumentClassificationResult; normalization: PolicyNormalizationResult }> {
  if (input.document.status !== 'UPLOADED' || input.document.malwareStatus !== 'CLEAN') {
    throw new Error('OCR requires committed immutable evidence with a CLEAN malware disposition.');
  }
  const bytes = await input.objectReader.readQuarantinedPdf(
    input.document.objectName,
    input.document.objectGeneration,
    input.document.sha256
  );
  const ocr = await input.ocrProvider.extract({
    bytes,
    sourceSha256: input.document.sha256,
    sourceGeneration: input.document.objectGeneration
  });
  if (ocr.sourceSha256 !== input.document.sha256 || ocr.sourceGeneration !== input.document.objectGeneration) {
    throw new Error('OCR result is not bound to the committed immutable evidence.');
  }
  const proposed = classifyCleanPolicyDocument({
    document: input.document,
    pages: ocr.pages.map(page => ({ pageNumber: page.pageNumber, text: page.text })),
    classifierVersion: '1.0.0'
  });
  const normalization = normalizePolicyFields({ documentId: input.document.id, ocr });
  const committed = await input.repository.commitPolicyDocumentExtraction(proposed, normalization);
  return { ocr, ...committed };
}
