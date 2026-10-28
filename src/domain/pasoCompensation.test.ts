import assert from 'node:assert/strict';
import test from 'node:test';
import { allocateCompensation, calculateCompensation } from './pasoCompensation.ts';

const plan={commissionRules:{PLAN_SOLO:5000,PLAN_AGENCY:12500,PLAN_OPEN_POLICY_PREMIUM:25000,PLAN_NETWORK:50000,PLAN_ENTERPRISE:null},retentionRules:{paidPeriodsRequired:3,PLAN_SOLO:2500,PLAN_AGENCY:6000,PLAN_OPEN_POLICY_PREMIUM:12500,PLAN_NETWORK:25000,PLAN_ENTERPRISE:null}};

test('initial draft schedule calculates exact non-enterprise acquisition and retention amounts',()=>{
  assert.equal(calculateCompensation({eventType:'ACQUISITION_COMMISSION',planCode:'PLAN_SOLO',verifiedOrganization:true,approvedAttribution:true,paidSubscriptionPeriods:1,plan}).amountCents,5000);
  assert.equal(calculateCompensation({eventType:'ACQUISITION_COMMISSION',planCode:'PLAN_NETWORK',verifiedOrganization:true,approvedAttribution:true,paidSubscriptionPeriods:1,plan}).amountCents,50000);
  assert.equal(calculateCompensation({eventType:'RETENTION_BONUS',planCode:'PLAN_AGENCY',verifiedOrganization:true,approvedAttribution:true,paidSubscriptionPeriods:3,plan}).amountCents,6000);
});

test('enterprise, missing authority, attribution, and premature retention fail closed',()=>{
  assert.equal(calculateCompensation({eventType:'ACQUISITION_COMMISSION',planCode:'PLAN_ENTERPRISE',verifiedOrganization:true,approvedAttribution:true,paidSubscriptionPeriods:1,plan}).eligible,false);
  assert.match(calculateCompensation({eventType:'ACQUISITION_COMMISSION',planCode:'PLAN_ENTERPRISE',verifiedOrganization:true,approvedAttribution:true,paidSubscriptionPeriods:1,plan}).reason,/contract-specific/);
  assert.equal(calculateCompensation({eventType:'RETENTION_BONUS',planCode:'PLAN_SOLO',verifiedOrganization:true,approvedAttribution:true,paidSubscriptionPeriods:2,plan}).eligible,false);
  assert.equal(calculateCompensation({eventType:'ACQUISITION_COMMISSION',planCode:'PLAN_SOLO',verifiedOrganization:false,approvedAttribution:true,paidSubscriptionPeriods:1,plan}).eligible,false);
});

test('approved split allocations preserve the exact total without duplicate reps',()=>{
  assert.deepEqual(allocateCompensation(12500,'rep-primary',[{repId:'rep-split',basisPoints:2500}]),[{repId:'rep-primary',amountCents:9375},{repId:'rep-split',amountCents:3125}]);
  assert.throws(()=>allocateCompensation(5000,'rep-a',[{repId:'rep-a',basisPoints:1000}]),/unique/);
  assert.throws(()=>allocateCompensation(5000,'rep-a',[{repId:'rep-b',basisPoints:10001}]),/100%/);
});
