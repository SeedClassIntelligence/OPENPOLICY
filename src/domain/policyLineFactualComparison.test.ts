import test from 'node:test';
import assert from 'node:assert/strict';
import { comparePolicyLineFacts } from './policyLineFactualComparison';

test('homeowners comparison reports factual differences without ranking terms', () => {
  const comparison = comparePolicyLineFacts({
    insuranceLine: 'HOMEOWNERS',
    baseline: {
      annualPremium: 1800,
      'coverage.dwelling.limit': 450000,
      'coverage.property.deductible': 2500,
      'coverage.waterBackup.limit': 10000
    },
    offer: {
      annualPremium: 1750,
      'coverage.dwelling.limit': 425000,
      'coverage.property.deductible': 1000
    }
  });
  assert.equal(comparison.annualPremiumDifference, 50);
  assert.equal(comparison.fields.every(field => field.fieldPath.startsWith('coverage.')), true);
  assert.equal(comparison.fields.some(field => field.fieldPath === 'carrier'), false);
  assert.equal(comparison.fields.find(field => field.fieldPath === 'coverage.dwelling.limit')?.relation, 'DIFFERENT');
  assert.equal(comparison.fields.find(field => field.fieldPath === 'coverage.waterBackup.limit')?.relation, 'BASELINE_ONLY');
  assert.equal(JSON.stringify(comparison).includes('BETTER'), false);
  assert.equal(JSON.stringify(comparison).includes('WORSE'), false);
  assert.equal(JSON.stringify(comparison).includes('recommend'), false);
});

test('CGL comparison excludes BOP-only fields by construction', () => {
  const comparison = comparePolicyLineFacts({
    insuranceLine: 'COMMERCIAL_GENERAL_LIABILITY',
    baseline: { 'coverage.cgl.eachOccurrence': 1000000 },
    offer: { 'coverage.cgl.eachOccurrence': 2000000, 'coverage.businessProperty.limit': 50000 }
  });
  assert.equal(comparison.fields.some(field => field.fieldPath === 'coverage.businessProperty.limit'), false);
  assert.equal(comparison.fields.find(field => field.fieldPath === 'coverage.cgl.eachOccurrence')?.relation, 'DIFFERENT');
});

test('comparison refuses lines without an implemented factual schema', () => {
  assert.throws(
    () => comparePolicyLineFacts({ insuranceLine: 'TERM_LIFE', baseline: {}, offer: {} }),
    /No factual comparison schema/
  );
});
