import type { NextFunction, Request, Response } from 'express';
import { configuredAuthMode, type IdentityRole } from './requestIdentity';
import type { RequestIdentity } from './requestIdentity';

type RouteRule = { methods?: string[]; pattern: RegExp; roles: IdentityRole[] | 'PUBLIC' | 'DECISION_REQUIRED' | 'FIXTURE_ONLY' };

const rules: RouteRule[] = [
  { pattern: /^\/health$/, roles: 'PUBLIC' },
  { pattern: /^\/jurisdictions(?:\/[^/]+\/(?:rulesets|market))?$/, roles: 'PUBLIC' },
  { pattern: /^\/documents\/samples$/, roles: 'PUBLIC' },
  { methods: ['POST'], pattern: /^\/offers\/validate-quote$/, roles: 'PUBLIC' },
  { methods: ['POST'], pattern: /^\/explain-comparison$/, roles: 'PUBLIC' },
  { pattern: /^\/commercial\/plans$/, roles: 'PUBLIC' },
  { pattern: /^\/docs\/spec$/, roles: 'PUBLIC' },

  // These directory/notification semantics are not established by the domain model.
  { pattern: /^\/marketplace\/users$/, roles: ['ADMIN'] },
  { pattern: /^\/marketplace\/providers$/, roles: ['CONSUMER', 'PROVIDER', 'ADMIN'] },
  { pattern: /^\/notifications(?:\/[^/]+\/read)?$/, roles: ['CONSUMER', 'PROVIDER', 'ADMIN'] },
  { methods: ['POST'], pattern: /^\/marketplace\/competition\/[^/]+\/seed-competitors$/, roles: 'FIXTURE_ONLY' },

  { pattern: /^\/(?:tests\/run|metrics|jurisdiction-evaluations|audit-events|reset)$/, roles: ['ADMIN'] },
  { methods: ['POST'], pattern: /^\/(?:documents\/upload-sample|policies\/[^/]+\/verify|baselines\/create)$/, roles: ['ADMIN'] },
  { methods: ['POST'], pattern: /^\/challenges\/[^/]+\/(?:compete|final-round|incumbent-defense)$/, roles: ['ADMIN'] },
  { methods: ['POST'], pattern: /^\/marketplace\/competition\/[^/]+\/advance-round$/, roles: ['ADMIN'] },
  { methods: ['POST'], pattern: /^\/marketplace\/offers\/[^/]+\/verify-document$/, roles: ['PROVIDER'] },
  { methods: ['GET'], pattern: /^\/marketplace\/offers\/[^/]+\/qualification$/, roles: ['CONSUMER', 'PROVIDER', 'ADMIN'] },
  { pattern: /^\/commercial\/(?:rating\/(?:run|reconcile|runs(?:\/[^/]+)?)|events\/reconcile)$/, roles: ['ADMIN'] },
  { pattern: /^\/admin\//, roles: ['ADMIN'] },

  { pattern: /^\/(?:challenges(?:\/create|\/[^/]+)?|selection\/|reconciliation\/|vault\/)/, roles: ['CONSUMER'] },
  { methods: ['POST'], pattern: /^\/policy-documents\/ingest$/, roles: ['CONSUMER'] },
  { methods: ['POST'], pattern: /^\/policy-documents\/[^/]+\/(?:scan|extract)$/, roles: ['CONSUMER'] },
  { methods: ['GET', 'POST'], pattern: /^\/policy-documents\/[^/]+\/corrections$/, roles: ['CONSUMER'] },
  { methods: ['POST'], pattern: /^\/policy-documents\/[^/]+\/verify$/, roles: ['CONSUMER'] },
  { methods: ['GET'], pattern: /^\/policy-documents\/[^/]+$/, roles: ['CONSUMER'] },
  { pattern: /^\/marketplace\/(?:vault\/|challenges\/[^/]+\/select-version|supplemental-facts\/[^/]+\/consent)/, roles: ['CONSUMER'] },
  { methods: ['POST'], pattern: /^\/marketplace\/competition\/[^/]+\/keep-current-policy$/, roles: ['CONSUMER'] },
  { methods: ['POST'], pattern: /^\/marketplace\/binding\/[^/]+\/(?:grant-consent|revoke-consent|resolve-modification|accept-modification|reject-modification|consumer-verify)$/, roles: ['CONSUMER'] },

  { pattern: /^\/marketplace\/(?:my-provider|active-provider|opportunities|invitations\/|competitions|workspace\/)/, roles: ['PROVIDER'] },
  { methods: ['POST'], pattern: /^\/offers\/submit$/, roles: ['PROVIDER'] },
  { pattern: /^\/commercial\//, roles: ['PROVIDER'] },
  { methods: ['POST'], pattern: /^\/marketplace\/competition\/[^/]+\/(?:keep-current-offer\/[^/]+|withdraw|revise-offer\/[^/]+)$/, roles: ['PROVIDER'] },
  { methods: ['POST'], pattern: /^\/marketplace\/(?:challenges\/[^/]+\/information-requests|information-requests\/[^/]+\/answer)$/, roles: ['PROVIDER'] },
  { methods: ['POST'], pattern: /^\/marketplace\/binding\/[^/]+\/(?:execute-disclosure|propose-modification|update-status|upload-issued-policy|reconcile)$/, roles: ['PROVIDER'] },
];

export function authorizationRuleFor(method: string, path: string): RouteRule | undefined {
  return rules.find(rule => (!rule.methods || rule.methods.includes(method.toUpperCase())) && rule.pattern.test(path));
}

function forbidden(message: string): never {
  throw Object.assign(new Error(message), { statusCode: 403 });
}

export function assertChallengeRelationship(params: {
  identity: RequestIdentity;
  challengeConsumerId: string;
  providerOrganizationId?: string;
  participatingOrganizationIds: string[];
}) {
  if (params.identity.role === 'ADMIN') return;
  if (params.identity.role === 'CONSUMER') {
    if (params.identity.uid === params.challengeConsumerId) return;
    forbidden('Forbidden: consumer does not own this challenge');
  }
  if (
    params.identity.role === 'PROVIDER' && params.providerOrganizationId &&
    params.participatingOrganizationIds.includes(params.providerOrganizationId)
  ) return;
  forbidden('Forbidden: provider organization does not participate in this challenge');
}

export function assertBindingRelationship(params: {
  identity: RequestIdentity;
  handoffConsumerId?: string;
  handoffProviderOrganizationId?: string;
  providerOrganizationId?: string;
}) {
  if (params.identity.role === 'ADMIN') return;
  if (params.identity.role === 'CONSUMER') {
    if (params.identity.uid === params.handoffConsumerId) return;
    forbidden('Forbidden: consumer does not own this binding handoff');
  }
  if (
    params.identity.role === 'PROVIDER' && params.providerOrganizationId &&
    params.handoffProviderOrganizationId === params.providerOrganizationId
  ) return;
  forbidden('Forbidden: provider organization does not own this binding handoff');
}

export function enforceApiAuthorization(req: Request, res: Response, next: NextFunction) {
  if (configuredAuthMode() === 'fixture' && process.env.OPENPOLICY_FIXTURE_AUTHORIZATION_BYPASS === '1') {
    next();
    return;
  }

  const rule = authorizationRuleFor(req.method, req.path);
  if (rule?.roles === 'PUBLIC') {
    next();
    return;
  }
  if (rule?.roles === 'DECISION_REQUIRED') {
    res.status(403).json({ error: 'Forbidden', message: 'Authorization policy for this route requires an explicit architecture decision.' });
    return;
  }
  if (rule?.roles === 'FIXTURE_ONLY') {
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  const identity = req.openPolicyIdentity;
  if (!identity) {
    res.status(401).json({ error: 'Unauthorized', message: 'Verified identity required.' });
    return;
  }
  if (rule && Array.isArray(rule.roles) && !rule.roles.includes(identity.role)) {
    res.status(403).json({ error: 'Forbidden', message: 'Authenticated actor is not permitted to use this route.' });
    return;
  }
  next();
}
