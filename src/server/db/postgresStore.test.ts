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
