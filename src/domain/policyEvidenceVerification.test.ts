import test from 'node:test'; import assert from 'node:assert/strict';
import { buildVerifiedPolicyAndBaseline } from './policyEvidenceVerification';
import { getPolicyLineSchema } from './policyLineSchemas';
const fields:any[]=['policyNumber','carrier','namedInsured','jurisdiction','effectiveDate','expirationDate','annualPremium','vehicle.vin','vehicle.year','vehicle.make','vehicle.model','vehicle.usage','vehicle.annualMileage','vehicle.garagingZip','vehicle.ownership','coverage.bodilyInjury.perPersonLimit','coverage.bodilyInjury.perAccidentLimit','coverage.propertyDamage.propertyLimit','coverage.medicalPayments.included','coverage.rentalReimbursement.included','coverage.umUim.included','coverage.comprehensive.included','coverage.collision.included','coverage.roadsideAssistance.included'].map((fieldPath,i)=>({fieldPath,value:['2025-01-01','2026-01-01'].includes(fieldPath)?fieldPath:'x',confidence:.99,evidence:{}}));
const set=(p:string,v:any)=>{fields.find(x=>x.fieldPath===p).value=v};
set('effectiveDate','2025-01-01');set('expirationDate','2026-01-01');set('annualPremium',1200);set('vehicle.vin','1HGCM82633A004352');set('vehicle.year',2022);set('vehicle.usage','COMMUTE');set('vehicle.annualMileage',10000);set('vehicle.ownership','OWNED');set('coverage.bodilyInjury.perPersonLimit',100000);set('coverage.bodilyInjury.perAccidentLimit',300000);set('coverage.propertyDamage.propertyLimit',100000);set('coverage.medicalPayments.included',0);set('coverage.rentalReimbursement.included',0);set('coverage.umUim.included',0);set('coverage.comprehensive.included',0);set('coverage.collision.included',0);set('coverage.roadsideAssistance.included',1);
test('builds a verified policy and immutable baseline only from complete attested facts',()=>{const r=buildVerifiedPolicyAndBaseline({ownerId:'c1',documentName:'p.pdf',normalization:{extractionRunId:'r',documentId:'d',documentGeneration:'1',sourceSha256:'a',normalizer:'n',normalizerVersion:'1',fields,criticalIssues:[],status:'READY_FOR_CONSUMER',normalizedAt:''},corrections:[],verifiedAt:'2026-10-07T00:00:00Z'});assert.equal(r.policy.status,'VERIFIED');assert.equal(r.baseline.policyId,r.policy.id);assert.equal(r.baseline.verifiedBy,'c1')});
test('refuses incomplete evidence rather than inventing baseline truth',()=>assert.throws(()=>buildVerifiedPolicyAndBaseline({ownerId:'c1',documentName:'p',normalization:{extractionRunId:'r',documentId:'d',documentGeneration:'1',sourceSha256:'a',normalizer:'n',normalizerVersion:'1',fields:fields.filter(x=>x.fieldPath!=='vehicle.vin'),criticalIssues:[],status:'READY_FOR_CONSUMER',normalizedAt:''},corrections:[]}),/vehicle.vin/));

const lineFields = (line: 'HOMEOWNERS' | 'BUSINESS_OWNERS_POLICY' | 'COMMERCIAL_AUTO') => getPolicyLineSchema(line)!.fields.map((definition, index) => ({
  fieldPath: definition.path,
  value: definition.path === 'effectiveDate' ? '2027-01-01'
    : definition.path === 'expirationDate' ? '2028-01-01'
      : definition.kind === 'MONEY' || definition.kind === 'LIMIT' || definition.kind === 'DEDUCTIBLE' || definition.kind === 'INTEGER' ? 1000 + index
        : definition.kind === 'BOOLEAN' ? 1
          : definition.path === 'jurisdiction' ? 'NV'
            : `${definition.label} value`,
  confidence: .99,
  evidence: {}
}));

test('builds a commercial-auto baseline with combined-single-limit evidence', () => {
  const fields = lineFields('COMMERCIAL_AUTO');
  const result = buildVerifiedPolicyAndBaseline({
    ownerId:'consumer-commercial-auto',documentName:'business-auto.pdf',insuranceLine:'COMMERCIAL_AUTO',
    normalization:{extractionRunId:'r-ca',documentId:'d-ca',documentGeneration:'1',sourceSha256:'ca',normalizer:'COMMERCIAL_AUTO',normalizerVersion:'1',fields:fields as any,criticalIssues:[],status:'READY_FOR_CONSUMER',normalizedAt:''},
    corrections:[],verifiedAt:'2026-10-26T00:00:00Z'
  });
  assert.equal(result.baseline.insuranceLine,'COMMERCIAL_AUTO');
  assert.equal(result.baseline.verifiedFacts?.['coverage.commercialAuto.combinedSingleLimit'],1015);
  assert.deepEqual(result.policy.vehicles,[]);
});

