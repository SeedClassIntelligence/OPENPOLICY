import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePolicyLineOfferFacts } from './policyLineOfferContract';

test('homeowners offer accepts required coverage terms and preserves optional omissions', () => {
  const facts = validatePolicyLineOfferFacts('HOMEOWNERS', {
    'coverage.dwelling.limit': 400000,
    'coverage.personalProperty.limit': 200000,
    'coverage.personalLiability.limit': 300000,
    'coverage.property.deductible': 1500
  });
  assert.equal(facts['coverage.dwelling.limit'], 400000);
  assert.equal(facts['coverage.waterBackup.limit'], undefined);
});

test('renters offer cannot inject a homeowners-only dwelling term', () => {
  assert.throws(() => validatePolicyLineOfferFacts('RENTERS', {
    'coverage.personalProperty.limit': 50000,
    'coverage.personalLiability.limit': 300000,
    'coverage.property.deductible': 500,
    'coverage.dwelling.limit': 400000
  }), /outside the RENTERS coverage schema/);
});

test('BOP offer requires its line-specific business coverage terms', () => {
  assert.throws(() => validatePolicyLineOfferFacts('BUSINESS_OWNERS_POLICY', {
    'coverage.cgl.eachOccurrence': 1000000,
    'coverage.cgl.generalAggregate': 2000000,
    'coverage.property.deductible': 1000
  }), /Business property limit/);
});

test('boolean and percent-or-money values retain factual source representation', () => {
  const facts = validatePolicyLineOfferFacts('HOMEOWNERS', {
    'coverage.dwelling.limit': 400000,
    'coverage.personalProperty.limit': 200000,
    'coverage.personalLiability.limit': 300000,
    'coverage.property.deductible': 1500,
    'coverage.windHail.deductible': '2%',
    'coverage.waterBackup.included': 1
  });
  assert.equal(facts['coverage.windHail.deductible'], '2%');
  assert.equal(facts['coverage.waterBackup.included'], 1);
});

test('commercial auto offer accepts its factual liability and optional coverage terms', () => {
  const facts = validatePolicyLineOfferFacts('COMMERCIAL_AUTO', {
    'coverage.commercialAuto.combinedSingleLimit': 1000000,
    'coverage.commercialAuto.comprehensiveDeductible': 1000,
    'coverage.commercialAuto.collisionDeductible': 2500,
    'coverage.commercialAuto.hiredAutoIncluded': 1,
    'coverage.commercialAuto.nonOwnedAutoIncluded': 1
  });
  assert.equal(facts['coverage.commercialAuto.combinedSingleLimit'],1000000);
  assert.equal(facts['coverage.commercialAuto.nonOwnedAutoIncluded'],1);
});

test('commercial auto offer fails closed without a complete liability representation', () => {
  assert.throws(() => validatePolicyLineOfferFacts('COMMERCIAL_AUTO', {
    'coverage.commercialAuto.comprehensiveDeductible': 1000
  }), /combined single limit or complete split limits/);
});

test('unfinished insurance lines fail closed', () => {
  assert.throws(() => validatePolicyLineOfferFacts('TERM_LIFE', {}), /not implemented/);
});

