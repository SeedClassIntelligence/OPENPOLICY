import type { UserRole } from '../context/AuthContext';

export type MarketplaceDestination = 'CONSUMER' | 'PROVIDER';
export type OwnerDestination = 'ADMIN_AUDIT' | 'TELEMETRY' | 'ARCHITECTURE_TESTS';

export function canEnterMarketplaceDestination(role: UserRole | null, destination: MarketplaceDestination): boolean {
  return role === destination;
}

export function canEnterOwnerDestination(role: UserRole | null, _destination: OwnerDestination): boolean {
  return role === 'ADMIN';
}

export function destinationForRole(role: UserRole): MarketplaceDestination | 'ADMIN_AUDIT' {
  if (role === 'PROVIDER') return 'PROVIDER';
  if (role === 'ADMIN') return 'ADMIN_AUDIT';
  return 'CONSUMER';
}
