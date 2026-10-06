import test from 'node:test';
import assert from 'node:assert/strict';
import type { PolicyDocumentRecord } from '../types/insurance';
import type { DocumentObjectStore, StoredDocumentObject } from './documentObjectStore';
import { ingestPolicyDocument, type PolicyDocumentRepository } from './policyDocumentIngestion';
import { PostgresStore } from './db/postgresStore';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const pdf = (marker = 'A') => Buffer.from(`%PDF-1.7\n${marker}\n%%EOF\n`, 'latin1');

class MemoryRepository implements PolicyDocumentRepository {
  byKey = new Map<string, PolicyDocumentRecord>();
  failCompleteOnce = false;
  async beginPolicyDocumentIngestion(record: PolicyDocumentRecord) {
    const key = `${record.ownerId}:${record.idempotencyKey}`;
    const existing = this.byKey.get(key);
    if (existing) return existing;
    this.byKey.set(key, record);
    return record;
  }
  async completePolicyDocumentUpload(input: { ownerId: string; documentId: string; objectGeneration: string }) {
    if (this.failCompleteOnce) { this.failCompleteOnce = false; throw new Error('database unavailable'); }
    const entry = [...this.byKey.entries()].find(([, value]) => value.id === input.documentId && value.ownerId === input.ownerId);
    if (!entry) throw new Error('missing workflow');
    const completed = { ...entry[1], objectGeneration: input.objectGeneration, status: 'UPLOADED' as const };
    this.byKey.set(entry[0], completed);
    return completed;
  }
}

class MemoryObjectStore implements DocumentObjectStore {
  readonly quarantineBucket = 'private-quarantine';
  objects = new Map<string, { sha256: string; generation: string }>();
  failPut = false;
  async putQuarantinedPdf(input: { objectName: string; bytes: Buffer; sha256: string; documentId: string }) {
    if (this.failPut) throw new Error('storage unavailable');
    if (this.objects.has(input.objectName)) throw new Error('immutable collision');
    const value = { sha256: input.sha256, generation: String(this.objects.size + 1) };
    this.objects.set(input.objectName, value);
    return { bucket: this.quarantineBucket, objectName: input.objectName, generation: value.generation };
  }
  async findQuarantinedPdf(objectName: string, sha256: string): Promise<StoredDocumentObject | undefined> {
    const value = this.objects.get(objectName);
    return value?.sha256 === sha256
      ? { bucket: this.quarantineBucket, objectName, generation: value.generation }
      : undefined;
  }
}

function input(repository = new MemoryRepository(), objectStore = new MemoryObjectStore()) {
  return {
    ownerId: 'firebase-consumer-1', idempotencyKey: 'upload-request-0001', fileName: 'policy.pdf',
    contentType: 'application/pdf', bytes: pdf(), repository, objectStore
  };
}

test('accepts actual PDF bytes into private immutable evidence and durable ownership', async () => {
  const args = input();
  const result = await ingestPolicyDocument(args);
  assert.equal(result.ownerId, 'firebase-consumer-1');
  assert.equal(result.storageBucket, 'private-quarantine');
  assert.equal(result.status, 'UPLOADED');
  assert.equal(result.sha256.length, 64);
  assert.equal(result.objectName.includes(result.ownerId), false);
  assert.equal(args.objectStore.objects.size, 1);
});

test('identical retry returns the same workflow and object', async () => {
  const args = input();
  const first = await ingestPolicyDocument(args);
  const second = await ingestPolicyDocument(args);
  assert.equal(second.id, first.id);
  assert.equal(second.objectGeneration, first.objectGeneration);
  assert.equal(args.objectStore.objects.size, 1);
});

test('idempotency key cannot be reused for different bytes', async () => {
  const args = input();
  await ingestPolicyDocument(args);
  await assert.rejects(() => ingestPolicyDocument({ ...args, bytes: pdf('DIFFERENT') }), /different evidence bytes/);
});

test('same filename with different idempotency key and bytes creates distinct evidence', async () => {
  const args = input();
  const first = await ingestPolicyDocument(args);
  const second = await ingestPolicyDocument({ ...args, idempotencyKey: 'upload-request-0002', bytes: pdf('B') });
  assert.notEqual(second.id, first.id);
  assert.notEqual(second.sha256, first.sha256);
});

test('storage failure leaves a non-accepted pending workflow', async () => {
  const args = input();
  args.objectStore.failPut = true;
  await assert.rejects(() => ingestPolicyDocument(args), /storage unavailable/);
  const pending = [...args.repository.byKey.values()][0];
  assert.equal(pending.status, 'UPLOAD_PENDING');
  assert.equal(pending.objectGeneration, 'PENDING');
});

test('database failure after object creation is recoverable without replacing evidence', async () => {
  const args = input();
  args.repository.failCompleteOnce = true;
  await assert.rejects(() => ingestPolicyDocument(args), /database unavailable/);
  assert.equal(args.objectStore.objects.size, 1);
  const recovered = await ingestPolicyDocument(args);
  assert.equal(recovered.status, 'UPLOADED');
  assert.equal(args.objectStore.objects.size, 1);
});

test('malformed or spoofed files are rejected before workflow or storage', async () => {
  const args = input();
  await assert.rejects(() => ingestPolicyDocument({ ...args, bytes: Buffer.from('not pdf') }), /recognizable PDF/);
  await assert.rejects(() => ingestPolicyDocument({ ...args, contentType: 'image/png' }), /Only PDF/);
  assert.equal(args.repository.byKey.size, 0);
  assert.equal(args.objectStore.objects.size, 0);
});

test('durable ownership and workflow survive an empty-process restart', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpolicy-document-restart-'));
  const objectStore = new MemoryObjectStore();
  const firstStore = new PostgresStore(dataDir);
  try {
    const accepted = await ingestPolicyDocument({ ...input(undefined, objectStore), repository: firstStore });
    await firstStore.close();
    const restarted = new PostgresStore(dataDir);
    const restored = await restarted.getPolicyDocument('firebase-consumer-1', accepted.id);
    assert.equal(restored?.id, accepted.id);
    assert.equal(restored?.ownerId, 'firebase-consumer-1');
    assert.equal(restored?.status, 'UPLOADED');
    assert.equal(await restarted.getPolicyDocument('different-consumer', accepted.id), undefined);
    await restarted.close();
  } finally {
    await firstStore.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
