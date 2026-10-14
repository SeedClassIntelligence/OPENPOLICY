import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { SQL_MIGRATION_V14 } from './migrate';
import { PostgresStore } from './postgresStore';
import type { OfferVersion } from '../../types/insurance';

test('multi-line offer migration is idempotent and immutable version facts survive restart', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpolicy-multiline-offer-'));
  const version: OfferVersion = {
    id: 'VER-HOME-1', offerId: 'OFFER-HOME-1', versionNumber: 1, round: 'OPEN',
    carrier: 'Example Carrier', annualPremium: 1700, monthlyPremium: 142,
    coverages: [], supportingQuoteDocName: 'home-quote.pdf', revisionReason: 'Initial offer submission',
    submittedAt: '2026-10-13T00:00:00.000Z', insuranceLine: 'HOMEOWNERS',
    verifiedFacts: {
      'coverage.dwelling.limit': 400000,
      'coverage.personalProperty.limit': 200000,
      'coverage.personalLiability.limit': 300000,
      'coverage.property.deductible': 1500
    }
  };

  const writer = new PostgresStore(dataDir);
  try {
    const database = await writer.getPgClient();
    await database.exec(SQL_MIGRATION_V14);
    await database.exec(SQL_MIGRATION_V14);
    await writer.saveOfferVersion(version);
  } finally {
    await writer.close();
  }

  const reader = new PostgresStore(dataDir);
  try {
    const durable = (await reader.getOfferVersions(version.offerId))[0];
    assert.equal(durable.insuranceLine, 'HOMEOWNERS');
    assert.deepEqual(durable.verifiedFacts, version.verifiedFacts);
  } finally {
    await reader.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

