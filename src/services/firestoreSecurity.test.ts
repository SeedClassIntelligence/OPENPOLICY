import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

test('Firestore rules default deny and expose no public connection-test bypass', () => {
  const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
  assert.match(rules, /match \/\{document=\*\*\}/);
  assert.match(rules, /allow read, write: if false/);
  assert.doesNotMatch(rules, /allow\s+read\s*:\s*if\s+true/);
});

test('direct browser collections are owner scoped and user profiles cannot self-promote', () => {
  const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
  for (const collection of ['challenges', 'orders', 'vault']) {
    assert.match(rules, new RegExp(`match /${collection}/\\{`));
  }
  assert.match(rules, /request\.auth\.uid == userId/);
  assert.match(rules, /incoming\(\)\.role in \['CONSUMER', 'PROVIDER'\]/);
  assert.match(rules, /incoming\(\)\.role == existing\(\)\.role/);
  assert.match(rules, /affectedKeys\(\)\.hasOnly\(\['displayName', 'currentCarrier'\]\)/);
  assert.doesNotMatch(rules, /'providerUserId'/);
  assert.doesNotMatch(rules, /'providerOrganizationId'/);
  assert.match(rules, /allow list: if false/);
});

test('browser service has no demo-record fallback on missing identity or permission failure', () => {
  const service = fs.readFileSync(path.join(root, 'src/services/userService.ts'), 'utf8');
  assert.doesNotMatch(service, /DEMO_(CHALLENGES|ORDERS|VAULT)/);
  assert.match(service, /Authenticated consumer identity does not match/);
});
