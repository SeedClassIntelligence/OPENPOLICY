import test from 'node:test';
import assert from 'node:assert/strict';
import {
  confirmConsumerDefinedCoverageRequest,
  consumerRequestToMarketplaceBaseline,
  projectConsumerRequestForMarketplace,
  reviseConsumerDefinedCoverageRequest,
  validateConsumerDefinedCoverageRequest,
  type ConsumerDefinedCoverageRequestInput
} from './consumerDefinedCoverageRequest';

const input: ConsumerDefinedCoverageRequestInput = {
  consumerId: 'consumer-1', jurisdiction: 'NV', insuranceLine: 'PERSONAL_AUTO',
  desiredEffectiveDate: '2026-11-01',
  riskFacts: { vehicleYear: 2024, vehicleMake: 'Test', vehicleModel: 'Sedan', garagingZip: '89101' },
  requestedCoverage: [
    { fieldCode: 'BODILY_INJURY', label: 'Bodily injury', preference: 'REQUESTED', requestedValue: '100000/300000' },
    { fieldCode: 'COLLISION', label: 'Collision', preference: 'NO_PREFERENCE_STATED' }
  ],
  privateBudget: { amount: 175, interval: 'MONTHLY' }, attested: true
};

test('confirms a Nevada consumer-defined request as an immutable versioned baseline', () => {
  const baseline = confirmConsumerDefinedCoverageRequest(input, {
    now: '2026-10-22T00:00:00.000Z', requestSeriesId: 'CDR-1', id: 'CDR-1-V1'
  });
  assert.equal(baseline.baselineOrigin, 'CONSUMER_DEFINED_COVERAGE_REQUEST');
  assert.equal(baseline.version, 1);
  assert.equal(baseline.contentSha256.length, 64);
  assert.equal(Object.isFrozen(baseline), true);
});

test('rejects non-Nevada requests and requested coverage without a value', () => {
  const result = validateConsumerDefinedCoverageRequest({
    ...input, jurisdiction: 'CA', requestedCoverage: [
      { fieldCode: 'COLLISION', label: 'Collision', preference: 'REQUESTED' }
    ]
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /only in Nevada/);
  assert.match(result.errors.join(' '), /requires a value/);
});

test('creates a new version without mutating the confirmed original', () => {
  const original = confirmConsumerDefinedCoverageRequest(input, { requestSeriesId: 'CDR-2', id: 'CDR-2-V1' });
  const revised = reviseConsumerDefinedCoverageRequest(original, {
    ...input, privateBudget: { amount: 200, interval: 'MONTHLY' }
  }, { id: 'CDR-2-V2' });
  assert.equal(original.privateBudget?.amount, 175);
  assert.equal(revised.privateBudget?.amount, 200);
  assert.equal(revised.version, 2);
  assert.equal(revised.supersedesBaselineId, original.id);
  assert.notEqual(revised.contentSha256, original.contentSha256);
});

test('marketplace projection excludes identity and private budget', () => {
  const baseline = confirmConsumerDefinedCoverageRequest(input, { requestSeriesId: 'CDR-3', id: 'CDR-3-V1' });
  const projection = projectConsumerRequestForMarketplace(baseline);
  assert.equal('consumerId' in projection, false);
  assert.equal('privateBudget' in projection, false);
  assert.equal(projection.requestedCoverage.length, 2);
});

test('creates a marketplace-compatible baseline without inventing unstated coverage or a current premium', () => {
  const request = confirmConsumerDefinedCoverageRequest(input, { requestSeriesId: 'CDR-4', id: 'CDR-4-V1' });
  const baseline = consumerRequestToMarketplaceBaseline(request);
  assert.equal(baseline.baselineOrigin, 'CONSUMER_DEFINED_COVERAGE_REQUEST');
  assert.equal(baseline.consumerDefinedRequestId, request.id);
  assert.equal(baseline.baselineAnnualPremium, 0);
  assert.equal(baseline.coverages.length, 1);
  assert.equal(baseline.coverages[0].code, 'BODILY_INJURY');
  assert.equal(baseline.coverages.some(item => item.code === 'COLLISION'), false);
  assert.equal('privateBudget' in baseline, false);
  assert.equal('consumerId' in baseline, false);
});
