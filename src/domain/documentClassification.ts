import crypto from 'crypto';
import type { InsuranceDocumentClassification, InsuranceLineAssessment, PolicyDocumentClassificationResult, PolicyDocumentRecord } from '../types/insurance';
import type { InsuranceLine } from '../types/jurisdiction';

export interface OcrPageEvidence {
  pageNumber: number;
  text: string;
}

const indicators: Array<{ code: string; pattern: RegExp }> = [
  { code: 'DECLARATIONS_HEADING', pattern: /\b(?:amended\s+)?declarations\b/i },
  { code: 'COVERAGE_LIMITS', pattern: /\bcoverage(?:s)?[,\s]+(?:premiums?,\s*)?limits?\b/i },
  { code: 'TOTAL_PREMIUM', pattern: /\btotal\s+premium\b/i },
  { code: 'POLICY_CONTRACT', pattern: /\b(?:personal\s+auto|homeowners?|renters?|tenant|commercial\s+auto|business\s+auto|commercial\s+general\s+liability|businessowners?|business\s+owners?)\s+(?:insurance\s+)?policy\b/i },
  { code: 'POLICY_DEFINITIONS', pattern: /\bdefinitions\b/i },
  { code: 'POLICY_EXCLUSIONS', pattern: /\bexclusions\b/i },
  { code: 'INSURANCE_CARD', pattern: /\binsurance\s+(?:identification\s+)?card\b/i },
  { code: 'PRODUCTION_ON_DEMAND', pattern: /\bproduction\s+upon\s+demand\b/i },
  { code: 'ENDORSEMENT', pattern: /\bendorsement\b/i }
];

const lineIndicators: Record<Exclude<InsuranceLine, 'TERM_LIFE' | 'INDIVIDUAL_HEALTH'>, Array<{ code: string; pattern: RegExp; weight: number }>> = {
  PERSONAL_AUTO: [
    { code: 'LINE_AUTO_TITLE', pattern: /\bpersonal\s+auto(?:mobile)?\s+(?:insurance\s+)?policy\b/i, weight: 3 },
    { code: 'LINE_AUTO_VIN', pattern: /\bVIN\b|\bvehicle identification number\b/i, weight: 1 },
    { code: 'LINE_AUTO_COLLISION', pattern: /\bcollision\b[\s\S]{0,100}\bcomprehensive\b|\bcomprehensive\b[\s\S]{0,100}\bcollision\b/i, weight: 1 }
  ],
  HOMEOWNERS: [
    { code: 'LINE_HOMEOWNERS_TITLE', pattern: /\bhomeowners?\s+(?:insurance\s+)?policy\b/i, weight: 3 },
    { code: 'LINE_HOMEOWNERS_DWELLING', pattern: /\bcoverage\s+a\b[\s\S]{0,80}\bdwelling\b|\bdwelling\s+limit\b/i, weight: 1 },
    { code: 'LINE_HOMEOWNERS_STRUCTURES', pattern: /\bother\s+structures\b/i, weight: 1 }
  ],
  RENTERS: [
    { code: 'LINE_RENTERS_TITLE', pattern: /\brenters?\s+(?:insurance\s+)?policy\b|\btenant(?:s)?\s+(?:insurance\s+)?policy\b/i, weight: 3 },
    { code: 'LINE_RENTERS_PROPERTY', pattern: /\bpersonal\s+property\b/i, weight: 1 },
    { code: 'LINE_RENTERS_LOSS_OF_USE', pattern: /\bloss\s+of\s+use\b/i, weight: 1 }
  ],
  COMMERCIAL_AUTO: [
    { code: 'LINE_COMMERCIAL_AUTO_TITLE', pattern: /\bcommercial\s+auto(?:mobile)?\s+(?:coverage|insurance|policy)\b|\bbusiness\s+auto\s+coverage\b/i, weight: 3 },
    { code: 'LINE_COMMERCIAL_AUTO_SYMBOL', pattern: /\bcovered\s+auto\s+symbols?\b/i, weight: 1 },
    { code: 'LINE_COMMERCIAL_AUTO_SCHEDULE', pattern: /\bschedule\s+of\s+covered\s+autos\b/i, weight: 1 }
  ],
  COMMERCIAL_GENERAL_LIABILITY: [
    { code: 'LINE_CGL_TITLE', pattern: /\bcommercial\s+general\s+liability\b/i, weight: 3 },
    { code: 'LINE_CGL_OCCURRENCE', pattern: /\beach\s+occurrence\b/i, weight: 1 },
    { code: 'LINE_CGL_AGGREGATE', pattern: /\bgeneral\s+aggregate\b|\bproducts[- ]completed\s+operations\s+aggregate\b/i, weight: 1 }
  ],
  BUSINESS_OWNERS_POLICY: [
    { code: 'LINE_BOP_TITLE', pattern: /\bbusinessowners?\s+(?:insurance\s+)?policy\b|\bbusiness\s+owners?\s+policy\b/i, weight: 3 },
    { code: 'LINE_BOP_PROPERTY', pattern: /\bbusiness\s+personal\s+property\b/i, weight: 1 },
    { code: 'LINE_BOP_INCOME', pattern: /\bbusiness\s+income\b[\s\S]{0,100}\bextra\s+expense\b/i, weight: 1 }
  ]
};

export function assessInsuranceLine(input: {
  declaredLine: InsuranceLine;
  pages: OcrPageEvidence[];
}): InsuranceLineAssessment {
  const matches = Object.entries(lineIndicators).map(([line, definitions]) => {
    const evidence = definitions.filter(definition => input.pages.some(page => definition.pattern.test(page.text)));
    return {
      line: line as InsuranceLine,
      score: evidence.reduce((sum, definition) => sum + definition.weight, 0),
      evidenceReferences: evidence.map(definition => definition.code)
    };
  }).filter(result => result.score > 0).sort((left, right) => right.score - left.score);

  const strongest = matches[0];
  const tied = strongest && matches[1]?.score === strongest.score;
  const detectedLine = strongest && !tied && strongest.score >= 2 ? strongest.line : undefined;
  const disposition = !detectedLine ? 'INDETERMINATE' : detectedLine === input.declaredLine ? 'MATCH' : 'CONFLICT';
  return {
    declaredLine: input.declaredLine,
    detectedLine,
    disposition,
    confidence: !strongest || tied ? 0 : Math.min(0.99, 0.55 + strongest.score * 0.1),
    evidenceReferences: strongest && !tied ? strongest.evidenceReferences : []
  };
}

export function classifyInsuranceDocument(input: {
  documentId: string;
  documentGeneration: string;
  sourceSha256: string;
  pages: OcrPageEvidence[];
  classifierVersion?: string;
  insuranceLine?: InsuranceLine;
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
  const lineAssessment = input.insuranceLine
    ? assessInsuranceLine({ declaredLine: input.insuranceLine, pages: input.pages })
    : undefined;
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
    requiresReview: classification === 'UNCERTAIN' || classification === 'UNSUPPORTED_NON_POLICY' || confidence < 0.9 || Boolean(lineAssessment && lineAssessment.disposition !== 'MATCH'),
    classifiedAt: new Date().toISOString(),
    lineAssessment
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
    classifierVersion: input.classifierVersion,
    insuranceLine: input.document.insuranceLine || 'PERSONAL_AUTO'
  });
}
