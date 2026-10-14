import test from 'node:test';
import assert from 'node:assert/strict';
import { POLICY_LINE_SCHEMAS, getPolicyLineSchema } from './policyLineSchemas';

test('development schemas carry common identity, term, and premium evidence', () => {
  for (const schema of Object.values(POLICY_LINE_SCHEMAS)) {
    const paths = new Set(schema.fields.map(field => field.path));
    for (const required of ['policyNumber','carrier','namedInsured','jurisdiction','effectiveDate','expirationDate','annualPremium']) {
      assert.equal(paths.has(required), true, `${schema.insuranceLine}:${required}`);
    }
    assert.equal(paths.size, schema.fields.length);
  }
});

test('homeowners, renters, CGL, and BOP have distinct coverage contracts', () => {
  assert.equal(getPolicyLineSchema('HOMEOWNERS')?.fields.some(field => field.path === 'coverage.dwelling.limit'), true);
  assert.equal(getPolicyLineSchema('RENTERS')?.fields.some(field => field.path === 'coverage.dwelling.limit'), false);
  assert.equal(getPolicyLineSchema('COMMERCIAL_GENERAL_LIABILITY')?.fields.some(field => field.path === 'coverage.businessProperty.limit'), false);
  assert.equal(getPolicyLineSchema('BUSINESS_OWNERS_POLICY')?.fields.some(field => field.path === 'coverage.businessProperty.limit'), true);
});

test('a schema describes evidence but cannot claim production authorization', () => {
  for (const schema of Object.values(POLICY_LINE_SCHEMAS)) {
    assert.equal('productionAuthorized' in schema, false);
    assert.equal('jurisdictions' in schema, false);
  }
});
