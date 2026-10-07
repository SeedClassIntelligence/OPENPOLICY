import crypto from 'node:crypto';
import type { CoverageBaseline, NormalizedPolicyFieldPath, Policy, PolicyFieldCorrection, PolicyNormalizationResult } from '../types/insurance';

const REQUIRED: NormalizedPolicyFieldPath[] = [
  'policyNumber','carrier','namedInsured','jurisdiction','effectiveDate','expirationDate','annualPremium',
  'vehicle.vin','vehicle.year','vehicle.make','vehicle.model','vehicle.usage','vehicle.annualMileage',
  'vehicle.garagingZip','vehicle.ownership','coverage.bodilyInjury.perPersonLimit',
  'coverage.bodilyInjury.perAccidentLimit','coverage.propertyDamage.propertyLimit'
];

export function buildVerifiedPolicyAndBaseline(input: {
  ownerId: string; documentName: string; normalization: PolicyNormalizationResult;
  corrections: PolicyFieldCorrection[]; verifiedAt?: string;
}): { policy: Policy; baseline: CoverageBaseline } {
  const values = new Map<NormalizedPolicyFieldPath, string | number>();
  for (const field of input.normalization.fields) values.set(field.fieldPath, field.value);
  for (const correction of input.corrections) {
    if (correction.extractionRunId === input.normalization.extractionRunId) {
      values.set(correction.fieldPath as NormalizedPolicyFieldPath, correction.afterValue as string | number);
    }
  }
  const missing = REQUIRED.filter(field => !values.has(field));
  if (missing.length) throw Object.assign(new Error(`Consumer verification requires: ${missing.join(', ')}`), { statusCode: 422 });
  const text = (field: NormalizedPolicyFieldPath) => String(values.get(field));
  const number = (field: NormalizedPolicyFieldPath) => Number(values.get(field));
  const effectiveDate = text('effectiveDate');
  const expirationDate = text('expirationDate');
  if (new Date(expirationDate) <= new Date(effectiveDate)) {
    throw Object.assign(new Error('Policy expiration must be after its effective date.'), { statusCode: 422 });
  }
  const verifiedAt = input.verifiedAt || new Date().toISOString();
  const policyId = `POL-${crypto.randomUUID()}`;
  const policy: Policy = {
    id: policyId, policyNumber: text('policyNumber'), carrier: text('carrier'), jurisdiction: text('jurisdiction'),
    namedInsured: text('namedInsured'), effectiveDate, expirationDate,
    termMonths: Math.max(1, Math.round((new Date(expirationDate).getTime() - new Date(effectiveDate).getTime()) / 2629800000)),
    annualPremium: number('annualPremium'), monthlyPremium: Math.round(number('annualPremium') / 12 * 100) / 100,
    status: 'VERIFIED', drivers: [], sourceDocumentId: input.normalization.documentId, sourceDocumentName: input.documentName,
    vehicles: [{ vin:text('vehicle.vin').toUpperCase(), year:number('vehicle.year'), make:text('vehicle.make'), model:text('vehicle.model'),
      usage:text('vehicle.usage') as any, annualMileage:number('vehicle.annualMileage'), garagingZip:text('vehicle.garagingZip'), ownership:text('vehicle.ownership') as any }],
    coverages: [
      { id:`COV-${crypto.randomUUID()}`,code:'BODILY_INJURY',name:'Bodily Injury Liability',category:'LIABILITY',isIncluded:true,
        perPersonLimit:number('coverage.bodilyInjury.perPersonLimit'),perAccidentLimit:number('coverage.bodilyInjury.perAccidentLimit') },
      { id:`COV-${crypto.randomUUID()}`,code:'PROPERTY_DAMAGE',name:'Property Damage Liability',category:'LIABILITY',isIncluded:true,
        propertyLimit:number('coverage.propertyDamage.propertyLimit') }
    ]
  };
  const baseline: CoverageBaseline = {
    id:`BL-${crypto.randomUUID()}`,policyId,version:1,carrier:policy.carrier,effectiveDate,expirationDate,
    baselineAnnualPremium:policy.annualPremium,baselineMonthlyPremium:policy.monthlyPremium,jurisdiction:policy.jurisdiction,
    vehicle:policy.vehicles[0],coverages:policy.coverages,verifiedAt,verifiedBy:input.ownerId
  };
  return { policy, baseline };
}
