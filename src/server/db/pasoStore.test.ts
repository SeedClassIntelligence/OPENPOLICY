import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { PostgresStore } from './postgresStore.ts';
import { PasoStore } from './pasoStore.ts';

test('PASO-1 persists teams, territories, profiles, and immutable creation evidence', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpolici-paso-'));
  const database = new PostgresStore(dataDir);
  const paso = new PasoStore(database);
  try {
    const team = await paso.createTeam({ name: 'Nevada Launch', actorId: 'owner-1' });
    const territory = await paso.createTerritory({
      name: 'Nevada Personal Lines',
      jurisdictionCodes: ['nv', 'NV'],
      geographicScope: 'STATE',
      insuranceLineFocus: ['personal_auto'],
      assignedTeamId: team.id,
      effectiveFrom: '2026-10-28',
      actorId: 'owner-1'
    });
    const profile = await paso.createProfile({
      internalUserId: 'firebase-sales-rep-1',
      teamId: team.id,
      role: 'SALES_REP',
      employmentClassification: 'EMPLOYEE',
      effectiveFrom: '2026-10-28',
      actorId: 'owner-1'
    });

    assert.equal((await paso.listTeams()).length, 1);
    assert.deepEqual((await paso.listTerritories())[0].jurisdictionCodes, ['NV']);
    assert.deepEqual((await paso.listTerritories())[0].insuranceLineFocus, ['PERSONAL_AUTO']);
    assert.equal((await paso.getProfileByInternalUserId(profile.internalUserId))?.teamId, team.id);
    assert.equal(territory.assignedTeamId, team.id);

    const sql = await database.getPgClient();
    const migration = await sql.query<{ count:number }>("SELECT count(*)::int AS count FROM _migrations WHERE name='0030_paso_foundation'");
    assert.equal(Number(migration.rows[0].count), 1);
    const audits = await sql.query<{ count:number }>('SELECT count(*)::int AS count FROM sales_audit_events');
    assert.equal(Number(audits.rows[0].count), 3);
  } finally {
    await database.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
