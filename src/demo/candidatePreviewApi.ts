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
  if (path === '/api/metrics') return json({
    activeChallenges: 1, totalPoliciesIngested: 29, redisCacheHitRate: 96.4,
    p95ComparisonLatencyMs: 14.2, workerQueueJobsProcessed: 1492,
    discrepanciesIntercepted: 14, averageConsumerSavings: 428
  });
  if (path === '/api/challenges') return json([]);
  if (path === '/api/audit-events') return json([]);
  if (path === '/api/admin/review-queue') return json([]);
  if (path === '/api/admin/audit-chain/verify') return json({
    valid: true,
    totalRecords: 0,
    verifiedRecords: 0,
    merkleRoot: 'preview0000000000000000000000000000000000000000000000000000000000',
    latestBlockHash: 'preview0000000000000000000000000000000000000000000000000000000000',
    message: 'Synthetic preview contains no production audit records.'
  });
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
      { id: 'org_preview_sierra', displayName: 'Sierra Brokerage Group', legalName: 'Sierra Brokerage Group LLC', verificationStatus: 'MARKETPLACE_APPROVED', marketplaceStatus: 'ACTIVE', userCount: 2, states: ['NV'], linesOfBusiness: ['PERSONAL_AUTO'] },
      { id: 'org_preview_suspended', displayName: 'Wave Zero Suspended Provider Demo', legalName: 'Wave Zero Suspended Provider Demo LLC', verificationStatus: 'MARKETPLACE_APPROVED', marketplaceStatus: 'SUSPENDED', userCount: 1, states: ['NV'], linesOfBusiness: ['PERSONAL_AUTO'] }
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

  if (path === '/api/internal/sales/foundation') return json({ profile: { id: 'preview-sales-owner', internalUserId:'preview-owner', role: 'SALES_ADMIN', activeStatus: 'ACTIVE' }, teams: [{ id: 'preview-team-nv', name: 'Nevada Provider Acquisition', activeStatus:'ACTIVE' }], territories: [{ id: 'preview-territory-nv', name: 'Nevada Wave 0', jurisdictionCodes:['NV'], insuranceLineFocus:['PERSONAL_AUTO'] }], profiles:[{id:'preview-sales-owner',internalUserId:'preview-owner',teamId:'preview-team-nv',role:'SALES_ADMIN',activeStatus:'ACTIVE'},{id:'preview-sales-rep',internalUserId:'preview-rep@example.invalid',teamId:'preview-team-nv',role:'SALES_REP',activeStatus:'ACTIVE'}] });
  if (path === '/api/internal/sales/prospects') return json({ prospects: [{ id: 'preview-prospect-1', organizationName: 'Silver State Coverage Partners', organizationType: 'INDEPENDENT_AGENCY', businessAddress: '100 Preview Way, Las Vegas, NV', jurisdiction: 'NV', website: 'https://example.invalid', knownLicenseIdentifiers: ['ORG-NPN-1000001', 'NV-ORG-20001', 'IND-NPN-3000001', 'NV-IND-40001'], primaryInsuranceLines: ['PERSONAL_AUTO'], assignedRepId: 'preview-sales-rep', qualificationStatus: 'EVIDENCE_PENDING_OWNER_REVIEW' }] });
  if (path === '/api/internal/sales/prospects/preview-prospect-1/authority-evidence') return json({ evidence: [
    { id:'preview-evidence-org', subjectType:'ORGANIZATION_LICENSE', legalName:'Silver State Coverage Partners', jurisdiction:'NV', authorityNumber:'NV-ORG-20001', npn:'ORG-NPN-1000001', status:'ACTIVE', qualifications:['PROPERTY','CASUALTY'], sourceName:'Nevada Division of Insurance', sourceRecordId:'PREVIEW-ORG-LOOKUP', reviewStatus:'PENDING_OWNER_REVIEW' },
    { id:'preview-evidence-ind', subjectType:'INDIVIDUAL_LICENSE', legalName:'Jordan Preview Producer', jurisdiction:'NV', authorityNumber:'NV-IND-40001', npn:'IND-NPN-3000001', status:'ACTIVE', qualifications:['PROPERTY','CASUALTY'], sourceName:'Nevada Division of Insurance', sourceRecordId:'PREVIEW-IND-LOOKUP', reviewStatus:'PENDING_OWNER_REVIEW' }
  ] });
  if (path === '/api/internal/sales/opportunities') return json({ opportunities: [{ id: 'preview-opportunity-1', prospectId:'preview-prospect-1', stage: 'VERIFICATION_PENDING', targetMembershipTier: 'PLAN_AGENCY', providerApplicationId: application.id }] });
  if (path === '/api/internal/sales/compensation/plans') return json({ plans: [{ id: 'preview-plan-v1', planName: 'Provider Acquisition Plan', version: 1, status: 'DRAFT' }] });
  if (path === '/api/internal/sales/analytics/actuals') return json({ newPayingProviders: 0, membershipMrrCents: 0, providerCacCents: 0, membershipRevenueCents: 0, connectionRevenueCents: 0, compensationExpenseCents: 0 });
  if (path === '/api/internal/sales/analytics/demand') return json({ registeredConsumers: 64, completedIntakes:29, eligibleStructuredOpportunities:18, activeCompetitions:12, target: { count: 1000 }, openDemand: 12 });
  if (path === '/api/internal/sales/duplicates') return json({ candidates: [] });

  if (path === '/api/marketplace/opportunities' || path === '/api/marketplace/competitions') return json([]);
  if (path === '/api/marketplace/my-provider') return json({
    org: { id: 'org_preview_sierra', legalName: 'Sierra Brokerage Group LLC', displayName: 'Sierra Brokerage Group', organizationType: 'INDEPENDENT_AGENCY', verificationStatus: 'MARKETPLACE_APPROVED', marketplaceStatus: 'ACTIVE', states: ['NV'], linesOfBusiness: ['PERSONAL_AUTO'] },
    user: { id: 'user_sierra_1', fullName: 'Jordan Rivera', email: 'jordan@example.invalid', role: 'ADMIN', activeStatus: 'ACTIVE' },
    licenses: [{ id: 'license-preview-1', jurisdiction: 'NV', licenseNumber: 'NV-PREVIEW-48291', status: 'ACTIVE', linesOfAuthority: ['PROPERTY', 'CASUALTY'] }],
    appetite: { states: ['NV'], jurisdictions: ['NV'], linesOfBusiness: ['PERSONAL_AUTO'], riskMarkets: ['PREFERRED', 'STANDARD'], status: 'ACTIVE' },
    carriers: [{ id: 'carrier-preview-1', carrierName: 'Synthetic Carrier for Preview', status: 'ACTIVE', insuranceLines: ['PERSONAL_AUTO'] }]
  });
  if (path.startsWith('/api/commercial/')) {
    if (path.endsWith('/account')) return json({ account: { providerOrganizationId: 'org_preview_sierra', planCode: 'PLAN_AGENCY', status: 'TRIAL', trialDaysRemaining: 30 } });
    if (path.endsWith('/agreement')) return json({ agreement: { id: 'agreement-preview', status: 'TRIAL', planCode: 'PLAN_AGENCY' }, plan: { code: 'PLAN_AGENCY', name: 'Agency' }, planVersion: { version: 1 } });
    if (path.endsWith('/entitlements')) return json({ entitlements: [] });
    if (path.endsWith('/events')) return json({ events: [] });
    if (path.endsWith('/value-summary')) return json({ valueSummary: { membershipStatus: 'TRIAL', opportunitiesReceived: 0, authorizedConnections: 0 } });
    if (path.endsWith('/billable-events')) return json({ billableEvents: [] });
    if (path.endsWith('/adjustments')) return json({ adjustments: [] });
    if (path.endsWith('/billable-events/summary')) return json({ summary: { totalCents: 0, count: 0 } });
    if (path.endsWith('/invoices')) return json({ invoices: [] });
    if (path.endsWith('/billing-periods')) return json({ billingPeriods: [] });
    if (path.endsWith('/statements/current')) return json({ statement: null });
    return json([]);
  }
  if (path === '/api/policy-documents/current-baseline') return json({ baseline: null });
  if (path === '/api/marketplace/vault/policies' || path === '/api/vault/documents') return json([]);

  return json({ preview: true, data: [] });
}

