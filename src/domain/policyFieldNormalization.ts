import type {
  NormalizedPolicyFieldCandidate,
  NormalizedPolicyFieldPath,
  PolicyNormalizationResult,
  SourceEvidence
} from '../types/insurance';
import type { ProviderNeutralOcrDocument, ProviderNeutralOcrPage } from '../server/documentAiOcrProvider';

type Rule = {
  fieldPath: NormalizedPolicyFieldPath;
  patterns: RegExp[];
  transform?: (value: string) => string | number | undefined;
  confidence: number;
};

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const money = (value: string) => {
  const parsed = Number(value.replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};
const isoDate = (value: string) => {
  const match = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!match) return undefined;
  const candidate = `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  const date = new Date(`${candidate}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? undefined : candidate;
};

const RULES: Rule[] = [
  { fieldPath: 'policyNumber', patterns: [/\bpolicy\s*(?:number|no\.?|#)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{3,})/i], confidence: .96 },
  { fieldPath: 'carrier', patterns: [/\b(?:insurance company|carrier|company)\s*[:#-]\s*([^\n]{3,80})/i], confidence: .90 },
  { fieldPath: 'namedInsured', patterns: [/\b(?:named insured|insured)\s*[:#-]\s*([^\n]{3,100})/i], confidence: .90 },
  { fieldPath: 'jurisdiction', patterns: [/\b(?:policy state|state)\s*[:#-]\s*([A-Z]{2})\b/i], transform: value => value.toUpperCase(), confidence: .91 },
  { fieldPath: 'effectiveDate', patterns: [/\b(?:policy )?effective(?: date)?\s*[:#-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i], transform: isoDate, confidence: .95 },
  { fieldPath: 'expirationDate', patterns: [/\b(?:policy )?expir(?:ation|es)(?: date)?\s*[:#-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i], transform: isoDate, confidence: .95 },
  { fieldPath: 'annualPremium', patterns: [/\b(?:total|annual)\s+(?:policy\s+)?premium\s*[:#-]?\s*(\$?[\d,]+(?:\.\d{2})?)/i], transform: money, confidence: .94 }
];

function evidence(documentId: string, page: ProviderNeutralOcrPage, match: RegExpMatchArray, confidence: number): SourceEvidence {
  const index = match.index || 0;
  const start = Math.max(0, index - 40);
  const end = Math.min(page.text.length, index + match[0].length + 40);
  const regionConfidence = page.regions
    .filter(region => region.textStart <= index && region.textEnd >= index)
    .map(region => region.confidence)
    .find(value => value !== undefined);
  return {
    documentId,
    documentName: 'immutable-upload',
    pageNumber: page.pageNumber,
    extractedSnippet: clean(page.text.slice(start, end)),
    confidence: Math.min(confidence, regionConfidence ?? confidence),
    verifiedByConsumer: false
  };
}

export function normalizePolicyFields(input: {
  documentId: string;
  ocr: ProviderNeutralOcrDocument;
  now?: string;
}): PolicyNormalizationResult {
  const fields: NormalizedPolicyFieldCandidate[] = [];
  for (const rule of RULES) {
    for (const page of input.ocr.pages) {
      const match = rule.patterns.map(pattern => page.text.match(pattern)).find(Boolean);
      if (!match?.[1]) continue;
      const raw = clean(match[1]);
      const value = rule.transform ? rule.transform(raw) : raw;
      if (value === undefined || value === '') continue;
      const source = evidence(input.documentId, page, match, rule.confidence);
      fields.push({ fieldPath: rule.fieldPath, value, confidence: source.confidence, evidence: source });
      break;
    }
  }
  const required: NormalizedPolicyFieldPath[] = [
    'policyNumber', 'carrier', 'namedInsured', 'jurisdiction', 'effectiveDate', 'expirationDate', 'annualPremium'
  ];
  const found = new Set(fields.map(field => field.fieldPath));
  const criticalIssues = required.filter(field => !found.has(field)).map(field => `Missing required field: ${field}`);
  if (fields.some(field => field.confidence < .90)) criticalIssues.push('One or more required fields have confidence below 0.90.');
  return {
    extractionRunId: input.ocr.runId,
    documentId: input.documentId,
    documentGeneration: input.ocr.sourceGeneration,
    sourceSha256: input.ocr.sourceSha256,
    normalizer: 'OPENPOLICY_POLICY_FIELDS',
    normalizerVersion: '1.0.0',
    fields,
    criticalIssues,
    status: criticalIssues.length ? 'REVIEW_REQUIRED' : 'READY_FOR_CONSUMER',
    normalizedAt: input.now || new Date().toISOString()
  };
}
