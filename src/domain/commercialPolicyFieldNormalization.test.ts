import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCommercialPolicyFields } from './commercialPolicyFieldNormalization';

const ocr = (text: string) => ({
  runId: 'OCR-COMMERCIAL',
  sourceSha256: 'b'.repeat(64),
  sourceGeneration: '9',
  extractor: 'GOOGLE_DOCUMENT_AI' as const,
  extractorVersion: 'test',
  processedAt: '',
  pages: [{ pageNumber: 3, text, regions: [{ textStart: 0, textEnd: text.length, confidence: .99, normalizedVertices: [] }] }]
});

const common = [
  'Policy Number: CGL-12345',
  'Insurance Company: Example Commercial Insurance Company',
  'Named Insured: Example Bakery LLC',
  'Policy State: NV',
  'Effective Date: 03/01/2027',
  'Expiration Date: 03/01/2028',
  'Annual Premium: $2,400.00',
  'Business Location: 500 Commerce Street, Reno, NV 89501',
  'Business Classification: Retail Bakery',
  'Each Occurrence: $1,000,000',
  'General Aggregate: $2,000,000'
];

test('extracts CGL facts without creating BOP property coverage', () => {
  const result = normalizeCommercialPolicyFields({
    documentId: 'D-CGL',
    insuranceLine: 'COMMERCIAL_GENERAL_LIABILITY',
    ocr: ocr([...common,
      'Products-Completed Operations Aggregate: $2,000,000',
      'Personal and Advertising Injury: $1,000,000',
      'Medical Expense: $5,000'
    ].join('\n'))
  });
  const values = Object.fromEntries(result.fields.map(candidate => [candidate.fieldPath, candidate.value]));
  assert.equal(values['coverage.cgl.eachOccurrence'], 1000000);
  assert.equal(values['coverage.cgl.generalAggregate'], 2000000);
  assert.equal(result.fields.some(candidate => candidate.fieldPath === 'coverage.businessProperty.limit'), false);
  assert.equal(result.status, 'READY_FOR_CONSUMER');
  assert.equal(result.fields.every(candidate => candidate.evidence.pageNumber === 3), true);
});

test('extracts Nevada-issued CGL declaration layout', () => {
  const result = normalizeCommercialPolicyFields({documentId:'D-NV-CGL',insuranceLine:'COMMERCIAL_GENERAL_LIABILITY',ocr:ocr(`
United States Liability Insurance Company
POLICY DECLARATIONS
No. CL 1817311G
NAMED INSURED AND ADDRESS:
LING LTD
933 GEAR ST
RENO, NV 89503
POLICY PERIOD: From: 06/30/2024 To: 06/30/2025 12:01 A.M.
BUSINESS DESCRIPTION: Office
Commercial Liability Coverage Part $500.00
TOTAL: $600.00
COMMERCIAL GENERAL LIABILITY COVERAGE PART DECLARATIONS
Each Occurrence Limit $1,000,000
General Aggregate Limit $2,000,000
LOCATIONS OF ALL PREMISES YOU OWN, RENT OR OCCUPY
Location Address Territory
1 933 Gear St, Reno, NV 89503 001
Loc Classification Code No. Premium Basis
1 Lawyer Offices - Other than Not-For-Profit 66122 1,500 Per 1,000
`)});
  const values = Object.fromEntries(result.fields.map(field => [field.fieldPath,field.value]));
  assert.equal(values.carrier,'United States Liability Insurance Company');
  assert.equal(values.namedInsured,'LING LTD');
  assert.equal(values.jurisdiction,'NV');
  assert.equal(values.effectiveDate,'2024-06-30');
  assert.equal(values.expirationDate,'2025-06-30');
  assert.equal(values.annualPremium,600);
  assert.equal(values['business.location'],'933 Gear St, Reno, NV 89503');
  assert.equal(values['coverage.cgl.eachOccurrence'],1000000);
  assert.equal(values['coverage.cgl.generalAggregate'],2000000);
});

test('extracts Nevada-issued BOP identity, property, income and liability declarations', () => {
  const result = normalizeCommercialPolicyFields({documentId:'D-NV-BOP',insuranceLine:'BUSINESS_OWNERS_POLICY',ocr:ocr(`
State Farm Fire and Casualty Company
BUSINESSOWNERS POLICY DECLARATIONS
Policy Number: 98-B8-A641-9
Named Insured And Address:
CARLIN HISTORICAL SOCIETY
718 CEDAR ST
CARLIN, NV 89822
Policy Period: From: 04/13/2019 To: 04/13/2020
Business Description: Historical museum
Annual Premium: $575.00
Business Location: 718 CEDAR ST, CARLIN, NV 89822
Business Personal Property Limit: $252,900
Basic Deductible: $1,000
Loss Of Income And Extra Expense: Included
Each Occurrence Limit: $1,000,000
General Aggregate Limit: $2,000,000
`)});
  const values = Object.fromEntries(result.fields.map(field => [field.fieldPath,field.value]));
  assert.equal(result.status,'READY_FOR_CONSUMER');
  assert.equal(values.carrier,'State Farm Fire and Casualty Company');
  assert.equal(values.jurisdiction,'NV');
  assert.equal(values['coverage.businessProperty.limit'],252900);
  assert.equal(values['coverage.businessIncome.included'],1);
  assert.equal(values['coverage.property.deductible'],1000);
});

test('extracts BOP property and liability facts from explicit source statements', () => {
  const result = normalizeCommercialPolicyFields({
    documentId: 'D-BOP',
    insuranceLine: 'BUSINESS_OWNERS_POLICY',
    ocr: ocr([...common,
      'Business Personal Property: $150,000',
      'Business Income Coverage: Included',
      'Extra Expense Coverage: Included',
      'Property Deductible: $1,000'
    ].join('\n'))
  });
  const values = Object.fromEntries(result.fields.map(candidate => [candidate.fieldPath, candidate.value]));
  assert.equal(values['coverage.businessProperty.limit'], 150000);
  assert.equal(values['coverage.businessIncome.included'], 1);
  assert.equal(values['coverage.extraExpense.included'], 1);
  assert.equal(values['coverage.property.deductible'], 1000);
  assert.equal(result.status, 'READY_FOR_CONSUMER');
});

test('missing required commercial facts fail closed without defaults', () => {
  const result = normalizeCommercialPolicyFields({
    documentId: 'D-BOP-INCOMPLETE',
    insuranceLine: 'BUSINESS_OWNERS_POLICY',
    ocr: ocr([...common.slice(0, 8), 'Each Occurrence: $1,000,000'].join('\n'))
  });
  assert.equal(result.status, 'REVIEW_REQUIRED');
  assert.equal(result.fields.some(candidate => candidate.fieldPath === 'coverage.businessIncome.included'), false);
  assert.equal(result.fields.some(candidate => candidate.fieldPath === 'coverage.businessProperty.limit'), false);
  assert.ok(result.criticalIssues.some(issue => issue.includes('coverage.businessIncome.included')));
  assert.ok(result.criticalIssues.some(issue => issue.includes('coverage.businessProperty.limit')));
});
