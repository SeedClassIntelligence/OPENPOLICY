import crypto from 'crypto';
import type { EntitlementType } from '../../types/insurance';
import { commercialStore, type CommercialStore } from './commercialStore';

export type WorkflowAction = 'PRIORITIZE' | 'STANDARD_REVIEW' | 'DO_NOT_PURSUE';
export type ApiScope = 'opportunities:read' | 'offers:read' | 'reports:read';

export class PremiumServicesStore {
  constructor(private readonly commercial: CommercialStore = commercialStore) {}

  async requireEntitlement(providerOrganizationId: string, entitlementType: EntitlementType) {
    const client = await this.commercial.getClient();
    const serviceControl = await client.query<{status:string}>(
      `SELECT status FROM premium_service_controls WHERE entitlement_type=$1;`, [entitlementType]
    );
    if (serviceControl.rows[0] && serviceControl.rows[0].status !== 'ENABLED') {
      throw Object.assign(new Error(`PREMIUM_SERVICE_DISABLED: ${entitlementType}`), { statusCode: 503 });
    }
    const now = new Date().toISOString();
    const entitlements = await this.commercial.getEntitlementsForOrg(providerOrganizationId);
    const entitlement = entitlements.find(item => item.entitlementType === entitlementType &&
      item.effectiveFrom <= now && (!item.effectiveUntil || item.effectiveUntil > now));
    if (!entitlement) {
      throw Object.assign(new Error(`PREMIUM_ENTITLEMENT_REQUIRED: ${entitlementType}`), { statusCode: 403 });
    }
    return entitlement;
  }

  async listWorkflowRules(providerOrganizationId: string) {
    await this.requireEntitlement(providerOrganizationId, 'AUTOMATED_APPETITE_MATCHING');
    const client = await this.commercial.getClient();
    const result = await client.query<any>(
      `SELECT * FROM provider_workflow_rules WHERE provider_organization_id = $1 ORDER BY created_at ASC`,
      [providerOrganizationId]
    );
    return result.rows.map(row => ({ id: row.id, providerOrganizationId: row.provider_organization_id,
      name: row.name, enabled: row.enabled, jurisdictions: JSON.parse(row.jurisdictions),
      insuranceLines: JSON.parse(row.insurance_lines), riskMarkets: JSON.parse(row.risk_markets),
      action: row.action as WorkflowAction, createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at }));
  }

  async createWorkflowRule(params: { providerOrganizationId: string; name: string; jurisdictions: string[];
    insuranceLines: string[]; riskMarkets: string[]; action: WorkflowAction; actorId: string }) {
    await this.requireEntitlement(params.providerOrganizationId, 'AUTOMATED_APPETITE_MATCHING');
    if (!params.name.trim() || !['PRIORITIZE','STANDARD_REVIEW','DO_NOT_PURSUE'].includes(params.action)) {
      throw Object.assign(new Error('Invalid workflow rule.'), { statusCode: 400 });
    }
    const now = new Date().toISOString();
    const rule = { id: `pwr_${crypto.randomUUID()}`, ...params, enabled: true, createdAt: now, updatedAt: now };
    const client = await this.commercial.getClient();
    await client.query(
      `INSERT INTO provider_workflow_rules (id, provider_organization_id, name, enabled, jurisdictions,
       insurance_lines, risk_markets, action, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,TRUE,$4,$5,$6,$7,$8,$9,$9)`,
      [rule.id, params.providerOrganizationId, params.name.trim(), JSON.stringify(params.jurisdictions),
       JSON.stringify(params.insuranceLines), JSON.stringify(params.riskMarkets), params.action, params.actorId, now]
    );
    return rule;
  }

