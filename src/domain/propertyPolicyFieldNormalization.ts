import type { InsuranceLine } from '../types/jurisdiction';
import type { NormalizedPolicyFieldCandidate, NormalizedPolicyFieldPath, PolicyNormalizationResult, SourceEvidence } from '../types/insurance';
import type { ProviderNeutralOcrDocument, ProviderNeutralOcrPage } from '../server/documentAiOcrProvider';
import { getPolicyLineSchema } from './policyLineSchemas';

type PropertyLine = Extract<InsuranceLine, 'HOMEOWNERS' | 'RENTERS'>;
type Rule = {
  fieldPath: NormalizedPolicyFieldPath;
  patterns: RegExp[];
  transform?: (value: string) => string | number | undefined;
  confidence: number;
  lines?: readonly PropertyLine[];
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

const RULES: readonly Rule[] = [
  { fieldPath:'policyNumber',patterns:[/\bpolicy\s*(?:number|no\.?|#)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{3,})/i],confidence:.96 },
  { fieldPath:'carrier',patterns:[/\b(?:insurance company|carrier|company)\s*[:#-]\s*([^\n]{3,100})/i,/\bunderwritten by\s*(?:\r?\n|:)\s*([^\n]{3,100})/i,/\bcoverage afforded by this policy is provided by\s*:\s*\r?\n\s*([^\n]{3,100})/i,/^([^\n]{3,100}\bInsurance Company)\s*$/im],confidence:.95 },
  { fieldPath:'namedInsured',patterns:[/\bnamed insured(?: and mailing address)?\s*(?:[:#-]\s*|\r?\n\s*)([^\n]{3,120})/i],confidence:.96 },
  { fieldPath:'jurisdiction',patterns:[/\b(?:policy state|state)\s*[:#-]\s*([A-Z]{2})\b/i,/\b(?:location of premises|insured property|property address)[\s\S]{0,180}?\b[A-Z][A-Z .'-]{2,80},\s*([A-Z]{2})\s+\d{5}(?:-\d{4})?\b/i],transform:v=>v.toUpperCase(),confidence:.95 },
  { fieldPath:'effectiveDate',patterns:[/\b(?:policy )?effective(?: date)?\s*[:#-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i,/\beffective date[\s\S]{0,80}?(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i],transform:date,confidence:.97 },
  { fieldPath:'expirationDate',patterns:[/\b(?:policy )?expir(?:ation|es)(?: date)?\s*[:#-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i,/\bexpiration of policy period\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i],transform:date,confidence:.97 },
  { fieldPath:'annualPremium',patterns:[/\b(?:total|annual)(?: policy| location)? premium\s*[:#-]?\s*(\$?[\d,]+(?:\.\d{2})?)/i,/\bpolicy premium\s*[:#-]?\s*(\$?\s*[\d,]+(?:\.\d{2})?)/i],transform:money,confidence:.96 },
  { fieldPath:'property.address',patterns:[/\b(?:residence premises|insured property|property address|location)\s*[:#-]\s*([^\n]{5,160})/i,/\blocation of premises\s*\r?\n\s*([^\n]{3,120}\r?\n[^\n]{3,80})/i],confidence:.93 },
  { fieldPath:'property.occupancy',patterns:[/\boccupancy\s*[:#-]\s*([^\n]{3,60})/i],confidence:.91 },
  { fieldPath:'property.yearBuilt',patterns:[/\byear built\s*[:#-]\s*((?:18|19|20)\d{2})\b/i],transform:integer,confidence:.94,lines:['HOMEOWNERS'] },
  { fieldPath:'property.constructionType',patterns:[/\bconstruction(?: type)?\s*[:#-]\s*([^\n]{3,80})/i],confidence:.91,lines:['HOMEOWNERS'] },
  { fieldPath:'coverage.dwelling.limit',patterns:[/\b(?:coverage\s*a\s*[-:]?\s*)?dwelling\s*(?:limit)?\s*[:#-]?\s*(\$?[\d,]+(?:\.\d{2})?)/i],transform:money,confidence:.96,lines:['HOMEOWNERS'] },
  { fieldPath:'coverage.otherStructures.limit',patterns:[/\b(?:coverage\s*b\s*[-:]?\s*)?other structures\s*(?:limit)?\s*[:#-]?\s*(\$?[\d,]+(?:\.\d{2})?)/i],transform:money,confidence:.95,lines:['HOMEOWNERS'] },
  { fieldPath:'coverage.personalProperty.limit',patterns:[/\b(?:coverage\s*c\s*[-:]?\s*)?personal property\s*(?:limit)?\s*[:#-]?\s*(\$?[\d,]+(?:\.\d{2})?)/i,/(\$?[\d,]+(?:\.\d{2})?)\s+personal property\b/i],transform:money,confidence:.96 },
  { fieldPath:'coverage.lossOfUse.limit',patterns:[/\b(?:coverage\s*d\s*[-:]?\s*)?(?:loss of use|additional living expense)\s*(?:limit)?\s*[:#-]?\s*(\$?[\d,]+(?:\.\d{2})?)/i],transform:money,confidence:.94 },
  { fieldPath:'coverage.personalLiability.limit',patterns:[/\b(?:coverage\s*e\s*[-:]?\s*)?personal liability\s*(?:limit)?\s*[:#-]?\s*(\$?[\d,]+(?:\.\d{2})?)/i,/\blimit of liability\s*-?\s*section\s+ii\s*(\$?[\d,]+(?:\.\d{2})?)[\s\S]{0,100}?personal liability\b/i],transform:money,confidence:.96 },
  { fieldPath:'coverage.medicalPayments.limit',patterns:[/\b(?:coverage\s*f\s*[-:]?\s*)?medical payments(?: to others)?\s*(?:limit)?\s*[:#-]?\s*(\$?[\d,]+(?:\.\d{2})?)/i,/\blimit of liability\s*-?\s*section\s+ii\s*\$?[\d,]+(?:\.\d{2})?\s*(\$?[\d,]+(?:\.\d{2})?)[\s\S]{0,140}?medical payments\b/i],transform:money,confidence:.94 },
  { fieldPath:'coverage.property.deductible',patterns:[/\b(?:all other perils|all perils|property)\s+deductible\s*[:#-]?\s*(\$?[\d,]+(?:\.\d{2})?)/i,/\bdeductible\s*[:#-]\s*(\$[\d,]+(?:\.\d{2})?)/i,/\bdeductibles?\s*(?:-\s*section\s+i)?\s*(\$\s*[\d,]+(?:\.\d{2})?)/i],transform:money,confidence:.94 },
  { fieldPath:'coverage.windHail.deductible',patterns:[/\bwind(?:storm)?(?:\s*(?:and|\/|&)?\s*hail)?\s+deductible\s*[:#-]?\s*([^\n]{1,40})/i],confidence:.91 },
  { fieldPath:'coverage.waterBackup.limit',patterns:[/\bwater backup\s*(?:limit)?\s*[:#-]?\s*(\$?[\d,]+(?:\.\d{2})?)/i],transform:money,confidence:.91 }
];

function evidence(documentId: string, page: ProviderNeutralOcrPage, match: RegExpMatchArray, confidence: number): SourceEvidence {
  const index = match.index || 0;
  const regionConfidence = page.regions.filter(region => region.textStart <= index && region.textEnd >= index)
    .map(region => region.confidence).find(value => value !== undefined);
  return {
    documentId, documentName:'immutable-upload', pageNumber:page.pageNumber,
    extractedSnippet:clean(page.text.slice(Math.max(0,index-40),Math.min(page.text.length,index+match[0].length+40))),
    confidence:Math.min(confidence,regionConfidence ?? confidence),verifiedByConsumer:false
  };
}

export function normalizePropertyPolicyFields(input: {
  documentId: string;
  insuranceLine: PropertyLine;
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
      const source = evidence(input.documentId,page,match,rule.confidence);
      fields.push({fieldPath:rule.fieldPath,value,confidence:source.confidence,evidence:source});
      break;
    }
  }
  if (input.insuranceLine === 'RENTERS') {
    const upsert = (fieldPath: NormalizedPolicyFieldPath, raw: string, page: ProviderNeutralOcrPage, match: RegExpMatchArray, transform?: (value: string) => string | number | undefined) => {
      const value = transform ? transform(clean(raw)) : clean(raw);
      if (value === undefined || value === '') return;
      const existing = fields.findIndex(candidate => candidate.fieldPath === fieldPath);
      if (existing >= 0) fields.splice(existing,1);
      const source = evidence(input.documentId,page,match,.96);
      fields.push({fieldPath,value,confidence:source.confidence,evidence:source});
    };
    for (const page of input.ocr.pages) {
      const period = page.text.match(/Policy Period:\s*(\d{1,2}\/\d{1,2}\/\d{4})[^\n]*?\bto\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
      if (period) {
        upsert('effectiveDate',period[1],page,period,date);
        upsert('expirationDate',period[2],page,period,date);
      }
      const location = page.text.match(/Prop Loc:\s*([^\n]*?\b([A-Z]{2})\s+\d{5}(?:-\d{4})?)/i);
      if (location) {
        upsert('property.address',location[1],page,location);
        upsert('jurisdiction',location[2],page,location,value=>value.toUpperCase());
      }
      const sectionLimits = page.text.match(/SECTION II\s*[–-]\s*LIABILITY COVERAGE LIMITS[\s\S]{0,420}?PERSONAL LIABILITY[\s\S]{0,80}?MEDICAL PAYMENTS TO\s*\nOTHERS\s*\n(\$[\d,]+)[\s\S]{0,100}?(\$[\d,]+)\s*\neach occurrence/i);
      if (sectionLimits) {
        upsert('coverage.medicalPayments.limit',sectionLimits[1],page,sectionLimits,money);
        upsert('coverage.personalLiability.limit',sectionLimits[2],page,sectionLimits,money);
      }
      const deductible = page.text.match(/Loss Deductible for Section I:\s*(\$[\d,]+)/i);
      if (deductible) upsert('coverage.property.deductible',deductible[1],page,deductible,money);
    }
  }
  const schema = getPolicyLineSchema(input.insuranceLine);
  const found = new Set(fields.map(candidate => candidate.fieldPath));
  const required = schema?.fields.filter(definition => definition.requiredForBaseline).map(definition => definition.path) || [];
  const criticalIssues = required.filter(path => !found.has(path as NormalizedPolicyFieldPath)).map(path => `Missing required field: ${path}`);
  if (fields.some(candidate => candidate.confidence < .90)) criticalIssues.push('One or more extracted fields have confidence below 0.90.');
  return {
    extractionRunId:input.ocr.runId,documentId:input.documentId,documentGeneration:input.ocr.sourceGeneration,
    sourceSha256:input.ocr.sourceSha256,normalizer:`OPENPOLICY_${input.insuranceLine}_FIELDS`,normalizerVersion:'1.0.0',
    fields,criticalIssues,status:criticalIssues.length?'REVIEW_REQUIRED':'READY_FOR_CONSUMER',normalizedAt:input.now||new Date().toISOString()
  };
}

