import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { PostgresStore } from './postgresStore';

test('required durable storage fails closed instead of falling back to PGlite', () => {
  const before = { ...process.env };
  try {
    process.env.OPENPOLICY_REQUIRE_DURABLE_STORAGE = 'true';
    delete process.env.DATABASE_URL;
    delete process.env.CLOUD_SQL_INSTANCE;
    delete process.env.OPENPOLICY_DATA_DIR;
    assert.throws(
      () => new PostgresStore(),
      /Durable storage is required/
    );
  } finally {
    process.env = before;
  }
});

test('explicit local validator storage remains available when durability is not required', async () => {
  const before = process.env.OPENPOLICY_REQUIRE_DURABLE_STORAGE;
  delete process.env.OPENPOLICY_REQUIRE_DURABLE_STORAGE;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpolicy-storage-selection-'));
  const store = new PostgresStore(dataDir);
  try {
    await store.init();
    const result = await (await store.getPgClient()).query<{ value: number }>('SELECT 1 AS value');
    assert.equal(result.rows[0]?.value, 1);
  } finally {
    await store.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
    if (before === undefined) delete process.env.OPENPOLICY_REQUIRE_DURABLE_STORAGE;
    else process.env.OPENPOLICY_REQUIRE_DURABLE_STORAGE = before;
  }
});

test('foundation records survive an empty-process restart and continue mutating durably', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpolicy-foundation-restart-'));
  const first = new PostgresStore(dataDir);
  const policy = {
    id: 'POL-RESTART-1', policyNumber: 'RESTART-1', carrier: 'Test Carrier',
    jurisdiction: 'X1', effectiveDate: '2026-01-01', expirationDate: '2027-01-01',
    termMonths: 12, annualPremium: 1200, monthlyPremium: 100, status: 'VERIFIED' as const,
    namedInsured: 'Test Consumer', drivers: [], vehicles: [], coverages: [],
    sourceDocumentId: 'DOC-1', sourceDocumentName: 'fixture.pdf'
  };
  const baseline = {
    id: 'BL-RESTART-1', policyId: policy.id, version: 1, carrier: policy.carrier,
    effectiveDate: policy.effectiveDate, expirationDate: policy.expirationDate,
    baselineAnnualPremium: 1200, baselineMonthlyPremium: 100, jurisdiction: 'X1',
    vehicle: { year: 2024, make: 'Test', model: 'Car', vin: 'TESTVIN',
      usage: 'PLEASURE' as const, annualMileage: 1000, garagingZip: '00000', ownership: 'OWNED' as const },
    coverages: [], verifiedAt: '2026-01-01T00:00:00.000Z', verifiedBy: 'test'
  };
  const requirements = {
    id: 'REQ-RESTART-1', ruleSummary: 'Preserve protection', minAnnualSavings: 100,
    maxCollisionDeductible: 500, maxCompDeductible: 250,
    mustIncludeRental: true, mustIncludeRoadside: true
  };
  const review = {
    id: 'REV-RESTART-1', type: 'QUOTE_DISCREPANCY' as const, source: 'test',
    summary: 'restart test', severity: 'HIGH' as const, status: 'PENDING_REVIEW' as const,
    createdAt: '2026-01-01T00:00:00.000Z'
  };
  try {
    await first.commitPolicyWithAudit(policy, [{
      eventType: 'POLICY_UPLOADED', actorRole: 'CONSUMER', actorId: 'consumer_restart', details: 'test policy'
    }]);
    await first.commitCoverageBaselineWithAudit(baseline, {
      eventType: 'BASELINE_CREATED', actorRole: 'SYSTEM', actorId: 'test', details: 'test baseline'
    });
    await first.saveConsumerRequirements(requirements);
    await first.saveReviewQueueItem(review);
    await first.saveNotification({
      id: 'NOTIF-RESTART-1', type: 'COMPETITION_UPDATE', title: 'Test', message: 'Persisted',
      timestamp: '2026-01-01T00:00:00.000Z', read: false, recipientType: 'CONSUMER',
      recipientConsumerId: 'consumer_restart', createdFromEvent: 'TEST'
    });
    await first.close();

    const second = new PostgresStore(dataDir);
    assert.deepEqual(await second.getPolicy(policy.id), policy);
    assert.deepEqual(await second.getCoverageBaseline(baseline.id), baseline);
    assert.deepEqual(await second.getConsumerRequirements(requirements.id), requirements);
    assert.equal((await second.getReviewQueue('PENDING_REVIEW'))[0]?.id, review.id);
    assert.equal((await second.getNotificationsForRecipient({
      recipientType: 'CONSUMER', recipientId: 'consumer_restart'
    }))[0]?.id, 'NOTIF-RESTART-1');
    const resolved = { ...review, status: 'RESOLVED_OVERRIDE' as const,
      resolvedAt: '2026-01-02T00:00:00.000Z', resolvedBy: 'operator',
      resolutionNotes: 'accepted', decision: 'OVERRIDE' as const };
    assert.equal(await second.resolveReviewQueueItem(review, resolved), true);
    assert.equal(await second.resolveReviewQueueItem(review, resolved), false,
      'a second instance cannot resolve the already-resolved item as first');
    const auditBeforeFailure = (await second.getAuditEvents()).length;
    await assert.rejects(
      () => second.commitCoverageBaselineWithAudit(
        { ...baseline, id: 'BL-INVALID-FK', policyId: 'POL-DOES-NOT-EXIST' },
        { eventType: 'BASELINE_CREATED', actorRole: 'SYSTEM', actorId: 'test', details: 'must roll back' }
      )
    );
    assert.equal(await second.getCoverageBaseline('BL-INVALID-FK'), undefined);
    assert.equal((await second.getAuditEvents()).length, auditBeforeFailure,
      'failed business mutation cannot leave audit or business state partially committed');
    await second.close();
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
