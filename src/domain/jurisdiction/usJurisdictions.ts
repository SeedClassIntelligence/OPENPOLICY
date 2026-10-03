/**
 * Reference data: the 50 U.S. states and the District of Columbia (USPS codes).
 * Codes and names only. This module contains no law.
 */
import { Jurisdiction, UsJurisdictionCode } from '../../types/jurisdiction';

export const US_JURISDICTIONS: ReadonlyArray<Jurisdiction & { code: UsJurisdictionCode }> = [
  { code: 'AL', name: 'Alabama', kind: 'STATE' },
  { code: 'AK', name: 'Alaska', kind: 'STATE' },
  { code: 'AZ', name: 'Arizona', kind: 'STATE' },
  { code: 'AR', name: 'Arkansas', kind: 'STATE' },
  { code: 'CA', name: 'California', kind: 'STATE' },
  { code: 'CO', name: 'Colorado', kind: 'STATE' },
  { code: 'CT', name: 'Connecticut', kind: 'STATE' },
  { code: 'DE', name: 'Delaware', kind: 'STATE' },
  { code: 'DC', name: 'District of Columbia', kind: 'FEDERAL_DISTRICT' },
  { code: 'FL', name: 'Florida', kind: 'STATE' },
  { code: 'GA', name: 'Georgia', kind: 'STATE' },
  { code: 'HI', name: 'Hawaii', kind: 'STATE' },
  { code: 'ID', name: 'Idaho', kind: 'STATE' },
  { code: 'IL', name: 'Illinois', kind: 'STATE' },
  { code: 'IN', name: 'Indiana', kind: 'STATE' },
  { code: 'IA', name: 'Iowa', kind: 'STATE' },
  { code: 'KS', name: 'Kansas', kind: 'STATE' },
  { code: 'KY', name: 'Kentucky', kind: 'STATE' },
  { code: 'LA', name: 'Louisiana', kind: 'STATE' },
  { code: 'ME', name: 'Maine', kind: 'STATE' },
  { code: 'MD', name: 'Maryland', kind: 'STATE' },
  { code: 'MA', name: 'Massachusetts', kind: 'STATE' },
  { code: 'MI', name: 'Michigan', kind: 'STATE' },
  { code: 'MN', name: 'Minnesota', kind: 'STATE' },
  { code: 'MS', name: 'Mississippi', kind: 'STATE' },
  { code: 'MO', name: 'Missouri', kind: 'STATE' },
  { code: 'MT', name: 'Montana', kind: 'STATE' },
  { code: 'NE', name: 'Nebraska', kind: 'STATE' },
  { code: 'NV', name: 'Nevada', kind: 'STATE' },
  { code: 'NH', name: 'New Hampshire', kind: 'STATE' },
  { code: 'NJ', name: 'New Jersey', kind: 'STATE' },
  { code: 'NM', name: 'New Mexico', kind: 'STATE' },
  { code: 'NY', name: 'New York', kind: 'STATE' },
  { code: 'NC', name: 'North Carolina', kind: 'STATE' },
  { code: 'ND', name: 'North Dakota', kind: 'STATE' },
  { code: 'OH', name: 'Ohio', kind: 'STATE' },
  { code: 'OK', name: 'Oklahoma', kind: 'STATE' },
  { code: 'OR', name: 'Oregon', kind: 'STATE' },
  { code: 'PA', name: 'Pennsylvania', kind: 'STATE' },
  { code: 'RI', name: 'Rhode Island', kind: 'STATE' },
  { code: 'SC', name: 'South Carolina', kind: 'STATE' },
  { code: 'SD', name: 'South Dakota', kind: 'STATE' },
  { code: 'TN', name: 'Tennessee', kind: 'STATE' },
  { code: 'TX', name: 'Texas', kind: 'STATE' },
  { code: 'UT', name: 'Utah', kind: 'STATE' },
  { code: 'VT', name: 'Vermont', kind: 'STATE' },
  { code: 'VA', name: 'Virginia', kind: 'STATE' },
  { code: 'WA', name: 'Washington', kind: 'STATE' },
  { code: 'WV', name: 'West Virginia', kind: 'STATE' },
  { code: 'WI', name: 'Wisconsin', kind: 'STATE' },
  { code: 'WY', name: 'Wyoming', kind: 'STATE' }
];

const CODES = new Set<string>(US_JURISDICTIONS.map(j => j.code));

export function isUsJurisdictionCode(code: string | undefined | null): code is UsJurisdictionCode {
  return typeof code === 'string' && CODES.has(code);
}
