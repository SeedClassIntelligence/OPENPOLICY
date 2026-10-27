import test from 'node:test';
import assert from 'node:assert/strict';
import { canEnterPolicyPipeline, INSURANCE_LINES, INSURANCE_LINE_REGISTRY } from './insuranceLineRegistry';

test('insurance-line registry contains unique stable codes', () => {
  const codes = INSURANCE_LINES.map(line => line.code);
  assert.equal(new Set(codes).size, codes.length);
  assert.deepEqual(codes.sort(), Object.keys(INSURANCE_LINE_REGISTRY).sort());
});

test('accepted personal auto and homeowners can enter the policy pipeline', () => {
  assert.equal(canEnterPolicyPipeline('PERSONAL_AUTO'), true);
  assert.equal(canEnterPolicyPipeline('HOMEOWNERS'), true);
  assert.equal(canEnterPolicyPipeline('RENTERS'), true);
  assert.equal(canEnterPolicyPipeline('COMMERCIAL_AUTO'), true);
  assert.equal(canEnterPolicyPipeline('COMMERCIAL_GENERAL_LIABILITY'), true);
  assert.equal(canEnterPolicyPipeline('BUSINESS_OWNERS_POLICY'), true);
});

test('property and core small-commercial lines expose complete acceptance contracts', () => {
  for (const code of ['HOMEOWNERS', 'RENTERS', 'COMMERCIAL_AUTO', 'COMMERCIAL_GENERAL_LIABILITY', 'BUSINESS_OWNERS_POLICY'] as const) {
    const line = INSURANCE_LINE_REGISTRY[code];
    assert.equal(line.implementationStatus, 'ACCEPTANCE');
    assert.equal(canEnterPolicyPipeline(code), true);
    assert.ok(line.policySchemaRef);
    assert.ok(line.extractionProfileRef);
    assert.ok(line.comparisonProfileRef);
    assert.ok(line.reconciliationProfileRef);
  }
});

test('registry membership never represents production authority', () => {
  for (const line of INSURANCE_LINES) {
    assert.equal('productionAuthorized' in line, false);
    assert.equal('jurisdictions' in line, false);
  }
});