  async evaluateWorkflow(providerOrganizationId: string, input: { jurisdiction?: string; insuranceLine?: string; riskMarket?: string }) {
    const rules = await this.listWorkflowRules(providerOrganizationId);
    const matches = rules.filter(rule => rule.enabled &&
      (!rule.jurisdictions.length || (input.jurisdiction && rule.jurisdictions.includes(input.jurisdiction))) &&
      (!rule.insuranceLines.length || (input.insuranceLine && rule.insuranceLines.includes(input.insuranceLine))) &&
      (!rule.riskMarkets.length || (input.riskMarket && rule.riskMarkets.includes(input.riskMarket))));
    return { action: matches[0]?.action || 'STANDARD_REVIEW', matchedRuleId: matches[0]?.id || null };
  }

  async createApiCredential(params: { providerOrganizationId: string; label: string; scopes: ApiScope[]; actorId: string }) {
    await this.requireEntitlement(params.providerOrganizationId, 'API_ACCESS');
    const allowed: ApiScope[] = ['opportunities:read','offers:read','reports:read'];
    if (!params.label.trim() || !params.scopes.length || params.scopes.some(scope => !allowed.includes(scope))) {
      throw Object.assign(new Error('Invalid API credential label or scopes.'), { statusCode: 400 });
    }
    const secret = crypto.randomBytes(32).toString('base64url');
    const token = `op_live_${secret}`;
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const now = new Date().toISOString();
    const id = `pac_${crypto.randomUUID()}`;
    const client = await this.commercial.getClient();
    await client.query(
      `INSERT INTO provider_api_credentials (id, provider_organization_id, label, token_prefix, token_hash,
       scopes, status, created_by, created_at) VALUES ($1,$2,$3,$4,$5,$6,'ACTIVE',$7,$8)`,
      [id, params.providerOrganizationId, params.label.trim(), token.slice(0, 16), hash,
       JSON.stringify([...new Set(params.scopes)]), params.actorId, now]
    );
    return { id, label: params.label.trim(), scopes: [...new Set(params.scopes)], token, tokenPrefix: token.slice(0, 16), createdAt: now };
  }

  async listApiCredentials(providerOrganizationId: string) {
    await this.requireEntitlement(providerOrganizationId, 'API_ACCESS');
    const client = await this.commercial.getClient();
    const result = await client.query<any>(
      `SELECT id, label, token_prefix, scopes, status, created_at, last_used_at, revoked_at
       FROM provider_api_credentials WHERE provider_organization_id = $1 ORDER BY created_at DESC`,
      [providerOrganizationId]
    );
    return result.rows.map(row => ({ id: row.id, label: row.label, tokenPrefix: row.token_prefix,
      scopes: JSON.parse(row.scopes), status: row.status, createdAt: row.created_at,
      lastUsedAt: row.last_used_at || undefined, revokedAt: row.revoked_at || undefined }));
  }

  async authenticateApiToken(token: string, requiredScope: ApiScope) {
    if (!token.startsWith('op_live_') || token.length < 32) {
      throw Object.assign(new Error('Invalid provider API credential.'), { statusCode: 401 });
    }
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const client = await this.commercial.getClient();
    const result = await client.query<any>(
      `SELECT * FROM provider_api_credentials WHERE token_hash=$1 AND status='ACTIVE'`, [hash]
    );
    const row = result.rows[0];
    if (!row) throw Object.assign(new Error('Invalid provider API credential.'), { statusCode: 401 });
    await this.requireEntitlement(row.provider_organization_id, 'API_ACCESS');
    const scopes = JSON.parse(row.scopes) as ApiScope[];
    if (!scopes.includes(requiredScope)) {
      throw Object.assign(new Error(`API scope required: ${requiredScope}`), { statusCode: 403 });
    }
    await client.query(`UPDATE provider_api_credentials SET last_used_at=$2 WHERE id=$1`, [row.id, new Date().toISOString()]);
    return { providerOrganizationId: row.provider_organization_id as string,
      providerUserId: row.created_by as string, credentialId: row.id as string, scopes };
  }

