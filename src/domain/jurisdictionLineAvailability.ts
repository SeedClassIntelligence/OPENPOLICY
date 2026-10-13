import type { InsuranceLine, UsJurisdictionCode } from '../types/jurisdiction';
import { INSURANCE_LINES, getInsuranceLineDefinition } from './insuranceLineRegistry';
import { getJurisdictionRollout, JURISDICTION_ROLLOUT } from './jurisdiction/jurisdictionRollout';

export interface JurisdictionLineAvailability {
  jurisdictionCode: UsJurisdictionCode;
  insuranceLine: InsuranceLine;
  region: ReturnType<typeof getJurisdictionRollout>['region'];
  waveId: ReturnType<typeof getJurisdictionRollout>['waveId'];
  rolloutState: ReturnType<typeof getJurisdictionRollout>['rolloutState'];
  lineImplementationStatus: ReturnType<typeof getInsuranceLineDefinition>['implementationStatus'];
  rolloutAvailable: boolean;
  mayEnterPolicyPipeline: boolean;
  /** Always false here. Production authority is derived from durable regulatory and activation records. */
  productionAuthorized: false;
}

/**
 * Product/rollout projection only. It intentionally cannot claim regulatory or
 * production authority; the durable market-activation engine owns that answer.
 */
export function getJurisdictionLineAvailability(
  jurisdictionCode: UsJurisdictionCode,
  insuranceLine: InsuranceLine
): JurisdictionLineAvailability {
  const jurisdiction = getJurisdictionRollout(jurisdictionCode);
  const line = getInsuranceLineDefinition(insuranceLine);
  return {
    jurisdictionCode,
    insuranceLine,
    region: jurisdiction.region,
    waveId: jurisdiction.waveId,
    rolloutState: jurisdiction.rolloutState,
    lineImplementationStatus: line.implementationStatus,
    rolloutAvailable: jurisdiction.rolloutAvailable,
    mayEnterPolicyPipeline: jurisdiction.rolloutAvailable && line.implementationStatus === 'ACCEPTANCE',
    productionAuthorized: false
  };
}

export const JURISDICTION_LINE_ROLLOUT_MATRIX: readonly JurisdictionLineAvailability[] = Object.freeze(
  JURISDICTION_ROLLOUT.flatMap(jurisdiction =>
    INSURANCE_LINES.map(line => getJurisdictionLineAvailability(jurisdiction.code, line.code))
  )
);

