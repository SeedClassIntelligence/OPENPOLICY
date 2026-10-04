import type { PlatformNotification } from '../../types/insurance';

export interface NotificationRecipientSelector {
  consumerId?: string;
  providerUserId?: string;
  providerOrganizationId?: string;
  operatorId?: string;
}

export function validateNotificationRecipient(notification: PlatformNotification): void {
  const recipientFields = [
    notification.recipientConsumerId,
    notification.recipientProviderUserId,
    notification.recipientProviderOrganizationId,
    notification.recipientOperatorId
  ].filter(Boolean);
  if (recipientFields.length !== 1) throw new Error('Notification must have exactly one authoritative recipient');
  const expected = {
    CONSUMER: notification.recipientConsumerId,
    PROVIDER_USER: notification.recipientProviderUserId,
    PROVIDER_ORGANIZATION: notification.recipientProviderOrganizationId,
    PLATFORM_OPERATOR: notification.recipientOperatorId
  }[notification.recipientType];
  if (!expected) throw new Error('Notification recipient type does not match its authoritative recipient field');
}

export function notificationMatchesRecipient(
  notification: PlatformNotification,
  recipient: NotificationRecipientSelector
): boolean {
  return Boolean(
    (notification.recipientType === 'CONSUMER' && notification.recipientConsumerId === recipient.consumerId) ||
    (notification.recipientType === 'PROVIDER_USER' && notification.recipientProviderUserId === recipient.providerUserId) ||
    (notification.recipientType === 'PROVIDER_ORGANIZATION' && notification.recipientProviderOrganizationId === recipient.providerOrganizationId) ||
    (notification.recipientType === 'PLATFORM_OPERATOR' && notification.recipientOperatorId === recipient.operatorId)
  );
}

export function assertNotificationRecipient(notification: PlatformNotification, recipient: NotificationRecipientSelector): void {
  if (!notificationMatchesRecipient(notification, recipient)) {
    throw Object.assign(new Error('Forbidden: notification belongs to another recipient'), { statusCode: 403 });
  }
}
