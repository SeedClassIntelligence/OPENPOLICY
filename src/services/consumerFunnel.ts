import { apiFetch } from './apiClient';
import type { InsuranceLine } from '../types/jurisdiction';

export type ConsumerFunnelEventName =
  | 'ACCOUNT_CREATED'
  | 'BASELINE_PATH_SELECTED'
  | 'BASELINE_CONFIRMED'
  | 'MARKETPLACE_REQUEST_ACTIVATED';

export async function recordConsumerFunnelEvent(input: {
  eventName: ConsumerFunnelEventName;
  insuranceLine?: InsuranceLine;
  baselineOrigin?: 'VERIFIED_EXISTING_POLICY' | 'CONSUMER_DEFINED_COVERAGE_REQUEST';
  referenceId?: string;
}): Promise<void> {
  const idempotencyKey = [input.eventName, input.referenceId || 'ACCOUNT'].join(':');
  const response = await apiFetch('/api/consumer-funnel/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, idempotencyKey })
  });
  if (!response.ok) throw new Error('Consumer progress could not be recorded.');
}