test('commercial-auto baseline refuses evidence without a complete liability representation', () => {
  const fields = lineFields('COMMERCIAL_AUTO').filter(field => ![
    'coverage.commercialAuto.combinedSingleLimit','coverage.commercialAuto.bodilyInjuryPerPersonLimit',
    'coverage.commercialAuto.bodilyInjuryPerAccidentLimit','coverage.commercialAuto.propertyDamageLimit'
  ].includes(field.fieldPath));
  assert.throws(() => buildVerifiedPolicyAndBaseline({
    ownerId:'consumer-commercial-auto',documentName:'business-auto.pdf',insuranceLine:'COMMERCIAL_AUTO',
    normalization:{extractionRunId:'r-ca',documentId:'d-ca',documentGeneration:'1',sourceSha256:'ca',normalizer:'COMMERCIAL_AUTO',normalizerVersion:'1',fields:fields as any,criticalIssues:[],status:'REVIEW_REQUIRED',normalizedAt:''},corrections:[]
  }),/commercial-auto liability/);
});

test('builds a homeowners baseline without manufacturing an auto vehicle', () => {
  const result = buildVerifiedPolicyAndBaseline({
    ownerId:'consumer-home', documentName:'home.pdf', insuranceLine:'HOMEOWNERS',
    normalization:{extractionRunId:'r-home',documentId:'d-home',documentGeneration:'1',sourceSha256:'b',normalizer:'HOME',normalizerVersion:'1',fields:lineFields('HOMEOWNERS') as any,criticalIssues:[],status:'READY_FOR_CONSUMER',normalizedAt:''},
    corrections:[], verifiedAt:'2026-10-13T00:00:00Z'
  });
  assert.equal(result.policy.insuranceLine, 'HOMEOWNERS');
  assert.deepEqual(result.policy.vehicles, []);
  assert.equal(result.baseline.vehicle, undefined);
  assert.equal(result.baseline.verifiedFacts?.['coverage.dwelling.limit'], 1011);
});

test('builds a BOP baseline from its own required facts and preserves explicit inclusion', () => {
  const result = buildVerifiedPolicyAndBaseline({
    ownerId:'consumer-bop', documentName:'bop.pdf', insuranceLine:'BUSINESS_OWNERS_POLICY',
    normalization:{extractionRunId:'r-bop',documentId:'d-bop',documentGeneration:'1',sourceSha256:'c',normalizer:'BOP',normalizerVersion:'1',fields:lineFields('BUSINESS_OWNERS_POLICY') as any,criticalIssues:[],status:'READY_FOR_CONSUMER',normalizedAt:''},
    corrections:[], verifiedAt:'2026-10-13T00:00:00Z'
  });
  assert.equal(result.baseline.insuranceLine, 'BUSINESS_OWNERS_POLICY');
  assert.equal(result.baseline.verifiedFacts?.['coverage.businessIncome.included'], 1);
  assert.equal(result.baseline.verifiedFacts?.['coverage.dwelling.limit'], undefined);
});

test('refuses non-auto baseline creation when required line facts are missing', () => {
  const incomplete = lineFields('HOMEOWNERS').filter(field => field.fieldPath !== 'coverage.dwelling.limit');
  assert.throws(() => buildVerifiedPolicyAndBaseline({
    ownerId:'consumer-home',documentName:'home.pdf',insuranceLine:'HOMEOWNERS',
    normalization:{extractionRunId:'r-home',documentId:'d-home',documentGeneration:'1',sourceSha256:'b',normalizer:'HOME',normalizerVersion:'1',fields:incomplete as any,criticalIssues:[],status:'READY_FOR_CONSUMER',normalizedAt:''},corrections:[]
  }), /coverage.dwelling.limit/);
});

test('refuses baseline creation for a line without an implemented evidence schema', () => {
  assert.throws(() => buildVerifiedPolicyAndBaseline({
    ownerId:'consumer-life',documentName:'life.pdf',insuranceLine:'TERM_LIFE',
    normalization:{extractionRunId:'r-life',documentId:'d-life',documentGeneration:'1',sourceSha256:'d',normalizer:'LIFE',normalizerVersion:'0',fields:[],criticalIssues:[],status:'REVIEW_REQUIRED',normalizedAt:''},corrections:[]
  }), /not implemented for TERM_LIFE/);
});
