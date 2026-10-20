import test from 'node:test';
import assert from 'node:assert/strict';
import { assembleUsageInvoice } from './commercialEconomicsEngine';
import type { BillingPeriod, BillableEvent } from '../types/insurance';

const period: BillingPeriod = {
  id:'bp-1',providerOrganizationId:'org-apex',commercialAgreementId:'agreement-1',
  commercialPlanVersionId:'premium-v1',periodStart:'2026-10-01T00:00:00.000Z',
  periodEnd:'2026-11-01T00:00:00.000Z',status:'OPEN',createdAt:'2026-10-01T00:00:00.000Z'
};
const engagement: BillableEvent = {
  id:'be-1',commercialEventId:'event-1',providerOrganizationId:'org-apex',
  commercialAgreementId:'agreement-1',commercialPlanVersionId:'premium-v1',
  chargeCode:'QUALIFIED_ENGAGEMENT_FEE',quantity:1,unitPriceCents:3500,amountCents:3500,
  currency:'USD',status:'RATED',ratedAt:'2026-10-16T00:00:00.000Z',
  pricingSnapshot:{},idempotencyKey:'be:event-1'
};

test('supplemental usage invoice bills the $35 engagement without duplicating membership',()=>{
  const result=assembleUsageInvoice({billingPeriod:period,billableEvents:[engagement],
    idempotencyKey:'usage-invoice:event-1',invoiceId:'invoice-1',invoiceNumber:'INV-USAGE-1',now:'2026-10-16T00:00:00.000Z'});
  assert.equal(result.invoice.totalDueCents,3500);
  assert.equal(result.lineItems.length,1);
  assert.equal(result.lineItems[0].lineType,'USAGE_CHARGE');
  assert.equal(result.lineItems.some(item=>item.lineType==='SUBSCRIPTION'),false);
});

test('supplemental usage invoice rejects cross-organization and already non-rated events',()=>{
  assert.throws(()=>assembleUsageInvoice({billingPeriod:period,billableEvents:[{...engagement,providerOrganizationId:'other'}],idempotencyKey:'x'}),/not eligible/);
  assert.throws(()=>assembleUsageInvoice({billingPeriod:period,billableEvents:[{...engagement,status:'INVOICED'}],idempotencyKey:'y'}),/not eligible/);
});
