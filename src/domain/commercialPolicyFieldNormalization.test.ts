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
