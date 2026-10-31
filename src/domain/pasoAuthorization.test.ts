import test from 'node:test';
import assert from 'node:assert/strict';
import { canPaso, canReadAssignedObject } from './pasoAuthorization.ts';

test('PASO roles are fail-closed for privileged actions', () => {
  assert.equal(canPaso('SALES_REP','TEAM_WRITE'), false);
  assert.equal(canPaso('SALES_MANAGER','PAYOUT_RECONCILE'), false);
  assert.equal(canPaso('SALES_FINANCE','PROSPECT_WRITE'), false);
  assert.equal(canPaso('SALES_ADMIN','TEAM_WRITE'), true);
});

test('representatives cannot read another representative private assignment', () => {
  assert.equal(canReadAssignedObject({role:'SALES_REP',actorProfileId:'rep-a',ownerProfileId:'rep-b'}), false);
  assert.equal(canReadAssignedObject({role:'SALES_REP',actorProfileId:'rep-a',ownerProfileId:'rep-a'}), true);
});

test('managers remain bounded to their team', () => {
  assert.equal(canReadAssignedObject({role:'SALES_MANAGER',actorProfileId:'mgr',actorTeamId:'team-a',objectTeamId:'team-b'}), false);
  assert.equal(canReadAssignedObject({role:'SALES_MANAGER',actorProfileId:'mgr',actorTeamId:'team-a',objectTeamId:'team-a'}), true);
});
