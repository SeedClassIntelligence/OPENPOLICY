import crypto from 'crypto';
import type { InsuranceDocumentClassification, PolicyDocumentClassificationResult, PolicyDocumentRecord } from '../types/insurance';

export interface OcrPageEvidence {
  pageNumber: number;
  text: string;
}

const indicators: Array<{ code: string; pattern: RegExp }> = [
  { code: 'DECLARATIONS_HEADING', pattern: /\b(?:amended\s+)?declarations\b/i },
  { code: 'COVERAGE_LIMITS', pattern: /\bcoverage(?:s)?[,\s]+(?:premiums?,\s*)?limits?\b/i },
  { code: 'TOTAL_PREMIUM', pattern: /\btotal\s+premium\b/i },
  { code: 'POLICY_CONTRACT', pattern: /\bpersonal\s+auto\s+insurance\s+policy\b/i },
  { code: 'POLICY_DEFINITIONS', pattern: /\bdefinitions\b/i },
  { code: 'POLICY_EXCLUSIONS', pattern: /\bexclusions\b/i },
  { code: 'INSURANCE_CARD', pattern: /\binsurance\s+(?:identification\s+)?card\b/i },
  { code: 'PRODUCTION_ON_DEMAND', pattern: /\bproduction\s+upon\s+demand\b/i },
  { code: 'ENDORSEMENT', pattern: /\bendorsement\b/i }
];

export function classifyInsuranceDocument(input: {
  documentId: string;
  documentGeneration: string;
  sourceSha256: string;
  pages: OcrPageEvidence[];
  classifierVersion?: string;
}): PolicyDocumentClassificationResult {
  const found = new Map<string, number[]>();
  for (const page of input.pages) {
    for (const indicator of indicators) {
      if (indicator.pattern.test(page.text)) found.set(indicator.code, [...(found.get(indicator.code) || []), page.pageNumber]);
    }
  }
  const has = (code: string) => found.has(code);
  let classification: InsuranceDocumentClassification = 'UNCERTAIN';
  let confidence = 0.45;
  if (has('POLICY_CONTRACT') && has('POLICY_DEFINITIONS') && has('POLICY_EXCLUSIONS')) {
    classification = 'FULL_POLICY'; confidence = has('DECLARATIONS_HEADING') ? 0.99 : 0.96;
  } else if (has('DECLARATIONS_HEADING') && has('COVERAGE_LIMITS') && has('TOTAL_PREMIUM')) {
    classification = 'DECLARATIONS_PAGE'; confidence = 0.98;
  } else if (has('INSURANCE_CARD') && has('PRODUCTION_ON_DEMAND')) {
    classification = 'INSURANCE_CARD'; confidence = 0.98;
  } else if (has('ENDORSEMENT') && !has('COVERAGE_LIMITS')) {
    classification = 'ENDORSEMENT'; confidence = 0.88;
  } else if (input.pages.length && found.size === 0) {
    classification = 'UNSUPPORTED_NON_POLICY'; confidence = 0.9;
  }
  const evidencePageNumbers = [...new Set([...found.values()].flat())].sort((a, b) => a - b);
  return {
    id: `DOCCLASS-${crypto.randomUUID()}`,
    documentId: input.documentId,
    documentGeneration: input.documentGeneration,
    sourceSha256: input.sourceSha256,
    classification,
    confidence,
    classifier: 'openpolicy-evidence-classifier',
    classifierVersion: input.classifierVersion || '1.0.0',
    evidencePageNumbers,
    evidenceReferences: [...found.keys()].sort(),
    requiresReview: classification === 'UNCERTAIN' || classification === 'UNSUPPORTED_NON_POLICY' || confidence < 0.9,
    classifiedAt: new Date().toISOString()
  };
}

export function classifyCleanPolicyDocument(input: {
  document: PolicyDocumentRecord;
  pages: OcrPageEvidence[];
  classifierVersion?: string;
}): PolicyDocumentClassificationResult {
  if (input.document.status !== 'UPLOADED' || input.document.malwareStatus !== 'CLEAN') {
    throw new Error('Document classification requires committed evidence with a CLEAN security disposition.');
  }
  return classifyInsuranceDocument({
    documentId: input.document.id,
    documentGeneration: input.document.objectGeneration,
    sourceSha256: input.document.sha256,
    pages: input.pages,
    classifierVersion: input.classifierVersion
  });
}
