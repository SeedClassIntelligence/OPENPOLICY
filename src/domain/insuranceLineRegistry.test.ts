import test from 'node:test';
import assert from 'node:assert/strict';
import { canEnterPolicyPipeline, INSURANCE_LINES, INSURANCE_LINE_REGISTRY } from './insuranceLineRegistry';

test('insurance-line registry contains unique stable codes', () => {
  const codes = INSURANCE_LINES.map(line => line.code);
  assert.equal(new Set(codes).size, codes.length);
  assert.deepEqual(codes.sort(), Object.keys(INSURANCE_LINE_REGISTRY).sort());
});

test('only accepted personal auto can enter the policy pipeline', () => {
  assert.equal(canEnterPolicyPipeline('PERSONAL_AUTO'), true);
  assert.equal(canEnterPolicyPipeline('HOMEOWNERS'), false);
  assert.equal(canEnterPolicyPipeline('RENTERS'), false);
  assert.equal(canEnterPolicyPipeline('COMMERCIAL_AUTO'), false);
  assert.equal(canEnterPolicyPipeline('COMMERCIAL_GENERAL_LIABILITY'), false);
});

test('property and core small-commercial lines are explicit development work, not active pipelines', () => {
  for (const code of ['HOMEOWNERS', 'RENTERS', 'COMMERCIAL_AUTO', 'COMMERCIAL_GENERAL_LIABILITY', 'BUSINESS_OWNERS_POLICY'] as const) {
    const line = INSURANCE_LINE_REGISTRY[code];
    assert.equal(line.implementationStatus, 'DEVELOPMENT');
    assert.equal(canEnterPolicyPipeline(code), false);
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
