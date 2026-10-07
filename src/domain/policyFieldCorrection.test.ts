import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePolicyFieldCorrection } from './policyFieldCorrection';

test('allows only bounded consumer-correctable policy facts', () => {
  assert.deepEqual(validatePolicyFieldCorrection({ fieldPath: 'jurisdiction', afterValue: 'NV' }), { fieldPath: 'jurisdiction', afterValue: 'NV' });
  assert.deepEqual(validatePolicyFieldCorrection({ fieldPath: 'annualPremium', afterValue: 1200 }), { fieldPath: 'annualPremium', afterValue: 1200 });
  assert.throws(() => validatePolicyFieldCorrection({ fieldPath: 'ownerId', afterValue: 'attacker' }), /not consumer-correctable/);
  assert.throws(() => validatePolicyFieldCorrection({ fieldPath: 'annualPremium', afterValue: -1 }), /valid non-negative/);
  assert.throws(() => validatePolicyFieldCorrection({ fieldPath: 'jurisdiction', afterValue: 'Nevada' }), /two-letter/);
});
