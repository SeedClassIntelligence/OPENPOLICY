import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePolicyFields } from './policyFieldNormalization';

const ocr = (text: string) => ({
  runId: 'OCR-1', sourceSha256: 'a'.repeat(64), sourceGeneration: '9',
  extractor: 'GOOGLE_DOCUMENT_AI' as const, extractorVersion: 'test', processedAt: '',
  pages: [{ pageNumber: 3, text, regions: [{ textStart: 0, textEnd: text.length, confidence: .99, normalizedVertices: [] }] }]
});

test('normalizes bounded policy fields with page-level evidence and no invented values', () => {
  const result = normalizePolicyFields({ documentId: 'DOC-1', now: '2026-10-07T00:00:00Z', ocr: ocr([
    'Policy Number: ABC-12345', 'Insurance Company: Root Insurance Company', 'Named Insured: Jane Consumer',
    'Policy State: NV', 'Effective Date: 10/05/2025', 'Expiration Date: 10/05/2026', 'Total Premium: $1,234.50',
    'Year, Make, and Model:', '2022 Honda Accord', 'Annualized Mileage:', '10000', 'VIN:', '1HGCM82633A004352',
    'Garaging Address ZIP Code:', '89106', 'Vehicle Usage:', 'commute',
    'Bodily injury liability', '$100,000 each person', '$300,000 each accident',
    'Property damage liability', '$100,000 each accident'
  ].join('\n')) });
  assert.equal(result.status, 'REVIEW_REQUIRED');
  assert.ok(result.criticalIssues.includes('Missing required field: vehicle.ownership'));
  assert.equal(result.fields.find(field => field.fieldPath === 'annualPremium')?.value, 1234.5);
  assert.equal(result.fields.find(field => field.fieldPath === 'effectiveDate')?.value, '2025-10-05');
  assert.ok(result.fields.every(field => field.evidence.pageNumber === 3 && field.evidence.verifiedByConsumer === false));
  assert.equal(result.sourceSha256, 'a'.repeat(64));
});

test('fails closed to review when critical fields are absent', () => {
  const result = normalizePolicyFields({ documentId: 'DOC-2', ocr: ocr('Policy Number: ONLY-ONE') });
  assert.equal(result.status, 'REVIEW_REQUIRED');
  assert.ok(result.criticalIssues.includes('Missing required field: carrier'));
  assert.equal(result.fields.some(field => field.fieldPath === 'carrier'), false);
});

test('extracts declarations and application facts from a full Root policy without drifting into contract text', () => {
  const page = (pageNumber: number, text: string) => ({
    pageNumber, text, regions: [{ textStart: 0, textEnd: text.length, confidence: .99, normalizedVertices: [] }]
  });
  const result = normalizePolicyFields({ documentId: 'DOC-ROOT', ocr: {
    ...ocr(''), pages: [
      page(1, [
        'Underwritten by', 'Root Property & Casualty Insurance Company', 'Named insured', 'Madelyn Rhodes',
        '2015 Hyundai Sonata (5NPE24AF2FH197646)', 'Policy number M9M4K7',
        'Your coverage begins on September 27, 2026 at 12:01am PDT. It expires on March 27, 2027 at 12:01am PDT.'
      ].join('\n')),
      page(2, 'Total premium (including fees)\n$1,630.00'),
      page(25, 'If a carrier denies coverage; or\n1. Court costs of any suit for damages.'),
      page(65, [
        'Garaging State:', 'NV', 'Year, Make, and Model:', '2015 Hyundai Sonata', 'Annualized Mileage:', '11125',
        'VIN:', '5NPE24AF2FH197646', 'Garaging Address ZIP Code:', '89106', 'Vehicle Usage:', 'commute',
        'Bodily injury liability', 'Premium: $1,151', 'Property damage liability', '$25,000 each', 'person',
        '$50,000 each accident', '$20,000 each accident', 'Premium: $416'
      ].join('\n'))
    ]
  } });
  const values = Object.fromEntries(result.fields.map(field => [field.fieldPath, field.value]));
  assert.equal(values.carrier, 'Root Property & Casualty Insurance Company');
  assert.equal(values.namedInsured, 'Madelyn Rhodes');
  assert.equal(values.effectiveDate, '2026-09-27');
  assert.equal(values.expirationDate, '2027-03-27');
  assert.equal(values.annualPremium, 1630);
  assert.equal(values['vehicle.vin'], '5NPE24AF2FH197646');
  assert.equal(values['vehicle.make'], 'Hyundai');
  assert.equal(values['vehicle.model'], 'Sonata');
  assert.equal(values['vehicle.annualMileage'], 11125);
  assert.equal(values['coverage.bodilyInjury.perPersonLimit'], 25000);
  assert.equal(values['coverage.bodilyInjury.perAccidentLimit'], 50000);
  assert.equal(values['coverage.propertyDamage.propertyLimit'], 20000);
  assert.ok(result.criticalIssues.includes('Missing required field: vehicle.ownership'));
  assert.equal(result.status, 'REVIEW_REQUIRED');
  assert.equal(result.fields.find(field => field.fieldPath === 'carrier')?.evidence.pageNumber, 1);
});
