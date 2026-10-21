import test from 'node:test';
import assert from 'node:assert/strict';
import { publishRuleSet, validatePublication, verifyAnchoredContent } from './rulesetGovernance';
import { evaluateProviderJurisdictionAuthority } from './providerAuthorityEngine';
import { NEVADA_WAVE0_FOUNDER_ID, nevadaWave0ProviderAuthorityCandidateRuleSet as ruleSet, nevadaWave0ProviderAuthorityCandidateRules as rules } from './nevadaWave0ProviderAuthorityCandidatePack';
import type { CarrierRelationship, ProviderLicense, ProviderOrganization } from '../types/insurance';

const org:ProviderOrganization={id:'org-nv',legalName:'Nevada Agency',displayName:'Nevada Agency',organizationType:'INDEPENDENT_AGENCY',verificationStatus:'MARKETPLACE_APPROVED',marketplaceStatus:'ACTIVE',states:['NV'],linesOfBusiness:['PERSONAL_AUTO'],createdAt:'2026-10-20T00:00:00Z'};
const license=(id:string,providerUserId?:string):ProviderLicense=>({id,providerOrganizationId:org.id,providerUserId,jurisdiction:'NV',licenseType:'PROPERTY_CASUALTY',licenseNumber:id,status:'ACTIVE',effectiveDate:'2025-01-01',expirationDate:'2027-01-01',verificationStatus:'VERIFIED'});
const relationship=(relationshipType:'APPOINTED'|'AUTHORIZED_BROKER'):CarrierRelationship=>({id:`rel-${relationshipType}`,providerOrganizationId:org.id,carrierId:'carrier-nevada-mutual',carrierName:'Nevada Mutual',relationshipType,status:'ACTIVE',jurisdiction:'NV',lineOfBusiness:'PERSONAL_AUTO',effectiveFrom:'2025-01-01'});
const evaluate=(role:'AGENT'|'BROKER',relationships:CarrierRelationship[],providerUserId='user-a')=>evaluateProviderJurisdictionAuthority({org,licenses:[license('entity'),license('producer-a','user-a')],carrierRelationships:relationships,rules,jurisdictionCode:'NV',insuranceLine:'PERSONAL_AUTO',carrier:'Nevada Mutual',evaluationDate:'2026-10-20',providerUserId,transactionRole:role});

test('founder-approved pack satisfies publication controls and produces an immutable anchor',()=>{
  const inReview={...ruleSet,status:'IN_REVIEW' as const};
  assert.deepEqual(validatePublication({ruleSet:inReview,rules,publisherId:NEVADA_WAVE0_FOUNDER_ID}),[]);
  const {published}=publishRuleSet({ruleSet:inReview,rules,publisherId:NEVADA_WAVE0_FOUNDER_ID,publishedAt:'2026-10-20T00:00:00.000Z'});
  assert.equal(published.status,'PUBLISHED');
  assert.ok(published.contentSha256);
  assert.equal(verifyAnchoredContent(published,rules,published.contentSha256!),true);
});

test('candidate behavior distinguishes agent appointment, broker placement, and exact producer',()=>{
  assert.equal(evaluate('AGENT',[relationship('APPOINTED')]).outcome,'AUTHORIZED');
  assert.equal(evaluate('AGENT',[relationship('AUTHORIZED_BROKER')]).outcome,'NOT_AUTHORIZED');
  assert.equal(evaluate('BROKER',[relationship('AUTHORIZED_BROKER')]).outcome,'AUTHORIZED');
  assert.equal(evaluate('BROKER',[relationship('APPOINTED')]).outcome,'NOT_AUTHORIZED');
  assert.equal(evaluate('AGENT',[relationship('APPOINTED')],'user-b').outcome,'NOT_AUTHORIZED');
});

test('candidate behavior fails closed without entity or direct-carrier certificate evidence',()=>{
  const noEntity=evaluateProviderJurisdictionAuthority({org,licenses:[license('producer-a','user-a')],carrierRelationships:[relationship('APPOINTED')],rules,jurisdictionCode:'NV',insuranceLine:'PERSONAL_AUTO',carrier:'Nevada Mutual',evaluationDate:'2026-10-20',providerUserId:'user-a',transactionRole:'AGENT'});
  assert.equal(noEntity.outcome,'NOT_AUTHORIZED');
  const carrier={...org,id:'carrier',organizationType:'DIRECT_CARRIER' as const};
  assert.equal(evaluateProviderJurisdictionAuthority({org:carrier,licenses:[],carrierRelationships:[],rules,jurisdictionCode:'NV',insuranceLine:'PERSONAL_AUTO',evaluationDate:'2026-10-20'}).outcome,'NOT_AUTHORIZED');
});
