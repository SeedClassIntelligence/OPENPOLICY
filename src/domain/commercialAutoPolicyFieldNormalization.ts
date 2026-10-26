import type { NormalizedPolicyFieldCandidate, NormalizedPolicyFieldPath, PolicyNormalizationResult, SourceEvidence } from '../types/insurance';
import type { ProviderNeutralOcrDocument, ProviderNeutralOcrPage } from '../server/documentAiOcrProvider';
import { getPolicyLineSchema } from './policyLineSchemas';

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
const integer = (value: string) => {
  const parsed = Number(value.replace(/,/g, ''));
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
};
const date = (value: string) => {
  const match = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!match) return undefined;
  const candidate = `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  return Number.isNaN(new Date(`${candidate}T00:00:00Z`).getTime()) ? undefined : candidate;
};
const included = (value: string) => {
  const normalized = clean(value).toUpperCase();
  if (['YES', 'Y', 'INCLUDED', 'COVERED'].includes(normalized)) return 1;
  if (['NO', 'N', 'NOT INCLUDED', 'EXCLUDED', 'NOT COVERED'].includes(normalized)) return 0;
  return undefined;
};

const RULES: readonly Rule[] = [
  { fieldPath:'policyNumber',patterns:[/\bpolicy\s*(?:number|no\.?|#)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{3,})/i],confidence:.96 },
  { fieldPath:'carrier',patterns:[/\b(?:insurance company|carrier|company)\s*[:#-]\s*([^\n]{3,100})/i,/\bunderwritten by\s*(?:\r?\n|:)\s*([^\n]{3,100})/i],confidence:.95 },
  { fieldPath:'namedInsured',patterns:[/\bnamed insured\s*(?:[:#-]\s*|\r?\n\s*)([^\n]{3,120})/i],confidence:.96 },
  { fieldPath:'jurisdiction',patterns:[/\b(?:policy state|state)\s*[:#-]\s*([A-Z]{2})\b/i],transform:value=>value.toUpperCase(),confidence:.95 },
  { fieldPath:'effectiveDate',patterns:[/\b(?:policy )?effective(?: date)?\s*[:#-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i],transform:date,confidence:.97 },
  { fieldPath:'expirationDate',patterns:[/\b(?:policy )?expir(?:ation|es)(?: date)?\s*[:#-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i],transform:date,confidence:.97 },
  { fieldPath:'annualPremium',patterns:[/\b(?:total|annual)(?: policy)? premium\s*[:#-]?\s*(\$?[\d,]+(?:\.\d{2})?)/i],transform:money,confidence:.96 },
  { fieldPath:'business.legalName',patterns:[/\b(?:named insured|insured business|business name)\s*[:#-]\s*([^\n]{3,120})/i],confidence:.95 },
  { fieldPath:'business.location',patterns:[/\b(?:business location|mailing address|location address)\s*[:#-]\s*([^\n]{5,160})/i],confidence:.92 },
  { fieldPath:'business.classification',patterns:[/\b(?:business classification|classification|description of operations)\s*[:#-]\s*([^\n]{3,120})/i],confidence:.92 },
  { fieldPath:'commercialAuto.coveredAutoSymbols',patterns:[/\bcovered auto symbols?\s*[:#-]\s*([^\n]{1,80})/i,/\bsymbols?\s+(?:for )?covered autos?\s*[:#-]\s*([^\n]{1,80})/i],confidence:.94 },
  { fieldPath:'commercialAuto.vehicleScheduleSummary',patterns:[/\b(?:schedule of covered autos|covered vehicle schedule)\s*[:#-]?\s*([^\n]{3,180})/i],confidence:.90 },
  { fieldPath:'commercialAuto.fleetSize',patterns:[/\b(?:scheduled vehicle count|number of (?:covered )?(?:autos|vehicles)|fleet size)\s*[:#-]\s*(\d{1,5})\b/i],transform:integer,confidence:.93 },
  { fieldPath:'commercialAuto.operatingRadius',patterns:[/\b(?:operating|business) radius\s*[:#-]\s*([^\n]{1,60})/i],confidence:.91 },
  { fieldPath:'commercialAuto.primaryUse',patterns:[/\b(?:primary vehicle use|vehicle use|business use)\s*[:#-]\s*([^\n]{3,100})/i],confidence:.91 },
  { fieldPath:'coverage.commercialAuto.combinedSingleLimit',patterns:[/\b(?:auto liability\s+)?combined single limit\s*[:#-]?\s*(\$?[\d,]+(?:\.\d{2})?)/i],transform:money,confidence:.97 },
  { fieldPath:'coverage.commercialAuto.bodilyInjuryPerPersonLimit',patterns:[/\bbodily injury(?: liability)?\s*(?:per person|each person)\s*(?:limit)?\s*[:#-]?\s*(\$?[\d,]+(?:\.\d{2})?)/i],transform:money,confidence:.96 },
  { fieldPath:'coverage.commercialAuto.bodilyInjuryPerAccidentLimit',patterns:[/\bbodily injury(?: liability)?\s*(?:per accident|each accident)\s*(?:limit)?\s*[:#-]?\s*(\$?[\d,]+(?:\.\d{2})?)/i],transform:money,confidence:.96 },
  { fieldPath:'coverage.commercialAuto.propertyDamageLimit',patterns:[/\bproperty damage(?: liability)?\s*(?:per accident)?\s*(?:limit)?\s*[:#-]?\s*(\$?[\d,]+(?:\.\d{2})?)/i],transform:money,confidence:.96 },
  { fieldPath:'coverage.commercialAuto.uninsuredMotoristLimit',patterns:[/\buninsured(?:\/underinsured)? motorist(?: bodily injury)?\s*(?:limit)?\s*[:#-]?\s*(\$?[\d,]+(?:\.\d{2})?)/i],transform:money,confidence:.94 },
  { fieldPath:'coverage.commercialAuto.medicalPaymentsLimit',patterns:[/\bmedical payments?\s*(?:limit)?\s*[:#-]?\s*(\$?[\d,]+(?:\.\d{2})?)/i],transform:money,confidence:.93 },
  { fieldPath:'coverage.commercialAuto.comprehensiveDeductible',patterns:[/\bcomprehensive\s*(?:coverage)?\s*deductible\s*[:#-]?\s*(\$?[\d,]+(?:\.\d{2})?)/i],transform:money,confidence:.95 },
  { fieldPath:'coverage.commercialAuto.collisionDeductible',patterns:[/\bcollision\s*(?:coverage)?\s*deductible\s*[:#-]?\s*(\$?[\d,]+(?:\.\d{2})?)/i],transform:money,confidence:.95 },
  { fieldPath:'coverage.commercialAuto.hiredAutoIncluded',patterns:[/\bhired auto(?: liability)?\s*[:#-]\s*(yes|no|included|not included|covered|not covered|excluded)\b/i],transform:included,confidence:.93 },
  { fieldPath:'coverage.commercialAuto.nonOwnedAutoIncluded',patterns:[/\bnon[- ]owned auto(?: liability)?\s*[:#-]\s*(yes|no|included|not included|covered|not covered|excluded)\b/i],transform:included,confidence:.93 },
  { fieldPath:'coverage.commercialAuto.motorTruckCargoLimit',patterns:[/\bmotor truck cargo(?: coverage)?\s*(?:limit)?\s*[:#-]?\s*(\$?[\d,]+(?:\.\d{2})?)/i],transform:money,confidence:.94 }
];

function evidence(documentId: string, page: ProviderNeutralOcrPage, match: RegExpMatchArray, confidence: number): SourceEvidence {
  const index = match.index || 0;
  const regionConfidence = page.regions
    .filter(region => region.textStart <= index && region.textEnd >= index)
    .map(region => region.confidence)
    .find(value => value !== undefined);
  return {
    documentId, documentName:'immutable-upload', pageNumber:page.pageNumber,
    extractedSnippet:clean(page.text.slice(Math.max(0,index-40),Math.min(page.text.length,index+match[0].length+40))),
    confidence:Math.min(confidence,regionConfidence ?? confidence),verifiedByConsumer:false
  };
}

export function normalizeCommercialAutoPolicyFields(input: {
  documentId: string;
  insuranceLine: 'COMMERCIAL_AUTO';
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
      const source = evidence(input.documentId,page,match,rule.confidence);
      fields.push({fieldPath:rule.fieldPath,value,confidence:source.confidence,evidence:source});
      break;
    }
  }
  const schema = getPolicyLineSchema('COMMERCIAL_AUTO')!;
  const found = new Set(fields.map(candidate => candidate.fieldPath));
  const criticalIssues = schema.fields
    .filter(definition => definition.requiredForBaseline && !found.has(definition.path as NormalizedPolicyFieldPath))
    .map(definition => `Missing required field: ${definition.path}`);
  const hasCombinedSingleLimit = found.has('coverage.commercialAuto.combinedSingleLimit');
  const hasSplitLimits = found.has('coverage.commercialAuto.bodilyInjuryPerPersonLimit')
    && found.has('coverage.commercialAuto.bodilyInjuryPerAccidentLimit')
    && found.has('coverage.commercialAuto.propertyDamageLimit');
  if (!hasCombinedSingleLimit && !hasSplitLimits) {
    criticalIssues.push('Missing commercial-auto liability limit: provide a combined single limit or complete split limits.');
  }
  if (fields.some(candidate => candidate.confidence < .90)) criticalIssues.push('One or more extracted fields have confidence below 0.90.');
  return {
    extractionRunId:input.ocr.runId,documentId:input.documentId,documentGeneration:input.ocr.sourceGeneration,
    sourceSha256:input.ocr.sourceSha256,normalizer:'OPENPOLICY_COMMERCIAL_AUTO_FIELDS',normalizerVersion:'1.0.0',
    fields,criticalIssues,status:criticalIssues.length?'REVIEW_REQUIRED':'READY_FOR_CONSUMER',normalizedAt:input.now||new Date().toISOString()
  };
}
