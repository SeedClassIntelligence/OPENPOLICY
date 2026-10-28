export type PasoRole = 'SALES_ADMIN'|'SALES_MANAGER'|'SALES_REP'|'PROVIDER_ACTIVATION'|'SALES_FINANCE'|'SALES_AUDITOR';
export type PasoAction = 'FOUNDATION_READ'|'TEAM_WRITE'|'TERRITORY_WRITE'|'PROFILE_WRITE'|'PROSPECT_READ'|'PROSPECT_WRITE'|'COMPENSATION_READ'|'COMPENSATION_APPROVE'|'PAYOUT_RECONCILE';

const ROLE_ACTIONS: Record<PasoRole, ReadonlySet<PasoAction>> = {
  SALES_ADMIN: new Set(['FOUNDATION_READ','TEAM_WRITE','TERRITORY_WRITE','PROFILE_WRITE','PROSPECT_READ','PROSPECT_WRITE','COMPENSATION_READ']),
  SALES_MANAGER: new Set(['FOUNDATION_READ','PROSPECT_READ','PROSPECT_WRITE','COMPENSATION_READ','COMPENSATION_APPROVE']),
  SALES_REP: new Set(['FOUNDATION_READ','PROSPECT_READ','PROSPECT_WRITE','COMPENSATION_READ']),
  PROVIDER_ACTIVATION: new Set(['FOUNDATION_READ','PROSPECT_READ']),
  SALES_FINANCE: new Set(['FOUNDATION_READ','COMPENSATION_READ','COMPENSATION_APPROVE','PAYOUT_RECONCILE']),
  SALES_AUDITOR: new Set(['FOUNDATION_READ','PROSPECT_READ','COMPENSATION_READ'])
};

export function canPaso(role: PasoRole, action: PasoAction): boolean {
  return ROLE_ACTIONS[role].has(action);
}

export function assertPaso(role: PasoRole, action: PasoAction): void {
  if (!canPaso(role, action)) throw Object.assign(new Error(`PASO permission denied: ${action}`), { statusCode: 403 });
}

export function canReadAssignedObject(input: { role: PasoRole; actorProfileId: string; actorTeamId?: string; ownerProfileId?: string; objectTeamId?: string }): boolean {
  if (input.role === 'SALES_ADMIN' || input.role === 'SALES_FINANCE' || input.role === 'SALES_AUDITOR') return true;
  if (input.role === 'SALES_MANAGER') return Boolean(input.actorTeamId && input.actorTeamId === input.objectTeamId);
  return Boolean(input.ownerProfileId && input.ownerProfileId === input.actorProfileId);
}
