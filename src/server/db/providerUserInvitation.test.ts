import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { PostgresStore } from './postgresStore';
import { CommercialStore } from './commercialStore';

async function seedSeatCapacity(store: PostgresStore) {
  const commercial = new CommercialStore(store);
  await commercial.seedTestCommercialAgreements();
  await commercial.enrollCommercialAgreement({ providerOrgId:'org_sierra', planId:'PLAN_SOLO', actorRole:'ADMIN',
    customTerms:{ includedProducerSeats:2 } });
}

test('provider administrator invitation links one authenticated identity to one organization without exposing stored secrets', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpolicy-provider-invite-'));
  const store = new PostgresStore(dataDir);
  try {
    await store.seedCanonicalProviderData();
    await seedSeatCapacity(store);
    const invitation = await store.createProviderUserInvitation({
      providerOrganizationId: 'org_sierra', email: 'new.producer@example.com',
      fullName: 'New Producer', role: 'AGENT', invitedByProviderUserId: 'user_sierra_1'
    });
    assert.ok(invitation.token.length >= 32);
    const listed = await store.listProviderUserInvitations('org_sierra');
    assert.equal(listed.length, 1);
    assert.equal('token' in listed[0], false, 'persisted/listed invitation never exposes the secret');
    await assert.rejects(() => store.acceptProviderUserInvitation({
      token: invitation.token, firebaseUid: 'firebase-wrong-email', email: 'attacker@example.com'
    }), /does not match/);
    const accepted = await store.acceptProviderUserInvitation({
      token: invitation.token, firebaseUid: 'firebase-new-producer', email: 'new.producer@example.com'
    });
    assert.equal(accepted.providerOrganizationId, 'org_sierra');
    const user = await store.getProviderUser(accepted.providerUserId);
    assert.equal(user?.organizationId, 'org_sierra');
    assert.equal(user?.role, 'AGENT');
    await assert.rejects(() => store.acceptProviderUserInvitation({
      token: invitation.token, firebaseUid: 'firebase-replay', email: 'new.producer@example.com'
    }), /no longer available/);
  } finally {
    await store.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('one authenticated identity cannot accept invitations into two provider organizations', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpolicy-provider-invite-isolation-'));
  const store = new PostgresStore(dataDir);
  try {
    await store.seedCanonicalProviderData();
    await seedSeatCapacity(store);
    const first = await store.createProviderUserInvitation({ providerOrganizationId:'org_sierra',
      email:'isolated@example.com',fullName:'Isolated User',role:'VIEW_ONLY',invitedByProviderUserId:'user_sierra_1' });
    await store.acceptProviderUserInvitation({ token:first.token,firebaseUid:'firebase-isolated',email:'isolated@example.com' });
    const second = await store.createProviderUserInvitation({ providerOrganizationId:'org_apex',
      email:'isolated@example.com',fullName:'Isolated User',role:'VIEW_ONLY',invitedByProviderUserId:'user_apex_1' });
    await assert.rejects(() => store.acceptProviderUserInvitation({
      token:second.token,firebaseUid:'firebase-isolated',email:'isolated@example.com'
    }), /already linked to another provider organization/);
  } finally {
    await store.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('producer-seat capacity counts the owner and hard-blocks an additional accepted identity', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpolicy-provider-seat-capacity-'));
  const store = new PostgresStore(dataDir);
  try {
    await store.seedCanonicalProviderData();
    const commercial = new CommercialStore(store);
    await commercial.seedTestCommercialAgreements(); // Sierra receives one Solo seat already occupied by its owner.
    const invitation = await store.createProviderUserInvitation({ providerOrganizationId:'org_sierra',
      email:'over-capacity@example.com',fullName:'Over Capacity',role:'AGENT',invitedByProviderUserId:'user_sierra_1' });
    await assert.rejects(() => store.acceptProviderUserInvitation({ token:invitation.token,
      firebaseUid:'firebase-over-capacity',email:'over-capacity@example.com' }), /PROVIDER_SEAT_CAPACITY_REACHED: 1\/1/);
    assert.equal((await store.getProviderUsers('org_sierra')).length, 1);
  } finally {
    await store.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