  async revokeApiCredential(providerOrganizationId: string, credentialId: string) {
    await this.requireEntitlement(providerOrganizationId, 'API_ACCESS');
    const client = await this.commercial.getClient();
    const now = new Date().toISOString();
    const result = await client.query<any>(
      `UPDATE provider_api_credentials SET status='REVOKED', revoked_at=$3
       WHERE id=$1 AND provider_organization_id=$2 AND status='ACTIVE' RETURNING id`,
      [credentialId, providerOrganizationId, now]
    );
    if (!result.rows[0]) throw Object.assign(new Error('API credential not found.'), { statusCode: 404 });
    return { id: credentialId, status: 'REVOKED', revokedAt: now };
  }

  async createLocation(params: { providerOrganizationId: string; name: string; jurisdiction: string;
    addressLine1: string; addressLine2?: string; city: string; postalCode: string; actorId: string }) {
    await this.requireEntitlement(params.providerOrganizationId, 'MULTI_LOCATION_ADMIN');
    if (![params.name, params.jurisdiction, params.addressLine1, params.city, params.postalCode].every(value => value.trim())) {
      throw Object.assign(new Error('Complete location details are required.'), { statusCode: 400 });
    }
    const now = new Date().toISOString();
    const id = `ploc_${crypto.randomUUID()}`;
    const client = await this.commercial.getClient();
    await client.query(
      `INSERT INTO provider_locations (id, provider_organization_id, name, jurisdiction, address_line1,
       address_line2, city, postal_code, status, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ACTIVE',$9,$10,$10)`,
      [id, params.providerOrganizationId, params.name.trim(), params.jurisdiction.trim().toUpperCase(),
       params.addressLine1.trim(), params.addressLine2?.trim() || null, params.city.trim(),
       params.postalCode.trim(), params.actorId, now]
    );
    return { id, ...params, jurisdiction: params.jurisdiction.trim().toUpperCase(), status: 'ACTIVE', createdAt: now };
  }

  async listLocations(providerOrganizationId: string) {
    await this.requireEntitlement(providerOrganizationId, 'MULTI_LOCATION_ADMIN');
    const client = await this.commercial.getClient();
    const result = await client.query<any>(
      `SELECT l.*, COUNT(a.provider_user_id)::int AS assigned_users FROM provider_locations l
       LEFT JOIN provider_location_assignments a ON a.location_id=l.id
       WHERE l.provider_organization_id=$1 GROUP BY l.id ORDER BY l.name`, [providerOrganizationId]
    );
    return result.rows.map(row => ({ id: row.id, name: row.name, jurisdiction: row.jurisdiction,
      addressLine1: row.address_line1, addressLine2: row.address_line2 || undefined, city: row.city,
      postalCode: row.postal_code, status: row.status, assignedUsers: Number(row.assigned_users) }));
  }

  async assignLocation(params: { providerOrganizationId: string; locationId: string; providerUserId: string; actorId: string }) {
    await this.requireEntitlement(params.providerOrganizationId, 'MULTI_LOCATION_ADMIN');
    const client = await this.commercial.getClient();
    const valid = await client.query<any>(
      `SELECT l.id FROM provider_locations l JOIN provider_users u ON u.organization_id=l.provider_organization_id
       WHERE l.id=$1 AND u.id=$2 AND l.provider_organization_id=$3`,
      [params.locationId, params.providerUserId, params.providerOrganizationId]
    );
    if (!valid.rows[0]) throw Object.assign(new Error('Location and provider user must belong to the same organization.'), { statusCode: 403 });
    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO provider_location_assignments (provider_organization_id, location_id, provider_user_id, assigned_by, assigned_at)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT(location_id,provider_user_id) DO NOTHING`,
      [params.providerOrganizationId, params.locationId, params.providerUserId, params.actorId, now]
    );
    return { locationId: params.locationId, providerUserId: params.providerUserId, assignedAt: now };
  }
}

export const premiumServicesStore = new PremiumServicesStore();
