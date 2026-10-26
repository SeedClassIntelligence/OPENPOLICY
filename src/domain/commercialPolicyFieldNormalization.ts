import type { InsuranceLine } from '../types/jurisdiction';
import type {
  NormalizedPolicyFieldCandidate,
  NormalizedPolicyFieldPath,
  PolicyNormalizationResult,
  SourceEvidence
} from '../types/insurance';
import type { ProviderNeutralOcrDocument, ProviderNeutralOcrPage } from '../server/documentAiOcrProvider';
import { getPolicyLineSchema } from './policyLineSchemas';

type CommercialLine = Extract<InsuranceLine, 'COMMERCIAL_GENERAL_LIABILITY' | 'BUSINESS_OWNERS_POLICY'>;
type Rule = {
  fieldPath: NormalizedPolicyFieldPath;
  patterns: RegExp[];
  transform?: (value: string) => string | number | undefined;
  confidence: number;
  lines?: readonly CommercialLine[];
};

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const money = (value: string) => {
  const parsed = Number(value.replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};
const date = (value: string) => {
  const match = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!match) return undefined;
  const candidate = `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  return Number.isNaN(new Date(`${candidate}T00:00:00Z`).getTime()) ? undefined : candidate;
};
const included = (value: string) => {
  const normalized = clean(value).toUpperCase();
  if (['YES', 'Y', 'INCLUDED'].includes(normalized)) return 1;
  if (['NO', 'N', 'NOT INCLUDED', 'EXCLUDED'].includes(normalized)) return 0;
  return undefined;
};

const RULES: readonly Rule[] = [
  { fieldPath: 'policyNumber', patterns: [/\bpolicy\s*(?:number|no\.?|#)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{3,})/i], confidence: .96 },
  { fieldPath: 'carrier', patterns: [/\b(?:insurance company|carrier|company)(?: name)?\s*[:#-]\s*([^\n]{3,100})/i, /\bunderwritten by\s*(?:\r?\n|:)\s*([^\n]{3,100})/i, /^([^\n]{3,100}?\b(?:Insurance Company|Indemnity Insurance Company|Mutual Insurance|Fire and Casualty Company))\b/im], confidence: .95 },
  { fieldPath: 'namedInsured', patterns: [/\bnamed insured(?: and (?:mailing )?address)?\s*(?:[:#-]\s*|\r?\n\s*)([^\n]{3,120})/i], confidence: .96 },
  { fieldPath: 'jurisdiction', patterns: [/\b(?:policy state|state)\s*[:#-]\s*([A-Z]{2})\b/i, /\b[A-Z][A-Za-z .'-]+,\s*(NV)\s+\d{5}(?:-\d{4})?\b/], transform: value => value.toUpperCase(), confidence: .95 },
  { fieldPath: 'effectiveDate', patterns: [/\b(?:policy )?effective(?: date)?\s*[:#-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i, /\bpolicy period[^\n]*\s+from\s*:\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i], transform: date, confidence: .97 },
  { fieldPath: 'expirationDate', patterns: [/\b(?:policy )?expir(?:ation|es)(?: date)?\s*[:#-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i, /\bpolicy period[^\n]*\s+from\s*:\s*\d{1,2}[\/-]\d{1,2}[\/-]\d{4}\s+to\s*:\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i], transform: date, confidence: .97 },
  { fieldPath: 'annualPremium', patterns: [/\b(?:total|annual)(?: policy)? premium\s*[:#-]?\s*(\$?[\d,]+(?:\.\d{2})?)/i, /\btotal\s*:\s*(\$?[\d,]+(?:\.\d{2})?)/i], transform: money, confidence: .96 },
  { fieldPath: 'business.legalName', patterns: [/\b(?:named insured(?: and (?:mailing )?address)?|insured business|business name)\s*(?:[:#-]\s*|\r?\n\s*)([^\n]{3,120})/i], confidence: .95 },
  { fieldPath: 'business.location', patterns: [/\b(?:business location|premises|location address)\s*[:#-]\s*([^\n]{5,160})/i, /\blocations of all premises[^\n]*\r?\nlocation address territory\r?\n\d+\s+([^\n]{5,160}?)(?:\s+\d{3})?$/im], confidence: .93 },
  { fieldPath: 'business.classification', patterns: [/\b(?:business classification|classification|description of operations|business description)\s*[:#-]\s*([^\n]{3,120})/i, /\b\d+\s+([^\n]{3,100})\s+\d{5}\s+[\d,]+\s+per\s+/i], confidence: .92 },
  { fieldPath: 'coverage.cgl.eachOccurrence', patterns: [/\beach occurrence\s*(?:limit)?\s*[:#-]?\s*(\$?[\d,]+(?:\.\d{2})?)/i], transform: money, confidence: .97 },
  { fieldPath: 'coverage.cgl.generalAggregate', patterns: [/\bgeneral aggregate\s*(?:limit)?\s*[:#-]?\s*(\$?[\d,]+(?:\.\d{2})?)/i], transform: money, confidence: .97 },
  { fieldPath: 'coverage.cgl.productsCompletedOperationsAggregate', patterns: [/\bproducts[- /]completed operations aggregate\s*(?:limit)?\s*[:#-]?\s*(\$?[\d,]+(?:\.\d{2})?)/i], transform: money, confidence: .95 },
  { fieldPath: 'coverage.cgl.personalAdvertisingInjury', patterns: [/\bpersonal(?: and| &) advertising injury\s*(?:limit)?\s*[:#-]?\s*(\$?[\d,]+(?:\.\d{2})?)/i], transform: money, confidence: .95 },
  { fieldPath: 'coverage.cgl.medicalExpense', patterns: [/\bmedical (?:expense|payments?)\s*(?:limit)?\s*[:#-]?\s*(\$?[\d,]+(?:\.\d{2})?)/i], transform: money, confidence: .94 },
  { fieldPath: 'coverage.businessProperty.limit', patterns: [/\b(?:business personal property|business property)\s*(?:limit)?\s*[:#-]?\s*(\$?[\d,]+(?:\.\d{2})?)/i], transform: money, confidence: .96, lines: ['BUSINESS_OWNERS_POLICY'] },
  { fieldPath: 'coverage.businessIncome.included', patterns: [/\bbusiness income(?: coverage)?\s*[:#-]\s*(yes|no|included|not included|excluded)\b/i, /\bloss of income(?: and extra expense)?\b[\s\S]{0,100}?\b(included|excluded)\b/i], transform: included, confidence: .94, lines: ['BUSINESS_OWNERS_POLICY'] },
  { fieldPath: 'coverage.extraExpense.included', patterns: [/\bextra expense(?: coverage)?\s*[:#-]\s*(yes|no|included|not included|excluded)\b/i], transform: included, confidence: .94, lines: ['BUSINESS_OWNERS_POLICY'] },
  { fieldPath: 'coverage.property.deductible', patterns: [/\b(?:business )?property deductible\s*[:#-]?\s*(\$?[\d,]+(?:\.\d{2})?)/i, /\b(?:policy|basic) deductible\s*[:#-]?\s*(\$?[\d,]+(?:\.\d{2})?)/i], transform: money, confidence: .95, lines: ['BUSINESS_OWNERS_POLICY'] }
];

function evidence(documentId: string, page: ProviderNeutralOcrPage, match: RegExpMatchArray, confidence: number): SourceEvidence {
  const index = match.index || 0;
  const regionConfidence = page.regions
    .filter(region => region.textStart <= index && region.textEnd >= index)
    .map(region => region.confidence)
    .find(value => value !== undefined);
  return {
    documentId,
    documentName: 'immutable-upload',
    pageNumber: page.pageNumber,
    extractedSnippet: clean(page.text.slice(Math.max(0, index - 40), Math.min(page.text.length, index + match[0].length + 40))),
    confidence: Math.min(confidence, regionConfidence ?? confidence),
    verifiedByConsumer: false
  };
}

export function normalizeCommercialPolicyFields(input: {
  documentId: string;
  insuranceLine: CommercialLine;
  ocr: ProviderNeutralOcrDocument;
  now?: string;
}): PolicyNormalizationResult {
  const fields: NormalizedPolicyFieldCandidate[] = [];
  for (const rule of RULES.filter(rule => !rule.lines || rule.lines.includes(input.insuranceLine))) {
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
  const schema = getPolicyLineSchema(input.insuranceLine);
  const found = new Set(fields.map(candidate => candidate.fieldPath));
  const required = schema?.fields.filter(definition => definition.requiredForBaseline).map(definition => definition.path) || [];
  const criticalIssues = required
    .filter(path => !found.has(path as NormalizedPolicyFieldPath))
    .map(path => `Missing required field: ${path}`);
  if (fields.some(candidate => candidate.confidence < .90)) {
    criticalIssues.push('One or more extracted fields have confidence below 0.90.');
  }
  return {
    extractionRunId: input.ocr.runId,
    documentId: input.documentId,
    documentGeneration: input.ocr.sourceGeneration,
    sourceSha256: input.ocr.sourceSha256,
    normalizer: `OPENPOLICY_${input.insuranceLine}_FIELDS`,
    normalizerVersion: '1.0.0',
    fields,
    criticalIssues,
    status: criticalIssues.length ? 'REVIEW_REQUIRED' : 'READY_FOR_CONSUMER',
    normalizedAt: input.now || new Date().toISOString()
  };
}
