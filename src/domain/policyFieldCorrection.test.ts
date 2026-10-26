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
  assert.throws(() => validatePolicyFieldCorrection({ fieldPath: 'annualPremium', afterValue: -1 }), /finite, non-negative/);
  assert.throws(() => validatePolicyFieldCorrection({ fieldPath: 'jurisdiction', afterValue: 'Nevada' }), /two-letter/);
  assert.throws(() => validatePolicyFieldCorrection({ fieldPath: 'vehicle.ownership', afterValue: 'borrowed' }), /ownership is invalid/);
});

test('corrections are bounded by the selected insurance line schema', () => {
  assert.deepEqual(
    validatePolicyFieldCorrection({ fieldPath: 'coverage.dwelling.limit', afterValue: 450000 }, 'HOMEOWNERS'),
    { fieldPath: 'coverage.dwelling.limit', afterValue: 450000 }
  );
  assert.throws(
    () => validatePolicyFieldCorrection({ fieldPath: 'coverage.dwelling.limit', afterValue: 450000 }, 'RENTERS'),
    /not consumer-correctable for RENTERS/
  );
  assert.deepEqual(
    validatePolicyFieldCorrection({ fieldPath: 'coverage.windHail.deductible', afterValue: '2%' }, 'HOMEOWNERS'),
    { fieldPath: 'coverage.windHail.deductible', afterValue: '2%' }
  );
  assert.deepEqual(
    validatePolicyFieldCorrection({ fieldPath: 'coverage.businessIncome.included', afterValue: 1 }, 'BUSINESS_OWNERS_POLICY'),
    { fieldPath: 'coverage.businessIncome.included', afterValue: 1 }
  );
  assert.throws(
    () => validatePolicyFieldCorrection({ fieldPath: 'coverage.businessProperty.limit', afterValue: 100000 }, 'COMMERCIAL_GENERAL_LIABILITY'),
    /not consumer-correctable for COMMERCIAL_GENERAL_LIABILITY/
  );
  assert.throws(
    () => validatePolicyFieldCorrection({ fieldPath: 'coverage.businessIncome.included', afterValue: 2 }, 'BUSINESS_OWNERS_POLICY'),
    /0 \(not included\) or 1/
  );
  assert.deepEqual(
    validatePolicyFieldCorrection({ fieldPath: 'commercialAuto.fleetSize', afterValue: 12 }, 'COMMERCIAL_AUTO'),
    { fieldPath: 'commercialAuto.fleetSize', afterValue: 12 }
  );
  assert.deepEqual(
    validatePolicyFieldCorrection({ fieldPath: 'coverage.commercialAuto.combinedSingleLimit', afterValue: 1000000 }, 'COMMERCIAL_AUTO'),
    { fieldPath: 'coverage.commercialAuto.combinedSingleLimit', afterValue: 1000000 }
  );
  assert.throws(
    () => validatePolicyFieldCorrection({ fieldPath: 'coverage.dwelling.limit', afterValue: 450000 }, 'COMMERCIAL_AUTO'),
    /not consumer-correctable for COMMERCIAL_AUTO/
  );
});
