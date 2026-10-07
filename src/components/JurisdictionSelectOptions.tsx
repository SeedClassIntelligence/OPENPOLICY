import React from 'react';
import { JURISDICTION_ROLLOUT, REGIONAL_ROLLOUT_WAVES } from '../domain/jurisdiction/jurisdictionRollout';

const OPTIONS_BY_WAVE = REGIONAL_ROLLOUT_WAVES.map(wave => ({
  ...wave,
  jurisdictions: JURISDICTION_ROLLOUT.filter(jurisdiction => jurisdiction.waveId === wave.id)
}));

/** Canonical jurisdiction choices for onboarding. Locked waves remain visible but unavailable. */
export const JurisdictionSelectOptions: React.FC = () => (
  <>
    {OPTIONS_BY_WAVE.map(wave => (
      <optgroup key={wave.id} label={`Wave ${wave.id} — ${wave.name}${wave.state === 'LOCKED' ? ' (locked)' : ''}`}>
        {wave.jurisdictions.map(jurisdiction => (
          <option
            key={jurisdiction.code}
            value={jurisdiction.code}
            disabled={!jurisdiction.rolloutAvailable}
          >
            {jurisdiction.name} ({jurisdiction.code}){jurisdiction.rolloutAvailable ? '' : ' — Locked'}
          </option>
        ))}
      </optgroup>
    ))}
  </>
);

