/**
 * PR-0A — Provider Jurisdictional Authority Engine (pure)
 *
 * Answers: is this provider legally authorized for this opportunity, in this jurisdiction,
 * for this line (and carrier, when known), on this date?
 *
 * Authority is derived from license and appointment evidence plus the ruleset's
 * PRODUCER_AUTHORITY / CARRIER_AUTHORITY requirements. It is never stored as truth.
 *
 * Never consulted: ProviderOrganization.states (self-declared), appetite (preference),
 * and any commercial entitlement, including commercial jurisdiction capacity (capacity is not authority).
 * Without a requirement in the ruleset the result is INDETERMINATE: license evidence alone
 * cannot establish which license the law requires.
 */
import { CarrierRelationship, ProviderLicense, ProviderOrganization } from '../types/insurance';
import { InsuranceLine, JurisdictionRule, ProviderAuthorityResult } from '../types/jurisdiction';
import { isCalendarDate } from './jurisdiction/canonical';
import { isRuleInForce } from './jurisdictionRuleEngine';

export interface ProviderAuthorityInput {
  org: ProviderOrganization;
  licenses: ProviderLicense[];
  carrierRelationships: CarrierRelationship[];
  rules: JurisdictionRule[];
  jurisdictionCode: string | undefined;
  insuranceLine: InsuranceLine;
  /** Carrier for the specific opportunity, when known (offer submission, binding). */
  carrier?: string;
  /** Calendar date of the participation or binding transaction (D10). */
  evaluationDate: string | undefined;
}

