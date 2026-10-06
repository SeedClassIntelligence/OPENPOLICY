import assert from 'node:assert/strict';

process.env.OPENPOLICY_AUTH_MODE = 'firebase';
delete process.env.OPENPOLICY_FIXTURE_AUTHORIZATION_BYPASS;

const { app } = await import('../server');
const { postgresStore } = await import('../src/server/db/postgresStore');
const { db } = await import('../src/server/db');
await postgresStore.init();
await postgresStore.seedCanonicalProviderData();
const canonicalChallenge = db.getChallenge('CHAL-NV-49281');
if (!canonicalChallenge) throw new Error('Canonical security fixture challenge is missing.');
await postgresStore.saveChallenge(canonicalChallenge);
for (const notification of db.getNotificationsForRecipient({ consumerId: 'user_consumer_1' })) {
  await postgresStore.saveNotification(notification);
}
for (const notification of db.getNotificationsForRecipient({
  providerUserId: 'user_sierra_1', providerOrganizationId: 'org_sierra'
})) {
  await postgresStore.saveNotification(notification);
}
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Could not obtain probe listener address.');
const base = `http://127.0.0.1:${address.port}`;

type Probe = { name: string; status: number };
const results: Probe[] = [];

async function probe(name: string, path: string, expected: number[], init: RequestInit = {}) {
  const response = await fetch(`${base}${path}`, init);
  assert.ok(expected.includes(response.status), `${name}: expected ${expected.join('/')} but received ${response.status}`);
  results.push({ name, status: response.status });
  return response;
}

try {
  await probe('anonymous challenges', '/api/challenges', [401]);
  await probe('anonymous competition status', '/api/marketplace/competition/CHAL-NV-49281/status', [401]);
  await probe('anonymous commercial rating history', '/api/commercial/rating/runs', [401]);

  process.env.NODE_ENV = 'test';
  process.env.OPENPOLICY_AUTH_MODE = 'fixture';
  const consumer = { 'x-consumer-id': 'user_consumer_1' };
  const otherConsumer = { 'x-consumer-id': 'other-consumer' };
  const sierra = { 'x-provider-user-id': 'user_sierra_1' };
  const buckeye = { 'x-provider-user-id': 'user_buckeye_1' };

  await probe('challenge owner', '/api/challenges/CHAL-NV-49281', [200], { headers: consumer });
  await probe('wrong consumer', '/api/challenges/CHAL-NV-49281', [403], { headers: otherConsumer });
  await probe('participating provider organization', '/api/marketplace/competition/CHAL-NV-49281/status', [200], { headers: sierra });
  await probe('cross-organization provider', '/api/marketplace/competition/CHAL-NV-49281/status', [403], { headers: buckeye });
  await probe('spoofed organization', '/api/marketplace/competition/CHAL-NV-49281/status', [403], {
    headers: { ...sierra, 'x-provider-org-id': 'org_buckeye' }
  });
  await probe('ordinary provider to admin', '/api/admin/review-queue', [403], { headers: sierra });
  await probe('consumer vault', '/api/vault/documents', [200], { headers: consumer });
  await probe('provider organization', '/api/marketplace/my-provider', [200], { headers: sierra });
  await probe('commercial organization scope', '/api/commercial/account', [200, 404], { headers: sierra });
  await probe('retired legacy binding surface unavailable', '/api/selection/dossier-by-challenge/CHAL-NV-49281', [410], {
    headers: otherConsumer
  });
  await probe('retired legacy reconciliation surface unavailable', '/api/reconciliation/dossier/nonexistent', [410], { headers: otherConsumer });

  const consumerNotifications = await probe('consumer notification listing', '/api/notifications', [200], { headers: consumer });
  const consumerBody = await consumerNotifications.json() as Array<{ id: string }>;
  assert.ok(consumerBody.length, 'fixture consumer must have an owned notification');
  const consumerNoticeId = consumerBody[0].id;
  await probe('provider denied consumer notification', `/api/notifications/${consumerNoticeId}/read`, [403], {
    method: 'POST', headers: sierra
  });
  await probe('correct consumer notification recipient', `/api/notifications/${consumerNoticeId}/read`, [200], {
    method: 'POST', headers: consumer
  });

  const providerNotifications = await probe('provider notification listing', '/api/notifications', [200], { headers: sierra });
  const providerBody = await providerNotifications.json() as Array<{ id: string }>;
  if (providerBody.length) {
    await probe('provider B denied provider A notification', `/api/notifications/${providerBody[0].id}/read`, [403], {
      method: 'POST', headers: buckeye
    });
  }

  process.env.OPENPOLICY_AUTH_MODE = 'firebase';
  process.env.NODE_ENV = 'production';
  await probe('production synthetic seeding unavailable', '/api/marketplace/competition/CHAL-NV-49281/seed-competitors', [404], {
    method: 'POST'
  });

  for (const result of results) console.log(`${result.status}\t${result.name}`);
  console.log(`SECURITY HTTP PROBES PASS (${results.length}/${results.length})`);
} finally {
  server.close();
  await postgresStore.close();
}
