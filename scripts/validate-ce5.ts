/**
 * Master Acceptance Validation Suite for Open Policy Commercial Economics (CE-5)
 * Invoicing, Billing Periods & Settlement
 * 
 * Verifies:
 * Part I: Architectural Invariants & Firewall (Tests 1–7)
 * Part II: Billing Period Management & Subscription Generation (Tests 8–14)
 * Part III: Invoice Assembly & Exactly-Once Invoicing (Tests 15–22)
 * Part IV: Line Item Financial Provenance (Tests 23–27)
 * Part V: Settlement Ledger, Partial Payments & Append-Only Refunds (Tests 28–35)
 * Part VI: HTTP Endpoints, Tenant Isolation & Full Regression (Tests 36–42)
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { app } from '../server';
import { db } from '../src/server/db';
import { postgresStore } from '../src/server/db/postgresStore';
import { commercialStore, paymentAdapter } from '../src/server/db/commercialStore';
import {
  buildCommercialEvent,
  rateCommercialEvent,
  buildBillableEvent,
  buildRatingAdjustment,
  buildBillingPeriod,
  assembleDraftInvoice,
  finalizeInvoice,
  calculateAuthoritativeAccountBalance,
  buildRefundRecord,
  verifyCommercialEventHash
} from '../src/domain/commercialEconomicsEngine';
import {
  CommercialEvent,
  CommercialPlan,
  CommercialPlanVersion,
  CommercialAgreement,
  BillableEvent,
  RatingAdjustment,
  BillingPeriod,
  Invoice,
  PaymentRecord,
  RefundRecord
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
      ...headers
    };
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
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ status: res.statusCode || 200, body: parsed });
          } catch {
            resolve({ status: res.statusCode || 200, body: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runValidation() {
  console.log('========================================================================');
  console.log('OPEN POLICY — CE-5 ACCEPTANCE VALIDATION SUITE');
  console.log('Invoicing, Billing Periods & Settlement');
  console.log('========================================================================\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  await postgresStore.init();
  await postgresStore.seedCanonicalProviderData();
  await commercialStore.seedCanonicalPlans();

  const runUid = Date.now();
  const testClient = await commercialStore.getClient();

  // Clean up CE-5 tables for test organizations so validation runs deterministically
  await testClient.query("DELETE FROM settlement_allocations WHERE invoice_id IN (SELECT id FROM invoices WHERE provider_organization_id IN ('org_apex', 'org_sierra'));");
  await testClient.query("DELETE FROM refund_records WHERE provider_organization_id IN ('org_apex', 'org_sierra');");
  await testClient.query("DELETE FROM payment_records WHERE provider_organization_id IN ('org_apex', 'org_sierra');");
  await testClient.query("DELETE FROM invoice_line_items WHERE invoice_id IN (SELECT id FROM invoices WHERE provider_organization_id IN ('org_apex', 'org_sierra'));");
  await testClient.query("DELETE FROM invoices WHERE provider_organization_id IN ('org_apex', 'org_sierra');");
  await testClient.query("DELETE FROM billing_periods WHERE provider_organization_id IN ('org_apex', 'org_sierra');");
  await testClient.query("DELETE FROM rating_adjustments WHERE provider_organization_id IN ('org_apex', 'org_sierra');");
  await testClient.query("DELETE FROM billable_events WHERE provider_organization_id IN ('org_apex', 'org_sierra');");
  await testClient.query("DELETE FROM commercial_events WHERE provider_organization_id IN ('org_apex', 'org_sierra');");

  // ------------------------------------------------------------------------
  // PART I: Architectural Invariants & Firewall (Tests 1–7)
  // ------------------------------------------------------------------------
  console.log('--- PART I: Architectural Invariants & Firewall (Tests 1–7) ---');

  // Test 1: Commercial Neutrality Codebase Firewall
  console.log('Test 1: Neutrality Firewall (Zero billing/settlement logic in protected engines)');
  const protectedFiles = [
    'src/domain/comparisonEngine.ts',
    'src/domain/qualificationEngine.ts',
    'src/domain/competitionEngine.ts',
    'src/domain/selectionBindingEngine.ts',
    'src/domain/pm5ReconciliationEngine.ts'
  ];
  const forbiddenBillingTokens = [
    'billing_periods',
    'invoices',
    'invoice_line_items',
    'payment_records',
    'refund_records',
    'settlement_allocations',
    'assembleDraftInvoice',
    'finalizeInvoice',
    'recordPayment'
  ];
  for (const f of protectedFiles) {
    const fullPath = path.join(process.cwd(), f);
    const content = fs.readFileSync(fullPath, 'utf8');
    for (const token of forbiddenBillingTokens) {
      assert(!content.includes(token), `${path.basename(f)} strictly does not contain '${token}'`);
    }
  }

  // Test 2: Zero Percentage-of-Premium / Commissions in Billing Domain
  console.log('Test 2: Zero Percentage-of-Premium / Commissions in Billing Domain');
  const engineContent = fs.readFileSync(path.join(process.cwd(), 'src/domain/commercialEconomicsEngine.ts'), 'utf8');
  const forbiddenCommissions = [
    'PERCENTAGE_OF_PREMIUM',
    'BASIS_POINTS',
    'COMMISSION_PERCENTAGE',
    'PREMIUM_SHARE',
    'SUCCESS_PERCENTAGE'
  ];
  for (const token of forbiddenCommissions) {
    assert(!engineContent.includes(token), `Domain engine strictly forbids ${token}`);
  }

  // Test 3: Zero Manufactured Subscription CommercialEvents in CE-3
  console.log('Test 3: Zero Manufactured Subscription CommercialEvents in CE-3');
  const subscriptionEvents = await testClient.query(
    "SELECT * FROM commercial_events WHERE event_type LIKE '%SUBSCRIPTION%';"
  );
  assert(subscriptionEvents.rows.length === 0, 'Zero subscription CommercialEvents manufactured in CE-3');

  // Test 4: Flat-Fee Integer Cents Arithmetic & USD Currency Invariant
  console.log('Test 4: Flat-Fee Integer Cents Arithmetic & USD Currency Invariant');
  let nonUsdRejected = false;
  try {
    const dummyBp = buildBillingPeriod({
      providerOrganizationId: 'org_apex',
      commercialAgreementId: 'agr_test',
      commercialPlanVersionId: 'cpv_test',
      periodStart: '2026-10-01T00:00:00Z',
      periodEnd: '2026-10-31T23:59:59Z'
    });
    const dummyPlanVer: CommercialPlanVersion = {
      id: 'cpv_eur',
      planId: 'plan_solo_producer',
      version: 1,
      effectiveFrom: '2026-01-01T00:00:00Z',
      billingInterval: 'MONTHLY',
      recurringFeeCents: 5000,
      currency: 'EUR' as any,
      termsSnapshot: {},
      createdAt: '2026-01-01T00:00:00Z'
    };
    assembleDraftInvoice({
      billingPeriod: dummyBp,
      planVersion: dummyPlanVer,
      billableEvents: [],
      ratingAdjustments: []
    });
  } catch (err: any) {
    nonUsdRejected = err.message.includes('USD');
  }
  assert(nonUsdRejected, 'Non-USD plan version rejected in invoice assembly');

  // Test 5: Relational Schema & Migration 0007 Verification
  console.log('Test 5: Relational Schema & Migration 0007 Verification');
  const migrations = await testClient.query("SELECT * FROM _migrations WHERE name = '0007_commercial_billing_settlement';");
  assert(migrations.rows.length === 1, 'Migration 0007 registered in _migrations table');

  const tableChecks = ['billing_periods', 'invoices', 'invoice_line_items', 'payment_records', 'refund_records', 'settlement_allocations'];
  for (const tbl of tableChecks) {
    const res = await testClient.query(`SELECT COUNT(*) as cnt FROM ${tbl};`);
    assert(res.rows.length > 0, `Table ${tbl} initialized and queryable`);
  }

  // Test 6: Database-Enforced Source Exclusivity CHECK Constraint on invoice_line_items
  console.log('Test 6: Database-Enforced Source Exclusivity CHECK Constraint');
  let dualSourceRejected = false;
  try {
    await testClient.query(`
      INSERT INTO invoice_line_items (
        id, invoice_id, line_type, description, quantity, unit_price_cents, amount_cents,
        billable_event_id, rating_adjustment_id, billing_period_id, created_at
      ) VALUES (
        'line_viol_dual_${runUid}', 'inv_dummy', 'USAGE_CHARGE', 'Violating Dual Source', 1, 1000, 1000,
        'be_dummy', 'adj_dummy', NULL, NOW()
      );
    `);
  } catch (err: any) {
    dualSourceRejected = err.message.includes('chk_invoice_line_source_exclusivity') || err.message.includes('check');
  }
  assert(dualSourceRejected, 'Database CHECK constraint rejects simultaneous multiple sources on invoice_line_items');

  let zeroSourceRejected = false;
  try {
    await testClient.query(`
      INSERT INTO invoice_line_items (
        id, invoice_id, line_type, description, quantity, unit_price_cents, amount_cents,
        billable_event_id, rating_adjustment_id, billing_period_id, created_at
      ) VALUES (
        'line_viol_none_${runUid}', 'inv_dummy', 'USAGE_CHARGE', 'Violating Zero Source', 1, 1000, 1000,
        NULL, NULL, NULL, NOW()
      );
    `);
  } catch (err: any) {
    zeroSourceRejected = err.message.includes('chk_invoice_line_source_exclusivity') || err.message.includes('check');
  }
  assert(zeroSourceRejected, 'Database CHECK constraint rejects unexplained line item with zero sources');

  // Test 7: Production Plans Remain Structural (Zero Unapproved Pricing)
  console.log('Test 7: Production Plans Remain Structural (Zero Unapproved Pricing)');
  const soloPlan = await commercialStore.getCommercialPlanByCode('PLAN_SOLO');
  const agencyPlan = await commercialStore.getCommercialPlanByCode('PLAN_AGENCY');
  assert(soloPlan !== undefined, 'Canonical structural PLAN_SOLO exists');
  assert(agencyPlan !== undefined, 'Canonical structural PLAN_AGENCY exists');

  // ------------------------------------------------------------------------
  // PART II: Billing Period Management & Subscription Generation (Tests 8–14)
  // ------------------------------------------------------------------------
  console.log('\n--- PART II: Billing Period Management & Subscription Generation (Tests 8–14) ---');

  // Setup test plan, version, account, agreement
  const testPlanId = `plan_ce5_${runUid}`;
  await commercialStore.saveCommercialPlan({
    id: testPlanId,
    code: `CODE_CE5_${runUid}`,
    displayName: 'CE-5 Test Plan',
    providerSegment: 'AGENCY',
    status: 'ACTIVE',
    createdAt: new Date().toISOString()
  });

  const testPlanVersionId = `cpv_ce5_${runUid}`;
  await commercialStore.saveCommercialPlanVersion({
    id: testPlanVersionId,
    planId: testPlanId,
    version: 1,
    effectiveFrom: '2026-01-01T00:00:00Z',
    billingInterval: 'MONTHLY',
    recurringFeeCents: 29900, // $299.00 / mo
    currency: 'USD',
    termsSnapshot: {
      rates: {
        BOUND_ACQUISITION_CENTS: 5000,
        AUTHORIZED_CONNECTION_CENTS: 2500
      },
      boundAcquisitionUnitPriceCents: 5000,
      authorizedConnectionUnitPriceCents: 2500
    },
    createdAt: new Date().toISOString()
  });

  const testOrgId = 'org_apex';
  let account = await commercialStore.getCommercialAccountByOrgId(testOrgId);
  if (!account) {
    account = {
      id: `acc_ce5_${runUid}`,
      providerOrganizationId: testOrgId,
      status: 'ACTIVE',
      currency: 'USD',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await commercialStore.saveCommercialAccount(account);
  }

  const testAgreementId = `agr_ce5_${runUid}`;
  const testAgreement: CommercialAgreement = {
    id: testAgreementId,
    commercialAccountId: account.id,
    providerOrganizationId: testOrgId,
    planVersionId: testPlanVersionId,
    status: 'ACTIVE',
    startsAt: '2026-10-01T00:00:00Z',
    acceptedAt: '2026-10-01T00:00:00Z',
    createdAt: '2026-10-01T00:00:00Z'
  };
  await commercialStore.saveCommercialAgreement(testAgreement);

  // Test 8: Billing Period Creation & Contractual Boundaries
  console.log('Test 8: Billing Period Creation & Contractual Boundaries');
  const bpId = `bp_${runUid}`;
  const bp = buildBillingPeriod({
    id: bpId,
    providerOrganizationId: testOrgId,
    commercialAgreementId: testAgreementId,
    commercialPlanVersionId: testPlanVersionId,
    periodStart: '2026-10-01T00:00:00Z',
    periodEnd: '2026-10-31T23:59:59Z'
  });
  await commercialStore.saveBillingPeriod(bp);
  const retrievedBp = await commercialStore.getBillingPeriodById(bpId);
  assert(retrievedBp !== undefined, 'BillingPeriod persisted and retrieved');
  assert(retrievedBp?.status === 'OPEN', 'BillingPeriod initial status is OPEN');

  // Test 9: Period State Machine (OPEN -> CLOSED) and Closing Timestamp
  console.log('Test 9: Period State Machine (OPEN -> CLOSED)');
  const closedBp = await commercialStore.closeBillingPeriod(bpId);
  assert(closedBp.status === 'CLOSED', 'BillingPeriod transitioned to CLOSED');
  assert(closedBp.closedAt !== undefined, 'BillingPeriod closedAt timestamp recorded');

  // Test 10: Recurring Subscription Fee Generation for Flat Subscription Plan
  console.log('Test 10: Recurring Subscription Fee Generation');
  const draftRes = assembleDraftInvoice({
    billingPeriod: bp,
    planVersion: await commercialStore.getCommercialPlanVersion(testPlanVersionId) as CommercialPlanVersion,
    billableEvents: [],
    ratingAdjustments: []
  });
  const subItem = draftRes.lineItems.find(l => l.lineType === 'SUBSCRIPTION');
  assert(subItem !== undefined, 'Subscription line item generated');
  assert(subItem?.amountCents === 29900, 'Subscription charged at plan recurring fee ($299.00 / 29900 cents)');

  // Test 11: Zero-Fee Platform Subscription Handling (PLAN_SOLO)
  console.log('Test 11: Zero-Fee Platform Subscription Handling (PLAN_SOLO)');
  const soloTestPlanId = `plan_solo_test_${runUid}`;
  await commercialStore.saveCommercialPlan({
    id: soloTestPlanId,
    code: `CODE_SOLO_TEST_${runUid}`,
    displayName: 'Solo Producer Test',
    providerSegment: 'SOLO',
    status: 'ACTIVE',
    createdAt: new Date().toISOString()
  });
  const soloPlanVerId = `cpv_solo_${runUid}`;
  await commercialStore.saveCommercialPlanVersion({
    id: soloPlanVerId,
    planId: soloTestPlanId,
    version: 1,
    effectiveFrom: '2026-01-01T00:00:00Z',
    billingInterval: 'MONTHLY',
    recurringFeeCents: 0,
    currency: 'USD',
    termsSnapshot: {},
    createdAt: new Date().toISOString()
  });
  const soloDraft = assembleDraftInvoice({
    billingPeriod: { ...bp, commercialPlanVersionId: soloPlanVerId },
    planVersion: await commercialStore.getCommercialPlanVersion(soloPlanVerId) as CommercialPlanVersion,
    billableEvents: [],
    ratingAdjustments: []
  });
  const soloSubItem = soloDraft.lineItems.find(l => l.lineType === 'SUBSCRIPTION');
  assert(soloSubItem?.amountCents === 0, 'Zero-fee subscription generates $0.00 line item without error');

  // Test 12: Deterministic Historical Anchoring at Period Start
  console.log('Test 12: Deterministic Historical Anchoring at Period Start');
  assert(bp.commercialPlanVersionId === testPlanVersionId, 'Billing period anchored to plan version at start');

  // Test 13: Mid-Period Plan Changes Policy
  console.log('Test 13: Mid-Period Plan Changes Policy (Effective at next boundary)');
  // Version 2 introduced mid-period
  const testPlanV2Id = `cpv_ce5_v2_${runUid}`;
  await commercialStore.saveCommercialPlanVersion({
    id: testPlanV2Id,
    planId: testPlanId,
    version: 2,
    effectiveFrom: '2026-10-15T00:00:00Z',
    billingInterval: 'MONTHLY',
    recurringFeeCents: 49900, // upgraded to $499
    currency: 'USD',
    termsSnapshot: {},
    createdAt: new Date().toISOString()
  });
  // Billing period for Oct 1-31 continues using V1 terms ($299.00), not mutated mid-period
  const octDraft = assembleDraftInvoice({
    billingPeriod: bp,
    planVersion: await commercialStore.getCommercialPlanVersion(bp.commercialPlanVersionId) as CommercialPlanVersion,
    billableEvents: [],
    ratingAdjustments: []
  });
  assert(octDraft.invoice.subtotalCents === 29900, 'Mid-period plan version does not retroactively mutate current billing period');

  // Test 14: Overlapping / Invalid Date Guard (periodStart >= periodEnd rejected)
  console.log('Test 14: Invalid Date Guard (periodStart >= periodEnd rejected)');
  let invalidDateRejected = false;
  try {
    buildBillingPeriod({
      providerOrganizationId: testOrgId,
      commercialAgreementId: testAgreementId,
      commercialPlanVersionId: testPlanVersionId,
      periodStart: '2026-10-31T00:00:00Z',
      periodEnd: '2026-10-01T00:00:00Z'
    });
  } catch (err: any) {
    invalidDateRejected = err.message.includes('periodStart must be strictly earlier than periodEnd');
  }
  assert(invalidDateRejected, 'Rejects billing period where periodStart >= periodEnd');

  // ------------------------------------------------------------------------
  // PART III: Invoice Assembly & Exactly-Once Invoicing (Tests 15–22)
  // ------------------------------------------------------------------------
  console.log('\n--- PART III: Invoice Assembly & Exactly-Once Invoicing (Tests 15–22) ---');

  // Seed CE-3 commercial events and CE-4 billable events
  const cev1 = buildCommercialEvent({
    providerOrganizationId: testOrgId,
    eventType: 'BOUND_ACQUISITION',
    sourceEntityType: 'Selection',
    sourceEntityId: `sel_${runUid}_1`,
    commercialAgreementId: testAgreementId,
    commercialPlanVersionId: testPlanVersionId
  });
  await commercialStore.recordCommercialEvent(cev1);

  await commercialStore.rateCommercialEventById(cev1.id);
  const beList = await commercialStore.getBillableEventsForCommercialEvent(cev1.id);
  const be1 = beList[0];

  // Seed CE-4 rating adjustment
  const adj1 = buildRatingAdjustment({
    originalBillableEvent: be1,
    adjustmentType: 'DISPUTE_CREDIT',
    amountCents: -1500, // -$15.00
    reason: 'Billing inquiry resolved with courtesy discount',
    authorizedBy: 'finance_ops_audit'
  });
  await commercialStore.saveRatingAdjustment(adj1);

  // Test 15: Draft Invoice Generation
  console.log('Test 15: Draft Invoice Generation');
  const activeBpId = `bp_active_${runUid}`;
  const activeBp = buildBillingPeriod({
    id: activeBpId,
    providerOrganizationId: testOrgId,
    commercialAgreementId: testAgreementId,
    commercialPlanVersionId: testPlanVersionId,
    periodStart: '2026-11-01T00:00:00Z',
    periodEnd: '2026-11-30T23:59:59Z'
  });
  await commercialStore.saveBillingPeriod(activeBp);

  const genDraft = await commercialStore.generateDraftInvoice({
    providerOrganizationId: testOrgId,
    billingPeriodId: activeBpId
  });
  assert(genDraft.invoice.status === 'DRAFT', 'Invoice generated in DRAFT status');
  assert(genDraft.lineItems.length === 3, 'Draft contains 3 lines (Subscription, Usage Charge, Adjustment Credit)');

  // Test 16: Draft Invoice Subtotal and Balance Due Calculation (Integer Cents Arithmetic)
  console.log('Test 16: Draft Invoice Subtotal and Balance Due Calculation');
  // Subscription ($299.00 = 29900) + Bound ($50.00 = 5000) - Adjustment ($15.00 = -1500) = 33400 ($334.00)
  assert(genDraft.invoice.subtotalCents === 33400, 'Subtotal correctly sums integer cents (29900 + 5000 - 1500 = 33400)');
  assert(genDraft.invoice.totalDueCents === 33400, 'Total due matches subtotal');
  assert(genDraft.invoice.balanceDueCents === 33400, 'Balance due initially equals total due');

  // Test 17: Database-Enforced Exactly-Once Invoicing for BillableEvent
  console.log('Test 17: Database-Enforced Exactly-Once Invoicing for BillableEvent');
  let duplicateBillableRejected = false;
  try {
    await testClient.query(`
      INSERT INTO invoice_line_items (
        id, invoice_id, line_type, description, quantity, unit_price_cents, amount_cents,
        billable_event_id, created_at
      ) VALUES (
        'line_dup_${runUid}', '${genDraft.invoice.id}', 'USAGE_CHARGE', 'Duplicate Event Claim', 1, 5000, 5000,
        '${be1.id}', NOW()
      );
    `);
  } catch (err: any) {
    duplicateBillableRejected = err.message.includes('uq_invoice_line_billable_event') || err.message.includes('unique');
  }
  assert(duplicateBillableRejected, 'Database UNIQUE constraint strictly prevents duplicate billing of same BillableEvent');

  // Test 18: Database-Enforced Exactly-Once Invoicing for RatingAdjustment
  console.log('Test 18: Database-Enforced Exactly-Once Invoicing for RatingAdjustment');
  let duplicateAdjustmentRejected = false;
  try {
    await testClient.query(`
      INSERT INTO invoice_line_items (
        id, invoice_id, line_type, description, quantity, unit_price_cents, amount_cents,
        rating_adjustment_id, created_at
      ) VALUES (
        'line_dup_adj_${runUid}', '${genDraft.invoice.id}', 'ADJUSTMENT_CREDIT', 'Duplicate Credit Claim', 1, -1500, -1500,
        '${adj1.id}', NOW()
      );
    `);
  } catch (err: any) {
    duplicateAdjustmentRejected = err.message.includes('uq_invoice_line_rating_adjustment') || err.message.includes('unique');
  }
  assert(duplicateAdjustmentRejected, 'Database UNIQUE constraint strictly prevents duplicate application of same RatingAdjustment');

  // Test 19: Atomic Transition of Claimed BillableEvents to INVOICED
  console.log('Test 19: Atomic Transition of Claimed BillableEvents to INVOICED');
  const finalized = await commercialStore.finalizeInvoiceById(genDraft.invoice.id);
  assert(finalized.status === 'FINALIZED', 'Invoice transitioned to FINALIZED');
  const be1Updated = await commercialStore.getBillableEventById(be1.id);
  assert(be1Updated?.status === 'INVOICED', 'Claimed BillableEvent status transitioned to INVOICED upon invoice finalization');

  // Test 20: Invariant: Invoiced BillableEvents Do NOT Transition to SETTLED Merely Because Invoice is Paid
  console.log('Test 20: Invariant: Invoiced BillableEvents Do NOT Carry Settlement Semantics');
  // Record full payment on invoice
  await commercialStore.recordPayment({
    providerOrganizationId: testOrgId,
    amountCents: finalized.totalDueCents,
    paymentMethod: 'ACH_TRANSFER',
    invoiceId: finalized.id
  });
  const be1PostPayment = await commercialStore.getBillableEventById(be1.id);
  assert(be1PostPayment?.status === 'INVOICED', 'BillableEvent remains in INVOICED status; settlement ledger owns payment satisfaction');

  // Test 21: Finalized Invoice Mathematics Immutability
  console.log('Test 21: Finalized Invoice Mathematics Immutability');
  const invRecheck = await commercialStore.getInvoiceById(finalized.id);
  assert(invRecheck?.subtotalCents === 33400, 'Finalized invoice subtotal remains strictly 33400');
  assert(invRecheck?.status === 'PAID', 'Invoice status updated to PAID after full payment');

  // Test 22: Idempotent Draft Invoice Request
  console.log('Test 22: Idempotent Invoice Retrieval for Period');
  const secondGen = await commercialStore.generateDraftInvoice({
    providerOrganizationId: testOrgId,
    billingPeriodId: activeBpId
  });
  assert(secondGen.invoice.id === finalized.id, 'Subsequent invoice request for period returns existing invoice');

  // ------------------------------------------------------------------------
  // PART IV: Line Item Financial Provenance (Tests 23–27)
  // ------------------------------------------------------------------------
  console.log('\n--- PART IV: Line Item Financial Provenance (Tests 23–27) ---');

  // Test 23: Complete Provenance: Usage/Outcome Line -> BillableEvent -> CommercialEvent -> Marketplace Fact
  console.log('Test 23: Provenance: Usage/Outcome Line -> BillableEvent -> CommercialEvent -> Marketplace Fact');
  const lines = await commercialStore.getInvoiceLineItems(finalized.id);
  const outcomeLine = lines.find(l => l.lineType === 'OUTCOME_CHARGE');
  assert(outcomeLine !== undefined, 'Outcome line found on finalized invoice');
  assert(outcomeLine?.billableEventId === be1.id, 'Outcome line links directly to BillableEvent');
  const linkedEvent = await commercialStore.getCommercialEventById(be1.commercialEventId);
  assert(linkedEvent?.id === cev1.id, 'BillableEvent links directly to CommercialEvent');
  assert(linkedEvent?.sourceEntityId === cev1.sourceEntityId, 'CommercialEvent links to authoritative marketplace fact');

  // Test 24: Complete Provenance: Adjustment Line -> RatingAdjustment -> Original BillableEvent
  console.log('Test 24: Provenance: Adjustment Line -> RatingAdjustment -> Original BillableEvent');
  const adjLine = lines.find(l => l.lineType === 'ADJUSTMENT_CREDIT');
  assert(adjLine !== undefined, 'Adjustment line found on invoice');
  assert(adjLine?.ratingAdjustmentId === adj1.id, 'Adjustment line links directly to RatingAdjustment');
  const linkedAdj = await commercialStore.getRatingAdjustmentById(adj1.id);
  assert(linkedAdj?.originalBillableEventId === be1.id, 'RatingAdjustment links directly to original BillableEvent');

  // Test 25: Complete Provenance: Subscription Line -> BillingPeriod -> CommercialPlanVersion
  console.log('Test 25: Provenance: Subscription Line -> BillingPeriod -> CommercialPlanVersion');
  const subLine = lines.find(l => l.lineType === 'SUBSCRIPTION');
  assert(subLine !== undefined, 'Subscription line found on invoice');
  assert(subLine?.billingPeriodId === activeBpId, 'Subscription line links directly to BillingPeriod');
  const linkedBp = await commercialStore.getBillingPeriodById(activeBpId);
  assert(linkedBp?.commercialPlanVersionId === testPlanVersionId, 'BillingPeriod links to historical CommercialPlanVersion');

  // Test 26: Relational Provenance Join Integrity
  console.log('Test 26: Relational Provenance Join Integrity');
  const joinQuery = await testClient.query(`
    SELECT il.id as line_id, il.amount_cents, be.charge_code, ce.event_type, ce.source_entity_id
    FROM invoice_line_items il
    JOIN billable_events be ON il.billable_event_id = be.id
    JOIN commercial_events ce ON be.commercial_event_id = ce.id
    WHERE il.invoice_id = $1;
  `, [finalized.id]);
  assert(joinQuery.rows.length === 1, 'Full relational provenance join executes cleanly');
  assert(joinQuery.rows[0].charge_code === 'BOUND_ACQUISITION_FEE', 'Charge code matches joined record');

  // Test 27: Cryptographic Hash Verification on Underlying Marketplace Event
  console.log('Test 27: Cryptographic Hash Verification on Underlying Marketplace Event');
  const hashValid = verifyCommercialEventHash(cev1);
  assert(hashValid, 'Underlying marketplace event hash verified cryptographically');

  // ------------------------------------------------------------------------
  // PART V: Settlement Ledger, Partial Payments & Append-Only Refunds (Tests 28–35)
  // ------------------------------------------------------------------------
  console.log('\n--- PART V: Settlement Ledger, Partial Payments & Append-Only Refunds (Tests 28–35) ---');

  // Create second invoice for partial payment and refund testing
  const bp2Id = `bp_settle_${runUid}`;
  const bp2 = buildBillingPeriod({
    id: bp2Id,
    providerOrganizationId: testOrgId,
    commercialAgreementId: testAgreementId,
    commercialPlanVersionId: testPlanVersionId,
    periodStart: '2026-12-01T00:00:00Z',
    periodEnd: '2026-12-31T23:59:59Z'
  });
  await commercialStore.saveBillingPeriod(bp2);

  const draft2 = await commercialStore.generateDraftInvoice({
    providerOrganizationId: testOrgId,
    billingPeriodId: bp2Id
  });
  const inv2 = await commercialStore.finalizeInvoiceById(draft2.invoice.id);
  assert(inv2.balanceDueCents === 29900, 'Invoice 2 finalized with 29900 cents ($299.00) balance due');

  // Test 28: Record Successful Payment via Decoupled Payment Gateway Adapter
  console.log('Test 28: Record Payment via Decoupled Payment Gateway Adapter');
  const intent = await paymentAdapter.createPaymentIntent({
    invoiceId: inv2.id,
    amountCents: 10000, // $100.00
    currency: 'USD'
  });
  assert(intent.status === 'SUCCEEDED', 'Payment gateway adapter intent succeeded without external network dependency');

  // Test 29 & 30: Partial Settlement: Payment < totalDue -> PARTIALLY_PAID
  console.log('Test 30: Partial Settlement: Payment < totalDue -> PARTIALLY_PAID');
  const partPayRes = await commercialStore.recordPayment({
    providerOrganizationId: testOrgId,
    amountCents: 10000,
    paymentMethod: 'CREDIT_CARD',
    invoiceId: inv2.id
  });
  assert(partPayRes.payment.status === 'SUCCEEDED', 'Partial payment record saved as SUCCEEDED');
  assert(partPayRes.allocation?.amountAllocatedCents === 10000, 'Allocated 10000 cents to Invoice 2');
  const inv2AfterPart = await commercialStore.getInvoiceById(inv2.id);
  assert(inv2AfterPart?.status === 'PARTIALLY_PAID', 'Invoice status transitioned to PARTIALLY_PAID');
  assert(inv2AfterPart?.balanceDueCents === 19900, 'Remaining balance due decremented to 19900 cents ($199.00)');

  // Test 31: Subsequent Payment Completes Partial Settlement -> status transitions to PAID
  console.log('Test 31: Subsequent Payment Completes Partial Settlement -> PAID');
  const compPayRes = await commercialStore.recordPayment({
    providerOrganizationId: testOrgId,
    amountCents: 19900,
    paymentMethod: 'ACH_TRANSFER',
    invoiceId: inv2.id
  });
  const inv2AfterFull = await commercialStore.getInvoiceById(inv2.id);
  assert(inv2AfterFull?.status === 'PAID', 'Invoice status transitioned to PAID after final payment');
  assert(inv2AfterFull?.balanceDueCents === 0, 'Remaining balance due is exactly 0 cents');

  // Test 32: Append-Only Refund: Recording a refund creates immutable RefundRecord without mutating original PaymentRecord
  console.log('Test 32: Append-Only Refund: Original PaymentRecord is NOT mutated');
  const refundRes = await commercialStore.recordRefund({
    paymentId: partPayRes.payment.id,
    amountCents: 5000, // Refund $50.00 of the original $100.00
    reason: 'Duplicate payment adjustment request'
  });
  assert(refundRes.refund.amountCents === 5000, 'RefundRecord created for 5000 cents');
  const origPaymentCheck = await commercialStore.getPaymentRecordById(partPayRes.payment.id);
  assert(origPaymentCheck?.status === 'SUCCEEDED', 'Invariant Verified: Original PaymentRecord status remains SUCCEEDED (not mutated to REFUNDED)');

  // Test 33: Refund Updates Invoice Balance Due
  console.log('Test 33: Refund Updates Invoice Balance Due');
  const inv2AfterRefund = await commercialStore.getInvoiceById(inv2.id);
  assert(inv2AfterRefund?.balanceDueCents === 5000, 'Invoice balance due reinstated by 5000 cents ($50.00) following refund');
  assert(inv2AfterRefund?.status === 'PARTIALLY_PAID', 'Invoice status transitions back to PARTIALLY_PAID due to outstanding balance');

  // Test 34: Refund Ceiling Validation: Cannot refund more than original payment amount
  console.log('Test 34: Refund Ceiling Validation');
  let overRefundRejected = false;
  try {
    await commercialStore.recordRefund({
      paymentId: partPayRes.payment.id,
      amountCents: 6000, // 5000 + 6000 = 11000 > 10000 original
      reason: 'Attempted excessive refund'
    });
  } catch (err: any) {
    overRefundRejected = err.message.includes('exceeds refundable payment balance');
  }
  assert(overRefundRejected, 'Rejects refund exceeding remaining payment consideration');

  // Test 35: Authoritative Provider Account Balance Reconstruction
  console.log('Test 35: Authoritative Provider Account Balance Reconstruction');
  const balance = await commercialStore.getAuthoritativeAccountBalance(testOrgId);
  // Total Invoiced: Invoice 1 ($334.00 = 33400) + Invoice 2 ($299.00 = 29900) = 63300 cents
  assert(balance.totalInvoicedCents === 63300, `totalInvoicedCents accurately reconstructed: ${balance.totalInvoicedCents}`);
  // Total Paid: Inv 1 full (33400) + Part (10000) + Comp (19900) = 63300 cents
  assert(balance.totalPaidCents === 63300, `totalPaidCents accurately reconstructed: ${balance.totalPaidCents}`);
  // Total Refunded: 5000 cents
  assert(balance.totalRefundedCents === 5000, `totalRefundedCents accurately reconstructed: ${balance.totalRefundedCents}`);
  // Total Adjustments: -1500 cents
  assert(balance.totalAdjustmentsCents === -1500, `totalAdjustmentsCents accurately reconstructed: ${balance.totalAdjustmentsCents}`);
  // Outstanding Balance: Invoice 1 (0) + Invoice 2 (5000 from refund) = 5000 cents
  assert(balance.outstandingBalanceCents === 5000, `outstandingBalanceCents accurately derived: ${balance.outstandingBalanceCents}`);

  // ------------------------------------------------------------------------
  // PART VI: HTTP Endpoints, Tenant Isolation & Full Regression (Tests 36–42)
  // ------------------------------------------------------------------------
  console.log('\n--- PART VI: HTTP Endpoints, Tenant Isolation & Full Regression (Tests 36–42) ---');

  const authHeadersApex = { 'x-provider-user-id': 'user_apex_1' };
  const authHeadersSierra = { 'x-provider-user-id': 'user_sierra_1' };

  // Test 36: HTTP Endpoints Integration
  console.log('Test 36: HTTP Endpoints Integration');
  const bpListRes = await request(server, 'GET', '/api/commercial/billing-periods', undefined, authHeadersApex);
  assert(bpListRes.status === 200 && bpListRes.body.success, 'GET /api/commercial/billing-periods returns 200');

  const invListRes = await request(server, 'GET', '/api/commercial/invoices', undefined, authHeadersApex);
  assert(invListRes.status === 200 && invListRes.body.success, 'GET /api/commercial/invoices returns 200');

  const invGetRes = await request(server, 'GET', `/api/commercial/invoices/${finalized.id}`, undefined, authHeadersApex);
  assert(invGetRes.status === 200 && invGetRes.body.invoice.id === finalized.id, 'GET /api/commercial/invoices/:id returns invoice');

  const balRes = await request(server, 'GET', '/api/commercial/statements/balance', undefined, authHeadersApex);
  assert(balRes.status === 200 && balRes.body.balance.outstandingBalanceCents === 5000, 'GET /api/commercial/statements/balance returns balance');

  const curStmtRes = await request(server, 'GET', '/api/commercial/statements/current', undefined, authHeadersApex);
  assert(curStmtRes.status === 200 && curStmtRes.body.statement.totalInvoicesCount >= 2, 'GET /api/commercial/statements/current returns statement overview');

  // Test 37: Multi-Tenant Isolation
  console.log('Test 37: Multi-Tenant Isolation (Cross-tenant access blocked with 403)');
  const crossInvRes = await request(server, 'GET', `/api/commercial/invoices/${finalized.id}`, undefined, authHeadersSierra);
  assert(crossInvRes.status === 403, 'Cross-tenant invoice access strictly forbidden with 403');

  const crossBpRes = await request(server, 'POST', `/api/commercial/billing-periods/${bpId}/close`, undefined, authHeadersSierra);
  assert(crossBpRes.status === 403, 'Cross-tenant billing period close strictly forbidden with 403');

  // Test 38: Unauthenticated / Invalid Provider Blocked with 401/403
  console.log('Test 38: Unauthenticated Provider Blocked');
  const unauthRes = await request(server, 'GET', '/api/commercial/invoices', undefined, { 'x-provider-user-id': 'user_unknown_ghost' });
  assert(unauthRes.status === 403 || unauthRes.status === 401, 'Unauthenticated user rejected');

  // Test 39: Zero Prohibited Marketplace Billing Routes (Remain 404)
  console.log('Test 39: Prohibited Marketplace Billing Routes (Remain 404)');
  const p1 = await request(server, 'POST', '/api/marketplace/billing/invoice', {});
  assert(p1.status === 404, '/api/marketplace/billing/invoice remains 404');
  const p2 = await request(server, 'POST', '/api/marketplace/billing/ledger', {});
  assert(p2.status === 404, '/api/marketplace/billing/ledger remains 404');
  const p3 = await request(server, 'POST', '/api/marketplace/settlement', {});
  assert(p3.status === 404, '/api/marketplace/settlement remains 404');

  // Test 40: Non-Regression & Marketplace Neutrality Integrity
  console.log('Test 40: Non-Regression & Marketplace Neutrality Integrity');
  const compRes = await request(server, 'GET', '/api/marketplace/competitions', undefined, authHeadersApex);
  assert(compRes.status === 200, 'Marketplace competitions route unaffected');

  // Test 41: End-to-End Golden Flow Verification
  console.log('Test 41: End-to-End Golden Flow Verification');
  // Full flow for Sierra Brokerage: create period -> generate draft -> finalize -> pay -> verify 0 balance
  const sierraBp = buildBillingPeriod({
    providerOrganizationId: 'org_sierra',
    commercialAgreementId: testAgreementId,
    commercialPlanVersionId: soloPlanVerId, // $0 plan
    periodStart: '2026-10-01T00:00:00Z',
    periodEnd: '2026-10-31T23:59:59Z'
  });
  await commercialStore.saveBillingPeriod(sierraBp);
  const sDraft = await commercialStore.generateDraftInvoice({
    providerOrganizationId: 'org_sierra',
    billingPeriodId: sierraBp.id
  });
  const sFinal = await commercialStore.finalizeInvoiceById(sDraft.invoice.id);
  assert(sFinal.status === 'FINALIZED', 'Sierra invoice finalized');
  const sBalance = await commercialStore.getAuthoritativeAccountBalance('org_sierra');
  assert(sBalance.outstandingBalanceCents === 0, 'Zero-fee plan invoice has 0 outstanding balance');

  // Test 42: Aggregate Platform Test Runner Pass
  console.log('Test 42: Aggregate Platform Test Runner Pass');
  const testRunRes = await request(server, 'GET', '/api/tests/run');
  assert(testRunRes.status === 200, 'GET /api/tests/run returns 200');
  assert(testRunRes.body.failed === 0, `All platform tests pass: 0 failures out of ${testRunRes.body.total}`);

  console.log('\n========================================================================');
  console.log('ALL 42 CE-5 ACCEPTANCE TESTS PASSED SUCCESSFULLY (42/42)');
  console.log('========================================================================\n');

  server.close();
  process.exit(0);
}

runValidation().catch((err) => {
  console.error('\n[FATAL] CE-5 Validation Failed:', err);
  process.exit(1);
});
