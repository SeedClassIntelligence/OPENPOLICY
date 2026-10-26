import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCommercialAutoPolicyFields } from './commercialAutoPolicyFieldNormalization';

const ocr = (text: string) => ({
  runId:'ocr-ca-1',sourceGeneration:'1',sourceSha256:'commercial-auto-sha',provider:'TEST',providerVersion:'1',
  pages:[{pageNumber:1,text,regions:[{textStart:0,textEnd:text.length,confidence:.99}]}]
} as any);

const common = `
Business Auto Coverage Declarations
Policy Number: BAP-440012
Insurance Company: Nevada Commercial Mutual
Named Insured: Silver State Delivery LLC
Policy State: NV
Effective Date: 01/01/2027
Expiration Date: 01/01/2028
Annual Premium: $12,400.00
Business Name: Silver State Delivery LLC
Business Location: 100 Commerce Way, Las Vegas, NV 89101
Covered Auto Symbols: 1, 7, 8, 9
Scheduled Vehicle Count: 12
Operating Radius: 200 miles
Primary Vehicle Use: Local delivery
`;

test('commercial auto extracts identity, fleet facts, liability, physical damage and optional extensions', () => {
  const result = normalizeCommercialAutoPolicyFields({documentId:'DOC-CA',insuranceLine:'COMMERCIAL_AUTO',ocr:ocr(`${common}
Combined Single Limit: $1,000,000
Comprehensive Deductible: $1,000
Collision Deductible: $2,500
Hired Auto Liability: Included
Non-Owned Auto Liability: Included
Motor Truck Cargo Limit: $100,000
`)});
  const values = Object.fromEntries(result.fields.map(field => [field.fieldPath,field.value]));
  assert.equal(result.status,'READY_FOR_CONSUMER');
  assert.equal(values['commercialAuto.fleetSize'],12);
  assert.equal(values['coverage.commercialAuto.combinedSingleLimit'],1000000);
  assert.equal(values['coverage.commercialAuto.hiredAutoIncluded'],1);
  assert.equal(values['coverage.commercialAuto.motorTruckCargoLimit'],100000);
});

test('commercial auto accepts complete split liability limits', () => {
  const result = normalizeCommercialAutoPolicyFields({documentId:'DOC-CA-SPLIT',insuranceLine:'COMMERCIAL_AUTO',ocr:ocr(`${common}
Bodily Injury Per Person: $100,000
Bodily Injury Per Accident: $300,000
Property Damage Per Accident: $100,000
`)});
  assert.equal(result.status,'READY_FOR_CONSUMER');
  assert.equal(result.criticalIssues.length,0);
});

test('commercial auto fails closed when liability evidence is absent', () => {
  const result = normalizeCommercialAutoPolicyFields({documentId:'DOC-CA-MISSING',insuranceLine:'COMMERCIAL_AUTO',ocr:ocr(common)});
  assert.equal(result.status,'REVIEW_REQUIRED');
  assert.ok(result.criticalIssues.some(issue => issue.includes('liability limit')));
});
