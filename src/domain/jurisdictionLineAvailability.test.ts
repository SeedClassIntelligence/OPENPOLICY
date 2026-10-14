import test from 'node:test';
import assert from 'node:assert/strict';
import { INSURANCE_LINES } from './insuranceLineRegistry';
import { JURISDICTION_LINE_ROLLOUT_MATRIX, getJurisdictionLineAvailability } from './jurisdictionLineAvailability';
import { JURISDICTION_ROLLOUT } from './jurisdiction/jurisdictionRollout';

test('every canonical jurisdiction-line pair occurs exactly once', () => {
  assert.equal(JURISDICTION_LINE_ROLLOUT_MATRIX.length, 51 * INSURANCE_LINES.length);
  const keys = JURISDICTION_LINE_ROLLOUT_MATRIX.map(entry => `${entry.jurisdictionCode}:${entry.insuranceLine}`);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(JURISDICTION_ROLLOUT.length, 51);
});

test('regional rollout and line implementation remain independent', () => {
  const westHomeowners = getJurisdictionLineAvailability('CA', 'HOMEOWNERS');
  assert.equal(westHomeowners.rolloutAvailable, true);
  assert.equal(westHomeowners.mayEnterPolicyPipeline, false);

  const lockedAuto = getJurisdictionLineAvailability('IL', 'PERSONAL_AUTO');
  assert.equal(lockedAuto.rolloutAvailable, false);
  assert.equal(lockedAuto.mayEnterPolicyPipeline, false);
});

test('static rollout projection can never confer production authority', () => {
  assert.equal(JURISDICTION_LINE_ROLLOUT_MATRIX.every(entry => entry.productionAuthorized === false), true);
});

