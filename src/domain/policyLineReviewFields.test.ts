import test from 'node:test';
import assert from 'node:assert/strict';
import { getPolicyReviewFields } from './policyLineReviewFields';

test('personal auto preserves its required vehicle and coverage review fields', () => {
  const paths = getPolicyReviewFields('PERSONAL_AUTO').map(field => field.path);
  assert.ok(paths.includes('vehicle.vin'));
  assert.ok(paths.includes('coverage.bodilyInjury.perPersonLimit'));
});

test('property review fields follow the canonical line schemas', () => {
  const homeowners = getPolicyReviewFields('HOMEOWNERS');
  const renters = getPolicyReviewFields('RENTERS');
  assert.ok(homeowners.some(field => field.path === 'coverage.dwelling.limit'));
  assert.equal(renters.some(field => field.path === 'coverage.dwelling.limit'), false);
  assert.equal(homeowners.find(field => field.path === 'property.yearBuilt')?.requiredForBaseline, false);
});

test('commercial review fields distinguish CGL from BOP property coverage', () => {
  const cgl = getPolicyReviewFields('COMMERCIAL_GENERAL_LIABILITY');
  const bop = getPolicyReviewFields('BUSINESS_OWNERS_POLICY');
  assert.equal(cgl.some(field => field.path === 'coverage.businessProperty.limit'), false);
  assert.ok(bop.some(field => field.path === 'coverage.businessProperty.limit'));
  assert.ok(bop.some(field => field.path === 'coverage.businessIncome.included'));
});

test('unfinished lines fail closed with no review fields', () => {
  assert.deepEqual(getPolicyReviewFields('COMMERCIAL_AUTO'), []);
  assert.deepEqual(getPolicyReviewFields('TERM_LIFE'), []);
  assert.deepEqual(getPolicyReviewFields('INDIVIDUAL_HEALTH'), []);
});

