import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { canEnterMarketplaceDestination, destinationForRole } from './roleAccess';

test('consumer and provider destinations are mutually exclusive', () => {
  assert.equal(canEnterMarketplaceDestination('CONSUMER', 'CONSUMER'), true);
  assert.equal(canEnterMarketplaceDestination('CONSUMER', 'PROVIDER'), false);
  assert.equal(canEnterMarketplaceDestination('PROVIDER', 'PROVIDER'), true);
  assert.equal(canEnterMarketplaceDestination('PROVIDER', 'CONSUMER'), false);
  assert.equal(canEnterMarketplaceDestination(null, 'CONSUMER'), false);
});

test('post-authentication routing comes from the persisted role', () => {
  assert.equal(destinationForRole('CONSUMER'), 'CONSUMER');
  assert.equal(destinationForRole('PROVIDER'), 'PROVIDER');
  assert.equal(destinationForRole('ADMIN'), 'ADMIN_AUDIT');
});

test('authentication source contains no email-role guessing or successful local fallback', () => {
  const root = path.resolve(import.meta.dirname, '..', '..');
  const context = fs.readFileSync(path.join(root, 'src/context/AuthContext.tsx'), 'utf8');
  const modal = fs.readFileSync(path.join(root, 'src/components/AuthModal.tsx'), 'utf8');
  assert.doesNotMatch(context, /fallback to local session/i);
  assert.doesNotMatch(context, /email\.includes\(['"](?:broker|agency|provider)/);
  assert.doesNotMatch(modal, /signInEmail\.includes/);
});
