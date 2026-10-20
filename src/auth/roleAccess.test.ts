import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { canEnterMarketplaceDestination, canEnterOwnerDestination, destinationForRole } from './roleAccess';

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

test('owner operations destinations require the persisted ADMIN role', () => {
  for (const destination of ['ADMIN_AUDIT', 'TELEMETRY', 'ARCHITECTURE_TESTS'] as const) {
    assert.equal(canEnterOwnerDestination('ADMIN', destination), true);
    assert.equal(canEnterOwnerDestination('CONSUMER', destination), false);
    assert.equal(canEnterOwnerDestination('PROVIDER', destination), false);
    assert.equal(canEnterOwnerDestination(null, destination), false);
  }
});

test('authentication source contains no email-role guessing or successful local fallback', () => {
  const root = process.cwd();
  const context = fs.readFileSync(path.join(root, 'src/context/AuthContext.tsx'), 'utf8');
  const modal = fs.readFileSync(path.join(root, 'src/components/AuthModal.tsx'), 'utf8');
  assert.doesNotMatch(context, /fallback to local session/i);
  assert.doesNotMatch(context, /email\.includes\(['"](?:broker|agency|provider)/);
  assert.doesNotMatch(modal, /signInEmail\.includes/);
});

test('owner navigation and destructive reset are hidden from non-admin users', () => {
  const root = process.cwd();
  const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
  const header = fs.readFileSync(path.join(root, 'src/components/Header.tsx'), 'utf8');
  assert.match(app, /canEnterOwnerDestination/);
  assert.match(app, /activePerspective === 'ADMIN_AUDIT' && userRole === 'ADMIN'/);
  assert.match(header, /p\.id === 'ADMIN_AUDIT'.*userRole !== 'ADMIN'/s);
  assert.match(header, /userRole === 'ADMIN'.*reset-canonical-btn/s);
});

test('public header authentication follows the active consumer or provider landing page', () => {
  const header = fs.readFileSync(path.join(process.cwd(), 'src/components/Header.tsx'), 'utf8');
  assert.match(header, /publicLandingPath === '\/providers' \? 'PROVIDER' : 'CONSUMER'/);
  assert.match(header, /initialMode: 'SIGN_IN', initialRole: publicAuthRole/);
  assert.match(header, /initialMode: 'SIGN_UP', initialRole: publicAuthRole/);
});
