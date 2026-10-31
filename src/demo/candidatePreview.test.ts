import test from 'node:test';
import assert from 'node:assert/strict';
import { candidatePreviewRole, isCandidatePreview } from './candidatePreview';
import { candidatePreviewFetch } from './candidatePreviewApi';

function setLocation(hostname: string, search: string) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { hostname, search, origin: `https://${hostname}` } }
  });
}

test('candidate preview is impossible on the canonical public domain', () => {
  setLocation('openpolici.com', '?preview=owner');
  assert.equal(candidatePreviewRole(), null);
  assert.equal(isCandidatePreview(), false);
});

test('tagged Cloud Run acceptance hosts map only explicit preview roles', () => {
  setLocation('preview---openpolicy-acceptance-63l7hngdka-uc.a.run.app', '?preview=owner');
  assert.equal(candidatePreviewRole(), 'ADMIN');
  setLocation('preview---openpolicy-acceptance-63l7hngdka-uc.a.run.app', '?preview=provider');
  assert.equal(candidatePreviewRole(), 'PROVIDER');
  setLocation('preview---openpolicy-acceptance-63l7hngdka-uc.a.run.app', '?preview=consumer');
  assert.equal(candidatePreviewRole(), 'CONSUMER');
  setLocation('preview---openpolicy-acceptance-63l7hngdka-uc.a.run.app', '?preview=unknown');
  assert.equal(candidatePreviewRole(), null);
});

test('preview API serves synthetic reads and rejects every write', async () => {
  setLocation('preview---openpolicy-acceptance-63l7hngdka-uc.a.run.app', '?preview=owner');
  const read = await candidatePreviewFetch('/api/admin/provider-applications');
  assert.equal(read.status, 200);
  assert.equal(read.headers.get('X-Open-Polici-Preview'), 'synthetic-read-only');
  const applications = await read.json();
  assert.equal(applications[0].status, 'PENDING_REVIEW');

  const notifications = await candidatePreviewFetch('/api/notifications');
  assert.deepEqual(await notifications.json(), []);

  const provider = await candidatePreviewFetch('/api/marketplace/my-provider').then((response) => response.json());
  assert.deepEqual(provider.org.states, ['NV']);
  assert.deepEqual(provider.appetite.jurisdictions, ['NV']);

  const audit = await candidatePreviewFetch('/api/admin/audit-chain/verify').then((response) => response.json());
  assert.equal(typeof audit.merkleRoot, 'string');
  assert.equal(typeof audit.latestBlockHash, 'string');

  const write = await candidatePreviewFetch('/api/admin/provider-applications/example/review', { method: 'POST' });
  assert.equal(write.status, 403);
  assert.match((await write.json()).error, /Read-only preview/);
});
