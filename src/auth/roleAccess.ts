import type { UserRole } from '../context/AuthContext';

export type MarketplaceDestination = 'CONSUMER' | 'PROVIDER';

export function canEnterMarketplaceDestination(role: UserRole | null, destination: MarketplaceDestination): boolean {
  return role === destination;
}

export function destinationForRole(role: UserRole): MarketplaceDestination | 'ADMIN_AUDIT' {
  if (role === 'PROVIDER') return 'PROVIDER';
  if (role === 'ADMIN') return 'ADMIN_AUDIT';
  return 'CONSUMER';
}
