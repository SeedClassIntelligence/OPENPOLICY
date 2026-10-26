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

test('renters extraction accepts a public carrier-style declarations layout', () => {
  const result=normalizePropertyPolicyFields({documentId:'D-HO4-PUBLIC',insuranceLine:'RENTERS',ocr:ocr([
    'DECLARATIONS','Coverage afforded by this policy is provided by:','State Farm Fire and Casualty Company',
    'Policy Number27-B3-P000-5','Named Insured and Mailing Address','LEASEHOLDER FIRST & LAST NAME',
    '1234 ADDRESS STREET','OMAHA, NE 68106','Effective Date','12 months - Policy Period','11/20/2020',
    'Expiration of Policy Period11/20/2021','Limit of Liability - Section I','$25,000 Personal Property (Coverage B)',
    'Limit of Liability - Section II','$100,000','$5,000','Policy Type','Personal Liability (Coverage L) each occurrence',
    'Medical Payments (Coverage M) each occurrence','Renters Policy','Location of Premises','5106 MAYBERRY ST APT 2101',
    'OMAHA, NE 68106-1764','Deductibles - Section I $500','Policy Premium $ 105.00'
  ].join('\n'))});
  const values=Object.fromEntries(result.fields.map(candidate=>[candidate.fieldPath,candidate.value]));
  assert.equal(values.carrier,'State Farm Fire and Casualty Company');
  assert.equal(values.namedInsured,'LEASEHOLDER FIRST & LAST NAME');
  assert.equal(values.jurisdiction,'NE');
  assert.equal(values.effectiveDate,'2020-11-20');
  assert.equal(values.expirationDate,'2021-11-20');
  assert.equal(values.annualPremium,105);
  assert.equal(values['coverage.personalProperty.limit'],25000);
  assert.equal(values['coverage.personalLiability.limit'],100000);
  assert.equal(values['coverage.medicalPayments.limit'],5000);
  assert.equal(values['coverage.property.deductible'],500);
  assert.equal(result.status,'READY_FOR_CONSUMER');
});

test('maps Nevada renters Document AI column order to the declared coverage limits', () => {
  const result=normalizePropertyPolicyFields({documentId:'D-NV-HO4-OCR',insuranceLine:'RENTERS',ocr:ocr(`
Accelerant National Insurance Company
Policy Number: N457PE00000000-00
RENTERS POLICY DECLARATION PAGE
Policy Period: 10/31/2021 5:00 PM PDT to 10/31/2022 5:00 PM PDT.
Primary Named Insured:
Amuro Ray
Prop Loc: 804 Peachy Canyon Cir Las Vegas NV 89144
SECTION I – PROPERTY COVERAGE LIMITS
C
PERSONAL PROPERTY
$10,000
D
SECTION II – LIABILITY COVERAGE LIMITS
E
F
LOSS OF USE
$2,000
PERSONAL LIABILITY
MEDICAL PAYMENTS TO
OTHERS
$1,000
Loss Deductible for Section I: $500
$100,000
each occurrence
Wind/Hail Deductible: $1,000
$25,000
each person each occurrence
Annual Premium: $135.00
`)});
  const values=Object.fromEntries(result.fields.map(candidate=>[candidate.fieldPath,candidate.value]));
  assert.equal(result.status,'READY_FOR_CONSUMER');
  assert.equal(values.carrier,'Accelerant National Insurance Company');
  assert.equal(values.jurisdiction,'NV');
  assert.equal(values.expirationDate,'2022-10-31');
  assert.equal(values['property.address'],'804 Peachy Canyon Cir Las Vegas NV 89144');
  assert.equal(values['coverage.personalLiability.limit'],100000);
  assert.equal(values['coverage.medicalPayments.limit'],1000);
  assert.equal(values['coverage.property.deductible'],500);
});

test('a commercial document cannot fall through into personal-auto normalization', () => {
  const result=normalizePolicyDocumentByLine({documentId:'D-CGL',insuranceLine:'COMMERCIAL_GENERAL_LIABILITY',ocr:ocr(
    'VIN: 1HGCM82633A004352\nYear, Make, and Model: 2022 Honda Accord'
  )});
  assert.equal(result.status,'REVIEW_REQUIRED');
  assert.equal(result.fields.length,0);
  assert.equal(result.normalizer,'OPENPOLICY_COMMERCIAL_GENERAL_LIABILITY_FIELDS');
  assert.match(result.criticalIssues[0],/Missing required field/);
});
