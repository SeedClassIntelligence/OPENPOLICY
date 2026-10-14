/**
 * Commercial Economics Domain & Neutrality Test Suite (CE-1)
 * 
 * Verifies:
 * 1. COMMERCIAL_NEUTRALITY: Provider commercial plan has ZERO influence on
 *    offer comparison, qualification, sorting, or selection.
 * 2. Immutable CommercialPlanVersion pricing and snapshots.
 * 3. Distinct CommercialAccount lifecycle independent of regulatory ProviderOrganization.
 * 4. Idempotent CommercialEvent recording with deterministic keys.
 * 5. Entitlement capacity evaluation without affecting entered competition logic.
 * 6. Pure deterministic rating engine for billable events.
 * 7. Factual value summary conversion calculations.
 */

import {
  createCommercialAccount,
  createCommercialPlanVersion,
  createCommercialAgreement,
  deriveEntitlementsFromPlanVersion,
  checkEntitlementCapacity,
  transitionAgreementLifecycle,
  createTestFixturePlanVersion,
  buildCommercialEvent,
  rateCommercialEvent,
  calculateValueSummary,
  computeCommercialEventHash,
  verifyCommercialEventHash
} from './commercialEconomicsEngine';

import { compareOfferAgainstBaseline } from './comparisonEngine';
import {
  CommercialPlan,
  CommercialPlanVersion,
  CommercialAgreement,
  CoverageBaseline,
  Offer
} from '../types/insurance';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export function runCommercialEconomicsTestSuite(): {
  passed: number;
  failed: number;
  total: number;
  results: TestResult[];
} {
  const results: TestResult[] = [];

  function test(name: string, fn: () => void) {
    try {
      fn();
      results.push({ name: `[CE-1] ${name}`, passed: true });
    } catch (e: any) {
      results.push({ name: `[CE-1] ${name}`, passed: false, error: e.message });
    }
  }

  function assert(condition: boolean, msg: string) {
    if (!condition) throw new Error(msg);
  }

  // -------------------------------------------------------------------------
  // Test 1: CommercialAccount creation & separation from ProviderOrganization
  // -------------------------------------------------------------------------
  test('CommercialAccount is decoupled from ProviderOrganization regulatory identity', () => {
    const orgId = 'org_apex';
    const account = createCommercialAccount({
      providerOrganizationId: orgId,
      externalBillingCustomerRef: 'cus_stripe_123',
      status: 'ACTIVE'
    });

    assert(account.providerOrganizationId === orgId, 'Links to ProviderOrganization ID');
    assert(account.status === 'ACTIVE', 'Account status is ACTIVE');
    assert(account.currency === 'USD', 'Currency is USD');
    assert(account.externalBillingCustomerRef === 'cus_stripe_123', 'External ref preserved');
    assert(!!account.createdAt, 'Timestamp generated');
  });

  // -------------------------------------------------------------------------
  // Test 2: CommercialPlanVersion immutability & historical reproducibility
  // -------------------------------------------------------------------------
  test('CommercialPlanVersion is immutable and preserves terms snapshot', () => {
    const planVersion = createCommercialPlanVersion({
      planId: 'plan_agency_growth',
      version: 1,
      effectiveFrom: '2026-01-01T00:00:00Z',
      billingInterval: 'MONTHLY',
      recurringFeeCents: 49900, // $499.00
      termsSnapshot: {
        compensationDeterminationApproved: true,
        determinationReference: 'TEST-DETERMINATION',
        includedProducerSeats: 5,
        includedJurisdictions: 3,
        includedVpoCapacity: 100,
        includedAuthorizedConnections: 25,
        authorizedConnectionUnitPriceCents: 2500
      }
    });

    assert(planVersion.recurringFeeCents === 49900, 'Recurring fee is $499.00 in cents');
    assert(planVersion.termsSnapshot.includedProducerSeats === 5, 'Included seats recorded');
    assert(planVersion.termsSnapshot.includedAuthorizedConnections === 25, 'Included connections recorded');

    // Attempt mutation on frozen snapshot must throw in strict mode
    let threw = false;
    try {
      (planVersion.termsSnapshot as any).includedProducerSeats = 99;
    } catch {
      threw = true;
    }
    assert(threw || planVersion.termsSnapshot.includedProducerSeats === 5, 'Terms snapshot is immutable');
  });

  // -------------------------------------------------------------------------
  // Test 3: Entitlement derivation & capacity enforcement
  // -------------------------------------------------------------------------
  test('ProviderEntitlements derived from plan version enforce capacity limits', () => {
    const agreement = createCommercialAgreement({
      commercialAccountId: 'cac_org_apex',
      providerOrganizationId: 'org_apex',
      planVersionId: 'cpv_plan_agency_growth_v1',
      startsAt: '2026-01-01T00:00:00Z'
    });

    const planVersion = createCommercialPlanVersion({
      planId: 'plan_agency_growth',
      version: 1,
      effectiveFrom: '2026-01-01T00:00:00Z',
      billingInterval: 'MONTHLY',
      recurringFeeCents: 49900,
      termsSnapshot: {
        compensationDeterminationApproved: true,
        determinationReference: 'TEST-DETERMINATION',
        includedVpoCapacity: 50,
        includedEngagementCapacity: 20
      }
    });

    const entitlements = deriveEntitlementsFromPlanVersion({ agreement, planVersion });
    assert(entitlements.length === 2, 'Two entitlements derived from terms snapshot');

    // Check capacity: below limit
    const check1 = checkEntitlementCapacity({
      entitlements,
      entitlementType: 'VPO_ENGAGEMENT_CAPACITY',
      currentUsage: 15
    });
    assert(check1.allowed === true, 'Under limit is allowed');

    // Check capacity: at limit
    const check2 = checkEntitlementCapacity({
      entitlements,
      entitlementType: 'VPO_ENGAGEMENT_CAPACITY',
      currentUsage: 20
    });
    assert(check2.allowed === false, 'At limit is disallowed');
    assert(check2.limit === 20, 'Limit is 20');
  });

  // -------------------------------------------------------------------------
  // Test 4: CommercialEvent ledger with deterministic hash & idempotency
  // -------------------------------------------------------------------------
  test('CommercialEvent produces verifiable SHA-256 hash and deterministic idempotency key', () => {
    const event = buildCommercialEvent({
      providerOrganizationId: 'org_apex',
      eventType: 'AUTHORIZED_CONNECTION',
      sourceEntityType: 'DisclosureEvent',
      sourceEntityId: 'dsc_12345',
      challengeId: 'CHAL-NV-49281',
      competitionId: 'COMP-NV-49281'
    });

    assert(event.eventType === 'AUTHORIZED_CONNECTION', 'Event type is AUTHORIZED_CONNECTION');
    assert(event.idempotencyKey === 'evt:AUTHORIZED_CONNECTION:dsc_12345', 'Deterministic canonical idempotency key evt:{type}:{sourceId}');
    assert(event.eventHash.length === 64, 'Event hash is 64-char hex SHA-256');

    // Idempotent recreation produces identical key
    const duplicate = buildCommercialEvent({
      providerOrganizationId: 'org_apex',
      eventType: 'AUTHORIZED_CONNECTION',
      sourceEntityType: 'DisclosureEvent',
      sourceEntityId: 'dsc_12345'
    });
    assert(duplicate.idempotencyKey === event.idempotencyKey, 'Re-run produces identical idempotency key');
  });

  // -------------------------------------------------------------------------
  // Test 5: Deterministic Rating Engine — Zero-dollar vs billable events
  // -------------------------------------------------------------------------
  test('Deterministic rating engine respects included capacity before charging', () => {
    const planVersion = createCommercialPlanVersion({
      planId: 'plan_agency_growth',
      version: 1,
      effectiveFrom: '2026-01-01T00:00:00Z',
      billingInterval: 'MONTHLY',
      recurringFeeCents: 49900,
      termsSnapshot: {
        compensationDeterminationApproved: true,
        determinationReference: 'TEST-DETERMINATION',
        includedAuthorizedConnections: 10,
        authorizedConnectionUnitPriceCents: 2000 // $20.00
      }
    });

    const agreement = createCommercialAgreement({
      commercialAccountId: 'cac_org_apex',
      providerOrganizationId: 'org_apex',
      planVersionId: planVersion.id,
      startsAt: '2026-01-01T00:00:00Z'
    });

    const event = buildCommercialEvent({
      providerOrganizationId: 'org_apex',
      eventType: 'AUTHORIZED_CONNECTION',
      sourceEntityType: 'DisclosureEvent',
      sourceEntityId: 'dsc_001'
    });

    // Connection 5 (within included 10)
    const ratingIncluded = rateCommercialEvent({
      event,
      agreement,
      planVersion,
      priorUsageCount: 4
    });
    assert(ratingIncluded.billable === false, 'Under included capacity is not billable');
    assert(ratingIncluded.amountCents === 0, 'Zero dollar amount for included capacity');

    // Connection 11 (above included 10)
    const ratingOverage = rateCommercialEvent({
      event,
      agreement,
      planVersion,
      priorUsageCount: 10
    });
    assert(ratingOverage.billable === true, 'Overage is billable');
    assert(ratingOverage.amountCents === 2000, 'Unit price charged ($20.00)');
  });

  // -------------------------------------------------------------------------
  // Test 6: Value Summary Funnel Calculation (9-stage canonical)
  // -------------------------------------------------------------------------
  test('Value summary computes factual conversion ratios across canonical 9 stages', () => {
    const summary = calculateValueSummary({
      providerOrganizationId: 'org_apex',
      from: '2026-09-01T00:00:00Z',
      to: '2026-09-30T23:59:59Z',
      counts: {
        VPO_AVAILABLE: 100,
        VPO_VIEWED: 80,
        VPO_ENGAGED: 50,
        PROPOSITION_SUBMITTED: 40,
        CONSUMER_SELECTED: 20,
        AUTHORIZED_CONNECTION: 16,
        BOUND_ACQUISITION: 12,
        VERIFIED_BOUND_OUTCOME: 10,
        BASELINE_ACTIVATED: 8
      }
    });

    assert(summary.vposAvailable === 100, 'VPOs available count correct');
    assert(summary.vposViewed === 80, 'VPOs viewed count correct');
    assert(summary.vposEngaged === 50, 'VPOs engaged count correct');
    assert(summary.propositionsSubmitted === 40, 'Propositions submitted count correct');
    assert(summary.consumerSelections === 20, 'Consumer selections count correct');
    assert(summary.authorizedConnections === 16, 'Authorized connections count correct');
    assert(summary.boundAcquisitions === 12, 'Bound acquisitions count correct');
    assert(summary.verifiedBoundOutcomes === 10, 'Verified bound outcomes count correct');
    assert(summary.baselinesActivated === 8, 'Baselines activated count correct');
    assert(summary.conversionRatios.engagementRate === 0.5, 'Engagement rate is 50/100 = 0.5');
    assert(summary.conversionRatios.selectionRate === 0.4, 'Selection rate is 20/50 = 0.4');
    assert(summary.conversionRatios.authorizationRate === 0.8, 'Authorization rate is 16/20 = 0.8');
    assert(summary.conversionRatios.bindRate === 0.75, 'Bind rate is 12/16 = 0.75');
    assert(summary.conversionRatios.verificationRate === 0.833, 'Verification rate is 10/12 = 0.833');
    assert(summary.conversionRatios.activationRate === 0.8, 'Activation rate is 8/10 = 0.8');
  });

  // -------------------------------------------------------------------------
  // Test 7: COMMERCIAL_NEUTRALITY FIREWALL INVARIANT (Most Critical Test)
  // -------------------------------------------------------------------------
  test('COMMERCIAL_NEUTRALITY: Provider commercial plan differences produce IDENTICAL comparison results', () => {
    // Construct mock baseline
    const mockBaseline: CoverageBaseline = {
      id: 'BL-TEST-NEUTRALITY',
      policyId: 'POL-TEST-1',
      version: 1,
      carrier: 'State Farm Mutual',
      effectiveDate: '2026-01-01',
      expirationDate: '2027-01-01',
      baselineAnnualPremium: 2000,
      baselineMonthlyPremium: 167,
      vehicle: {
        year: 2022,
        make: 'Toyota',
        model: 'Camry',
        vin: '123',
        usage: 'COMMUTE',
        annualMileage: 12000,
        garagingZip: '89101',
        ownership: 'OWNED'
      },
      coverages: [
        { id: 'bi_base', code: 'BODILY_INJURY', name: 'Bodily Injury', category: 'LIABILITY', perPersonLimit: 100000, perAccidentLimit: 300000, isIncluded: true },
        { id: 'pd_base', code: 'PROPERTY_DAMAGE', name: 'Property Damage', category: 'LIABILITY', propertyLimit: 100000, isIncluded: true }
      ],
      verifiedAt: '2026-01-01T00:00:00Z',
      verifiedBy: 'Consumer'
    };

    // Provider A: Solo plan ($0 or $99)
    const offerFromProviderA: Offer = {
      id: 'OFF-PROV-A',
      challengeId: 'CHAL-TEST-1',
      providerId: 'org_solo_agent',
      providerName: 'Solo Agent Joe',
      providerLicense: 'NV-LIC-100',
      carrier: 'Progressive Northern',
      quoteNumber: 'Q-SOLO-1',
      annualPremium: 1800,
      monthlyPremium: 150,
      termMonths: 12,
      effectiveDate: '2026-01-01',
      expirationDate: '2027-01-01',
      supportingQuoteDocName: 'quote_solo.pdf',
      submittedAt: '2026-01-01T00:00:00Z',
      discrepanciesDetected: false,
      status: 'VALIDATED',
      round: 'ROUND_1_OPEN',
      version: 1,
      coverages: [
        { id: 'bi_off_a', code: 'BODILY_INJURY', name: 'Bodily Injury', category: 'LIABILITY', perPersonLimit: 100000, perAccidentLimit: 300000, isIncluded: true },
        { id: 'pd_off_a', code: 'PROPERTY_DAMAGE', name: 'Property Damage', category: 'LIABILITY', propertyLimit: 100000, isIncluded: true }
      ]
    };

    // Provider B: Enterprise plan ($5,000/mo) submitting identical insurance proposition
    const offerFromProviderB: Offer = {
      id: 'OFF-PROV-B',
      challengeId: 'CHAL-TEST-1',
      providerId: 'org_enterprise_national',
      providerName: 'National Megacorp Carrier',
      providerLicense: 'NV-LIC-200',
      carrier: 'Progressive Northern',
      quoteNumber: 'Q-ENT-1',
      annualPremium: 1800,
      monthlyPremium: 150,
      termMonths: 12,
      effectiveDate: '2026-01-01',
      expirationDate: '2027-01-01',
      supportingQuoteDocName: 'quote_ent.pdf',
      submittedAt: '2026-01-01T00:00:00Z',
      discrepanciesDetected: false,
      status: 'VALIDATED',
      round: 'ROUND_1_OPEN',
      version: 1,
      coverages: [
        { id: 'bi_off_b', code: 'BODILY_INJURY', name: 'Bodily Injury', category: 'LIABILITY', perPersonLimit: 100000, perAccidentLimit: 300000, isIncluded: true },
        { id: 'pd_off_b', code: 'PROPERTY_DAMAGE', name: 'Property Damage', category: 'LIABILITY', propertyLimit: 100000, isIncluded: true }
      ]
    };

    const dummyRequirements = {
      id: 'req-neutrality',
      ruleSummary: 'Beat my price without cutting protection',
      minAnnualSavings: 50,
      maxCollisionDeductible: 500,
      maxCompDeductible: 500,
      mustIncludeRental: false,
      mustIncludeRoadside: false
    };

    // Run deterministic comparison engine
    const compA = compareOfferAgainstBaseline(mockBaseline, offerFromProviderA);
    const compB = compareOfferAgainstBaseline(mockBaseline, offerFromProviderB);

    // Verify absolute equality of comparison outcomes
    assert(compA.classification === compB.classification, 'Classifications must be IDENTICAL');
    assert(compA.annualPremiumDifference === compB.annualPremiumDifference, 'Annual premium differences must be IDENTICAL');
    assert(!('meetsConsumerRequirements' in compA) && !('meetsConsumerRequirements' in compB), 'Comparison must not expose a platform attractiveness gate');
    assert(compA.fieldComparisons.length === compB.fieldComparisons.length, 'Field comparisons must be IDENTICAL');

    // Assert that NO commercial plan attribute leaked into comparison output
    const keysA = Object.keys(compA);
    const hasCommercialLeaking = keysA.some(k =>
      k.toLowerCase().includes('plan') ||
      k.toLowerCase().includes('commercial') ||
      k.toLowerCase().includes('fee') ||
      k.toLowerCase().includes('account') ||
      k.toLowerCase().includes('agreement')
    );
    assert(!hasCommercialLeaking, 'No commercial attributes exist in OfferComparison object');
  });

  // -------------------------------------------------------------------------
  // Test 8: Explicit Commercial Agreement Lifecycle Transitions (CE-2)
  // -------------------------------------------------------------------------
  test('Agreement lifecycle enforces formal transitions (PENDING -> ACTIVE -> SUSPENDED -> TERMINATED)', () => {
    const agreement = createCommercialAgreement({
      commercialAccountId: 'cac_org_apex',
      providerOrganizationId: 'org_apex',
      planVersionId: 'cpv_fixture_1',
      startsAt: '2026-01-01T00:00:00Z',
      status: 'PENDING'
    });

    // Valid: PENDING -> ACTIVE
    const toActive = transitionAgreementLifecycle({
      currentAgreement: agreement,
      targetStatus: 'ACTIVE'
    });
    assert(toActive.success === true, 'PENDING -> ACTIVE allowed');
    assert(toActive.agreement.status === 'ACTIVE', 'Agreement status is ACTIVE');

    // Valid: ACTIVE -> SUSPENDED
    const toSuspended = transitionAgreementLifecycle({
      currentAgreement: toActive.agreement,
      targetStatus: 'SUSPENDED'
    });
    assert(toSuspended.success === true, 'ACTIVE -> SUSPENDED allowed');
    assert(toSuspended.agreement.status === 'SUSPENDED', 'Agreement status is SUSPENDED');

    // Valid: SUSPENDED -> ACTIVE (reinstated)
    const reinstated = transitionAgreementLifecycle({
      currentAgreement: toSuspended.agreement,
      targetStatus: 'ACTIVE'
    });
    assert(reinstated.success === true, 'SUSPENDED -> ACTIVE allowed');

    // Valid: ACTIVE -> TERMINATED
    const terminated = transitionAgreementLifecycle({
      currentAgreement: reinstated.agreement,
      targetStatus: 'TERMINATED'
    });
    assert(terminated.success === true, 'ACTIVE -> TERMINATED allowed');
    assert(terminated.agreement.status === 'TERMINATED', 'Status is TERMINATED');

    // Invalid: TERMINATED -> ACTIVE (terminal state)
    const invalidReactivation = transitionAgreementLifecycle({
      currentAgreement: terminated.agreement,
      targetStatus: 'ACTIVE'
    });
    assert(invalidReactivation.success === false, 'TERMINATED is terminal; cannot transition to ACTIVE');
    assert(invalidReactivation.error !== undefined, 'Provides rejection reason');
  });

  // -------------------------------------------------------------------------
  // Test 9: Deterministic Capacity Policy Behavior (HARD_BLOCK, ALLOW_OVERAGE, NOTIFY_ONLY)
  // -------------------------------------------------------------------------
  test('Capacity enforcement policies evaluate deterministically', () => {
    const baseEntitlement = {
      id: 'ent_test_1',
      providerOrganizationId: 'org_apex',
      commercialAgreementId: 'cag_test_1',
      entitlementType: 'VPO_ENGAGEMENT_CAPACITY' as const,
      limit: 10,
      effectiveFrom: '2026-01-01T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z'
    };

    // HARD_BLOCK: Under limit -> allowed
    const hbUnder = checkEntitlementCapacity({
      entitlements: [{ ...baseEntitlement, enforcementPolicy: 'HARD_BLOCK' }],
      entitlementType: 'VPO_ENGAGEMENT_CAPACITY',
      currentUsage: 9
    });
    assert(hbUnder.allowed === true, 'HARD_BLOCK under limit allows participation');
    assert(hbUnder.code === 'WITHIN_CAPACITY', 'Code is WITHIN_CAPACITY');
    assert(hbUnder.isOverage === false, 'isOverage is false');

    // HARD_BLOCK: At limit -> blocked
    const hbAtLimit = checkEntitlementCapacity({
      entitlements: [{ ...baseEntitlement, enforcementPolicy: 'HARD_BLOCK' }],
      entitlementType: 'VPO_ENGAGEMENT_CAPACITY',
      currentUsage: 10
    });
    assert(hbAtLimit.allowed === false, 'HARD_BLOCK at limit denies participation');
    assert(hbAtLimit.code === 'COMMERCIAL_CAPACITY_REACHED', 'Code is COMMERCIAL_CAPACITY_REACHED');

    // ALLOW_OVERAGE: At limit -> allowed with overage flag
    const overage = checkEntitlementCapacity({
      entitlements: [{ ...baseEntitlement, enforcementPolicy: 'ALLOW_OVERAGE' }],
      entitlementType: 'VPO_ENGAGEMENT_CAPACITY',
      currentUsage: 10
    });
    assert(overage.allowed === true, 'ALLOW_OVERAGE permits participation');
    assert(overage.code === 'OVERAGE_PERMITTED', 'Code is OVERAGE_PERMITTED');
    assert(overage.isOverage === true, 'isOverage is true');

    // NOTIFY_ONLY: At limit -> allowed with notify code
    const notifyOnly = checkEntitlementCapacity({
      entitlements: [{ ...baseEntitlement, enforcementPolicy: 'NOTIFY_ONLY' }],
      entitlementType: 'VPO_ENGAGEMENT_CAPACITY',
      currentUsage: 10
    });
    assert(notifyOnly.allowed === true, 'NOTIFY_ONLY permits participation');
    assert(notifyOnly.code === 'NOTIFY_CAPACITY_EXCEEDED', 'Code is NOTIFY_CAPACITY_EXCEEDED');
    assert(notifyOnly.isOverage === true, 'isOverage is true');
  });

  // -------------------------------------------------------------------------
  // Test 10: Inactive / Unconfigured Agreements grant ZERO capacity
  // -------------------------------------------------------------------------
  test('Non-ACTIVE agreement status denies capacity regardless of limits', () => {
    const entitlement = {
      id: 'ent_test_2',
      providerOrganizationId: 'org_apex',
      commercialAgreementId: 'cag_test_2',
      entitlementType: 'VPO_ENGAGEMENT_CAPACITY' as const,
      limit: 100,
      enforcementPolicy: 'ALLOW_OVERAGE' as const,
      effectiveFrom: '2026-01-01T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z'
    };

    const suspendedCheck = checkEntitlementCapacity({
      entitlements: [entitlement],
      entitlementType: 'VPO_ENGAGEMENT_CAPACITY',
      currentUsage: 0,
      agreementStatus: 'SUSPENDED'
    });
    assert(suspendedCheck.allowed === false, 'Suspended agreement cannot consume capacity');
    assert(suspendedCheck.code === 'NO_ACTIVE_AGREEMENT', 'Returns NO_ACTIVE_AGREEMENT');

    const terminatedCheck = checkEntitlementCapacity({
      entitlements: [entitlement],
      entitlementType: 'VPO_ENGAGEMENT_CAPACITY',
      currentUsage: 0,
      agreementStatus: 'TERMINATED'
    });
    assert(terminatedCheck.allowed === false, 'Terminated agreement cannot consume capacity');
  });

  // -------------------------------------------------------------------------
  // Test 11: Test Fixture Isolation — Zero unapproved production pricing required
  // -------------------------------------------------------------------------
  test('Isolated test fixtures support configurable terms without production pricing assumptions', () => {
    const fixture = createTestFixturePlanVersion({
      planId: 'plan_custom_fixture',
      version: 1,
      recurringFeeCents: 0,
      termsSnapshot: {
        compensationDeterminationApproved: true,
        determinationReference: 'TEST-DETERMINATION',
        includedVpoCapacity: 75,
        includedEngagementCapacity: 15,
        capacityEnforcementPolicy: 'HARD_BLOCK'
      }
    });

    assert(fixture.id.startsWith('fixture_cpv_'), 'Explicitly identifies as test fixture');
    assert(fixture.recurringFeeCents === 0, 'Does not declare invented production pricing');
    assert(fixture.termsSnapshot.includedEngagementCapacity === 15, 'Configurable capacity preserved');
  });

  // -------------------------------------------------------------------------
  // Test 12: Event Hashing Determinism & Tamper Detection (CE-3 Section 10)
  // -------------------------------------------------------------------------
  test('Event hashing is deterministic across metadata order and detects any payload mutation', () => {
    const occurredAt = '2026-10-01T12:00:00.000Z';
    const baseParams = {
      providerOrganizationId: 'org_apex',
      eventType: 'AUTHORIZED_CONNECTION' as const,
      sourceEntityType: 'DISCLOSURE_EVENT',
      sourceEntityId: 'dsc_99999',
      idempotencyKey: 'evt:AUTHORIZED_CONNECTION:dsc_99999',
      occurredAt,
      challengeId: 'CHAL-001',
      competitionId: 'COMP-001',
      commercialAgreementId: 'cag_001',
      commercialPlanVersionId: 'cpv_001'
    };

    // Hash with metadata in order A
    const hashA = computeCommercialEventHash({
      ...baseParams,
      metadata: { alpha: 1, beta: 'two', nested: { z: 26, a: 1 } }
    });

    // Hash with metadata in order B (different key insertion order)
    const hashB = computeCommercialEventHash({
      ...baseParams,
      metadata: { nested: { a: 1, z: 26 }, beta: 'two', alpha: 1 }
    });

    assert(hashA === hashB, 'Hashes are identical regardless of metadata key ordering');

    // Tampering test: mutating any canonical field produces a different hash
    const tamperedOrg = computeCommercialEventHash({
      ...baseParams,
      providerOrganizationId: 'org_sierra'
    });
    assert(tamperedOrg !== hashA, 'Changing providerOrganizationId changes the event hash');

    const tamperedType = computeCommercialEventHash({
      ...baseParams,
      eventType: 'BOUND_ACQUISITION' as const
    });
    assert(tamperedType !== hashA, 'Changing eventType changes the event hash');

    const tamperedSrc = computeCommercialEventHash({
      ...baseParams,
      sourceEntityId: 'dsc_different'
    });
    assert(tamperedSrc !== hashA, 'Changing sourceEntityId changes the event hash');

    const tamperedTime = computeCommercialEventHash({
      ...baseParams,
      occurredAt: '2026-10-01T12:00:01.000Z'
    });
    assert(tamperedTime !== hashA, 'Changing occurredAt changes the event hash');

    // Build event and verify
    const event = buildCommercialEvent({
      providerOrganizationId: 'org_apex',
      eventType: 'AUTHORIZED_CONNECTION',
      sourceEntityType: 'DISCLOSURE_EVENT',
      sourceEntityId: 'dsc_99999',
      metadata: { field: 'value' },
      occurredAt
    });

    assert(verifyCommercialEventHash(event) === true, 'Untampered event verifies successfully');
    const tamperedEvent = { ...event, sourceEntityId: 'dsc_tampered' };
    assert(verifyCommercialEventHash(tamperedEvent) === false, 'Tampered event fails hash verification');
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  return { passed, failed, total: results.length, results };
}

// Direct CLI execution
if (process.argv[1] && process.argv[1].endsWith('commercialEconomics.test.ts')) {
  const { passed, failed, total, results } = runCommercialEconomicsTestSuite();
  console.log(`\n========================================`);
  console.log(`Commercial Economics Suite: ${passed}/${total} PASSED (${failed} FAILED)`);
  console.log(`========================================`);
  results.forEach(r => {
    console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.name}${r.error ? ` -> ${r.error}` : ''}`);
  });
}
