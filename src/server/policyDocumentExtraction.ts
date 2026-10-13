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

export function applyClassificationReviewGate(
  classification: PolicyDocumentClassificationResult,
  normalization: PolicyNormalizationResult
): PolicyNormalizationResult {
  if (!classification.requiresReview) return normalization;
  const lineDisposition = classification.lineAssessment?.disposition;
  const issue = lineDisposition === 'CONFLICT'
    ? `Declared insurance line ${classification.lineAssessment?.declaredLine} conflicts with document evidence for ${classification.lineAssessment?.detectedLine}.`
    : lineDisposition === 'INDETERMINATE'
      ? `Document evidence did not establish the declared insurance line ${classification.lineAssessment?.declaredLine}.`
      : `Document classification ${classification.classification} requires review.`;
  return {
    ...normalization,
    status: 'REVIEW_REQUIRED',
    criticalIssues: normalization.criticalIssues.includes(issue)
      ? normalization.criticalIssues
      : [...normalization.criticalIssues, issue]
  };
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
  const normalization = applyClassificationReviewGate(
    proposed,
    normalizePolicyFields({ documentId: input.document.id, ocr })
  );
  const committed = await input.repository.commitPolicyDocumentExtraction(proposed, normalization);
  return { ocr, ...committed };
}
