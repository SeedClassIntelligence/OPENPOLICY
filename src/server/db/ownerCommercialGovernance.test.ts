import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { PostgresStore } from './postgresStore';
import { CommercialStore } from './commercialStore';

test('owner compensation determinations are durable, audited, and idempotent', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpolicy-owner-commercial-'));
  const store = new PostgresStore(dataDir);
  try {
    await store.init();
    const input = {
      jurisdictionCode: 'nv', insuranceLine: 'PERSONAL_AUTO', chargeType: 'AUTHORIZED_CONNECTION',
      effectiveFrom: '2027-01-01T00:00:00.000Z', authorityReference: 'NV-COUNSEL-001',
      supportingReference: 'gs://openpolicy-governance/nv-counsel-001.pdf',
      determinationSummary: 'Approved subject to the recorded operating constraints.',
      idempotencyKey: 'comp-determination:nv:auto:v1', actorId: 'firebase-owner-uid'
    };
    const first = await store.approveCompensationDetermination(input);
    const replay = await store.approveCompensationDetermination(input);
    assert.equal(replay.id, first.id);
    assert.equal(first.jurisdictionCode, 'NV');
    assert.equal((await store.listCompensationDeterminations()).length, 1);
    const audits = await store.getAuditEvents();
    assert.equal(audits.filter(event => event.eventType === 'COMPENSATION_DETERMINATION_APPROVED').length, 1);
    const revoked=await store.revokeCompensationDetermination({id:first.id,actorId:'firebase-owner-uid',reason:'Authority superseded'});
    assert.equal(revoked.status,'REVOKED');
    assert.equal((await store.getAuditEvents()).filter(event=>event.eventType==='COMPENSATION_DETERMINATION_REVOKED').length,1);
    await assert.rejects(()=>store.revokeCompensationDetermination({id:first.id,actorId:'firebase-owner-uid',reason:'again'}),/already revoked/);
  } finally {
    await store.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('owner price changes create immutable future versions and preserve prior history', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpolicy-owner-pricing-'));
  const store = new PostgresStore(dataDir);
  try {
    await store.init();
    const client = await store.getPgClient();
    await client.query(`INSERT INTO commercial_plans (id,code,display_name,provider_segment,status,created_at) VALUES ($1,$2,$3,$4,'ACTIVE',$5);`,
      ['PLAN_TEST','TEST','Test Plan','AGENCY',new Date().toISOString()]);
    await client.query(`INSERT INTO commercial_plan_versions (id,plan_id,version,effective_from,billing_interval,recurring_fee_cents,currency,terms_snapshot,created_at) VALUES ($1,$2,1,$3,'MONTHLY',49900,'USD',$4,$5);`,
      ['cpv_PLAN_TEST_v1','PLAN_TEST','2026-01-01T00:00:00.000Z',JSON.stringify({priceBookId:'V1'}),new Date().toISOString()]);
    const created = await store.createGovernedCommercialPlanVersion({ planId:'PLAN_TEST',effectiveFrom:'2027-01-01T00:00:00.000Z',
      billingInterval:'MONTHLY',recurringFeeCents:54900,termsSnapshot:{priceBookId:'V2',compensationDeterminationApproved:false},actorId:'firebase-owner-uid' });
    assert.equal(created.version, 2);
    const rows = await client.query<any>(`SELECT version,recurring_fee_cents,terms_snapshot FROM commercial_plan_versions WHERE plan_id='PLAN_TEST' ORDER BY version;`);
    assert.equal(rows.rows.length, 2);
    assert.equal(rows.rows[0].recurring_fee_cents, 49900);
    assert.equal(rows.rows[1].recurring_fee_cents, 54900);
    assert.equal(JSON.parse(rows.rows[1].terms_snapshot).compensationDeterminationApproved, false);
    await assert.rejects(() => store.createGovernedCommercialPlanVersion({ planId:'PLAN_TEST',effectiveFrom:'2020-01-01T00:00:00.000Z',
      billingInterval:'MONTHLY',recurringFeeCents:1,termsSnapshot:{},actorId:'firebase-owner-uid' }), /future timestamp/);
  } finally {
    await store.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('owner premium-service control is durable, audited, and blocks service use independently of entitlement', async()=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'openpolicy-owner-services-'));
  const store=new PostgresStore(dataDir);
  try{
    await store.init();
    const before=await store.listPremiumServiceControls();
    assert.equal(before.length,4);assert.ok(before.every(item=>item.status==='ENABLED'));
    const disabled=await store.changePremiumServiceControl({serviceCode:'API_INTEGRATION',status:'DISABLED',actorId:'firebase-owner-uid',reason:'Acceptance incident review'});
    assert.equal(disabled.status,'DISABLED');
    assert.equal((await store.listPremiumServiceControls()).find(item=>item.serviceCode==='API_INTEGRATION')?.status,'DISABLED');
    assert.equal((await store.getAuditEvents()).filter(event=>event.eventType==='PREMIUM_SERVICE_STATUS_CHANGED').length,1);
    await assert.rejects(()=>store.changePremiumServiceControl({serviceCode:'API_INTEGRATION',status:'ENABLED',actorId:'firebase-owner-uid',reason:''}),/reason is required/);
  }finally{await store.close();fs.rmSync(dataDir,{recursive:true,force:true});}
});

test('platform financial overview is rebuilt from canonical ledgers without dashboard state',async()=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'openpolicy-owner-financials-'));
  const store=new PostgresStore(dataDir);const commercial=new CommercialStore(store);
  try{await store.init();const overview:any=await commercial.getPlatformFinancialOverview();
    assert.deepEqual(overview.totals,{invoiceCount:0,invoicedCents:0,outstandingCents:0,pastDueCount:0,paymentCount:0,collectedCents:0,failedPaymentCount:0,pendingPaymentCount:0,refundCount:0,refundedCents:0});
    assert.deepEqual(overview.revenueEvents,[]);assert.deepEqual(overview.recentInvoices,[]);assert.deepEqual(overview.recentPayments,[]);assert.deepEqual(overview.recentRefunds,[]);
  }finally{await store.close();fs.rmSync(dataDir,{recursive:true,force:true});}
});