function normalizeCarrier(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function evaluateProviderJurisdictionAuthority(input: ProviderAuthorityInput): ProviderAuthorityResult {
  const { org, licenses, carrierRelationships, rules, jurisdictionCode, insuranceLine, carrier, evaluationDate } = input;
  const base = { providerOrganizationId: org.id, jurisdictionCode };

  if (!jurisdictionCode) {
    return { ...base, outcome: 'INDETERMINATE', reasons: ['Governing jurisdiction is unknown.'], ruleIds: [] };
  }
  if (!isCalendarDate(evaluationDate)) {
    return { ...base, outcome: 'INDETERMINATE', reasons: ['Evaluation date is unknown or not a calendar date.'], ruleIds: [] };
  }

  const reasons: string[] = [];
  let indeterminate = false;

  // License evidence valid on the evaluation date in this jurisdiction.
  const validLicenses: ProviderLicense[] = [];
  // Licenses whose validity on the evaluation date cannot be established.
  const uncertainLicenses: ProviderLicense[] = [];
  for (const lic of licenses.filter(l => l.providerOrganizationId === org.id && l.jurisdiction === jurisdictionCode)) {
    if (lic.status !== 'ACTIVE' || lic.verificationStatus !== 'VERIFIED') continue;
    const from = lic.effectiveDate?.slice(0, 10);
    const exp = lic.expirationDate?.slice(0, 10);
    if (from && isCalendarDate(from) && evaluationDate < from) continue;
    if (exp && isCalendarDate(exp)) {
      if (evaluationDate > exp) continue;
      if (evaluationDate === exp) {
        uncertainLicenses.push(lic);
        reasons.push(`License ${lic.licenseNumber} expires on the evaluation date; expiration-day semantics are unverified.`);
        continue;
      }
    }
    validLicenses.push(lic);
  }

  const inForce = rules.filter(
    r => r.enforcementPoint === 'PROVIDER_AUTHORITY' && r.machineRule !== null && isRuleInForce(r, evaluationDate)
  );
  const producerRules = inForce.filter(r => r.machineRule!.kind === 'PRODUCER_AUTHORITY');
  const carrierRules = inForce.filter(r => r.machineRule!.kind === 'CARRIER_AUTHORITY');
  const ruleIds = inForce.map(r => r.id);

  if (org.organizationType === 'DIRECT_CARRIER') {
    if (carrierRules.length === 0) {
      return { ...base, outcome: 'INDETERMINATE', reasons: [...reasons, 'No CARRIER_AUTHORITY requirement is in force for this jurisdiction.'], ruleIds };
    }
    return {
      ...base,
      outcome: 'INDETERMINATE',
      reasons: [...reasons, 'Certificate-of-authority evidence is not yet modeled; carrier authority cannot be established.'],
      ruleIds
    };
  }

  if (producerRules.length === 0) {
    return {
      ...base,
      outcome: 'INDETERMINATE',
      reasons: [
        ...reasons,
        `No PRODUCER_AUTHORITY requirement is in force for ${jurisdictionCode}; ${validLicenses.length} valid license(s) on record cannot establish authority without one.`
      ],
      ruleIds
    };
  }

  let notAuthorized = false;
  for (const rule of producerRules) {
    const req = rule.machineRule as Extract<NonNullable<JurisdictionRule['machineRule']>, { kind: 'PRODUCER_AUTHORITY' }>;
    const classOk = (l: ProviderLicense) =>
      req.acceptedLicenseClasses.length === 0 || req.acceptedLicenseClasses.includes(l.licenseType);

    if (req.entityLicenseRequired) {
      const entity = validLicenses.filter(l => !l.providerUserId && classOk(l));
      if (entity.length === 0 && uncertainLicenses.some(l => !l.providerUserId && classOk(l))) {
        indeterminate = true;
        reasons.push(`${rule.ruleCode}: only a license of uncertain validity on this date could satisfy the requirement.`);
      } else if (entity.length === 0) {
        notAuthorized = true;
        reasons.push(`${rule.ruleCode}: no valid entity license of an accepted class (${req.acceptedLicenseClasses.join(', ') || 'any'}).`);
      } else {
        reasons.push(`${rule.ruleCode}: entity license ${entity[0].licenseNumber} satisfies the requirement.`);
      }
    }
    if (req.individualLicenseRequired) {
      const individual = validLicenses.filter(l => !!l.providerUserId && classOk(l));
      if (individual.length === 0 && uncertainLicenses.some(l => !!l.providerUserId && classOk(l))) {
        indeterminate = true;
        reasons.push(`${rule.ruleCode}: only an individual license of uncertain validity on this date could satisfy the requirement.`);
      } else if (individual.length === 0) {
        notAuthorized = true;
        reasons.push(`${rule.ruleCode}: no valid individual producer license of an accepted class.`);
      } else {
        reasons.push(`${rule.ruleCode}: individual producer license ${individual[0].licenseNumber} satisfies the requirement.`);
      }
    }
    if (req.appointmentRequired) {
      if (!carrier) {
        reasons.push(`${rule.ruleCode}: carrier appointment is evaluated per carrier when an offer is submitted.`);
      } else {
        const appointed = carrierRelationships.find(
          rel =>
            rel.providerOrganizationId === org.id &&
            rel.relationshipType === 'APPOINTED' &&
            rel.status === 'ACTIVE' &&
            rel.jurisdiction === jurisdictionCode &&
            rel.lineOfBusiness === insuranceLine &&
            normalizeCarrier(rel.carrierName) === normalizeCarrier(carrier) &&
            (!rel.effectiveFrom || rel.effectiveFrom <= evaluationDate) &&
            (!rel.effectiveUntil || evaluationDate < rel.effectiveUntil)
        );
        if (!appointed) {
          notAuthorized = true;
          reasons.push(`${rule.ruleCode}: no active ${jurisdictionCode} ${insuranceLine} appointment with carrier '${carrier}'.`);
        } else {
          reasons.push(`${rule.ruleCode}: appointment with '${appointed.carrierName}' in ${jurisdictionCode} verified.`);
        }
      }
    }
  }

  if (notAuthorized) return { ...base, outcome: 'NOT_AUTHORIZED', reasons, ruleIds };
  if (indeterminate) return { ...base, outcome: 'INDETERMINATE', reasons, ruleIds };
  return { ...base, outcome: 'AUTHORIZED', reasons, ruleIds };
}
