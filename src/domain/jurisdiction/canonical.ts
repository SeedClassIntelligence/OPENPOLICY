/**
 * Canonical serialization for hashing regulatory content and evaluation inputs.
 * Object keys are sorted recursively and undefined values dropped, so equal content
 * always produces the same hash.
 */
import crypto from 'crypto';

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = sortKeys(v);
    }
    return out;
  }
  return value;
}

export function sha256Hex(value: unknown): string {
  return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
}

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** D3: rule effectiveness is evaluated on calendar dates only (YYYY-MM-DD). */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !CALENDAR_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().startsWith(value);
}
