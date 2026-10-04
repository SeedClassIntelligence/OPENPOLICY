import test from 'node:test';
import assert from 'node:assert/strict';
import { configuredAuthMode, parseBearerToken } from './requestIdentity';

test('Firebase verification is the default authentication mode', () => {
  assert.equal(configuredAuthMode({} as NodeJS.ProcessEnv), 'firebase');
});

test('fixture identity is explicitly selected and forbidden in production', () => {
  assert.equal(configuredAuthMode({ OPENPOLICY_AUTH_MODE: 'fixture' } as NodeJS.ProcessEnv), 'fixture');
  assert.throws(
    () => configuredAuthMode({ OPENPOLICY_AUTH_MODE: 'fixture', NODE_ENV: 'production' } as NodeJS.ProcessEnv),
    /forbidden/
  );
});

test('bearer tokens must use the Authorization Bearer scheme', () => {
  assert.equal(parseBearerToken('Bearer verified-token'), 'verified-token');
  assert.equal(parseBearerToken('bearer verified-token'), 'verified-token');
  assert.equal(parseBearerToken('verified-token'), null);
  assert.equal(parseBearerToken(undefined), null);
});
