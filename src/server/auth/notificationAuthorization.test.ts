import test from 'node:test';
import assert from 'node:assert/strict';
import type { PlatformNotification } from '../../types/insurance';
import { assertNotificationRecipient, notificationMatchesRecipient, validateNotificationRecipient } from './notificationAuthorization';

function notification(overrides: Partial<PlatformNotification>): PlatformNotification {
  return {
    id: `NOTIF-AUTH-${Math.random()}`,
    type: 'COMPETITION_UPDATE',
    title: 'Authorization test',
    message: 'Recipient isolation test',
    timestamp: new Date().toISOString(),
    read: false,
    recipientType: 'CONSUMER',
    recipientConsumerId: 'consumer-a',
    createdFromEvent: 'AUTHORIZATION_TEST',
    ...overrides
  };
}

test('notification invariant requires exactly one matching recipient authority', () => {
  assert.throws(() => validateNotificationRecipient(notification({ recipientConsumerId: undefined })), /exactly one/);
  assert.throws(() => validateNotificationRecipient(notification({ recipientProviderUserId: 'provider-user-a' })), /exactly one/);
  assert.throws(() => validateNotificationRecipient(notification({
    recipientType: 'PROVIDER_USER', recipientConsumerId: 'consumer-a', recipientProviderUserId: undefined
  })), /does not match/);
});

test('consumer notifications are visible and mutable only by the exact consumer', () => {
  const item = notification({});
  assert(notificationMatchesRecipient(item, { consumerId: 'consumer-a' }));
  assert(!notificationMatchesRecipient(item, { consumerId: 'consumer-b' }));
  assert.throws(() => assertNotificationRecipient(item, { consumerId: 'consumer-b' }), /another recipient/);
  assert.doesNotThrow(() => assertNotificationRecipient(item, { consumerId: 'consumer-a' }));
});

test('provider-user and provider-organization recipients remain independent', () => {
  const userItem = notification({
    recipientType: 'PROVIDER_USER', recipientConsumerId: undefined, recipientProviderUserId: 'provider-user-a'
  });
  const orgItem = notification({
    recipientType: 'PROVIDER_ORGANIZATION', recipientConsumerId: undefined,
    recipientProviderOrganizationId: 'provider-org-a'
  });
  const sameProvider = { providerUserId: 'provider-user-a', providerOrganizationId: 'provider-org-a' };
  assert(notificationMatchesRecipient(userItem, sameProvider));
  assert(notificationMatchesRecipient(orgItem, sameProvider));
  assert(!notificationMatchesRecipient(userItem, { providerUserId: 'provider-user-b', providerOrganizationId: 'provider-org-b' }));
  assert(!notificationMatchesRecipient(orgItem, { providerUserId: 'provider-user-b', providerOrganizationId: 'provider-org-b' }));
  assert.throws(() => assertNotificationRecipient(orgItem, {
    providerUserId: 'provider-user-b', providerOrganizationId: 'provider-org-b'
  }), /another recipient/);
});

test('platform operator sees only explicitly addressed operator notifications', () => {
  const item = notification({
    recipientType: 'PLATFORM_OPERATOR', recipientConsumerId: undefined, recipientOperatorId: 'operator-a'
  });
  assert(notificationMatchesRecipient(item, { operatorId: 'operator-a' }));
  assert(!notificationMatchesRecipient(item, { operatorId: 'operator-b' }));
  assert(!notificationMatchesRecipient(notification({}), { operatorId: 'operator-a' }));
});
