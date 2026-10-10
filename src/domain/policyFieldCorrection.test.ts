import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePolicyFieldCorrection } from './policyFieldCorrection';

test('allows only bounded consumer-correctable policy facts', () => {
  assert.deepEqual(validatePolicyFieldCorrection({ fieldPath: 'jurisdiction', afterValue: 'NV' }), { fieldPath: 'jurisdiction', afterValue: 'NV' });
  assert.deepEqual(validatePolicyFieldCorrection({ fieldPath: 'annualPremium', afterValue: 1200 }), { fieldPath: 'annualPremium', afterValue: 1200 });
  assert.deepEqual(validatePolicyFieldCorrection({ fieldPath: 'vehicle.ownership', afterValue: 'owned' }), { fieldPath: 'vehicle.ownership', afterValue: 'OWNED' });
  assert.deepEqual(validatePolicyFieldCorrection({ fieldPath: 'vehicle.usage', afterValue: 'Commute' }), { fieldPath: 'vehicle.usage', afterValue: 'COMMUTE' });
  assert.deepEqual(validatePolicyFieldCorrection({ fieldPath: 'jurisdiction', afterValue: 'nv' }), { fieldPath: 'jurisdiction', afterValue: 'NV' });
  assert.throws(() => validatePolicyFieldCorrection({ fieldPath: 'ownerId', afterValue: 'attacker' }), /not consumer-correctable/);
  assert.throws(() => validatePolicyFieldCorrection({ fieldPath: 'annualPremium', afterValue: -1 }), /valid non-negative/);
  assert.throws(() => validatePolicyFieldCorrection({ fieldPath: 'jurisdiction', afterValue: 'Nevada' }), /two-letter/);
  assert.throws(() => validatePolicyFieldCorrection({ fieldPath: 'vehicle.ownership', afterValue: 'borrowed' }), /ownership is invalid/);
});
