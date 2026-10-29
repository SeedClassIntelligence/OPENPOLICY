const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'X-Open-Polici-Preview': 'synthetic-read-only' }
});

const application = {
  id: 'preview-provider-application-001', applicantName: 'Alex Morgan', applicantEmail: 'alex@example.invalid',
  legalName: 'Silver State Coverage Partners LLC', displayName: 'Silver State Coverage Partners',
  organizationType: 'INDEPENDENT_AGENCY', jurisdictionCode: 'NV', insuranceLines: ['PERSONAL_AUTO'],
  producerLicenseNumber: 'NV-PREVIEW-48291', producerNpn: 'PREVIEW-1808605',
  organizationNpn: 'PREVIEW-8645063', organizationLicenseNumber: 'NV-PREVIEW-47854',
  transactionRole: 'BROKER', requestedPlanCode: 'PLAN_AGENCY', status: 'PENDING_REVIEW',
  createdAt: '2026-10-29T00:00:00.000Z'
};

export async function candidatePreviewFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  if (method !== 'GET') return json({ error: 'Read-only preview: changes are disabled and no production record was modified.' }, 403);
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const url = new URL(raw, window.location.origin);
  const path = url.pathname;

  if (path === '/api/notifications') return json([]);
  if (path === '/api/challenges') return json([]);
  if (path === '/api/audit-events') return json([]);
  if (path === '/api/admin/review-queue') return json([]);
  if (path === '/api/admin/audit-chain/verify') return json({ valid: true, totalRecords: 0, verifiedRecords: 0, message: 'Synthetic preview contains no production audit records.' });
  if (path === '/api/insurance-lines') return json({ insuranceLines: [
    { code: 'PERSONAL_AUTO', displayName: 'Personal Auto', status: 'ACTIVE' },
    { code: 'HOMEOWNERS', displayName: 'Homeowners', status: 'PRE_PRODUCTION' },
    { code: 'RENTERS', displayName: 'Renters', status: 'PRE_PRODUCTION' },
    { code: 'COMMERCIAL_AUTO', displayName: 'Commercial Auto', status: 'PRE_PRODUCTION' },
    { code: 'GENERAL_LIABILITY', displayName: 'General Liability', status: 'PRE_PRODUCTION' },
    { code: 'BUSINESSOWNERS', displayName: 'Businessowners', status: 'PRE_PRODUCTION' }
  ]});
  if (path === '/api/rollout/jurisdiction-lines') return json({ entries: [{ jurisdictionCode: 'NV', insuranceLine: 'PERSONAL_AUTO', marketStatus: 'CONTROLLED_ACCEPTANCE' }] });
  if (path === '/api/admin/overview') return json({
    generatedAt: '2026-10-29T00:00:00.000Z',
    counts: { activeProviderOrganizations: 3, providerOrganizations: 4, activeProviderUsers: 6, providerUsers: 7, openCompetitions: 12, competitions: 18, policies: 29, verifiedBaselines: 29, bindingHandoffs: 4, policyVaultItems: 4, pendingReviews: 1, auditEvents: 0 },
    paymentProcessor: { configured: true, secureReturnUrl: true, liveCollectionsEnabled: false },
    organizations: [
      { id: 'org_preview_sierra', legalName: 'Sierra Brokerage Group LLC', verificationStatus: 'MARKETPLACE_APPROVED', marketplaceStatus: 'ACTIVE', users: 2, jurisdictions: ['NV'], insuranceLines: ['PERSONAL_AUTO'] },
      { id: 'org_preview_suspended', legalName: 'Wave Zero Suspended Provider Demo LLC', verificationStatus: 'MARKETPLACE_APPROVED', marketplaceStatus: 'SUSPENDED', users: 1, jurisdictions: ['NV'], insuranceLines: ['PERSONAL_AUTO'] }
    ]
  });
  if (path === '/api/admin/commercial/governance') return json({ priceBookId: 'OPEN_POLICY_COMMERCIAL_V2', status: 'ACTIVE', liveCollectionsEnabled: false, plans: [] });
  if (path === '/api/admin/commercial/platform-summary') return json({ liveCollectionsEnabled: false, activeMemberships: 3, invoices: 0, payments: 0, outstandingCents: 0 });
  if (path === '/api/admin/administrators') return json({ administrators: [{ firebaseUid: 'preview-owner', adminType: 'OWNER', permissions: ['PLATFORM_READ'], status: 'ACTIVE' }] });
  if (path === '/api/admin/marketplace-operations') return json({
    policies: [{ id: 'preview-policy-1' }],
    opportunities: [{ id: 'preview-opportunity-1', referenceNumber: 'NV-PA-PREVIEW-001', jurisdiction: 'NV', insuranceLine: 'PERSONAL_AUTO', status: 'OPEN', competitionStatus: 'SUBMISSION_WINDOW', offersCount: 2, activeOfferCohort: 1, maximumActivatedProviders: 5 }],
    offers: [{ id: 'preview-offer-1' }, { id: 'preview-offer-2' }], selections: [], handoffs: []
  });
  if (path === '/api/admin/provider-applications') return json([application]);
  if (path === '/api/admin/provider-authority-evidence') return json([]);
  if (path === '/api/admin/jurisdictions/NV/readiness') return json({
    market: { readiness: 'CONTROLLED_ACCEPTANCE', state: 'PRE_PRODUCTION', gates: [] },
    candidatePacket: { rules: [
      { ruleId: 'NV-PREVIEW-INDIVIDUAL-LICENSE', researchStatus: 'READY_FOR_VERIFICATION', verificationStatus: 'SANDBOX_ONLY', normalizedProposition: 'Individual producer licensing is evaluated independently.', primaryAuthority: { officialUrl: 'https://doi.nv.gov/', citation: 'Nevada Division of Insurance' }, openQuestions: [] },
      { ruleId: 'NV-PREVIEW-ORGANIZATION-LICENSE', researchStatus: 'REVIEW_REQUIRED', verificationStatus: 'UNPUBLISHED', normalizedProposition: 'Business-entity authority is evaluated separately from individual authority.', primaryAuthority: { officialUrl: 'https://doi.nv.gov/', citation: 'Nevada Division of Insurance' }, openQuestions: ['Independent production verification remains required.'] }
    ] },
    manifest: { activationGates: [{ gateCode: 'INDEPENDENT_RULE_VERIFICATION', evidenceRefs: ['Synthetic preview—no production attestation'] }] }
  });
  if (path === '/api/admin/consumer-funnel/summary') return json({ targetActivatedConsumers: 1000, events: [
    { eventName: 'ACCOUNT_CREATED', consumers: 64 }, { eventName: 'INTAKE_PATH_SELECTED', consumers: 51 },
    { eventName: 'BASELINE_CONFIRMED', consumers: 29 }, { eventName: 'MARKETPLACE_REQUEST_ACTIVATED', consumers: 18 },
    { eventName: 'FIRST_OFFER_RECEIVED', consumers: 9 }, { eventName: 'PROVIDER_CONNECTION_AUTHORIZED', consumers: 4 }
  ] });

  if (path === '/api/internal/sales/foundation') return json({ profile: { id: 'preview-sales-owner', role: 'SALES_ADMIN', activeStatus: 'ACTIVE' }, teams: [{ id: 'preview-team-nv', name: 'Nevada Provider Acquisition' }], territories: [{ id: 'preview-territory-nv', name: 'Nevada Wave 0' }] });
  if (path === '/api/internal/sales/prospects') return json({ prospects: [{ id: 'preview-prospect-1', organizationName: 'Silver State Coverage Partners', jurisdiction: 'NV', assignedRepId: 'preview-sales-owner', status: 'QUALIFIED' }] });
  if (path === '/api/internal/sales/opportunities') return json({ opportunities: [{ id: 'preview-opportunity-1', stage: 'VERIFICATION_PENDING', targetMembershipTier: 'PLAN_AGENCY', providerApplicationId: application.id }] });
  if (path === '/api/internal/sales/compensation/plans') return json({ plans: [{ id: 'preview-plan-v1', planName: 'Provider Acquisition Plan', version: 1, status: 'DRAFT' }] });
  if (path === '/api/internal/sales/analytics/actuals') return json({ newPayingProviders: 0, membershipMrrCents: 0, providerCacCents: 0, membershipRevenueCents: 0, connectionRevenueCents: 0, compensationExpenseCents: 0 });
  if (path === '/api/internal/sales/analytics/demand') return json({ registeredConsumers: 64, target: { count: 1000 }, openDemand: 12 });

  if (path === '/api/marketplace/opportunities' || path === '/api/marketplace/competitions') return json([]);
  if (path === '/api/marketplace/my-provider') return json({ organization: { id: 'org_preview_sierra', legalName: 'Sierra Brokerage Group LLC', displayName: 'Sierra Brokerage Group', verificationStatus: 'MARKETPLACE_APPROVED', marketplaceStatus: 'ACTIVE', jurisdictions: ['NV'], insuranceLines: ['PERSONAL_AUTO'] }, user: { id: 'user_sierra_1', role: 'ADMIN', activeStatus: 'ACTIVE' } });
  if (path.startsWith('/api/commercial/')) {
    if (path.endsWith('/account')) return json({ providerOrganizationId: 'org_preview_sierra', planCode: 'PLAN_AGENCY', status: 'TRIAL', trialDaysRemaining: 30 });
    if (path.endsWith('/agreement')) return json({ id: 'agreement-preview', status: 'TRIAL', planCode: 'PLAN_AGENCY' });
    if (path.endsWith('/entitlements')) return json({ entitlements: [] });
    if (path.endsWith('/value-summary')) return json({ membershipStatus: 'TRIAL', opportunitiesReceived: 0, authorizedConnections: 0 });
    if (path.endsWith('/billable-events/summary')) return json({ totalCents: 0, count: 0 });
    if (path.endsWith('/statements/current')) return json({ statement: null });
    return json([]);
  }
  if (path === '/api/policy-documents/current-baseline') return json({ baseline: null });
  if (path === '/api/marketplace/vault/policies' || path === '/api/vault/documents') return json([]);

  return json({ preview: true, data: [] });
}

