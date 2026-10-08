import { JurisdictionKind, UsJurisdictionCode } from '../../types/jurisdiction';
import { US_JURISDICTIONS } from './usJurisdictions';

export type RolloutWaveId = 0 | 1 | 2 | 3 | 4;
export type RegionalRolloutState = 'ENABLED' | 'UNLOCKED' | 'LOCKED';

export interface RegionalRolloutWave {
  id: RolloutWaveId;
  name: string;
  region: 'NEVADA' | 'WEST' | 'MIDWEST' | 'SOUTH' | 'NORTHEAST';
  state: RegionalRolloutState;
  jurisdictions: readonly UsJurisdictionCode[];
}

/**
 * Frozen PR-0B rollout cohorts. This schedules rollout and onboarding only.
 * It never verifies law, provider authority, or PRODUCTION market activation.
 */
const REGIONAL_ROLLOUT_MEMBERSHIP: readonly Omit<RegionalRolloutWave, 'state'>[] = [
  {
    id: 0,
    name: 'Nevada',
    region: 'NEVADA',
    jurisdictions: ['NV']
  },
  {
    id: 1,
    name: 'West remainder',
    region: 'WEST',
    jurisdictions: ['AK', 'AZ', 'CA', 'CO', 'HI', 'ID', 'MT', 'NM', 'OR', 'UT', 'WA', 'WY']
  },
  {
    id: 2,
    name: 'Midwest',
    region: 'MIDWEST',
    jurisdictions: ['IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI']
  },
  {
    id: 3,
    name: 'South',
    region: 'SOUTH',
    jurisdictions: ['AL', 'AR', 'DE', 'DC', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'OK', 'SC', 'TN', 'TX', 'VA', 'WV']
  },
  {
    id: 4,
    name: 'Northeast',
    region: 'NORTHEAST',
    jurisdictions: ['CT', 'ME', 'MA', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT']
  }
] as const;

export function resolveRegionalRolloutWaves(unlockedWaveIds: ReadonlySet<RolloutWaveId>): readonly RegionalRolloutWave[] {
  return REGIONAL_ROLLOUT_MEMBERSHIP.map(wave => ({
    ...wave,
    state: wave.id === 0 ? 'ENABLED' : unlockedWaveIds.has(wave.id) ? 'UNLOCKED' : 'LOCKED'
  }));
}

function configuredUnlockedWaves(): ReadonlySet<RolloutWaveId> {
  const raw: string = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
    ?.VITE_OPENPOLICY_UNLOCKED_ROLLOUT_WAVES ?? '1';
  const ids = raw.split(',').map(value => Number(value.trim())).filter(value => Number.isInteger(value) && value >= 1 && value <= 4);
  return new Set(ids as RolloutWaveId[]);
}

/**
 * Deployment configuration may unlock an existing wave without a source edit.
 * Wave 0 is always enabled; default Wave 1 is unlocked. This public rollout
 * setting cannot activate a market or bypass server-side PR-0A authority.
 */
export const REGIONAL_ROLLOUT_WAVES = resolveRegionalRolloutWaves(configuredUnlockedWaves());

const waveByJurisdiction = new Map<UsJurisdictionCode, RegionalRolloutWave>();
for (const wave of REGIONAL_ROLLOUT_WAVES) {
  for (const code of wave.jurisdictions) {
    if (waveByJurisdiction.has(code)) {
      throw new Error(`Duplicate jurisdiction ${code} in regional rollout configuration`);
    }
    waveByJurisdiction.set(code, wave);
  }
}

const canonicalCodes = new Set(US_JURISDICTIONS.map(jurisdiction => jurisdiction.code));
if (
  waveByJurisdiction.size !== US_JURISDICTIONS.length ||
  [...waveByJurisdiction.keys()].some(code => !canonicalCodes.has(code))
) {
  throw new Error('Regional rollout configuration must contain every canonical U.S. jurisdiction exactly once');
}

export interface JurisdictionRolloutEntry {
  code: UsJurisdictionCode;
  name: string;
  kind: JurisdictionKind;
  waveId: RolloutWaveId;
  waveName: string;
  region: RegionalRolloutWave['region'];
  rolloutState: RegionalRolloutState;
  rolloutAvailable: boolean;
}

export const JURISDICTION_ROLLOUT: readonly JurisdictionRolloutEntry[] = US_JURISDICTIONS.map(jurisdiction => {
  const wave = waveByJurisdiction.get(jurisdiction.code);
  if (!wave) throw new Error(`Missing rollout configuration for ${jurisdiction.code}`);
  return {
    ...jurisdiction,
    waveId: wave.id,
    waveName: wave.name,
    region: wave.region,
    rolloutState: wave.state,
    rolloutAvailable: wave.state !== 'LOCKED'
  };
});

export function getJurisdictionRollout(code: UsJurisdictionCode): JurisdictionRolloutEntry {
  const entry = JURISDICTION_ROLLOUT.find(jurisdiction => jurisdiction.code === code);
  if (!entry) throw new Error(`Unknown U.S. jurisdiction: ${code}`);
  return entry;
}
