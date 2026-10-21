import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateProviderJurisdictionAuthority } from './providerAuthorityEngine';
import type { CarrierRelationship, ProviderLicense, ProviderOrganization } from '../types/insurance';
import type { JurisdictionRule } from '../types/jurisdiction';

const org:ProviderOrganization={id:'org',legalName:'Agency',displayName:'Agency',organizationType:'INDEPENDENT_AGENCY',verificationStatus:'MARKETPLACE_APPROVED',marketplaceStatus:'ACTIVE',states:['NV'],linesOfBusiness:['PERSONAL_AUTO'],createdAt:'2026-01-01T00:00:00Z'};
const license=(userId:string):ProviderLicense=>({id:`lic-${userId}`,providerOrganizationId:'org',providerUserId:userId,jurisdiction:'NV',licenseType:'PROPERTY_CASUALTY',licenseNumber:`NV-${userId}`,status:'ACTIVE',effectiveDate:'2025-01-01',expirationDate:'2027-01-01',verificationStatus:'VERIFIED'});
const relationship=(type:CarrierRelationship['relationshipType']):CarrierRelationship=>({id:`rel-${type}`,providerOrganizationId:'org',carrierId:'carrier',carrierName:'Test Carrier',jurisdiction:'NV',lineOfBusiness:'PERSONAL_AUTO',relationshipType:type,status:'ACTIVE',effectiveFrom:'2025-01-01'});
const rule:JurisdictionRule={id:'rule',ruleSetId:'published-rules',ruleCode:'NV.PRODUCER.AUTHORITY',ruleCategory:'PRODUCER_LICENSING',enforcementPoint:'PROVIDER_AUTHORITY',temporalBasis:'transactionDate',requirementText:'Independently verified role-specific provider authority fixture.',effectiveFrom:'2025-01-01',sourceIds:['official'],verificationStatus:'VERIFIED',verifiedBy:'independent-verifier',verifiedAt:'2026-01-01T00:00:00Z',machineRule:{kind:'PRODUCER_AUTHORITY',acceptedLicenseClasses:['PROPERTY_CASUALTY'],entityLicenseRequired:false,individualLicenseRequired:true,appointmentRequired:false,carrierRelationshipRequirementByTransactionRole:{AGENT:['APPOINTED'],BROKER:['AUTHORIZED_BROKER']}}};
const evaluate=(providerUserId:string|undefined,transactionRole:'AGENT'|'BROKER'|undefined,relationships:CarrierRelationship[])=>evaluateProviderJurisdictionAuthority({org,licenses:[license('producer-a'),license('producer-b')],carrierRelationships:relationships,rules:[rule],jurisdictionCode:'NV',insuranceLine:'PERSONAL_AUTO',carrier:'Test Carrier',evaluationDate:'2026-10-20',providerUserId,transactionRole});

test('individual licensing is evaluated for the authenticated producer, never any producer in the organization',()=>{
  assert.equal(evaluate('producer-a','AGENT',[relationship('APPOINTED')]).outcome,'AUTHORIZED');
  assert.equal(evaluate('producer-missing','AGENT',[relationship('APPOINTED')]).outcome,'NOT_AUTHORIZED');
  assert.equal(evaluate(undefined,'AGENT',[relationship('APPOINTED')]).outcome,'INDETERMINATE');
});

test('verified role-specific relationship rule distinguishes agent appointment from broker authorization',()=>{
  assert.equal(evaluate('producer-a','AGENT',[relationship('APPOINTED')]).outcome,'AUTHORIZED');
  assert.equal(evaluate('producer-a','AGENT',[relationship('AUTHORIZED_BROKER')]).outcome,'NOT_AUTHORIZED');
  assert.equal(evaluate('producer-a','BROKER',[relationship('AUTHORIZED_BROKER')]).outcome,'AUTHORIZED');
  assert.equal(evaluate('producer-a','BROKER',[relationship('APPOINTED')]).outcome,'NOT_AUTHORIZED');
  assert.equal(evaluate('producer-a',undefined,[relationship('APPOINTED')]).outcome,'INDETERMINATE');
});
