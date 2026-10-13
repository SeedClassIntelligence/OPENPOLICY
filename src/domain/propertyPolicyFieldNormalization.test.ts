import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePropertyPolicyFields } from './propertyPolicyFieldNormalization';
import { normalizePolicyDocumentByLine } from './policyLineNormalization';

const ocr = (text: string) => ({
  runId:'OCR-PROPERTY',sourceSha256:'a'.repeat(64),sourceGeneration:'7',extractor:'GOOGLE_DOCUMENT_AI' as const,
  extractorVersion:'test',processedAt:'',pages:[{pageNumber:2,text,regions:[{textStart:0,textEnd:text.length,confidence:.99,normalizedVertices:[]}]}]
});

test('extracts homeowners source facts without calculated defaults', () => {
  const result = normalizePropertyPolicyFields({documentId:'D-HO',insuranceLine:'HOMEOWNERS',ocr:ocr([
    'Policy Number: HO-12345','Insurance Company: Example Property Insurance Company','Named Insured: Jane Policyholder',
    'Policy State: NV','Effective Date: 01/01/2027','Expiration Date: 01/01/2028','Annual Premium: $1,800.00',
    'Residence Premises: 123 Main Street, Las Vegas, NV 89101','Occupancy: Owner occupied','Year Built: 2004','Construction Type: Frame',
    'Coverage A Dwelling: $450,000','Coverage B Other Structures: $45,000','Coverage C Personal Property: $225,000',
    'Coverage D Loss of Use: $90,000','Coverage E Personal Liability: $300,000','Coverage F Medical Payments to Others: $5,000',
    'All Other Perils Deductible: $2,500','Wind/Hail Deductible: 2%','Water Backup Limit: $10,000'
  ].join('\n'))});
  const values=Object.fromEntries(result.fields.map(candidate=>[candidate.fieldPath,candidate.value]));
  assert.equal(values['coverage.dwelling.limit'],450000);
  assert.equal(values['coverage.otherStructures.limit'],45000);
  assert.equal(values['coverage.windHail.deductible'],'2%');
  assert.equal(values['coverage.waterBackup.limit'],10000);
  assert.equal(result.status,'READY_FOR_CONSUMER');
  assert.equal(result.fields.every(candidate=>candidate.evidence.pageNumber===2),true);
});

test('renters extraction omits dwelling fields rather than writing zero or null', () => {
  const result=normalizePropertyPolicyFields({documentId:'D-HO4',insuranceLine:'RENTERS',ocr:ocr([
    'Policy Number: R-12345','Carrier: Example Renters Insurance Company','Named Insured: Jane Tenant','Policy State: NV',
    'Effective Date: 02/01/2027','Expiration Date: 02/01/2028','Total Premium: $240.00',
    'Residence Premises: 200 Tenant Avenue, Reno, NV 89501','Coverage C Personal Property: $30,000',
    'Coverage D Loss of Use: $9,000','Coverage E Personal Liability: $100,000','Property Deductible: $500'
  ].join('\n'))});
  assert.equal(result.fields.some(candidate=>candidate.fieldPath==='coverage.dwelling.limit'),false);
  assert.equal(result.fields.some(candidate=>candidate.fieldPath==='coverage.otherStructures.limit'),false);
  assert.equal(result.status,'READY_FOR_CONSUMER');
});

test('unfinished commercial lines cannot fall through into personal-auto normalization', () => {
  const result=normalizePolicyDocumentByLine({documentId:'D-CGL',insuranceLine:'COMMERCIAL_GENERAL_LIABILITY',ocr:ocr(
    'VIN: 1HGCM82633A004352\nYear, Make, and Model: 2022 Honda Accord'
  )});
  assert.equal(result.status,'REVIEW_REQUIRED');
  assert.equal(result.fields.length,0);
  assert.match(result.criticalIssues[0],/not implemented for COMMERCIAL_GENERAL_LIABILITY/);
});
