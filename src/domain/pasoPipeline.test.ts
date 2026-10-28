import assert from 'node:assert/strict';
import test from 'node:test';
import { assertSalesTransition, authoritativePipelineStage } from './pasoPipeline.ts';

test('sales transitions cannot manufacture authoritative provider or commercial stages',()=>{
  assert.doesNotThrow(()=>assertSalesTransition('IDENTIFIED','CONTACT_ATTEMPTED'));
  assert.doesNotThrow(()=>assertSalesTransition('ENGAGED','LOST'));
  assert.throws(()=>assertSalesTransition('DEMO_COMPLETED','VERIFIED'),/authoritative/);
  assert.throws(()=>assertSalesTransition('DEMO_COMPLETED','PAID_ACTIVE'),/authoritative/);
  assert.throws(()=>assertSalesTransition('DEMO_COMPLETED','ACTIVE_PARTICIPANT'),/authoritative/);
  assert.throws(()=>assertSalesTransition('IDENTIFIED','QUALIFIED'),/Invalid/);
});

test('authoritative projection separates approval, payment, and marketplace evidence',()=>{
  assert.equal(authoritativePipelineStage({currentStage:'DEMO_COMPLETED',applicationStatus:'SUBMITTED',paidMembership:false,activeMarketplaceParticipation:false})?.stage,'APPLICATION_SUBMITTED');
  assert.equal(authoritativePipelineStage({currentStage:'VERIFICATION_PENDING',applicationStatus:'APPROVED',providerOrganizationId:'org-1',paidMembership:false,activeMarketplaceParticipation:false})?.stage,'VERIFIED');
  assert.equal(authoritativePipelineStage({currentStage:'VERIFIED',applicationStatus:'APPROVED',providerOrganizationId:'org-1',paidMembership:false,activeMarketplaceParticipation:false})?.stage,'PAYMENT_PENDING');
  assert.equal(authoritativePipelineStage({currentStage:'PAYMENT_PENDING',applicationStatus:'APPROVED',providerOrganizationId:'org-1',paidMembership:true,activeMarketplaceParticipation:false})?.stage,'PAID_ACTIVE');
  assert.equal(authoritativePipelineStage({currentStage:'PAID_ACTIVE',applicationStatus:'APPROVED',providerOrganizationId:'org-1',paidMembership:true,activeMarketplaceParticipation:true})?.stage,'ACTIVE_PARTICIPANT');
});
