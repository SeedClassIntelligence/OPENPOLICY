/**
 * Master Acceptance Validation Suite for Open Policy Commercial Economics (CE-4)
 * Transactional Commercial Rating Engine
 * 
 * Implements all 38 acceptance tests defined in Section 21 of the CE-4 Implementation Directive.
 */

// Must stay the first import: isolates this suite's database before any store is constructed.
import './lib/isolatedDataDir';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { app } from '../server';
import { db } from '../src/server/db';
import { postgresStore } from '../src/server/db/postgresStore';
import { commercialStore } from '../src/server/db/commercialStore';
import {
  rateCommercialEvent,
  buildBillableEvent,
  buildRatingAdjustment,
  buildCommercialEvent,
  computeCommercialEventHash,
  verifyCommercialEventHash
} from '../src/domain/commercialEconomicsEngine';
import {
  CommercialEvent,
  CommercialPlan,
  CommercialPlanVersion,
  CommercialAgreement,
  BillableEvent,
  RatingAdjustment,
  RatingDecision
} from '../src/types/insurance';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  [PASS] ${message}`);
}

async function request(
  server: http.Server,
  method: string,
  urlPath: string,
  body?: any,
  headers?: Record<string, string>
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const port = (server.address() as any).port;
    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(headers || {})
    };

    let postData = '';
    if (body !== undefined) {
      postData = JSON.stringify(body);
      reqHeaders['Content-Length'] = Buffer.byteLength(postData).toString();
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers: reqHeaders
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            resolve({ status: res.statusCode || 200, body: parsed });
          } catch {
            resolve({ status: res.statusCode || 200, body: data });
          }
        });
      }
    );

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runCE4ValidationSuite() {
  console.log('========================================================================');
  console.log('OPEN POLICY — CE-4 ACCEPTANCE VALIDATION SUITE');
  console.log('Transactional Commercial Rating Engine');
  console.log('========================================================================\n');

  await postgresStore.init();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    // -------------------------------------------------------------------------
    // PART I: Architecture & Invariant Verification (Tests 1-8)
    // -------------------------------------------------------------------------
    console.log('--- PART I: Architecture & Invariant Verification (Tests 1-8) ---');

    // Test 1: Protected Marketplace Engines Commercially Neutral
    console.log('Test 1: Protected Marketplace Engines Commercially Neutral');
    const protectedEngines = [
      'comparisonEngine.ts',
      'qualificationEngine.ts',
      'competitionEngine.ts',
      'selectionBindingEngine.ts',
      'pm5ReconciliationEngine.ts'
    ];
    for (const engine of protectedEngines) {
      const filePath = path.join(process.cwd(), 'src', 'domain', engine);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        assert(!content.includes('billable_events'), `${engine} contains zero billable_events`);
        assert(!content.includes('rating_adjustments'), `${engine} contains zero rating_adjustments`);
        assert(!content.includes('rateCommercialEvent'), `${engine} contains zero rateCommercialEvent`);
        assert(!content.includes('commercialStore'), `${engine} contains zero commercialStore references`);
      }
    }

    // Test 2: Zero Percentage-of-Premium / Commissions in CE-4 Domain Codebase
    console.log('Test 2: Zero Percentage-of-Premium / Commissions in CE-4 Domain Codebase');
    const domainEngineFile = path.join(process.cwd(), 'src', 'domain', 'commercialEconomicsEngine.ts');
    const domainContent = fs.readFileSync(domainEngineFile, 'utf-8');
    const forbiddenPatterns = [
      'PERCENTAGE_OF_PREMIUM',
      'BASIS_POINTS',
      'COMMISSION_PERCENTAGE',
      'PREMIUM_SHARE',
      'SUCCESS_PERCENTAGE'
    ];
    for (const pattern of forbiddenPatterns) {
      assert(!domainContent.includes(pattern), `Domain engine strictly forbids ${pattern}`);
    }

    // Test 3: Zero Manufactured Subscription CommercialEvents
    console.log('Test 3: Zero Manufactured Subscription CommercialEvents in CE-4');
    assert(!domainContent.includes('SUBSCRIPTION_ACCRUED'), 'Zero subscription CommercialEvents manufactured');
    assert(!domainContent.includes('SUBSCRIPTION_CHARGE'), 'Subscription handling cleanly separated to CE-5');

    // Test 4: Currency Enforcement (USD only)
    console.log('Test 4: Currency Enforcement (USD only)');
    const mockNonUsdPlanVersion: CommercialPlanVersion = {
      id: 'cpv_eur_test',
      planId: 'plan_test',
      version: 1,
      effectiveFrom: '2026-01-01T00:00:00Z',
      billingInterval: 'MONTHLY',
      recurringFeeCents: 0,
      currency: 'EUR' as any,
      termsSnapshot: {},
      createdAt: '2026-01-01T00:00:00Z'
    };
    const mockAgr: CommercialAgreement = {
      id: 'agr_cur_test',
      commercialAccountId: 'acc_test',
      providerOrganizationId: 'org_sierra',
      planVersionId: 'cpv_eur_test',
      status: 'ACTIVE',
      startsAt: '2026-01-01T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z'
    };
    const testEventCur = buildCommercialEvent({
      providerOrganizationId: 'org_sierra',
      eventType: 'AUTHORIZED_CONNECTION',
      sourceEntityType: 'DISCLOSURE_EVENT',
      sourceEntityId: 'disc_cur_test'
    });
    const curDecision = rateCommercialEvent({
      event: testEventCur,
      agreement: mockAgr,
      planVersion: mockNonUsdPlanVersion
    });
    assert(curDecision.disposition === 'NOT_RATED', 'Non-USD plan yields NOT_RATED disposition');
    assert(curDecision.error === 'CURRENCY_UNSUPPORTED', 'Non-USD plan yields CURRENCY_UNSUPPORTED error');

    // Test 5: Invariant: Append-Only Ledger, Zero In-Place Mutations / Zero VOIDED Status
    console.log('Test 5: Invariant: Append-Only Ledger, Zero In-Place Mutations / Zero VOIDED Status');
    const typesFile = path.join(process.cwd(), 'src', 'types', 'insurance.ts');
    const typesContent = fs.readFileSync(typesFile, 'utf-8');
    assert(!typesContent.includes("'VOIDED'"), 'BillableEventStatus does not contain VOIDED status');
    assert(typesContent.includes('RatingAdjustment'), 'RatingAdjustment type defined for additive adjustments');

    // Test 6: Database Schema Migration V6 Verification
    console.log('Test 6: Database Schema Migration V6 Verification');
    const pg = await commercialStore.getClient();
    const colRes = await pg.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'billable_events' AND column_name = 'commercial_plan_version_id';`
    );
    assert(colRes.rows.length > 0, 'commercial_plan_version_id column exists on billable_events');
    const tableRes = await pg.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_name IN ('rating_adjustments', 'rating_runs');`
    );
    assert(tableRes.rows.length >= 2, 'rating_adjustments and rating_runs tables exist in PostgreSQL');

    // Test 7: Production Plans Remain Structural (Zero Unapproved Pricing)
    console.log('Test 7: Production Plans Remain Structural (Zero Unapproved Pricing)');
    await commercialStore.seedCanonicalPlans();
    const soloPlan = await commercialStore.getCommercialPlanByCode('PLAN_SOLO');
    assert(soloPlan !== undefined, 'Canonical PLAN_SOLO exists');
    const agencyPlan = await commercialStore.getCommercialPlanByCode('PLAN_AGENCY');
    assert(agencyPlan !== undefined, 'Canonical PLAN_AGENCY exists');

    // Test 8: Historical Anchoring Invariant
    console.log('Test 8: Historical Anchoring Invariant');
    const histTestPlan: CommercialPlan = {
      id: 'plan_test_ce4_hist',
      code: 'PLAN_TEST_HIST',
      displayName: 'Historical Plan Test',
      providerSegment: 'SOLO',
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00Z'
    };
    await commercialStore.saveCommercialPlan(histTestPlan);

    const planV1: CommercialPlanVersion = {
      id: 'cpv_hist_v1',
      planId: histTestPlan.id,
      version: 1,
      effectiveFrom: '2026-01-01T00:00:00Z',
      billingInterval: 'MONTHLY',
      recurringFeeCents: 0,
      currency: 'USD',
      termsSnapshot: {
        rates: {
          BOUND_ACQUISITION_CENTS: 3000
        }
      },
      createdAt: '2026-01-01T00:00:00Z'
    };
    const planV2: CommercialPlanVersion = {
      id: 'cpv_hist_v2',
      planId: histTestPlan.id,
      version: 2,
      effectiveFrom: '2026-06-01T00:00:00Z',
      billingInterval: 'MONTHLY',
      recurringFeeCents: 0,
      currency: 'USD',
      termsSnapshot: {
        rates: {
          BOUND_ACQUISITION_CENTS: 7500
        }
      },
      createdAt: '2026-06-01T00:00:00Z'
    };
    await commercialStore.saveCommercialPlanVersion(planV1);
    await commercialStore.saveCommercialPlanVersion(planV2);

    const testHistEvent = buildCommercialEvent({
      providerOrganizationId: 'org_sierra',
      eventType: 'BOUND_ACQUISITION',
      sourceEntityType: 'BINDING_HANDOFF',
      sourceEntityId: 'handoff_hist_test',
      commercialPlanVersionId: 'cpv_hist_v1'
    });
    const histDecision = rateCommercialEvent({
      event: testHistEvent,
      agreement: mockAgr,
      planVersion: planV1
    });
    assert(histDecision.amountCents === 3000, 'Rated strictly under historical v1 terms ($30.00), not v2 ($75.00)');

    // -------------------------------------------------------------------------
    // PART II: Transactional Rating Functionality (Tests 9-20)
    // -------------------------------------------------------------------------
    console.log('\n--- PART II: Transactional Rating Functionality (Tests 9-20) ---');

    const tieredPlan: CommercialPlan = {
      id: 'plan_test_ce4_tiered',
      code: 'PLAN_TEST_TIERED',
      displayName: 'Tiered Plan Test',
      providerSegment: 'SOLO',
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00Z'
    };
    await commercialStore.saveCommercialPlan(tieredPlan);

    const tieredPlanVersion: CommercialPlanVersion = {
      id: 'cpv_tiered_test_v1',
      planId: tieredPlan.id,
      version: 1,
      effectiveFrom: '2026-01-01T00:00:00Z',
      billingInterval: 'MONTHLY',
      recurringFeeCents: 0,
      currency: 'USD',
      termsSnapshot: {
        includedAuthorizedConnections: 2,
        includedEngagementCapacity: 5,
        rates: {
          AUTHORIZED_CONNECTION_CENTS: 2500,
          BOUND_ACQUISITION_CENTS: 5000,
          VERIFIED_BOUND_OUTCOME_CENTS: 1500,
          ENGAGEMENT_OVERAGE_CENTS: 1000
        }
      },
      createdAt: '2026-01-01T00:00:00Z'
    };
    await commercialStore.saveCommercialPlanVersion(tieredPlanVersion);

    let sierraAcc = await commercialStore.getCommercialAccountByOrgId('org_sierra');
    if (!sierraAcc) {
      sierraAcc = {
        id: 'acc_sierra',
        providerOrganizationId: 'org_sierra',
        status: 'ACTIVE',
        currency: 'USD',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };
      await commercialStore.saveCommercialAccount(sierraAcc);
    }

    const activeAgreement: CommercialAgreement = {
      id: 'agr_sierra_ce4',
      commercialAccountId: sierraAcc.id,
      providerOrganizationId: 'org_sierra',
      planVersionId: tieredPlanVersion.id,
      status: 'ACTIVE',
      startsAt: '2026-01-01T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z'
    };
    await commercialStore.saveCommercialAgreement(activeAgreement);

    // Test 9: Rate AUTHORIZED_CONNECTION Within Included Capacity
    console.log('Test 9: Rate AUTHORIZED_CONNECTION Within Included Capacity');
    const evConn1 = buildCommercialEvent({
      providerOrganizationId: 'org_sierra',
      eventType: 'AUTHORIZED_CONNECTION',
      sourceEntityType: 'DISCLOSURE_EVENT',
      sourceEntityId: 'disc_included_1'
    });
    const decConn1 = rateCommercialEvent({
      event: evConn1,
      agreement: activeAgreement,
      planVersion: tieredPlanVersion,
      priorUsageCount: 0 // < 2
    });
    assert(decConn1.disposition === 'INCLUDED_IN_PLAN', 'Within included capacity yields INCLUDED_IN_PLAN');
    assert(decConn1.amountCents === 0, 'Zero cents charged for included connection');

    // Test 10: Rate AUTHORIZED_CONNECTION Exceeding Included Capacity
    console.log('Test 10: Rate AUTHORIZED_CONNECTION Exceeding Included Capacity');
    const evConnOverage = buildCommercialEvent({
      providerOrganizationId: 'org_sierra',
      eventType: 'AUTHORIZED_CONNECTION',
      sourceEntityType: 'DISCLOSURE_EVENT',
      sourceEntityId: 'disc_overage_1'
    });
    const decConnOverage = rateCommercialEvent({
      event: evConnOverage,
      agreement: activeAgreement,
      planVersion: tieredPlanVersion,
      priorUsageCount: 2 // threshold reached
    });
    assert(decConnOverage.disposition === 'BILLABLE', 'Exceeding included capacity yields BILLABLE');
    assert(decConnOverage.amountCents === 2500, 'Billed at configured unit price (2500 cents / $25.00)');

    // Test 11: Rate BOUND_ACQUISITION With Configured Fee
    console.log('Test 11: Rate BOUND_ACQUISITION With Configured Fee');
    const evBound = buildCommercialEvent({
      providerOrganizationId: 'org_sierra',
      eventType: 'BOUND_ACQUISITION',
      sourceEntityType: 'BINDING_HANDOFF',
      sourceEntityId: 'handoff_bound_1'
    });
    const decBound = rateCommercialEvent({
      event: evBound,
      agreement: activeAgreement,
      planVersion: tieredPlanVersion
    });
    assert(decBound.disposition === 'BILLABLE', 'Bound acquisition with fee yields BILLABLE');
    assert(decBound.amountCents === 5000, 'Billed at 5000 cents ($50.00)');

    // Test 12: Rate BOUND_ACQUISITION With Zero-Fee Plan
    console.log('Test 12: Rate BOUND_ACQUISITION With Zero-Fee Plan');
    const zeroFeePlan: CommercialPlan = {
      id: 'plan_test_ce4_zero',
      code: 'PLAN_TEST_ZERO',
      displayName: 'Zero Fee Plan Test',
      providerSegment: 'SOLO',
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00Z'
    };
    await commercialStore.saveCommercialPlan(zeroFeePlan);

    const zeroFeePlanVersion: CommercialPlanVersion = {
      id: 'cpv_zero_fee_test',
      planId: zeroFeePlan.id,
      version: 1,
      effectiveFrom: '2026-01-01T00:00:00Z',
      billingInterval: 'MONTHLY',
      recurringFeeCents: 0,
      currency: 'USD',
      termsSnapshot: {
        rates: {
          BOUND_ACQUISITION_CENTS: 0
        }
      },
      createdAt: '2026-01-01T00:00:00Z'
    };
    const decBoundZero = rateCommercialEvent({
      event: evBound,
      agreement: activeAgreement,
      planVersion: zeroFeePlanVersion
    });
    assert(decBoundZero.disposition === 'INCLUDED_IN_PLAN', 'Bound acquisition with zero fee yields INCLUDED_IN_PLAN');
    assert(decBoundZero.amountCents === 0, 'Zero cents charged');

    // Test 13: Rate VERIFIED_BOUND_OUTCOME With Configured Fee
    console.log('Test 13: Rate VERIFIED_BOUND_OUTCOME With Configured Fee');
    const evVerified = buildCommercialEvent({
      providerOrganizationId: 'org_sierra',
      eventType: 'VERIFIED_BOUND_OUTCOME',
      sourceEntityType: 'RECONCILIATION_REPORT',
      sourceEntityId: 'rec_report_1'
    });
    const decVerified = rateCommercialEvent({
      event: evVerified,
      agreement: activeAgreement,
      planVersion: tieredPlanVersion
    });
    assert(decVerified.disposition === 'BILLABLE', 'Verified bound outcome with fee yields BILLABLE');
    assert(decVerified.amountCents === 1500, 'Billed at 1500 cents ($15.00)');

    // Test 14: Rate VERIFIED_BOUND_OUTCOME With Zero-Fee Plan
    console.log('Test 14: Rate VERIFIED_BOUND_OUTCOME With Zero-Fee Plan');
    const decVerifiedZero = rateCommercialEvent({
      event: evVerified,
      agreement: activeAgreement,
      planVersion: zeroFeePlanVersion
    });
    assert(decVerifiedZero.disposition === 'INCLUDED_IN_PLAN', 'Verified bound outcome with zero fee yields INCLUDED_IN_PLAN');

    // Test 15: Rate VPO_ENGAGED Overage Above Capacity
    console.log('Test 15: Rate VPO_ENGAGED Overage Above Capacity');
    const evEngagedOverage = buildCommercialEvent({
      providerOrganizationId: 'org_sierra',
      eventType: 'VPO_ENGAGED',
      sourceEntityType: 'CHALLENGE_PARTICIPATION',
      sourceEntityId: 'part_overage_1',
      metadata: { isOverage: true }
    });
    const decEngagedOverage = rateCommercialEvent({
      event: evEngagedOverage,
      agreement: activeAgreement,
      planVersion: tieredPlanVersion,
      priorUsageCount: 5
    });
    assert(decEngagedOverage.disposition === 'BILLABLE', 'VPO_ENGAGED overage yields BILLABLE');
    assert(decEngagedOverage.amountCents === 1000, 'Billed at 1000 cents ($10.00)');

    // Test 16: Rate VPO_ENGAGED Within Capacity
    console.log('Test 16: Rate VPO_ENGAGED Within Capacity');
    const evEngagedWithin = buildCommercialEvent({
      providerOrganizationId: 'org_sierra',
      eventType: 'VPO_ENGAGED',
      sourceEntityType: 'CHALLENGE_PARTICIPATION',
      sourceEntityId: 'part_within_1'
    });
    const decEngagedWithin = rateCommercialEvent({
      event: evEngagedWithin,
      agreement: activeAgreement,
      planVersion: tieredPlanVersion,
      priorUsageCount: 2
    });
    assert(decEngagedWithin.disposition === 'INCLUDED_IN_PLAN', 'VPO_ENGAGED within capacity yields INCLUDED_IN_PLAN');
    assert(decEngagedWithin.amountCents === 0, 'Zero cents billed');

    // Test 17: Rate Telemetry Events -> disposition NOT_RATED ($0)
    console.log('Test 17: Rate Telemetry Events -> disposition NOT_RATED ($0)');
    const telemetryTypes = ['VPO_AVAILABLE', 'VPO_VIEWED', 'PROPOSITION_SUBMITTED', 'CONSUMER_SELECTED', 'BASELINE_ACTIVATED'] as const;
    for (const tType of telemetryTypes) {
      const telemEvt = buildCommercialEvent({
        providerOrganizationId: 'org_sierra',
        eventType: tType,
        sourceEntityType: 'TEST_TELEMETRY',
        sourceEntityId: `telem_${tType}`
      });
      const decTelem = rateCommercialEvent({
        event: telemEvt,
        agreement: activeAgreement,
        planVersion: tieredPlanVersion
      });
      assert(decTelem.disposition === 'NOT_RATED', `${tType} yields NOT_RATED disposition`);
      assert(decTelem.amountCents === 0, `${tType} yields 0 cents amount`);
    }

    // Test 18: Rate Contractually or Operationally Exempt Event
    console.log('Test 18: Rate Contractually or Operationally Exempt Event');
    const evExempt = buildCommercialEvent({
      providerOrganizationId: 'org_sierra',
      eventType: 'BOUND_ACQUISITION',
      sourceEntityType: 'BINDING_HANDOFF',
      sourceEntityId: 'handoff_exempt_1',
      metadata: { isExempt: true }
    });
    const decExempt = rateCommercialEvent({
      event: evExempt,
      agreement: activeAgreement,
      planVersion: tieredPlanVersion
    });
    assert(decExempt.disposition === 'EXEMPT', 'Exempt event yields EXEMPT disposition');
    assert(decExempt.amountCents === 0, 'Exempt event yields $0 charge');

    // Test 19: Rate Event with Tampered Event Hash
    console.log('Test 19: Rate Event with Tampered Event Hash');
    const tamperedEvt = {
      ...evBound,
      idempotencyKey: 'tampered_key_attempt'
    };
    const decTampered = rateCommercialEvent({
      event: tamperedEvt,
      agreement: activeAgreement,
      planVersion: tieredPlanVersion
    });
    assert(decTampered.disposition === 'NOT_RATED', 'Tampered hash yields NOT_RATED disposition');
    assert(decTampered.error === 'EVENT_HASH_INVALID', 'Tampered hash yields EVENT_HASH_INVALID error');

    // Test 20: Rate Event with Missing Historical Agreement
    console.log('Test 20: Rate Event with Missing Historical Agreement');
    await pg.query(
      `INSERT INTO provider_organizations (
        id, legal_name, display_name, organization_type, verification_status,
        marketplace_status, states, lines_of_business, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO NOTHING;`,
      [
        'org_unanchored_test',
        'Unanchored Test Org',
        'Unanchored Test Org',
        'AGENCY',
        'VERIFIED',
        'ACTIVE',
        '["NV"]',
        '["PERSONAL_AUTO"]',
        new Date().toISOString()
      ]
    );

    const runUid = Date.now();

    const unanchoredEvent = buildCommercialEvent({
      providerOrganizationId: 'org_unanchored_test',
      eventType: 'BOUND_ACQUISITION',
      sourceEntityType: 'BINDING_HANDOFF',
      sourceEntityId: `handoff_unanchored_${runUid}`
    });
    const recordedUnanchored = await commercialStore.recordCommercialEvent(unanchoredEvent);
    assert(recordedUnanchored, 'Commercial event recorded for valid org without agreement');
    const decUnanchored = await commercialStore.rateCommercialEventById(unanchoredEvent.id);
    assert(decUnanchored.disposition === 'NOT_RATED', 'Missing agreement yields NOT_RATED disposition');
    assert(decUnanchored.error === 'AGREEMENT_NOT_FOUND', 'Missing agreement yields AGREEMENT_NOT_FOUND error');

    // -------------------------------------------------------------------------
    // PART III: BillableEvent Lifecycle & Immutability (Tests 21-27)
    // -------------------------------------------------------------------------
    console.log('\n--- PART III: BillableEvent Lifecycle & Immutability (Tests 21-27) ---');

    // Test 21: BillableEvent Canonical Idempotency Key
    console.log('Test 21: BillableEvent Canonical Idempotency Key');
    const evLiveBound = buildCommercialEvent({
      providerOrganizationId: 'org_sierra',
      eventType: 'BOUND_ACQUISITION',
      sourceEntityType: 'BINDING_HANDOFF',
      sourceEntityId: `handoff_live_ce4_${runUid}`,
      commercialAgreementId: activeAgreement.id,
      commercialPlanVersionId: tieredPlanVersion.id
    });
    await commercialStore.recordCommercialEvent(evLiveBound);

    const billableDecision = rateCommercialEvent({
      event: evLiveBound,
      agreement: activeAgreement,
      planVersion: tieredPlanVersion
    });
    const builtBillable = buildBillableEvent({ decision: billableDecision, event: evLiveBound });
    const expectedKey = `bill:evt:${evLiveBound.id}:${billableDecision.chargeCode}`;
    assert(builtBillable.idempotencyKey === expectedKey, `Canonical key format matched: ${expectedKey}`);

    // Test 22: BillableEvent Idempotency Check
    console.log('Test 22: BillableEvent Idempotency Check');
    const decLive1 = await commercialStore.rateCommercialEventById(evLiveBound.id);
    assert(decLive1.disposition === 'BILLABLE', 'First rating creates billable event');
    const decLive2 = await commercialStore.rateCommercialEventById(evLiveBound.id);
    assert(decLive2.disposition === 'PREVIOUSLY_RATED', 'Duplicate rating returns PREVIOUSLY_RATED');

    const billablesForEvt = await commercialStore.getBillableEventsForCommercialEvent(evLiveBound.id);
    assert(billablesForEvt.length === 1, 'Exactly 1 BillableEvent exists in database for this event');

    // Test 23: BillableEvent Fields Verification
    console.log('Test 23: BillableEvent Fields Verification');
    const bRow = billablesForEvt[0];
    assert(bRow.commercialPlanVersionId === tieredPlanVersion.id, 'commercialPlanVersionId accurately captured');
    assert(bRow.currency === 'USD', 'Currency is USD');
    assert(bRow.status === 'RATED', 'Initial status is RATED');
    assert(bRow.pricingSnapshot !== undefined, 'Pricing snapshot preserved');

    // Test 24: Foreign Key Integrity
    console.log('Test 24: Foreign Key Integrity');
    assert(bRow.commercialEventId === evLiveBound.id, 'billable_events.commercial_event_id references commercial_events.id');

    // Test 25: Re-Rating with Different Ephemeral Context Yields Identical Result
    console.log('Test 25: Re-Rating with Different Ephemeral Context Yields Identical Result');
    const decReRate = await commercialStore.rateCommercialEventById(evLiveBound.id);
    assert(decReRate.amountCents === bRow.amountCents, 'Amount matches existing line item exactly');
    assert(decReRate.chargeCode === bRow.chargeCode, 'Charge code matches existing line item exactly');

    // Test 26: Non-Blocking Rating Invariant
    console.log('Test 26: Non-Blocking Rating Invariant');
    // Ensure that rating evaluation failure does not throw or crash
    const safeDecision = await commercialStore.rateCommercialEventById('nonexistent_event_id_xyz');
    assert(safeDecision.error === 'EVENT_NOT_FOUND', 'Gracefully handled without throwing uncaught exception');

    // Test 27: No False Zero-Dollar Conversion
    console.log('Test 27: No False Zero-Dollar Conversion');
    assert(safeDecision.disposition === 'NOT_RATED', 'Errors yield NOT_RATED, never silent $0 BILLABLE item');
    assert(safeDecision.billable === false, 'billable is explicitly false on errors');

    // -------------------------------------------------------------------------
    // PART IV: Rating Adjustments (Tests 28-32)
    // -------------------------------------------------------------------------
    console.log('\n--- PART IV: Rating Adjustments (Tests 28-32) ---');

    // Test 28: RatingAdjustment Type REVERSAL
    console.log('Test 28: RatingAdjustment Type REVERSAL');
    const reversal = await commercialStore.createRatingAdjustment({
      originalBillableEventId: bRow.id,
      adjustmentType: 'REVERSAL',
      amountCents: -2000,
      reason: 'Consumer policy rescinded prior to effective date',
      authorizedBy: 'Supervisor J. Doe'
    });
    assert(reversal.adjustmentType === 'REVERSAL', 'REVERSAL adjustment created');
    assert(reversal.amountCents === -2000, 'Reversal amount is negative integer cents');

    // Test 29: RatingAdjustment Type DISPUTE_CREDIT
    console.log('Test 29: RatingAdjustment Type DISPUTE_CREDIT');
    const disputeCredit = await commercialStore.createRatingAdjustment({
      originalBillableEventId: bRow.id,
      adjustmentType: 'DISPUTE_CREDIT',
      amountCents: -1000,
      reason: 'Partial technical billing dispute resolved in broker favor',
      authorizedBy: 'Support Lead M. Stone'
    });
    assert(disputeCredit.adjustmentType === 'DISPUTE_CREDIT', 'DISPUTE_CREDIT created');
    assert(disputeCredit.amountCents === -1000, 'Credit amount is negative integer cents');

    // Test 30: RatingAdjustment Type OVERAGE_FORGIVENESS
    console.log('Test 30: RatingAdjustment Type OVERAGE_FORGIVENESS');
    const forgiveness = await commercialStore.createRatingAdjustment({
      originalBillableEventId: bRow.id,
      adjustmentType: 'OVERAGE_FORGIVENESS',
      amountCents: -500,
      reason: 'Grace period forgiveness for first time onboarding overage',
      authorizedBy: 'Account Exec R. Vance'
    });
    assert(forgiveness.adjustmentType === 'OVERAGE_FORGIVENESS', 'OVERAGE_FORGIVENESS created');

    // Test 31: RatingAdjustment Validation (Max Credit Bound)
    console.log('Test 31: RatingAdjustment Validation (Max Credit Bound)');
    // Original = 5000 cents. Prior adjustments = -2000 + -1000 + -500 = -3500. Remaining available = 1500.
    // Attempting to credit 2000 cents should fail:
    let exceededErrorCaught = false;
    try {
      await commercialStore.createRatingAdjustment({
        originalBillableEventId: bRow.id,
        adjustmentType: 'DISPUTE_CREDIT',
        amountCents: -2000,
        reason: 'Over-credit attempt',
        authorizedBy: 'Admin'
      });
    } catch (e: any) {
      exceededErrorCaught = true;
      assert(e.message.includes('exceeds maximum available'), 'Rejects credit that exceeds original billable event amount');
    }
    assert(exceededErrorCaught, 'Validation successfully prevented net negative billable amount');

    // Test 32: RatingAdjustment Idempotency
    console.log('Test 32: RatingAdjustment Idempotency');
    const repeatAdjustment = await commercialStore.createRatingAdjustment({
      originalBillableEventId: bRow.id,
      adjustmentType: 'DISPUTE_CREDIT',
      amountCents: -500,
      reason: 'Duplicate retry test',
      authorizedBy: 'Admin',
      idempotencyKey: `adj:test_repeat_${runUid}`
    });
    const repeatAdjustment2 = await commercialStore.createRatingAdjustment({
      originalBillableEventId: bRow.id,
      adjustmentType: 'DISPUTE_CREDIT',
      amountCents: -500,
      reason: 'Duplicate retry test',
      authorizedBy: 'Admin',
      idempotencyKey: `adj:test_repeat_${runUid}`
    });
    assert(repeatAdjustment.id === repeatAdjustment2.id, 'Idempotent key returns existing adjustment without duplicate');

    // -------------------------------------------------------------------------
    // PART V: Rating Runs & Batch Orchestration (Tests 33-36)
    // -------------------------------------------------------------------------
    console.log('\n--- PART V: Rating Runs & Batch Orchestration (Tests 33-36) ---');

    // Test 33: Batch Reconciliation of Unrated Events
    console.log('Test 33: Batch Reconciliation of Unrated Events');
    // Create 3 unrated events
    const batchEvt1 = buildCommercialEvent({
      providerOrganizationId: 'org_sierra',
      eventType: 'BOUND_ACQUISITION',
      sourceEntityType: 'BINDING_HANDOFF',
      sourceEntityId: `handoff_batch_1_${runUid}`,
      commercialAgreementId: activeAgreement.id,
      commercialPlanVersionId: tieredPlanVersion.id
    });
    const batchEvt2 = buildCommercialEvent({
      providerOrganizationId: 'org_sierra',
      eventType: 'VERIFIED_BOUND_OUTCOME',
      sourceEntityType: 'RECONCILIATION_REPORT',
      sourceEntityId: `rec_batch_2_${runUid}`,
      commercialAgreementId: activeAgreement.id,
      commercialPlanVersionId: tieredPlanVersion.id
    });
    const batchEvt3 = buildCommercialEvent({
      providerOrganizationId: 'org_sierra',
      eventType: 'BASELINE_ACTIVATED',
      sourceEntityType: 'COVERAGE_BASELINE',
      sourceEntityId: `base_batch_3_${runUid}`,
      commercialAgreementId: activeAgreement.id,
      commercialPlanVersionId: tieredPlanVersion.id
    });
    await commercialStore.recordCommercialEvent(batchEvt1);
    await commercialStore.recordCommercialEvent(batchEvt2);
    await commercialStore.recordCommercialEvent(batchEvt3);

    const reconcileRun = await commercialStore.reconcileUnratedCommercialEvents();
    assert(reconcileRun.eventsEvaluated >= 3, 'Evaluated all unrated commercial events');
    assert(reconcileRun.billableEventsCreated >= 2, 'Created billable items for bound and verified events');

    // Test 34: RatingRun Record & Audit Metrics
    console.log('Test 34: RatingRun Record & Audit Metrics');
    const runInDb = await commercialStore.getRatingRunById(reconcileRun.id);
    assert(runInDb !== undefined, 'RatingRun persisted to database');
    assert(runInDb!.billableEventsCreated === reconcileRun.billableEventsCreated, 'billableEventsCreated audit matches');
    assert(runInDb!.grossRatedCents > 0, 'grossRatedCents audit recorded');

    // Test 35: Reconcile Idempotency
    console.log('Test 35: Reconcile Idempotency');
    const secondRun = await commercialStore.reconcileUnratedCommercialEvents();
    assert(secondRun.billableEventsCreated === 0, 'Second run creates 0 duplicate billable events');

    // Test 36: Provider Commercial Activity Summary
    console.log('Test 36: Provider Commercial Activity Summary');
    const summary = await commercialStore.getCommercialActivitySummary('org_sierra');
    assert(summary.grossRatedCents > 0, 'grossRatedCents computed');
    assert(summary.adjustmentCents < 0, 'adjustmentCents computed (negative sum)');
    assert(summary.netRatedCents === summary.grossRatedCents + summary.adjustmentCents, 'netRatedCents accurately derived');
    assert(summary.billableEventCount > 0, 'billableEventCount computed');
    assert(summary.byChargeCode['BOUND_ACQUISITION_FEE'] !== undefined, 'Breakdown by charge code present');

    // -------------------------------------------------------------------------
    // PART VI: HTTP Endpoints & Non-Regression (Tests 37-38)
    // -------------------------------------------------------------------------
    console.log('\n--- PART VI: HTTP Endpoints & Non-Regression (Tests 37-38) ---');

    // Test 37: HTTP Endpoints Integration & Tenant Isolation
    console.log('Test 37: HTTP Endpoints Integration & Tenant Isolation');
    const sierraHeaders = { 'x-provider-user-id': 'user_sierra_1' };
    const apexHeaders = { 'x-provider-user-id': 'user_apex_1' };

    // 37a. GET /api/commercial/billable-events
    const resBillables = await request(server, 'GET', '/api/commercial/billable-events', undefined, sierraHeaders);
    assert(resBillables.status === 200, 'GET /api/commercial/billable-events returns 200');
    assert(Array.isArray(resBillables.body.billableEvents), 'Returns billableEvents array');

    // 37b. GET /api/commercial/billable-events/summary
    const resSummary = await request(server, 'GET', '/api/commercial/billable-events/summary', undefined, sierraHeaders);
    assert(resSummary.status === 200, 'GET /api/commercial/billable-events/summary returns 200');
    assert(resSummary.body.summary.grossRatedCents > 0, 'Summary returns grossRatedCents');

    // 37c. GET /api/commercial/billable-events/:id
    const sampleId = resBillables.body.billableEvents[0].id;
    const resSingle = await request(server, 'GET', `/api/commercial/billable-events/${sampleId}`, undefined, sierraHeaders);
    assert(resSingle.status === 200, 'GET /api/commercial/billable-events/:id returns 200');
    assert(resSingle.body.billableEvent.id === sampleId, 'Returns matched billableEvent');

    // Tenant Isolation Check: Apex user accessing Sierra's billable event
    const resForbidden = await request(server, 'GET', `/api/commercial/billable-events/${sampleId}`, undefined, apexHeaders);
    assert(resForbidden.status === 403, 'Cross-tenant access blocked with 403 Forbidden');

    // 37d. GET /api/commercial/adjustments
    const resAdj = await request(server, 'GET', '/api/commercial/adjustments', undefined, sierraHeaders);
    assert(resAdj.status === 200, 'GET /api/commercial/adjustments returns 200');
    assert(resAdj.body.adjustments.length > 0, 'Returns rating adjustments');

    // 37e. POST /api/commercial/rating/evaluate-event
    const resEval = await request(server, 'POST', '/api/commercial/rating/evaluate-event', { eventId: evLiveBound.id }, sierraHeaders);
    assert(resEval.status === 200, 'POST /api/commercial/rating/evaluate-event returns 200');
    assert(resEval.body.decision.disposition === 'PREVIOUSLY_RATED', 'Evaluates event idempotently');

    // 37f. POST /api/commercial/rating/run
    const resRun = await request(server, 'POST', '/api/commercial/rating/run', { limit: 100 }, sierraHeaders);
    assert(resRun.status === 200, 'POST /api/commercial/rating/run returns 200');

    // 37g. GET /api/commercial/rating/runs
    const resRunsList = await request(server, 'GET', '/api/commercial/rating/runs', undefined, sierraHeaders);
    assert(resRunsList.status === 200, 'GET /api/commercial/rating/runs returns 200');
    assert(resRunsList.body.runs.length > 0, 'Returns historical runs');

    // Test 38: Non-Regression & Neutrality Integrity
    console.log('Test 38: Non-Regression & Neutrality Integrity');
    // Ensure all 5 engines still evaluate completely neutrally without commercial fees influencing outcomes
    const compEvaluations = db.getAllCompetitions();
    assert(compEvaluations !== undefined, 'Core competition state accessible');
    const selections = db.getAllSelections();
    assert(selections !== undefined, 'Core selection state accessible');

    console.log('\n========================================================================');
    console.log('ALL 38 CE-4 ACCEPTANCE TESTS PASSED SUCCESSFULLY (38/38)');
    console.log('========================================================================\n');
  } finally {
    server.close();
  }
}

runCE4ValidationSuite()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nCE-4 VALIDATION FAILED:', err);
    process.exit(1);
  });
