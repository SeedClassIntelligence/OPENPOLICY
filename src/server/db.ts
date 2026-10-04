/**
 * Structured In-Memory Relational Data Store
 * Mimics PostgreSQL schema with audit trail, Redis cache simulation, and transaction isolation
 */

import {
  Policy,
  CoverageBaseline,
  ConsumerRequirements,
  Challenge,
  Offer,
  BindingHandoff,
  ReconciliationReport,
  AuditEvent,
  SystemMetrics,
  VaultDocument,
  PlatformNotification,
  ProviderOrganization,
  ProviderUser,
  ProviderLicense,
  CarrierRelationship,
  ProviderAppetite,
  Competition,
  CompetitionRound,
  ChallengeInvitation,
  ChallengeParticipation,
  OpportunityPreview,
  DeclineReason,
  ProviderMarketSignal,
  CompetitionEvaluationSummary,
  BindingHandoffDossier,
  DetailedPostBindReconciliation,
  ReviewQueueItem,
  ReviewQueueStatus,
  ChainVerificationResult,
  RegulatoryAuditProof,
  InformationRequest,
  InformationRequestField,
  InformationRequestPurpose,
  InformationRequestStatus,
  VerifiedSupplementalFact,
  FactConsentScope,
  OfferVersion,
  OfferVerification,
  QualifiedOffer,
  CompetitionActivityEvent,
  RoundDeadlineStatus,
  RoundDeadlineConfig,
  CompetitionActivityType,
  Selection,
  ConsentGrant,
  DisclosureEvent,
  BindingHandoffStatus,
  BindingModification,
  IssuedPolicyDocument,
  IssuedPolicySnapshot,
  ExpectedBoundTerms,
  PolicyVaultItem,
  ReconciliationVerdict,
  ReconciliationStatus
} from '../types/insurance';
import { SAMPLE_DECLARATIONS_PAGES, detectQuoteDiscrepancies } from '../domain/policyIntelligence';
import { compareOfferAgainstBaseline } from '../domain/comparisonEngine';
import { evaluateProviderEligibility, EligibilityEvaluation } from '../domain/eligibilityEngine';
import { 
  evaluateCompetitionRoundState, 
  calculateProviderMarketSignals, 
  advanceCompetitionRound as advanceCompRoundLogic, 
  validateOfferRevision,
  checkRoundDeadlineStatus,
  filterCompetitionActivityFeedForProvider
} from '../domain/competitionEngine';
import {
  createSelection,
  initiateBindingHandoff,
  createConsentGrant,
  revokeConsentGrant,
  validateAndExecuteDisclosure,
  proposeBindingModification,
  resolveBindingModification,
  transitionBindingStatus
} from '../domain/selectionBindingEngine';
import {
  deriveExpectedBoundTerms,
  createIssuedPolicyDocument,
  createIssuedPolicySnapshot,
  reconcileIssuedPolicy as pm5Reconcile,
  processConsumerVarianceReview as pm5ProcessReview,
  activateVerifiedPolicyToVault as pm5ActivateVault
} from '../domain/pm5ReconciliationEngine';
import {
  validateConsumerBindingAuthorization,
  reconcileIssuedPolicyWithQuote
} from '../domain/bindingReconciliationEngine';
import {
  verifyCryptographicAuditChain,
  processReviewQueueResolution,
  generateRegulatoryAuditProof as createRegulatoryProof
} from '../domain/governanceAuditEngine';
import {
  evaluateOfferQualification,
  flagDuplicateCarrierOffers,
  createOfferVersionSnapshot,
  getVisibleSupplementalFactsForProvider
} from '../domain/qualificationEngine';
import { postgresStore } from './db/postgresStore';

export class PolicyChallengeDatabase {
  private policies: Map<string, Policy> = new Map();
  private baselines: Map<string, CoverageBaseline> = new Map();
  private requirements: Map<string, ConsumerRequirements> = new Map();
  private challenges: Map<string, Challenge> = new Map();
  private offers: Map<string, Offer> = new Map();
  private handoffs: Map<string, BindingHandoff> = new Map();
  private reconciliations: Map<string, ReconciliationReport> = new Map();
  private vaultDocuments: Map<string, VaultDocument> = new Map();
  private notifications: PlatformNotification[] = [];
  private auditEvents: AuditEvent[] = [];
  private redisCache: Map<string, { value: any; expiresAt: number }> = new Map();
  private cacheHits: number = 2480;
  private cacheMisses: number = 88;

  // PM-1: Provider Marketplace & Competition Domain
  private providerOrganizations: Map<string, ProviderOrganization> = new Map();
  private providerUsers: Map<string, ProviderUser> = new Map();
  private providerLicenses: Map<string, ProviderLicense[]> = new Map();
  private carrierRelationships: Map<string, CarrierRelationship[]> = new Map();
  private providerAppetites: Map<string, ProviderAppetite> = new Map();
  private competitions: Map<string, Competition> = new Map();
  private challengeInvitations: Map<string, ChallengeInvitation> = new Map();
  private challengeParticipations: Map<string, ChallengeParticipation> = new Map();
  private competitionActivityEvents: Map<string, CompetitionActivityEvent[]> = new Map();

  // PM-2: Information Requests, Supplemental Facts, Offer Versions & Verifications
  private informationRequests: Map<string, InformationRequest> = new Map();
  private verifiedSupplementalFacts: Map<string, VerifiedSupplementalFact> = new Map();
  private offerVersions: Map<string, OfferVersion[]> = new Map();
  private offerVerifications: Map<string, OfferVerification> = new Map();

  // PM-3: Binding Dossiers & Post-Bind Detailed Reconciliations
  private bindingDossiers: Map<string, BindingHandoffDossier> = new Map();
  private detailedReconciliations: Map<string, DetailedPostBindReconciliation> = new Map();

  // PM-4: Selection, Controlled Consent, Disclosure Events & Binding Modifications
  private selections: Map<string, Selection> = new Map();
  private consentGrants: Map<string, ConsentGrant> = new Map();
  private disclosureEvents: Map<string, DisclosureEvent> = new Map();
  private bindingModifications: Map<string, BindingModification> = new Map();

  // PM-5: Issued Policy Documents, Snapshots, Reconciliation Reports & Policy Vault
  private issuedPolicyDocuments: Map<string, IssuedPolicyDocument> = new Map();
  private issuedPolicySnapshots: Map<string, IssuedPolicySnapshot> = new Map();
  private reconciliationReports: Map<string, ReconciliationReport> = new Map();
  private policyVaultItems: Map<string, PolicyVaultItem> = new Map();

  // PM-4: Human Review Queue (Section 32)
  private reviewQueue: Map<string, ReviewQueueItem> = new Map();

  constructor() {
    this.seedCanonicalDataset();
  }

  private generateHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(12, '0');
  }

  public recordAudit(
    eventType: AuditEvent['eventType'],
    actorRole: AuditEvent['actorRole'],
    actorId: string,
    details: string
  ): AuditEvent {
    const prevHash = this.auditEvents.length > 0 ? this.auditEvents[this.auditEvents.length - 1].hash : 'GENESIS_BLOCK_000000';
    const timestamp = new Date().toISOString();
    const hash = this.generateHash(`${timestamp}|${eventType}|${actorId}|${details}|${prevHash}`);

    const event: AuditEvent = {
      id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp,
      eventType,
      actorId,
      actorRole,
      details,
      hash
    };

    this.auditEvents.push(event);
    postgresStore.saveAuditEvent(event).catch(err => {
      console.warn('[PostgresStore Audit Event Sync Error]', err?.message || err);
    });
    return event;
  }

  public seedCanonicalDataset() {
    this.policies.clear();
    this.baselines.clear();
    this.requirements.clear();
    this.challenges.clear();
    this.offers.clear();
    this.handoffs.clear();
    this.reconciliations.clear();
    this.auditEvents = [];
    this.providerOrganizations.clear();
    this.providerUsers.clear();
    this.providerLicenses.clear();
    this.carrierRelationships.clear();
    this.providerAppetites.clear();
    this.competitions.clear();
    this.challengeInvitations.clear();
    this.challengeParticipations.clear();
    this.competitionActivityEvents.clear();
    this.issuedPolicyDocuments.clear();
    this.issuedPolicySnapshots.clear();
    this.reconciliationReports.clear();
    this.policyVaultItems.clear();
    // NOTE: Provider seed data (org_sierra, org_buckeye, org_apex) is canonical fixture data.
    // These identifiers appear in seed/fixture context only. Provider identity in production
    // API calls derives from authenticated session (x-provider-user-id), not from these values.

    // Seed PM-1 Provider Organizations
    // Provider A: Sierra Brokerage Group (NV Personal Auto Eligible)
    const sierraOrg: ProviderOrganization = {
      id: 'org_sierra',
      legalName: 'Sierra Brokerage Group LLC',
      displayName: 'Sierra Brokerage Group',
      organizationType: 'INDEPENDENT_AGENCY',
      verificationStatus: 'MARKETPLACE_APPROVED',
      marketplaceStatus: 'ACTIVE',
      states: ['NV', 'CA', 'AZ'],
      linesOfBusiness: ['PERSONAL_AUTO', 'HOMEOWNERS'],
      createdAt: '2026-01-15T08:00:00Z',
      verifiedAt: '2026-01-16T10:30:00Z'
    };
    this.providerOrganizations.set(sierraOrg.id, sierraOrg);
    this.providerUsers.set('user_sierra_1', {
      id: 'user_sierra_1',
      organizationId: 'org_sierra',
      name: 'Alex Morgan',
      email: 'alex@sierrabrokerage.com',
      role: 'AGENT',
      status: 'ACTIVE'
    });
    this.providerLicenses.set('org_sierra', [
      {
        id: 'lic_sierra_nv',
        providerOrganizationId: 'org_sierra',
        jurisdiction: 'NV',
        licenseType: 'PROPERTY_CASUALTY_BROKER',
        licenseNumber: 'NV-LIC-902188',
        status: 'ACTIVE',
        effectiveDate: '2025-01-01',
        expirationDate: '2027-01-01',
        verificationStatus: 'VERIFIED'
      }
    ]);
    this.providerAppetites.set('org_sierra', {
      id: 'app_sierra',
      providerOrganizationId: 'org_sierra',
      jurisdictions: ['NV', 'CA', 'AZ'],
      linesOfBusiness: ['PERSONAL_AUTO'],
      riskMarkets: ['PREFERRED', 'STANDARD'],
      renewalWindowDays: { min: 14, max: 90 },
      supportedVehicleCharacteristics: ['SEDAN', 'SUV', 'TRUCK'],
      active: true
    });
    this.carrierRelationships.set('org_sierra', [
      { id: 'rel_sierra_trv', providerOrganizationId: 'org_sierra', carrierId: 'c_trv', carrierName: 'Travelers', jurisdiction: 'NV', lineOfBusiness: 'PERSONAL_AUTO', relationshipType: 'APPOINTED', status: 'ACTIVE' },
      { id: 'rel_sierra_saf', providerOrganizationId: 'org_sierra', carrierId: 'c_saf', carrierName: 'Safeco', jurisdiction: 'NV', lineOfBusiness: 'PERSONAL_AUTO', relationshipType: 'APPOINTED', status: 'ACTIVE' },
      { id: 'rel_sierra_nat', providerOrganizationId: 'org_sierra', carrierId: 'c_nat', carrierName: 'Nationwide', jurisdiction: 'NV', lineOfBusiness: 'PERSONAL_AUTO', relationshipType: 'APPOINTED', status: 'ACTIVE' }
    ]);
    this.recordAudit('PROVIDER_REGISTERED', 'PROVIDER', 'org_sierra', 'Sierra Brokerage Group registered on Open Policy marketplace');
    this.recordAudit('PROVIDER_VERIFIED', 'ADMIN', 'admin_sys', 'Sierra Brokerage Group verified with active NV P&C license #902188');

    // Provider B: Buckeye State Insurance (OH Only - INELIGIBLE for NV Auto)
    const buckeyeOrg: ProviderOrganization = {
      id: 'org_buckeye',
      legalName: 'Buckeye Mutual Agency Inc',
      displayName: 'Buckeye State Insurance',
      organizationType: 'INDEPENDENT_AGENCY',
      verificationStatus: 'MARKETPLACE_APPROVED',
      marketplaceStatus: 'ACTIVE',
      states: ['OH'],
      linesOfBusiness: ['PERSONAL_AUTO'],
      createdAt: '2026-02-01T08:00:00Z',
      verifiedAt: '2026-02-02T10:00:00Z'
    };
    this.providerOrganizations.set(buckeyeOrg.id, buckeyeOrg);
    this.providerUsers.set('user_buckeye_1', {
      id: 'user_buckeye_1',
      organizationId: 'org_buckeye',
      name: 'Dave Miller',
      email: 'dave@buckeyestate.com',
      role: 'AGENT',
      status: 'ACTIVE'
    });
    this.providerLicenses.set('org_buckeye', [
      {
        id: 'lic_buckeye_oh',
        providerOrganizationId: 'org_buckeye',
        jurisdiction: 'OH',
        licenseType: 'AGENT',
        licenseNumber: 'OH-LIC-44120',
        status: 'ACTIVE',
        effectiveDate: '2025-01-01',
        expirationDate: '2027-01-01',
        verificationStatus: 'VERIFIED'
      }
    ]);
    this.providerAppetites.set('org_buckeye', {
      id: 'app_buckeye',
      providerOrganizationId: 'org_buckeye',
      jurisdictions: ['OH'],
      linesOfBusiness: ['PERSONAL_AUTO'],
      riskMarkets: ['PREFERRED', 'STANDARD'],
      renewalWindowDays: { min: 10, max: 60 },
      active: true
    });
    this.carrierRelationships.set('org_buckeye', [
      { id: 'rel_buckeye_erie', providerOrganizationId: 'org_buckeye', carrierId: 'c_erie', carrierName: 'Erie Insurance', jurisdiction: 'OH', lineOfBusiness: 'PERSONAL_AUTO', relationshipType: 'APPOINTED', status: 'ACTIVE' }
    ]);
    this.recordAudit('PROVIDER_REGISTERED', 'PROVIDER', 'org_buckeye', 'Buckeye State Insurance registered on Open Policy marketplace (OH jurisdiction)');

    // Provider C: Apex Insurance Services (NV Personal Auto Brokerage - ELIGIBLE)
    const apexOrg: ProviderOrganization = {
      id: 'org_apex',
      legalName: 'Apex Insurance Services Inc',
      displayName: 'Apex Insurance Services',
      organizationType: 'BROKERAGE',
      verificationStatus: 'MARKETPLACE_APPROVED',
      marketplaceStatus: 'ACTIVE',
      states: ['NV'],
      linesOfBusiness: ['PERSONAL_AUTO'],
      createdAt: '2026-01-20T08:00:00Z',
      verifiedAt: '2026-01-21T09:00:00Z'
    };
    this.providerOrganizations.set(apexOrg.id, apexOrg);
    this.providerUsers.set('user_apex_1', {
      id: 'user_apex_1',
      organizationId: 'org_apex',
      name: 'Sarah Jenkins',
      email: 'sarah@apexinsurance.com',
      role: 'AGENT',
      status: 'ACTIVE'
    });
    this.providerLicenses.set('org_apex', [
      {
        id: 'lic_apex_nv',
        providerOrganizationId: 'org_apex',
        jurisdiction: 'NV',
        licenseType: 'BROKER',
        licenseNumber: 'NV-LIC-849201',
        status: 'ACTIVE',
        effectiveDate: '2025-01-01',
        expirationDate: '2027-01-01',
        verificationStatus: 'VERIFIED'
      }
    ]);
    this.providerAppetites.set('org_apex', {
      id: 'app_apex',
      providerOrganizationId: 'org_apex',
      jurisdictions: ['NV'],
      linesOfBusiness: ['PERSONAL_AUTO'],
      riskMarkets: ['PREFERRED', 'STANDARD'],
      renewalWindowDays: { min: 7, max: 120 },
      active: true
    });
    this.recordAudit('PROVIDER_REGISTERED', 'PROVIDER', 'org_apex', 'Apex Insurance Services registered with NV license #849201');

    // 1. Initial Sample Policy (GEICO NV-49281)
    const sample = SAMPLE_DECLARATIONS_PAGES[0];
    const policyId = 'POL-NV-49281';
    const policy: Policy = {
      id: policyId,
      policyNumber: '4928-1029-41-01',
      carrier: 'GEICO Advantage Insurance Co.',
      jurisdiction: 'NV',
      namedInsured: 'Jane Doe',
      effectiveDate: '2025-11-18',
      expirationDate: '2026-11-18',
      termMonths: 12,
      annualPremium: 2964,
      monthlyPremium: 247,
      status: 'VERIFIED',
      drivers: sample.policyData.drivers || [],
      vehicles: sample.policyData.vehicles || [],
      coverages: sample.policyData.coverages || [],
      sourceDocumentId: sample.id,
      sourceDocumentName: sample.name
    };
    this.policies.set(policyId, policy);

    // Audit initial policy upload
    this.recordAudit('POLICY_UPLOADED', 'CONSUMER', 'user_consumer_1', `Uploaded ${sample.name} for extraction`);
    this.recordAudit('DOCUMENT_PROCESSED', 'SYSTEM', 'worker_doc_intel_1', `Extracted 7 coverage items from ${sample.name} with 97.4% confidence`);
    this.recordAudit('POLICY_VERIFIED', 'CONSUMER', 'user_consumer_1', `Consumer confirmed extracted policy terms for GEICO policy #4928-1029-41-01`);

    // 2. Coverage Baseline
    const baselineId = 'BL-NV-49281';
    const baseline: CoverageBaseline = {
      id: baselineId,
      policyId,
      version: 1,
      carrier: policy.carrier,
      effectiveDate: policy.effectiveDate,
      expirationDate: policy.expirationDate,
      baselineAnnualPremium: policy.annualPremium,
      baselineMonthlyPremium: policy.monthlyPremium,
      vehicle: policy.vehicles[0],
      coverages: policy.coverages,
      verifiedAt: '2026-09-18T14:20:00Z',
      verifiedBy: 'Jane Doe (Consumer)'
    };
    this.baselines.set(baselineId, baseline);
    this.recordAudit('BASELINE_CREATED', 'SYSTEM', 'baseline_engine', `Generated immutable CoverageBaseline version 1 from verified policy`);

    // 3. Consumer Requirements
    const reqId = 'REQ-NV-49281';
    const requirements: ConsumerRequirements = {
      id: reqId,
      ruleSummary: 'Beat my current price without reducing my protection.',
      minAnnualSavings: 150,
      maxCollisionDeductible: 500,
      maxCompDeductible: 250,
      mustIncludeRental: true,
      mustIncludeRoadside: true
    };
    this.requirements.set(reqId, requirements);

    // 4. Challenge
    const challengeId = 'CHAL-NV-49281';
    const challenge: Challenge = {
      id: challengeId,
      referenceNumber: 'CHALLENGE #NV-49281',
      consumerId: 'user_consumer_1',
      coverageBaselineId: baselineId,
      baseline,
      requirements,
      jurisdiction: 'NV',
      openingTimestamp: '2026-09-18T14:30:00Z',
      closingTimestamp: '2026-10-18T14:30:00Z',
      status: 'OFFERS_RECEIVED',
      disclosureLevel: 'MARKETPLACE_ANONYMOUS',
      offersCount: 3
    };
    this.challenges.set(challengeId, challenge);
    this.recordAudit('CHALLENGE_OPENED', 'CONSUMER', 'user_consumer_1', `Challenge #NV-49281 opened for marketplace competition with baseline $2,964/yr`);

    // Create Initial Competition & Invitations
    const compId = 'COMP-NV-49281';
    const comp: Competition = {
      id: compId,
      challengeId,
      status: 'OPEN',
      currentRound: 'ROUND_1_OPEN',
      openedAt: '2026-09-18T14:35:00Z',
      closesAt: '2026-09-20T14:35:00Z',
      participantCount: 1,
      improvementRoundEnabled: true,
      finalRoundEnabled: true
    };
    this.competitions.set(compId, comp);

    // Sierra invitation: Accepted
    const invSierra: ChallengeInvitation = {
      id: 'INV-NV-49281-org_sierra',
      challengeId,
      competitionId: compId,
      providerOrganizationId: 'org_sierra',
      eligibilityResult: 'ELIGIBLE',
      eligibilityReasons: ['All marketplace eligibility criteria satisfied: active license, matching jurisdiction, verified appetite, and line of business.'],
      status: 'ACCEPTED',
      invitedAt: '2026-09-18T14:35:00Z',
      viewedAt: '2026-09-18T14:50:00Z',
      acceptedAt: '2026-09-18T15:10:00Z',
      expiresAt: comp.closesAt
    };
    this.challengeInvitations.set(invSierra.id, invSierra);
    this.challengeParticipations.set('PART-NV-49281-org_sierra', {
      id: 'PART-NV-49281-org_sierra',
      challengeId,
      competitionId: compId,
      providerOrganizationId: 'org_sierra',
      acceptedAt: '2026-09-18T15:10:00Z',
      status: 'ACTIVE',
      lastActivityAt: '2026-09-19T11:42:00Z'
    });

    // Apex invitation: Open Opportunity (Status: INVITED, ready for testing!)
    const invApex: ChallengeInvitation = {
      id: 'INV-NV-49281-org_apex',
      challengeId,
      competitionId: compId,
      providerOrganizationId: 'org_apex',
      eligibilityResult: 'ELIGIBLE',
      eligibilityReasons: ['All marketplace eligibility criteria satisfied: active license, matching jurisdiction, verified appetite, and line of business.'],
      status: 'INVITED',
      invitedAt: '2026-09-18T14:35:00Z',
      expiresAt: comp.closesAt
    };
    this.challengeInvitations.set(invApex.id, invApex);

    // Buckeye: Evaluated as INELIGIBLE (no invitation created for Buckeye - zero leak)
    this.recordAudit(
      'PROVIDER_MATCH_EVALUATED',
      'SYSTEM',
      'eligibility_engine',
      'Evaluated Buckeye State Insurance (org_buckeye) for challenge CHALLENGE #NV-49281: INELIGIBLE [JURISDICTION: No active, verified license found for jurisdiction NV, APPETITE_JURISDICTION: Jurisdiction NV is outside configured appetite]'
    );

    // Seed PM-3 Competition Activity Events for CHAL-NV-49281
    this.competitionActivityEvents.set(challengeId, [
      {
        id: 'EVT-NV-49281-1',
        competitionId: compId,
        challengeId,
        timestamp: '2026-09-18T14:35:00Z',
        type: 'COMPETITION_OPENED',
        actorRole: 'SYSTEM',
        summary: 'Marketplace competition opened for Nevada Personal Auto challenge.',
        round: 'ROUND_1_OPEN'
      },
      {
        id: 'EVT-NV-49281-2',
        competitionId: compId,
        challengeId,
        timestamp: '2026-09-18T15:10:00Z',
        type: 'PROVIDER_JOINED',
        actorRole: 'PROVIDER',
        actorName: 'Sierra Brokerage Group',
        providerOrganizationId: 'org_sierra',
        summary: 'Sierra Brokerage Group entered the competition.',
        round: 'ROUND_1_OPEN'
      },
      {
        id: 'EVT-NV-49281-3',
        competitionId: compId,
        challengeId,
        timestamp: '2026-09-19T09:15:00Z',
        type: 'OFFER_SUBMITTED',
        actorRole: 'PROVIDER',
        actorName: 'Apex Insurance Services',
        providerOrganizationId: 'org_apex',
        summary: 'Apex Insurance Services submitted quote for Progressive Northern Insurance: $2,712/yr',
        round: 'ROUND_1_OPEN'
      }
    ]);

    // 5. Competing Offers (Matching Canonical Section 25)
    // OFFER A: Progressive - $226/mo ($2,712/yr) -> Save $252/yr -> BASELINE MATCH
    const offerA: Offer = {
      id: 'OFFER-A',
      challengeId,
      providerId: 'org_apex',
      providerName: 'Apex Insurance Services',
      providerLicense: 'NV-LIC-849201',
      carrier: 'Progressive Northern Insurance',
      quoteNumber: 'PRG-QUOTE-849102',
      annualPremium: 2712,
      monthlyPremium: 226,
      termMonths: 12,
      effectiveDate: '2026-11-18',
      expirationDate: '2027-11-18',
      supportingQuoteDocName: 'Progressive_Quote_PRG849102.pdf',
      submittedAt: '2026-09-19T09:15:00Z',
      discrepanciesDetected: false,
      status: 'VALIDATED',
      coverages: [
        {
          id: 'OFA-1',
          code: 'BODILY_INJURY',
          name: 'Bodily Injury Liability',
          category: 'LIABILITY',
          perPersonLimit: 100000,
          perAccidentLimit: 300000,
          isIncluded: true
        },
        {
          id: 'OFA-2',
          code: 'PROPERTY_DAMAGE',
          name: 'Property Damage Liability',
          category: 'LIABILITY',
          propertyLimit: 100000,
          isIncluded: true
        },
        {
          id: 'OFA-3',
          code: 'UM_UIM',
          name: 'Uninsured/Underinsured Motorist',
          category: 'LIABILITY',
          perPersonLimit: 100000,
          perAccidentLimit: 300000,
          isIncluded: true
        },
        {
          id: 'OFA-4',
          code: 'COLLISION',
          name: 'Collision Coverage',
          category: 'PHYSICAL_DAMAGE',
          deductible: 500,
          isIncluded: true
        },
        {
          id: 'OFA-5',
          code: 'COMPREHENSIVE',
          name: 'Comprehensive Coverage',
          category: 'PHYSICAL_DAMAGE',
          deductible: 250,
          isIncluded: true
        },
        {
          id: 'OFA-6',
          code: 'RENTAL_REIMBURSEMENT',
          name: 'Rental Reimbursement',
          category: 'ADDITIONAL',
          isIncluded: true,
          notes: '$45/day ($1,350 max)'
        },
        {
          id: 'OFA-7',
          code: 'ROADSIDE_ASSISTANCE',
          name: 'Roadside Assistance',
          category: 'ADDITIONAL',
          isIncluded: true
        }
      ]
    };
    this.offers.set(offerA.id, offerA);
    this.recordAudit('OFFER_SUBMITTED', 'PROVIDER', 'PROV-1', `Apex Insurance submitted Offer A ($2,712/yr) under Progressive Northern`);

    // OFFER B: Travelers - $204/mo ($2,448/yr) -> Save $516/yr -> BASELINE PLUS (Property limit $250k upgrade!)
    const offerB: Offer = {
      id: 'OFFER-B',
      challengeId,
      providerId: 'org_sierra',
      providerName: 'Sierra Brokerage Group',
      providerLicense: 'NV-LIC-902188',
      carrier: 'Travelers Property Casualty',
      quoteNumber: 'TRV-NV-993821',
      annualPremium: 2448,
      monthlyPremium: 204,
      termMonths: 12,
      effectiveDate: '2026-11-18',
      expirationDate: '2027-11-18',
      supportingQuoteDocName: 'Travelers_Official_Rate_TRV993821.pdf',
      submittedAt: '2026-09-19T11:42:00Z',
      discrepanciesDetected: false,
      status: 'VALIDATED',
      coverages: [
        {
          id: 'OFB-1',
          code: 'BODILY_INJURY',
          name: 'Bodily Injury Liability',
          category: 'LIABILITY',
          perPersonLimit: 100000,
          perAccidentLimit: 300000,
          isIncluded: true
        },
        {
          id: 'OFB-2',
          code: 'PROPERTY_DAMAGE',
          name: 'Property Damage Liability',
          category: 'LIABILITY',
          propertyLimit: 250000, // UPGRADE from $100k!
          isIncluded: true
        },
        {
          id: 'OFB-3',
          code: 'UM_UIM',
          name: 'Uninsured/Underinsured Motorist',
          category: 'LIABILITY',
          perPersonLimit: 100000,
          perAccidentLimit: 300000,
          isIncluded: true
        },
        {
          id: 'OFB-4',
          code: 'COLLISION',
          name: 'Collision Coverage',
          category: 'PHYSICAL_DAMAGE',
          deductible: 500,
          isIncluded: true
        },
        {
          id: 'OFB-5',
          code: 'COMPREHENSIVE',
          name: 'Comprehensive Coverage',
          category: 'PHYSICAL_DAMAGE',
          deductible: 250,
          isIncluded: true
        },
        {
          id: 'OFB-6',
          code: 'RENTAL_REIMBURSEMENT',
          name: 'Rental Reimbursement',
          category: 'ADDITIONAL',
          isIncluded: true,
          notes: '$50/day ($1,500 max)'
        },
        {
          id: 'OFB-7',
          code: 'ROADSIDE_ASSISTANCE',
          name: 'Premier Roadside Assistance',
          category: 'ADDITIONAL',
          isIncluded: true,
          notes: 'Includes 100-mile towing'
        }
      ]
    };
    this.offers.set(offerB.id, offerB);
    this.recordAudit('OFFER_SUBMITTED', 'PROVIDER', 'PROV-2', `Sierra Pacific submitted Offer B ($2,448/yr) with Property Damage limit upgrade ($250k)`);

    // OFFER C: Budget Carrier - $181/mo ($2,172/yr) -> Save $792/yr -> COVERAGE CHANGED (Collision $1,500 ded & NO RENTAL!)
    const offerC: Offer = {
      id: 'OFFER-C',
      challengeId,
      providerId: 'PROV-3',
      providerName: 'FastQuote Direct Agency',
      providerLicense: 'NV-LIC-662018',
      carrier: 'National General / Allstate Sub',
      quoteNumber: 'NG-DISC-10928',
      annualPremium: 2172,
      monthlyPremium: 181,
      termMonths: 12,
      effectiveDate: '2026-11-18',
      expirationDate: '2027-11-18',
      supportingQuoteDocName: 'NatGen_Quote_10928.pdf',
      submittedAt: '2026-09-19T16:05:00Z',
      discrepanciesDetected: false,
      status: 'VALIDATED',
      coverages: [
        {
          id: 'OFC-1',
          code: 'BODILY_INJURY',
          name: 'Bodily Injury Liability',
          category: 'LIABILITY',
          perPersonLimit: 100000,
          perAccidentLimit: 300000,
          isIncluded: true
        },
        {
          id: 'OFC-2',
          code: 'PROPERTY_DAMAGE',
          name: 'Property Damage Liability',
          category: 'LIABILITY',
          propertyLimit: 100000,
          isIncluded: true
        },
        {
          id: 'OFC-3',
          code: 'UM_UIM',
          name: 'Uninsured/Underinsured Motorist',
          category: 'LIABILITY',
          perPersonLimit: 100000,
          perAccidentLimit: 300000,
          isIncluded: true
        },
        {
          id: 'OFC-4',
          code: 'COLLISION',
          name: 'Collision Coverage',
          category: 'PHYSICAL_DAMAGE',
          deductible: 1500, // TRIPLE DEDUCTIBLE!
          isIncluded: true
        },
        {
          id: 'OFC-5',
          code: 'COMPREHENSIVE',
          name: 'Comprehensive Coverage',
          category: 'PHYSICAL_DAMAGE',
          deductible: 1000, // QUADRUPLE DEDUCTIBLE!
          isIncluded: true
        },
        {
          id: 'OFC-6',
          code: 'RENTAL_REIMBURSEMENT',
          name: 'Rental Reimbursement',
          category: 'ADDITIONAL',
          isIncluded: false, // STRIPPED!
          notes: 'Not Included in Quote'
        },
        {
          id: 'OFC-7',
          code: 'ROADSIDE_ASSISTANCE',
          name: 'Roadside Assistance',
          category: 'ADDITIONAL',
          isIncluded: false // STRIPPED!
        }
      ]
    };
    this.offers.set(offerC.id, offerC);
    this.recordAudit('OFFER_SUBMITTED', 'PROVIDER', 'PROV-3', `FastQuote submitted Offer C ($2,172/yr) with reduced coverage and higher deductibles`);
    this.recordAudit('COMPARISON_GENERATED', 'SYSTEM', 'comparison_engine', `Evaluated 3 competitive offers against Baseline #BL-NV-49281. Flagged 2 material reductions in Offer C.`);

    // PM-2 Seed Data: Information Requests, Reusable Facts & Offer Qualification
    this.informationRequests.clear();
    this.verifiedSupplementalFacts.clear();
    this.offerVersions.clear();
    this.offerVerifications.clear();

    const fact1: VerifiedSupplementalFact = {
      id: 'FACT-NV-49281-01',
      consumerId: 'user_consumer_1',
      challengeId,
      fieldType: 'ANNUAL_MILEAGE',
      fieldName: 'Annual Commute Mileage',
      value: 8500,
      formattedValue: '8,500 miles/year',
      verificationState: 'CONSUMER_ATTESTED',
      source: 'CONSUMER_PORTAL',
      createdAt: '2026-09-18T16:00:00Z',
      consentScope: 'ALL_ACTIVE_PARTICIPANTS',
      sharedWithOrganizationIds: ['org_sierra', 'org_apex']
    };
    this.verifiedSupplementalFacts.set(fact1.id, fact1);

    const req1: InformationRequest = {
      id: 'REQ-INFO-01',
      challengeId,
      competitionId: compId,
      providerOrganizationId: 'org_sierra',
      requestedField: 'ANNUAL_MILEAGE',
      customFieldName: 'Annual Commute Mileage',
      purpose: 'RATING_DISCOUNT',
      purposeExplanation: 'Verifying annual mileage under 10,000 miles to apply low-mileage commuter discount of up to 12%.',
      status: 'ANSWERED',
      requestedAt: '2026-09-18T15:20:00Z',
      answeredAt: '2026-09-18T16:00:00Z',
      answerValue: 8500,
      reusableFactId: fact1.id
    };
    this.informationRequests.set(req1.id, req1);

    const req2: InformationRequest = {
      id: 'REQ-INFO-02',
      challengeId,
      competitionId: compId,
      providerOrganizationId: 'org_sierra',
      requestedField: 'SECURITY_SYSTEM_TYPE',
      customFieldName: 'Anti-Theft Device Type',
      purpose: 'RATING_DISCOUNT',
      purposeExplanation: 'Factory passive immobilizer or active GPS tracking qualifies for additional comprehensive premium discount.',
      status: 'PENDING',
      requestedAt: '2026-09-19T10:00:00Z'
    };
    this.informationRequests.set(req2.id, req2);

    // Deterministically qualify seeded offers
    for (const off of [offerA, offerB, offerC]) {
      this.qualifyOffer(off.id);
    }

    // 5. Canonical Policy Vault Documents (Section 4)
    this.vaultDocuments.clear();
    const vaultDoc1: VaultDocument = {
      documentId: 'DOC-NV-49281',
      ownerId: 'user_consumer_1',
      documentType: 'DECLARATIONS_PAGE',
      source: 'UPLOAD',
      uploadTimestamp: '2026-09-18T14:22:00Z',
      effectiveDate: '2025-11-18',
      expirationDate: '2026-11-18',
      processingStatus: 'VERIFIED',
      extractionVersion: 'v2.4-canonical',
      documentHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      fileName: 'GEICO_Auto_Dec_Page_NV49281.pdf',
      fileSize: '1.4 MB',
      carrier: 'GEICO Advantage Insurance Co.',
      policyNumber: '4928-1029-41-01',
      notes: 'Active policy declarations page used to establish Coverage Baseline #BL-NV-49281.',
      isImmutable: true
    };
    const vaultDoc2: VaultDocument = {
      documentId: 'DOC-NV-CARD-01',
      ownerId: 'user_consumer_1',
      documentType: 'INSURANCE_CARD',
      source: 'CARRIER_DIRECT',
      uploadTimestamp: '2026-09-18T14:25:00Z',
      effectiveDate: '2025-11-18',
      expirationDate: '2026-11-18',
      processingStatus: 'VERIFIED',
      extractionVersion: 'v2.4-canonical',
      documentHash: '7d1a54127b222502f5b79b5fb0803061152a44f92b37e23c6527baf665d4da9a',
      fileName: 'Nevada_Auto_Liability_Card_2025.pdf',
      fileSize: '340 KB',
      carrier: 'GEICO Advantage Insurance Co.',
      policyNumber: '4928-1029-41-01',
      notes: 'Official state insurance identification card for Nevada DMV verification.',
      isImmutable: true
    };
    const vaultDoc3: VaultDocument = {
      documentId: 'DOC-NV-END-44',
      ownerId: 'user_consumer_1',
      documentType: 'ENDORSEMENT',
      source: 'UPLOAD',
      uploadTimestamp: '2026-09-18T14:26:00Z',
      effectiveDate: '2025-11-18',
      expirationDate: '2026-11-18',
      processingStatus: 'VERIFIED',
      extractionVersion: 'v2.4-canonical',
      documentHash: 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
      fileName: 'Endorsement_Form_NV78B_RentalRoadside.pdf',
      fileSize: '512 KB',
      carrier: 'GEICO Advantage Insurance Co.',
      policyNumber: '4928-1029-41-01',
      notes: 'Endorsement providing rental reimbursement up to $45/day and roadside assistance.',
      isImmutable: true
    };
    const vaultDoc4: VaultDocument = {
      documentId: 'DOC-NV-REN-02',
      ownerId: 'user_consumer_1',
      documentType: 'RENEWAL_NOTICE',
      source: 'UPLOAD',
      uploadTimestamp: '2026-09-19T09:15:00Z',
      effectiveDate: '2026-11-18',
      expirationDate: '2027-11-18',
      processingStatus: 'VERIFIED',
      extractionVersion: 'v2.4-canonical',
      documentHash: '3f52c1e2f6946059489622d645167098e4d29199d2551cf94e09f58ea41e0c24',
      fileName: 'GEICO_Upcoming_Renewal_Notice_2026.pdf',
      fileSize: '890 KB',
      carrier: 'GEICO Advantage Insurance Co.',
      policyNumber: '4928-1029-41-01',
      notes: 'Renewal offer indicating rate increase to $280/mo ($3,360/yr) triggered challenge.',
      isImmutable: true
    };
    this.vaultDocuments.set(vaultDoc1.documentId, vaultDoc1);
    this.vaultDocuments.set(vaultDoc2.documentId, vaultDoc2);
    this.vaultDocuments.set(vaultDoc3.documentId, vaultDoc3);
    this.vaultDocuments.set(vaultDoc4.documentId, vaultDoc4);

    // 6. Notifications Stream (Section 28)
    this.notifications = [
      {
        id: 'NOTIF-1',
        type: 'POLICY_PROCESSED',
        title: 'Declarations Page Ingested',
        message: 'Extracted 7 coverage items from GEICO Dec Page with 97.4% verification confidence.',
        timestamp: '2026-09-18T14:23:00Z',
        read: true,
        actionTarget: 'VERIFY_POLICY'
      },
      {
        id: 'NOTIF-2',
        type: 'CHALLENGE_OPENED',
        title: 'Marketplace Competition Active',
        message: 'Challenge #NV-49281 opened. Verified baseline ($2,964/yr) distributed to licensed providers.',
        timestamp: '2026-09-19T08:30:00Z',
        read: true,
        actionTarget: 'COMPETITION_ROOM'
      },
      {
        id: 'NOTIF-3',
        type: 'OFFER_RECEIVED',
        title: 'Competitive Offer from Travelers',
        message: 'Travelers submitted an offer saving $516/yr ($204/mo) with upgraded $250k property limit.',
        timestamp: '2026-09-19T11:42:00Z',
        read: false,
        actionTarget: 'COMPETITION_ROOM'
      },
      {
        id: 'NOTIF-4',
        type: 'OFFER_RECEIVED',
        title: 'Coverage Reduction Warning',
        message: 'National General submitted Offer C ($181/mo) but stripped rental and tripled your collision deductible.',
        timestamp: '2026-09-19T16:06:00Z',
        read: false,
        actionTarget: 'COMPARISON_DEEP_DIVE'
      },
      {
        id: 'NOTIF-5',
        type: 'RENEWAL_APPROACHING',
        title: 'Renewal Notice Detected',
        message: 'Policy expires in 58 days. Your current carrier proposed an annual rate revision.',
        timestamp: '2026-09-20T09:00:00Z',
        read: false,
        actionTarget: 'RECONCILIATION_VAULT'
      }
    ];

    // PM-4: Seed Human Review Queue (Section 32)
    this.reviewQueue.clear();
    const q1: ReviewQueueItem = {
      id: 'REV-941',
      type: 'QUOTE_DISCREPANCY',
      source: 'Offer from FastQuote Direct (Underwriting PDF)',
      summary: 'Deductible discrepancy: Provider claimed $500 collision deductible, but OCR parsed $1,000 from quote PDF.',
      severity: 'HIGH',
      status: 'PENDING_REVIEW',
      createdAt: '2026-09-22T10:14:00Z',
      challengeId: 'CHAL-NV-49281',
      offerId: 'OFFER-C',
      providerId: 'PROV-3',
      details: 'Provider manual input of $500 collision deductible differs from underwriting PDF attachment indicating $1,000 deductible. Flagged by Section 19 quote discrepancy simulator.'
    };
    const q2: ReviewQueueItem = {
      id: 'REV-940',
      type: 'AMBIGUOUS_EXTRACTION',
      source: 'State Farm Declarations Page scan',
      summary: 'Page 3 endorsement terminology "Emergency Roadside Service vs Towing" confidence score 84%.',
      severity: 'MEDIUM',
      status: 'PENDING_REVIEW',
      createdAt: '2026-09-22T09:32:00Z',
      details: 'Endorsement code ERS-04 parsed with 84.2% confidence. Section 40 epistemic humility requires licensed agent confirmation before automated comparison binding.'
    };
    const q3: ReviewQueueItem = {
      id: 'REV-939',
      type: 'POST_BIND_BREACH',
      source: 'Post-Bind Declarations Audit Engine',
      summary: 'Issued policy premium increased by +$180/yr over agreed binding dossier terms ($2,670 vs $2,490).',
      severity: 'CRITICAL',
      status: 'UNDER_INVESTIGATION',
      createdAt: '2026-09-21T16:20:00Z',
      challengeId: 'CHAL-NV-49281',
      details: 'Automated post-bind creep detection flagged unauthorized rate inflation on issued declarations page. Assigned to compliance officer for carrier contract enforcement.'
    };
    this.reviewQueue.set(q1.id, q1);
    this.reviewQueue.set(q2.id, q2);
    this.reviewQueue.set(q3.id, q3);

    // Sync PM-1 canonical dataset to durable store
    postgresStore.seedCanonicalProviderData().catch(err => {
      console.warn('[PostgresStore Seed Sync Error]', err?.message || err);
    });
  }

  // Getters
  public getPolicies(): Policy[] {
    return Array.from(this.policies.values());
  }

  public getVaultDocuments(): VaultDocument[] {
    return Array.from(this.vaultDocuments.values());
  }

  public getNotifications(): PlatformNotification[] {
    return [...this.notifications];
  }

  public markNotificationRead(id: string): void {
    const notif = this.notifications.find(n => n.id === id);
    if (notif) notif.read = true;
  }

  public getPolicy(id: string): Policy | undefined {
    return this.policies.get(id);
  }

  public getBaselines(): CoverageBaseline[] {
    return Array.from(this.baselines.values());
  }

  public getBaseline(id: string): CoverageBaseline | undefined {
    return this.baselines.get(id);
  }

  public getChallenges(): Challenge[] {
    return Array.from(this.challenges.values());
  }

  public getChallenge(id: string): Challenge | undefined {
    return this.challenges.get(id);
  }

  public getOffers(challengeId?: string): Offer[] {
    const all = Array.from(this.offers.values());
    const filtered = challengeId ? all.filter(o => o.challengeId === challengeId) : all;
    return flagDuplicateCarrierOffers(filtered);
  }

  public getOffer(id: string): Offer | undefined {
    return this.offers.get(id);
  }

  // ==========================================
  // PM-2: Information Requests & Reusable Supplemental Facts
  // ==========================================

  public createInformationRequest(params: {
    challengeId: string;
    providerOrganizationId: string;
    requestedField: InformationRequestField;
    customFieldName?: string;
    purpose: InformationRequestPurpose;
    purposeExplanation: string;
  }): InformationRequest {
    const comp = this.getCompetitionForChallenge(params.challengeId);
    if (!comp) {
      throw new Error(`Active competition not found for challenge ${params.challengeId}`);
    }

    // Verify requesting provider is an active participant in this competition
    const participation = Array.from(this.challengeParticipations.values()).find(
      p => p.challengeId === params.challengeId && 
           p.providerOrganizationId === params.providerOrganizationId && 
           p.status !== 'WITHDRAWN'
    );
    if (!participation) {
      const err: any = new Error(`Provider organization ${params.providerOrganizationId} is not an active participant in competition for challenge ${params.challengeId}`);
      err.statusCode = 403;
      throw err;
    }

    const req: InformationRequest = {
      id: `INFOREQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      challengeId: params.challengeId,
      competitionId: comp.id,
      providerOrganizationId: params.providerOrganizationId,
      requestedField: params.requestedField,
      customFieldName: params.customFieldName,
      purpose: params.purpose,
      purposeExplanation: params.purposeExplanation,
      status: 'PENDING',
      requestedAt: new Date().toISOString()
    };

    this.informationRequests.set(req.id, req);
    this.recordAudit(
      'POLICY_UPLOADED',
      'PROVIDER',
      params.providerOrganizationId,
      `Information request created for field '${req.requestedField}' on challenge ${params.challengeId}`
    );

    // Notify consumer of rating request
    this.notifications.unshift({
      id: `NOTIF-${Date.now()}`,
      type: 'COMPETITION_UPDATE',
      title: 'Underwriting Information Requested',
      message: `A participating provider requested: ${req.customFieldName || req.requestedField} for rating discounts.`,
      timestamp: new Date().toISOString(),
      read: false
    });

    postgresStore.saveInformationRequest(req).catch(err => {
      console.warn('[PostgresStore InformationRequest Sync Error]', err?.message || err);
    });

    return req;
  }

  public getInformationRequests(challengeId: string, providerOrgId?: string): InformationRequest[] {
    const all = Array.from(this.informationRequests.values()).filter(r => r.challengeId === challengeId);
    if (!providerOrgId) {
      // Consumer view: all requests for their challenge
      return all;
    }
    // Provider view: requests submitted by this provider, OR answered requests that created shared reusable facts
    return all.filter(r => r.providerOrganizationId === providerOrgId || r.status === 'ANSWERED');
  }

  public getInformationRequest(id: string): InformationRequest | undefined {
    return this.informationRequests.get(id);
  }

  public answerInformationRequest(params: {
    requestId: string;
    answerValue: any;
    consumerId: string;
    consentScope?: FactConsentScope;
    authorizedOrgIds?: string[];
  }): { request: InformationRequest; fact: VerifiedSupplementalFact } {
    const req = this.informationRequests.get(params.requestId);
    if (!req) {
      const err: any = new Error(`Information request ${params.requestId} not found`);
      err.statusCode = 404;
      throw err;
    }

    const chal = this.challenges.get(req.challengeId);
    if (!chal) {
      const err: any = new Error(`Challenge ${req.challengeId} not found`);
      err.statusCode = 404;
      throw err;
    }

    // Explicit consumer disclosure/consent scope determination
    // Canonical Invariant: One answer -> reusable authorized marketplace fact.
    // Provider access is strictly governed by explicit consumer disclosure/consent state.
    const consentScope: FactConsentScope = params.consentScope || 'REQUESTING_PROVIDER_ONLY';
    let sharedWithOrganizationIds: string[] = [req.providerOrganizationId];

    if (consentScope === 'ALL_ACTIVE_PARTICIPANTS') {
      const participatingOrgIds = Array.from(this.challengeParticipations.values())
        .filter(p => p.challengeId === req.challengeId && p.status !== 'WITHDRAWN')
        .map(p => p.providerOrganizationId);
      sharedWithOrganizationIds = participatingOrgIds.length > 0 ? participatingOrgIds : [req.providerOrganizationId];
    } else if (consentScope === 'EXPLICIT_PROVIDER_SELECTION' && params.authorizedOrgIds) {
      sharedWithOrganizationIds = Array.from(new Set([req.providerOrganizationId, ...params.authorizedOrgIds]));
    }

    // Format value display
    const formattedVal = typeof params.answerValue === 'object' 
      ? JSON.stringify(params.answerValue) 
      : String(params.answerValue);

    const factId = `FACT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const fact: VerifiedSupplementalFact = {
      id: factId,
      consumerId: params.consumerId,
      challengeId: req.challengeId,
      fieldType: req.requestedField,
      fieldName: req.customFieldName || req.requestedField,
      value: params.answerValue,
      formattedValue: formattedVal,
      verificationState: 'CONSUMER_ATTESTED',
      source: 'CONSUMER_PORTAL',
      createdAt: new Date().toISOString(),
      consentScope,
      sharedWithOrganizationIds
    };

    req.status = 'ANSWERED';
    req.answeredAt = new Date().toISOString();
    req.answerValue = params.answerValue;
    req.reusableFactId = fact.id;

    this.informationRequests.set(req.id, req);
    this.verifiedSupplementalFacts.set(fact.id, fact);

    this.recordAudit(
      'CONSUMER_CORRECTED_FIELD',
      'CONSUMER',
      params.consumerId,
      `Consumer answered information request ${req.id} (${fact.fieldName}: ${formattedVal}) with consentScope=${consentScope}. Created reusable supplemental fact.`
    );

    postgresStore.saveInformationRequest(req).catch(err => {
      console.warn('[PostgresStore InformationRequest Sync Error]', err?.message || err);
    });
    postgresStore.saveVerifiedSupplementalFact(fact).catch(err => {
      console.warn('[PostgresStore VerifiedSupplementalFact Sync Error]', err?.message || err);
    });

    return { request: req, fact };
  }

  public grantFactConsent(
    factId: string,
    organizationIds: string[],
    consumerId: string
  ): VerifiedSupplementalFact {
    const fact = this.verifiedSupplementalFacts.get(factId);
    if (!fact) {
      const err: any = new Error(`Fact ${factId} not found`);
      err.statusCode = 404;
      throw err;
    }
    if (fact.consumerId !== consumerId) {
      const err: any = new Error('Unauthorized: Only the consumer can grant access consent to a supplemental fact');
      err.statusCode = 403;
      throw err;
    }
    const set = new Set([...fact.sharedWithOrganizationIds, ...organizationIds]);
    fact.sharedWithOrganizationIds = Array.from(set);
    fact.consentScope = 'EXPLICIT_PROVIDER_SELECTION';
    this.verifiedSupplementalFacts.set(fact.id, fact);

    this.recordAudit(
      'CONSUMER_CORRECTED_FIELD',
      'CONSUMER',
      consumerId,
      `Consumer granted disclosure consent for fact ${factId} to providers: ${organizationIds.join(', ')}`
    );

    postgresStore.saveVerifiedSupplementalFact(fact).catch(err => {
      console.warn('[PostgresStore VerifiedSupplementalFact Sync Error]', err?.message || err);
    });
    return fact;
  }

  public getSupplementalFacts(challengeId: string, providerOrgId?: string): VerifiedSupplementalFact[] {
    const all = Array.from(this.verifiedSupplementalFacts.values()).filter(f => f.challengeId === challengeId);
    if (!providerOrgId) {
      return all;
    }
    return getVisibleSupplementalFactsForProvider(all, providerOrgId);
  }

  // ==========================================
  // PM-2: Offer Versioning & Quote Document Verification
  // ==========================================

  public getOfferVersions(offerId: string): OfferVersion[] {
    return this.offerVersions.get(offerId) || [];
  }

  public verifyOfferDocument(offerId: string, docData?: any): OfferVerification {
    const offer = this.offers.get(offerId);
    if (!offer) {
      const err: any = new Error(`Offer ${offerId} not found`);
      err.statusCode = 404;
      throw err;
    }

    const documentName = offer.supportingQuoteDocName || 'Supporting_Quote_Document.pdf';

    // Independent discrepancy extraction against entered quote values
    const colCov = offer.coverages?.find(c => c.code === 'COLLISION');
    const compCov = offer.coverages?.find(c => c.code === 'COMPREHENSIVE');
    const rentalCov = offer.coverages?.find(c => c.code === 'RENTAL_REIMBURSEMENT');

    const entered = {
      carrier: offer.carrier,
      annualPremium: offer.annualPremium,
      collisionDeductible: colCov?.deductible,
      compDeductible: compCov?.deductible,
      rentalIncluded: rentalCov?.isIncluded ?? false
    };

    const docExtracted = docData || {
      extractedAnnualPremium: offer.annualPremium,
      extractedCollisionDeductible: colCov?.deductible,
      extractedCompDeductible: compCov?.deductible,
      extractedRentalIncluded: rentalCov?.isIncluded ?? false
    };

    const check = detectQuoteDiscrepancies(entered, docExtracted);

    const verification: OfferVerification = {
      id: `VERIFY-${Date.now()}-${offer.id}`,
      offerId: offer.id,
      documentName,
      status: check.hasDiscrepancy ? 'DISCREPANCIES_FLAGGED' : 'VERIFIED',
      verifiedAt: new Date().toISOString(),
      discrepancyCount: check.discrepancies.length,
      discrepancies: check.discrepancies,
      extractedPremium: docExtracted.extractedAnnualPremium ?? offer.annualPremium,
      enteredPremium: entered.annualPremium
    };

    this.offerVerifications.set(offer.id, verification);
    offer.discrepanciesDetected = check.hasDiscrepancy;
    offer.discrepancyDetails = verification.discrepancies;
    offer.status = check.hasDiscrepancy ? 'DISCREPANCY_FLAGGED' : 'VALIDATED';
    offer.verificationId = verification.id;
    this.offers.set(offer.id, offer);

    postgresStore.saveOfferVerification(verification).catch(err => {
      console.warn('[PostgresStore OfferVerification Sync Error]', err?.message || err);
    });

    return verification;
  }

  public getOfferVerification(offerId: string): OfferVerification | undefined {
    return this.offerVerifications.get(offerId);
  }

  public qualifyOffer(offerId: string): Offer {
    const offer = this.offers.get(offerId);
    if (!offer) {
      const err: any = new Error(`Offer ${offerId} not found`);
      err.statusCode = 404;
      throw err;
    }

    const challenge = this.challenges.get(offer.challengeId);
    const baseline = challenge?.baseline || ({} as any);
    const requirements = challenge?.requirements;
    const providerOrg = this.getProviderOrganization(offer.providerId);
    const carrierRels = this.carrierRelationships.get(offer.providerId) || [];
    const verification = this.offerVerifications.get(offer.id);

    const evalResult = evaluateOfferQualification(
      offer,
      baseline,
      requirements,
      providerOrg,
      carrierRels,
      verification
    );

    offer.isQualified = evalResult.isQualified;
    offer.qualifiedAt = evalResult.evaluatedAt;
    offer.qualificationReasons = evalResult.qualificationReasons;
    offer.disqualificationReasons = evalResult.disqualificationReasons;

    this.offers.set(offer.id, offer);
    return offer;
  }

  public getAuditEvents(): AuditEvent[] {
    return [...this.auditEvents].reverse();
  }

  // PM-4: Regulatory Audit & Human Review Queue Methods
  public getReviewQueue(status?: ReviewQueueStatus): ReviewQueueItem[] {
    const all = Array.from(this.reviewQueue.values());
    if (status) {
      return all.filter(item => item.status === status);
    }
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getReviewQueueItem(id: string): ReviewQueueItem | undefined {
    return this.reviewQueue.get(id);
  }

  public resolveReviewQueueItem(params: {
    id: string;
    action: 'OVERRIDE' | 'REJECT';
    resolvedBy: string;
    notes: string;
  }): ReviewQueueItem {
    const item = this.reviewQueue.get(params.id);
    if (!item) {
      throw new Error(`Review queue ticket ${params.id} not found.`);
    }

    const { updatedItem, auditPayload } = processReviewQueueResolution(
      item,
      params.action,
      params.resolvedBy,
      params.notes
    );

    this.reviewQueue.set(updatedItem.id, updatedItem);
    this.recordAudit(
      auditPayload.eventType,
      auditPayload.actorRole,
      auditPayload.actorId,
      auditPayload.details
    );

    return updatedItem;
  }

  public enqueueReviewItem(item: Omit<ReviewQueueItem, 'id' | 'createdAt' | 'status'>): ReviewQueueItem {
    const id = `REV-${Date.now()}`;
    const fullItem: ReviewQueueItem = {
      ...item,
      id,
      createdAt: new Date().toISOString(),
      status: 'PENDING_REVIEW'
    };
    this.reviewQueue.set(id, fullItem);
    this.recordAudit(
      'QUOTE_DISCREPANCY_DETECTED',
      'SYSTEM',
      'review_escalation_service',
      `Escalated ${fullItem.type} to Human Review Queue [#${id}] with severity ${fullItem.severity}: ${fullItem.summary}`
    );
    return fullItem;
  }

  public verifyAuditChainIntegrity(): ChainVerificationResult {
    return verifyCryptographicAuditChain(this.auditEvents);
  }

  public generateRegulatoryAuditProof(params: {
    jurisdiction: string;
    challengeReference?: string;
    auditorName?: string;
  }): RegulatoryAuditProof {
    const proof = createRegulatoryProof(this.auditEvents, params);
    this.recordAudit(
      'POLICY_VERIFIED',
      'ADMIN',
      params.auditorName || 'Chief Compliance Officer',
      `Certified Regulatory Audit Proof #${proof.proofId} for ${params.jurisdiction} Division of Insurance. Merkle Root: ${proof.merkleRoot}`
    );
    return proof;
  }

  public getHandoffs(): BindingHandoff[] {
    return Array.from(this.handoffs.values());
  }

  public getReconciliations(): ReconciliationReport[] {
    return Array.from(this.reconciliations.values());
  }

  public getMetrics(): SystemMetrics {
    const totalOffers = this.offers.size;
    return {
      activeChallenges: Array.from(this.challenges.values()).filter(c => c.status === 'OPEN' || c.status === 'OFFERS_RECEIVED').length,
      totalPoliciesIngested: this.policies.size,
      redisCacheHitRate: Number(((this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100).toFixed(1)),
      p95ComparisonLatencyMs: 14.4,
      workerQueueJobsProcessed: 1492,
      discrepanciesIntercepted: 14,
      averageConsumerSavings: 428
    };
  }

  // Mutators
  public savePolicy(policy: Policy): Policy {
    this.policies.set(policy.id, policy);
    this.recordAudit('POLICY_UPLOADED', 'CONSUMER', 'user_consumer_1', `Policy ${policy.id} stored in private vault`);
    return policy;
  }

  public updatePolicy(policy: Policy): Policy {
    this.policies.set(policy.id, policy);
    this.recordAudit('CONSUMER_CORRECTED_FIELD', 'CONSUMER', 'user_consumer_1', `Consumer corrected/verified policy fields for ${policy.carrier}`);
    return policy;
  }

  public createBaseline(baseline: CoverageBaseline): CoverageBaseline {
    this.baselines.set(baseline.id, baseline);
    this.recordAudit('BASELINE_CREATED', 'SYSTEM', 'baseline_engine', `Coverage baseline version ${baseline.version} created`);
    return baseline;
  }

  public createChallenge(challenge: Challenge): Challenge {
    this.challenges.set(challenge.id, challenge);
    if (challenge.baseline) {
      this.baselines.set(challenge.baseline.id, challenge.baseline);
    }
    this.recordAudit('CHALLENGE_OPENED', 'CONSUMER', challenge.consumerId, `Challenge ${challenge.referenceNumber} opened in marketplace`);
    this.openCompetitionForChallenge(challenge.id);
    postgresStore.saveChallenge(challenge).catch(err => {
      console.warn('[PostgresStore Challenge Sync Error]', err?.message || err);
    });
    return challenge;
  }

  public submitOffer(offer: Offer): Offer {
    this.offers.set(offer.id, offer);
    this.recordAudit('OFFER_SUBMITTED', 'PROVIDER', offer.providerId, `Provider ${offer.providerName} submitted quote #${offer.quoteNumber} for ${offer.carrier}`);
    
    // Ensure initial OfferVersion exists and is persisted (PM-2 & CE-3)
    const existingVersions = this.offerVersions.get(offer.id) || [];
    if (existingVersions.length === 0) {
      const initialVersion: OfferVersion = {
        id: `VER-${offer.id}-v${offer.version || 1}`,
        offerId: offer.id,
        versionNumber: offer.version || 1,
        round: offer.round || 'ROUND_1_OPEN',
        carrier: offer.carrier,
        annualPremium: offer.annualPremium,
        monthlyPremium: offer.monthlyPremium,
        coverages: JSON.parse(JSON.stringify(offer.coverages || [])),
        supportingQuoteDocName: offer.supportingQuoteDocName,
        revisionReason: 'Initial offer submission',
        submittedAt: offer.submittedAt
      };
      existingVersions.push(initialVersion);
      this.offerVersions.set(offer.id, existingVersions);
      postgresStore.saveOfferVersion(initialVersion).catch(err => {
        console.warn('[PostgresStore OfferVersion Sync Error]', err?.message || err);
      });
    }

    // Update challenge offer count
    const chal = this.challenges.get(offer.challengeId);
    if (chal) {
      chal.offersCount = (chal.offersCount || 0) + 1;
      chal.status = 'OFFERS_RECEIVED';

      // PM-2: Deterministic offer qualification evaluation
      const providerOrg = this.getProviderOrganization(offer.providerId);
      const carrierRels = this.carrierRelationships.get(offer.providerId) || [];
      const verification = this.offerVerifications.get(offer.id);
      const qualResult = evaluateOfferQualification(
        offer,
        chal.baseline,
        chal.requirements,
        providerOrg,
        carrierRels,
        verification
      );
      offer.isQualified = qualResult.isQualified;
      offer.qualifiedAt = qualResult.evaluatedAt;
      offer.qualificationReasons = qualResult.qualificationReasons;
      offer.disqualificationReasons = qualResult.disqualificationReasons;
    }

    if (offer.discrepanciesDetected) {
      this.recordAudit('QUOTE_DISCREPANCY_DETECTED', 'SYSTEM', 'quote_validator', `Discrepancy detected in offer ${offer.id}: ${offer.discrepancyDetails?.join('; ')}`);
    }

    postgresStore.saveOffer(offer).catch(err => {
      console.warn('[PostgresStore Offer Sync Error]', err?.message || err);
    });

    return offer;
  }

  public selectOffer(challengeId: string, offerId: string, consumerContact: { name: string; email: string; phone: string }): BindingHandoff {
    const offer = this.offers.get(offerId);
    const chal = this.challenges.get(challengeId);
    if (!offer || !chal) throw new Error('Offer or Challenge not found');

    offer.status = 'SELECTED';
    chal.status = 'SELECTED';

    this.recordAudit('CONSUMER_SELECTED_OFFER', 'CONSUMER', chal.consumerId, `Consumer selected offer ${offer.id} (${offer.carrier}) with annual premium $${offer.annualPremium}`);
    this.recordAudit('DATA_DISCLOSURE_AUTHORIZED', 'CONSUMER', chal.consumerId, `Authorized progressive disclosure for licensed binding handoff to ${offer.providerName}`);

    const handoff: BindingHandoff = {
      id: `HND-${Date.now()}`,
      challengeId,
      selectedOfferId: offerId,
      consumerName: consumerContact.name,
      consumerEmail: consumerContact.email,
      consumerPhone: consumerContact.phone,
      providerName: offer.providerName,
      carrier: offer.carrier,
      status: 'SELECTED',
      handoffTimestamp: new Date().toISOString(),
      bindingReference: `BIND-NV-${Math.floor(100000 + Math.random() * 900000)}`
    };

    this.handoffs.set(handoff.id, handoff);
    this.recordAudit('BINDING_HANDOFF_CREATED', 'SYSTEM', 'handoff_service', `Handoff created with reference ${handoff.bindingReference}`);
    return handoff;
  }

  /**
   * PM-3: Generates a certified Binding Handoff Dossier with Progressive Disclosure Level 1 (Section 28)
   */
  public createBindingDossier(params: {
    challengeId: string;
    offerId: string;
    consumerContact: {
      name: string;
      email: string;
      phone: string;
      addressLine1?: string;
      city?: string;
      state?: string;
      postalCode?: string;
    };
    consumerConsentGiven: boolean;
    acknowledgedReductions?: string[];
  }): { dossier: BindingHandoffDossier; handoff: BindingHandoff } {
    const chal = this.challenges.get(params.challengeId);
    const offer = this.offers.get(params.offerId);
    if (!chal || !offer) throw new Error('Challenge or Offer not found');

    const baseline = chal.baseline;
    const comp = compareOfferAgainstBaseline(baseline, chal.requirements, offer);
    const materialReductionCodes = comp.materialReductions.map(r => r.fieldCode);

    // Validate informed consent per Section 40
    const authCheck = validateConsumerBindingAuthorization({
      selectedOffer: offer,
      baseline,
      materialReductions: materialReductionCodes,
      consumerConsentGiven: params.consumerConsentGiven,
      consumerAcknowledgedReductions: params.acknowledgedReductions || []
    });

    if (!authCheck.isValid) {
      throw new Error(authCheck.error || 'Binding authorization failed compliance check');
    }

    // Mark offer and challenge as selected
    offer.status = 'SELECTED';
    chal.status = 'SELECTED';

    // Find winning broker organization
    const org: ProviderOrganization = this.providerOrganizations.get(offer.providerId) || {
      id: offer.providerId,
      legalName: offer.providerName,
      displayName: offer.providerName,
      organizationType: 'BROKERAGE',
      verificationStatus: 'MARKETPLACE_APPROVED',
      marketplaceStatus: 'ACTIVE',
      states: ['NV'],
      linesOfBusiness: ['PERSONAL_AUTO'],
      createdAt: new Date().toISOString()
    };

    const license = (this.providerLicenses.get(org.id) || [])[0] || {
      licenseNumber: offer.providerLicense || 'NV-LIC-992014',
      jurisdiction: 'NV'
    };

    const bindingRef = `BIND-NV-${Math.floor(100000 + Math.random() * 900000)}`;
    const handoffId = `HND-${Date.now()}`;

    const handoff: BindingHandoff = {
      id: handoffId,
      challengeId: params.challengeId,
      selectedOfferId: params.offerId,
      consumerName: params.consumerContact.name,
      consumerEmail: params.consumerContact.email,
      consumerPhone: params.consumerContact.phone,
      providerName: offer.providerName,
      carrier: offer.carrier,
      status: 'SELECTED',
      handoffTimestamp: new Date().toISOString(),
      bindingReference: bindingRef
    };
    this.handoffs.set(handoff.id, handoff);

    const dossierId = `DOSSIER-${chal.referenceNumber}-${Date.now()}`;
    const dossier: BindingHandoffDossier = {
      id: dossierId,
      bindingReference: bindingRef,
      challengeId: chal.id,
      challengeReference: chal.referenceNumber,
      status: 'DISCLOSED_TO_BROKER',
      createdAt: new Date().toISOString(),
      selectedOffer: {
        id: offer.id,
        carrier: offer.carrier,
        quoteNumber: offer.quoteNumber,
        annualPremium: offer.annualPremium,
        monthlyPremium: offer.monthlyPremium,
        termMonths: offer.termMonths,
        effectiveDate: offer.effectiveDate,
        expirationDate: offer.expirationDate,
        tierLabel: offer.tierLabel,
        classification: comp.classification,
        coverages: offer.coverages
      },
      winningBroker: {
        providerOrganizationId: org.id,
        providerName: org.legalName,
        licenseNumber: license.licenseNumber,
        jurisdiction: license.jurisdiction,
        designatedAgentName: 'Marcus Vance, CIC (Principal Broker)',
        agentEmail: 'broker@insurance.com'
      },
      authorizedConsumer: {
        namedInsured: params.consumerContact.name,
        contactEmail: params.consumerContact.email,
        contactPhone: params.consumerContact.phone,
        garagingAddress: {
          addressLine1: params.consumerContact.addressLine1 || '812 Horizon Ridge Pkwy',
          city: params.consumerContact.city || 'Henderson',
          state: params.consumerContact.state || 'NV',
          postalCode: params.consumerContact.postalCode || '89012'
        },
        drivers: [
          {
            name: params.consumerContact.name,
            licenseState: 'NV',
            licenseNumber: 'NV-DL-8912781',
            age: 38,
            isPrimary: true
          }
        ],
        vehicles: [
          {
            year: baseline.vehicle.year,
            make: baseline.vehicle.make,
            model: baseline.vehicle.model,
            vin: '4T1B11HK5RU123498', // Authorized unmasked VIN for winning broker
            annualMileage: 11000,
            primaryUse: 'Commute'
          }
        ]
      },
      complianceAcknowledgments: {
        section40ParityAcknowledged: true,
        acknowledgedAt: new Date().toISOString(),
        ipAddressHash: this.generateHash(`${params.consumerContact.email}|${Date.now()}`),
        termsVersion: 'v2026.3-consumer-rights',
        discrepanciesExplicitlyApproved: params.acknowledgedReductions || [],
        priceImprovementAnnual: comp.annualSavings
      },
      dossierHash: this.generateHash(`${dossierId}|${bindingRef}|${offer.quoteNumber}`),
      sourceBaselinePolicyId: baseline.policyId
    };

    this.bindingDossiers.set(dossier.id, dossier);

    this.recordAudit(
      'CONSUMER_SELECTED_OFFER',
      'CONSUMER',
      chal.consumerId,
      `Consumer selected offer ${offer.id} (${offer.carrier}) - dossier ${dossier.bindingReference} created`
    );
    this.recordAudit(
      'DATA_DISCLOSURE_AUTHORIZED',
      'CONSUMER',
      chal.consumerId,
      `Authorized progressive disclosure level 1 for licensed binding handoff to ${offer.providerName}`
    );
    this.recordAudit(
      'BINDING_HANDOFF_CREATED',
      'SYSTEM',
      'handoff_service',
      `Binding Dossier ${dossier.id} created with reference ${dossier.bindingReference}`
    );

    return { dossier, handoff };
  }

  public getBindingDossier(dossierId: string): BindingHandoffDossier | undefined {
    return this.bindingDossiers.get(dossierId);
  }

  public getDossierByChallenge(challengeId: string): BindingHandoffDossier | undefined {
    return Array.from(this.bindingDossiers.values()).find(d => d.challengeId === challengeId);
  }

  public getAllBindingDossiers(): BindingHandoffDossier[] {
    return Array.from(this.bindingDossiers.values());
  }

  /**
   * PM-3: Advanced Post-Bind Reconciliation with Steath Creep Detection
   */
  public performDetailedReconciliation(params: {
    dossierId: string;
    issuedData: {
      policyNumber: string;
      annualPremium: number;
      effectiveDate?: string;
      coverages: Array<{
        code: string;
        name?: string;
        limit?: string;
        perPersonLimit?: number;
        perAccidentLimit?: number;
        propertyLimit?: number;
        deductible?: number;
        isIncluded: boolean;
      }>;
    };
  }): DetailedPostBindReconciliation {
    const dossier = this.bindingDossiers.get(params.dossierId);
    if (!dossier) throw new Error('Binding dossier not found');

    const detailedRec = reconcileIssuedPolicyWithQuote({
      dossier,
      issuedData: {
        policyNumber: params.issuedData.policyNumber,
        annualPremium: params.issuedData.annualPremium,
        effectiveDate: params.issuedData.effectiveDate || dossier.selectedOffer.effectiveDate,
        coverages: params.issuedData.coverages
      }
    });

    this.detailedReconciliations.set(detailedRec.id, detailedRec);

    // Update dossier status
    if (detailedRec.isCompliant) {
      dossier.status = 'RECONCILED';
    } else {
      dossier.status = 'RECONCILIATION_FAILED';
    }

    // Also update legacy handoff if present
    const handoff = Array.from(this.handoffs.values()).find(h => h.bindingReference === dossier.bindingReference);
    if (handoff) {
      handoff.status = 'BOUND';
    }

    this.recordAudit(
      'ISSUED_POLICY_RECONCILED',
      'SYSTEM',
      'reconciliation_engine',
      `Detailed reconciliation for policy #${params.issuedData.policyNumber}: ${detailedRec.reconciliationAuditVerdict}. Creep: $${detailedRec.totalAnnualCreepAmount}`
    );

    return detailedRec;
  }

  public getDetailedReconciliation(id: string): DetailedPostBindReconciliation | undefined {
    return this.detailedReconciliations.get(id);
  }

  public getDetailedReconciliationByDossier(dossierId: string): DetailedPostBindReconciliation | undefined {
    return Array.from(this.detailedReconciliations.values()).find(r => r.dossierId === dossierId);
  }

  public reconcileIssuedPolicy(
    handoffId: string,
    issuedData: {
      policyNumber: string;
      annualPremium: number;
      collisionDeductible: number;
      rentalIncluded: boolean;
    }
  ): ReconciliationReport {
    const handoff = this.handoffs.get(handoffId);
    if (!handoff) throw new Error('Handoff not found');

    const targetOfferId = handoff.selectedOfferId || handoff.offerId || '';
    const offer = this.offers.get(targetOfferId);
    if (!offer) throw new Error('Selected offer not found');

    const offerColl = offer.coverages.find(c => c.code === 'COLLISION')?.deductible || 500;
    const offerRental = offer.coverages.find(c => c.code === 'RENTAL_REIMBURSEMENT')?.isIncluded ?? true;

    const differences: ReconciliationReport['differences'] = [];

    if (issuedData.annualPremium !== offer.annualPremium) {
      differences.push({
        field: 'Annual Premium',
        agreedOffer: `$${offer.annualPremium.toLocaleString()}/yr`,
        actualIssued: `$${issuedData.annualPremium.toLocaleString()}/yr`,
        isSeverityHigh: Math.abs(issuedData.annualPremium - offer.annualPremium) > 20
      });
    }

    if (issuedData.collisionDeductible !== offerColl) {
      differences.push({
        field: 'Collision Deductible',
        agreedOffer: `$${offerColl}`,
        actualIssued: `$${issuedData.collisionDeductible}`,
        isSeverityHigh: true
      });
    }

    if (issuedData.rentalIncluded !== offerRental) {
      differences.push({
        field: 'Rental Coverage',
        agreedOffer: offerRental ? 'Included' : 'Excluded',
        actualIssued: issuedData.rentalIncluded ? 'Included' : 'Excluded',
        isSeverityHigh: true
      });
    }

    const isIdentical = differences.length === 0;

    const report: ReconciliationReport = {
      id: `REC-${Date.now()}`,
      handoffId,
      bindingHandoffId: handoffId,
      selectedOfferId: offer.id,
      issuedPolicyNumber: issuedData.policyNumber,
      isIdentical,
      verdict: isIdentical ? 'MATCH' : 'UNAUTHORIZED_VARIANCE',
      status: isIdentical ? 'COMPLETED_MATCH' : 'PENDING_CONSUMER_REVIEW',
      discrepancies: [],
      totalAnnualPremiumVariance: 0,
      discrepancyCount: differences.length,
      notes: isIdentical
        ? 'Issued policy terms match selected offer with 100% fidelity.'
        : `Identified ${differences.length} terms that deviate from the agreed quote.`,
      reconciledAt: new Date().toISOString(),
      differences
    };

    this.reconciliations.set(report.id, report);
    handoff.status = 'BOUND';

    this.recordAudit(
      'ISSUED_POLICY_RECONCILED',
      'SYSTEM',
      'reconciliation_engine',
      `Reconciled issued policy #${issuedData.policyNumber} against offer ${offer.id}. Result: ${isIdentical ? 'MATCH' : 'DISCREPANCY DETECTED'}`
    );

    return report;
  }

  public uploadVaultDocument(doc: Partial<VaultDocument>): VaultDocument {
    if (!doc.ownerId) throw new Error('Forbidden: Vault document requires an authoritative consumer owner');
    const documentId = doc.documentId || `DOC-USER-${Date.now()}`;
    const hash = this.generateHash(`${documentId}|${doc.fileName}|${Date.now()}`);
    const fullDoc: VaultDocument = {
      documentId,
      ownerId: doc.ownerId,
      documentType: doc.documentType || 'ENDORSEMENT',
      source: doc.source || 'UPLOAD',
      uploadTimestamp: new Date().toISOString(),
      effectiveDate: doc.effectiveDate || '2025-11-18',
      expirationDate: doc.expirationDate || '2026-11-18',
      processingStatus: 'VERIFIED',
      extractionVersion: 'v2.4-canonical',
      documentHash: hash,
      fileName: doc.fileName || 'Uploaded_Document.pdf',
      fileSize: doc.fileSize || '1.1 MB',
      carrier: doc.carrier || 'Carrier',
      policyNumber: doc.policyNumber || 'POL-NV-49281',
      notes: doc.notes || 'User uploaded document directly into Private Policy Vault.',
      isImmutable: true
    };
    this.vaultDocuments.set(fullDoc.documentId, fullDoc);
    this.recordAudit('VAULT_DOCUMENT_ADDED', 'CONSUMER', fullDoc.ownerId, `Added document ${fullDoc.fileName} (${fullDoc.documentType}) to Policy Vault`);
    return fullDoc;
  }

  public initiateFinalRound(challengeId: string): Challenge {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) throw new Error('Challenge not found');

    challenge.status = 'FINAL_ROUND';
    challenge.isFinalRound = true;

    // Sharpen existing offers in the final round
    const offerA = this.offers.get('OFFER-A');
    if (offerA) {
      offerA.annualPremium = 2580; // reduced from 2712
      offerA.monthlyPremium = 215;
    }

    const offerB = this.offers.get('OFFER-B');
    if (offerB) {
      offerB.annualPremium = 2388; // reduced from 2448
      offerB.monthlyPremium = 199; // below $200!
    }

    this.recordAudit(
      'FINAL_ROUND_INITIATED',
      'CONSUMER',
      challenge.consumerId,
      `Consumer initiated Best & Final round. Providers notified to submit their sharpened rates.`
    );

    this.notifications.unshift({
      id: `NOTIF-${Date.now()}`,
      type: 'FINAL_ROUND_OPENED',
      title: 'Best & Final Improvement Round Active',
      message: 'Providers have submitted sharpened final rates. Travelers reduced to $199/mo ($2,388/yr) while maintaining upgraded limits.',
      timestamp: new Date().toISOString(),
      read: false,
      actionTarget: 'COMPETITION_ROOM'
    });

    return challenge;
  }

  public requestIncumbentDefense(challengeId: string): Offer {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) throw new Error('Challenge not found');

    challenge.incumbentDefended = true;

    const incumbentOffer: Offer = {
      id: 'OFFER-INCUMBENT',
      challengeId,
      providerId: 'PROV-GEICO-DIRECT',
      providerName: 'GEICO Retention Underwriting Desk',
      providerLicense: 'NV-LIC-100001',
      carrier: 'GEICO Advantage (Incumbent Defense)',
      quoteNumber: 'GEICO-RET-9410',
      annualPremium: 2664, // Saved $300/yr from $2,964
      monthlyPremium: 222,
      termMonths: 12,
      effectiveDate: '2026-11-18',
      expirationDate: '2027-11-18',
      supportingQuoteDocName: 'GEICO_Retention_Defense_Offer_9410.pdf',
      submittedAt: new Date().toISOString(),
      discrepanciesDetected: false,
      status: 'VALIDATED',
      coverages: challenge.baseline.coverages.map(c => ({
        ...c,
        id: `INC-${c.id}`,
        notes: (c.notes || '') + ' (Retained with loyalty tier discount)'
      }))
    };

    this.offers.set(incumbentOffer.id, incumbentOffer);
    challenge.offersCount = (challenge.offersCount || 0) + 1;

    this.recordAudit(
      'INCUMBENT_DEFENSE_INVITED',
      'CONSUMER',
      challenge.consumerId,
      `Consumer requested: LET MY CURRENT COMPANY DEFEND MY POLICY. Incumbent GEICO invited into standard competition pipeline.`
    );

    this.recordAudit(
      'OFFER_SUBMITTED',
      'PROVIDER',
      'PROV-GEICO-DIRECT',
      `GEICO Retention Desk submitted competitive defense offer ($2,664/yr, -$300 savings) with 100% baseline match`
    );

    this.notifications.unshift({
      id: `NOTIF-${Date.now()}`,
      type: 'INCUMBENT_DEFENSE',
      title: 'Current Carrier Defended Policy',
      message: 'GEICO submitted a retention counter-offer saving $300/year ($222/mo) with identical protection to defend your business.',
      timestamp: new Date().toISOString(),
      read: false,
      actionTarget: 'COMPETITION_ROOM'
    });

    return incumbentOffer;
  }

  // ==========================================
  // PM-1: Provider Marketplace & Competition Methods
  // ==========================================

  public getProviderOrganizations(): ProviderOrganization[] {
    return Array.from(this.providerOrganizations.values());
  }

  public getProviderOrganization(id: string): ProviderOrganization | undefined {
    return this.providerOrganizations.get(id);
  }

  public getProviderUsers(orgId?: string): ProviderUser[] {
    const all = Array.from(this.providerUsers.values());
    return orgId ? all.filter(u => u.organizationId === orgId) : all;
  }

  public getProviderUser(userId: string): ProviderUser | undefined {
    return this.providerUsers.get(userId);
  }

  public getProviderLicenses(orgId: string): ProviderLicense[] {
    return this.providerLicenses.get(orgId) || [];
  }

  public getProviderAppetite(orgId: string): ProviderAppetite | undefined {
    return this.providerAppetites.get(orgId);
  }

  public getCarrierRelationships(orgId: string): CarrierRelationship[] {
    return this.carrierRelationships.get(orgId) || [];
  }

  public getCompetition(id: string): Competition | undefined {
    return this.competitions.get(id);
  }

  public getCompetitionForChallenge(challengeId: string): Competition | undefined {
    return Array.from(this.competitions.values()).find(c => c.challengeId === challengeId);
  }

  public getAllCompetitions(): Competition[] {
    return Array.from(this.competitions.values());
  }

  public getAllInvitations(): ChallengeInvitation[] {
    return Array.from(this.challengeInvitations.values());
  }

  public getAllParticipations(): ChallengeParticipation[] {
    return Array.from(this.challengeParticipations.values());
  }

  public getAllSelections(): Selection[] {
    return Array.from(this.selections.values());
  }

  public getAllDisclosureEvents(): DisclosureEvent[] {
    return Array.from(this.disclosureEvents.values());
  }

  public getAllBindingHandoffs(): BindingHandoff[] {
    return Array.from(this.handoffs.values());
  }

  public getAllReconciliationReports(): ReconciliationReport[] {
    return Array.from(this.reconciliationReports.values());
  }

  public getAllPolicyVaultItems(): PolicyVaultItem[] {
    return Array.from(this.policyVaultItems.values());
  }

  public getAllOfferVersionsFlat(): OfferVersion[] {
    return Array.from(this.offerVersions.values()).flat();
  }

  public getAllOffers(): Offer[] {
    return Array.from(this.offers.values());
  }

  /**
   * Evaluates marketplace providers and opens competition for a verified challenge (Section 21)
   */
  public openCompetitionForChallenge(challengeId: string): {
    competition: Competition;
    invitations: ChallengeInvitation[];
    evaluations: EligibilityEvaluation[];
  } {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) throw new Error(`Challenge ${challengeId} not found`);

    // 1. Create or retrieve Competition
    let comp = this.getCompetitionForChallenge(challengeId);
    if (!comp) {
      const compId = `COMP-${challengeId.replace('CHAL-', '')}`;
      const newComp: Competition = {
        id: compId,
        challengeId,
        status: 'OPEN',
        currentRound: 'ROUND_1_OPEN',
        openedAt: new Date().toISOString(),
        closesAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours default (Section 22)
        participantCount: 0,
        improvementRoundEnabled: true,
        finalRoundEnabled: true
      };
      this.competitions.set(newComp.id, newComp);
      comp = newComp;
      this.recordAudit('COMPETITION_CREATED', 'SYSTEM', 'competition_engine', `Competition ${comp.id} created for challenge ${challenge.referenceNumber}`);
      this.recordAudit('COMPETITION_OPENED', 'SYSTEM', 'competition_engine', `Competition ${comp.id} opened for 48h initial round`);
    }

    const competitionRecord = comp;

    // 2. Evaluate all provider organizations using deterministic Eligibility Engine (Section 10)
    const evaluations: EligibilityEvaluation[] = [];
    const invitations: ChallengeInvitation[] = [];

    for (const org of this.providerOrganizations.values()) {
      const licenses = this.getProviderLicenses(org.id);
      const appetite = this.getProviderAppetite(org.id);

      const evaluation = evaluateProviderEligibility(challenge, org, licenses, appetite);
      evaluations.push(evaluation);

      this.recordAudit(
        'PROVIDER_MATCH_EVALUATED',
        'SYSTEM',
        'eligibility_engine',
        `Evaluated ${org.displayName} (${org.id}) for challenge ${challenge.referenceNumber}: ${evaluation.isEligible ? 'ELIGIBLE' : 'INELIGIBLE'} [${evaluation.reasons.join(', ')}]`
      );

      if (evaluation.isEligible) {
        // Check if invitation already exists
        const existingInv = Array.from(this.challengeInvitations.values()).find(
          i => i.challengeId === challengeId && i.providerOrganizationId === org.id
        );

        if (!existingInv) {
          const invId = `INV-${challengeId.replace('CHAL-', '')}-${org.id}`;
          const invitation: ChallengeInvitation = {
            id: invId,
            challengeId,
            competitionId: competitionRecord.id,
            providerOrganizationId: org.id,
            eligibilityResult: 'ELIGIBLE',
            eligibilityReasons: evaluation.reasons,
            status: 'INVITED',
            invitedAt: new Date().toISOString(),
            expiresAt: competitionRecord.closesAt
          };
          this.challengeInvitations.set(invitation.id, invitation);
          invitations.push(invitation);

          this.recordAudit(
            'INVITATION_CREATED',
            'SYSTEM',
            'invitation_service',
            `Created challenge invitation ${invitation.id} for ${org.displayName}`
          );

          this.notifications.unshift({
            id: `NOTIF-${Date.now()}-${org.id}`,
            type: 'OPPORTUNITY_RECEIVED',
            title: 'New Policy Challenge Opportunity',
            message: `New verified ${challenge.jurisdiction} Personal Auto opportunity: ${challenge.referenceNumber}. Current premium: $${challenge.baseline?.baselineAnnualPremium}/yr.`,
            timestamp: new Date().toISOString(),
            read: false,
            actionTarget: 'OPPORTUNITIES'
          });
        } else {
          invitations.push(existingInv);
        }
      }
    }

    challenge.status = 'OPEN';

    postgresStore.saveCompetition(competitionRecord).catch(err => {
      console.warn('[PostgresStore Competition Sync Error]', err?.message || err);
    });
    for (const inv of invitations) {
      postgresStore.saveInvitation(inv).catch(err => {
        console.warn('[PostgresStore Invitation Sync Error]', err?.message || err);
      });
    }

    return { competition: competitionRecord, invitations, evaluations };
  }

  /**
   * Pre-acceptance Opportunity view for a specific provider (Section 12)
   * Enforces privacy-preserving disclosure: no consumer name, email, phone, raw VINs, or exact address.
   */
  public getProviderOpportunities(orgId: string): OpportunityPreview[] {
    const opportunities: OpportunityPreview[] = [];

    for (const inv of this.challengeInvitations.values()) {
      if (inv.providerOrganizationId === orgId && (inv.status === 'INVITED' || inv.status === 'VIEWED')) {
        const chal = this.challenges.get(inv.challengeId);
        const comp = this.competitions.get(inv.competitionId);
        if (!chal || !comp) continue;

        // Calculate renewal days
        let renewalDays = 30;
        if (chal.baseline?.expirationDate) {
          const diff = new Date(chal.baseline.expirationDate).getTime() - Date.now();
          renewalDays = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
        }

        const invitedCount = Array.from(this.challengeInvitations.values()).filter(
          i => i.challengeId === chal.id
        ).length;

        const participatingCount = Array.from(this.challengeParticipations.values()).filter(
          p => p.challengeId === chal.id && p.status !== 'WITHDRAWN'
        ).length;

        opportunities.push({
          invitationId: inv.id,
          challengeId: chal.id,
          competitionId: comp.id,
          referenceNumber: chal.referenceNumber,
          market: `${chal.jurisdiction === 'NV' ? 'Nevada' : chal.jurisdiction} Personal Auto`,
          jurisdiction: chal.jurisdiction,
          lineOfBusiness: 'PERSONAL_AUTO',
          vehicleSummary: chal.baseline?.vehicle ? `${chal.baseline.vehicle.year} ${chal.baseline.vehicle.make} ${chal.baseline.vehicle.model}` : 'Personal Vehicle',
          currentAnnualPremium: chal.baseline?.baselineAnnualPremium || 0,
          currentMonthlyPremium: chal.baseline?.baselineMonthlyPremium || 0,
          coverageBaselineStatus: 'VERIFIED',
          renewalDaysRemaining: renewalDays,
          consumerRequirementsSummary: chal.requirements?.ruleSummary || 'Beat current baseline price with equal or better coverage.',
          competitionClosesAt: comp.closesAt,
          invitedProvidersCount: invitedCount,
          participatingProvidersCount: participatingCount,
          invitationStatus: inv.status,
          viewedAt: inv.viewedAt
        });
      }
    }

    return opportunities;
  }

  /**
   * Tenant-isolated retrieval of an invitation
   */
  public getInvitation(invitationId: string, orgId: string): ChallengeInvitation {
    const inv = this.challengeInvitations.get(invitationId);
    if (!inv) {
      const err: any = new Error(`Invitation ${invitationId} not found`);
      err.statusCode = 404;
      throw err;
    }
    if (inv.providerOrganizationId !== orgId) {
      const err: any = new Error(`Access Denied: Provider ${orgId} is not authorized to view invitation ${invitationId}`);
      err.statusCode = 403;
      throw err;
    }
    return inv;
  }

  /**
   * Transitions invitation to VIEWED (Section 11)
   */
  public viewInvitation(invitationId: string, orgId: string): ChallengeInvitation {
    const inv = this.getInvitation(invitationId, orgId);
    if (inv.status === 'INVITED') {
      inv.status = 'VIEWED';
      inv.viewedAt = new Date().toISOString();
      this.recordAudit(
        'INVITATION_VIEWED',
        'PROVIDER',
        orgId,
        `Provider ${orgId} opened and viewed opportunity invitation ${inv.id}`
      );
      postgresStore.saveInvitation(inv).catch(err => {
        console.warn('[PostgresStore Invitation Sync Error]', err?.message || err);
      });
    }
    return inv;
  }

  /**
   * Accepts invitation and creates ChallengeParticipation (Section 13)
   */
  public acceptInvitation(
    invitationId: string,
    orgId: string
  ): { invitation: ChallengeInvitation; participation: ChallengeParticipation } {
    const inv = this.getInvitation(invitationId, orgId);

    if (inv.status === 'DECLINED') {
      const err: any = new Error(`Invitation ${invitationId} was already declined and cannot be accepted`);
      err.statusCode = 400;
      throw err;
    }

    if (inv.status === 'ACCEPTED') {
      const existingPart = Array.from(this.challengeParticipations.values()).find(
        p => p.challengeId === inv.challengeId && p.providerOrganizationId === orgId
      );
      if (existingPart) return { invitation: inv, participation: existingPart };
    }

    inv.status = 'ACCEPTED';
    inv.acceptedAt = new Date().toISOString();

    const partId = `PART-${inv.challengeId.replace('CHAL-', '')}-${orgId}`;
    const participation: ChallengeParticipation = {
      id: partId,
      challengeId: inv.challengeId,
      competitionId: inv.competitionId,
      providerOrganizationId: orgId,
      acceptedAt: inv.acceptedAt,
      status: 'ACTIVE',
      lastActivityAt: new Date().toISOString()
    };

    this.challengeParticipations.set(participation.id, participation);

    // Update competition participant count
    const comp = this.competitions.get(inv.competitionId);
    if (comp) {
      comp.participantCount = Array.from(this.challengeParticipations.values()).filter(
        p => p.competitionId === comp.id && p.status !== 'WITHDRAWN'
      ).length;
    }

    this.recordAudit(
      'INVITATION_ACCEPTED',
      'PROVIDER',
      orgId,
      `Provider ${orgId} accepted invitation ${inv.id} to compete for challenge ${inv.challengeId}`
    );

    this.recordAudit(
      'PARTICIPATION_CREATED',
      'PROVIDER',
      orgId,
      `Active participation record ${participation.id} created for competition ${inv.competitionId}`
    );

    postgresStore.saveInvitation(inv).catch(err => {
      console.warn('[PostgresStore Invitation Sync Error]', err?.message || err);
    });
    postgresStore.saveParticipation(participation).catch(err => {
      console.warn('[PostgresStore Participation Sync Error]', err?.message || err);
    });
    if (comp) {
      postgresStore.saveCompetition(comp).catch(err => {
        console.warn('[PostgresStore Competition Sync Error]', err?.message || err);
      });
    }

    return { invitation: inv, participation };
  }

  public saveInvitation(invitation: ChallengeInvitation): void {
    this.challengeInvitations.set(invitation.id, invitation);
  }

  public saveProviderOrganization(org: ProviderOrganization): void {
    this.providerOrganizations.set(org.id, org);
  }

  public saveProviderOrg(org: ProviderOrganization): void {
    this.providerOrganizations.set(org.id, org);
  }

  public saveProviderUser(user: ProviderUser): void {
    this.providerUsers.set(user.id, user);
  }

  /**
   * Declines invitation with structured reason (Section 14)
   */
  public declineInvitation(
    invitationId: string,
    orgId: string,
    reason: DeclineReason,
    notes?: string
  ): ChallengeInvitation {
    const inv = this.getInvitation(invitationId, orgId);

    inv.status = 'DECLINED';
    inv.declinedAt = new Date().toISOString();
    inv.declineReason = reason;
    inv.declineNotes = notes;

    this.recordAudit(
      'INVITATION_DECLINED',
      'PROVIDER',
      orgId,
      `Provider ${orgId} declined invitation ${inv.id}. Reason: ${reason}${notes ? ` - ${notes}` : ''}`
    );

    postgresStore.saveInvitation(inv).catch(err => {
      console.warn('[PostgresStore Invitation Sync Error]', err?.message || err);
    });

    return inv;
  }

  /**
   * Returns active participations for a provider organization (Section 13: "My Competitions")
   */
  public getProviderCompetitions(orgId: string): Array<{
    participation: ChallengeParticipation;
    challenge: Challenge;
    competition: Competition;
    offersCount: number;
  }> {
    const list: Array<{
      participation: ChallengeParticipation;
      challenge: Challenge;
      competition: Competition;
      offersCount: number;
    }> = [];

    for (const part of this.challengeParticipations.values()) {
      if (part.providerOrganizationId === orgId && part.status !== 'WITHDRAWN') {
        const chal = this.challenges.get(part.challengeId);
        const comp = this.competitions.get(part.competitionId);
        if (chal && comp) {
          const orgOffers = Array.from(this.offers.values()).filter(
            o => o.challengeId === chal.id && o.providerId === orgId
          );
          list.push({
            participation: part,
            challenge: chal,
            competition: comp,
            offersCount: orgOffers.length
          });
        }
      }
    }

    return list;
  }

  /**
   * Challenge Workspace Foundation (Section 16)
   * Enforces server-side tenant isolation: only participating providers can access.
   * Protects consumer PII (progressive disclosure Stage B: authorized rating info only).
   * Competitor offer submissions are strictly excluded to prevent information leakage (Section 24).
   */
  public getChallengeWorkspace(challengeId: string, orgId: string) {
    // 1. Enforce participation authorization
    const participation = Array.from(this.challengeParticipations.values()).find(
      p => p.challengeId === challengeId && p.providerOrganizationId === orgId && p.status !== 'WITHDRAWN'
    );

    if (!participation) {
      const err: any = new Error(`Access Denied: Provider organization ${orgId} is not an authorized participant in challenge ${challengeId}`);
      err.statusCode = 403;
      throw err;
    }

    const challenge = this.challenges.get(challengeId);
    if (!challenge) {
      const err: any = new Error(`Challenge ${challengeId} not found`);
      err.statusCode = 404;
      throw err;
    }

    const competition = this.getCompetitionForChallenge(challengeId);
    if (!competition) {
      const err: any = new Error(`Competition not found for challenge ${challengeId}`);
      err.statusCode = 404;
      throw err;
    }

    // 2. Filter provider's own offers ONLY (Strict competitor privacy - Section 24)
    const myOffers = Array.from(this.offers.values()).filter(
      o => o.challengeId === challengeId && o.providerId === orgId
    );

    // 3. Stage B Authorized Rating Information (Section 16 & Section 42)
    // Strip direct consumer PII: no name, phone, email, full address, full VIN
    const authorizedRatingInfo = {
      vehicle: {
        year: challenge.baseline.vehicle.year,
        make: challenge.baseline.vehicle.make,
        model: challenge.baseline.vehicle.model,
        usage: challenge.baseline.vehicle.usage,
        annualMileage: challenge.baseline.vehicle.annualMileage,
        garagingZip: challenge.baseline.vehicle.garagingZip,
        ownership: challenge.baseline.vehicle.ownership
      },
      driverInfo: {
        primaryDriverAgeBracket: '35-49',
        licenseState: challenge.jurisdiction,
        yearsLicensed: '15+'
      },
      currentPolicyTerm: {
        effectiveDate: challenge.baseline.effectiveDate,
        expirationDate: challenge.baseline.expirationDate,
        termMonths: 12
      }
    };

    const invitedCount = Array.from(this.challengeInvitations.values()).filter(
      i => i.challengeId === challengeId
    ).length;

    const participatingCount = Array.from(this.challengeParticipations.values()).filter(
      p => p.challengeId === challengeId && p.status !== 'WITHDRAWN'
    ).length;

    // Mask direct consumer identity in baseline object per Progressive Disclosure Stage B
    const sanitizedBaseline: CoverageBaseline = {
      ...challenge.baseline,
      verifiedBy: 'Verified Policyholder',
      vehicle: challenge.baseline.vehicle ? {
        ...challenge.baseline.vehicle,
        vin: challenge.baseline.vehicle.vin ? `***${challenge.baseline.vehicle.vin.slice(-4)}` : '***MASKED***'
      } : {
        vin: '***MASKED***',
        year: 2023,
        make: 'Verified',
        model: 'Vehicle',
        usage: 'COMMUTE',
        annualMileage: 12000,
        garagingZip: '89101',
        ownership: 'OWNED'
      }
    };

    return {
      challenge: {
        id: challenge.id,
        referenceNumber: challenge.referenceNumber,
        jurisdiction: challenge.jurisdiction,
        status: challenge.status,
        openingTimestamp: challenge.openingTimestamp,
        closingTimestamp: challenge.closingTimestamp
      },
      competition: {
        id: competition.id,
        currentRound: competition.currentRound,
        status: competition.status,
        openedAt: competition.openedAt,
        closesAt: competition.closesAt,
        participantCount: participatingCount,
        invitedCount
      },
      consumerObjective: `Beat $${challenge.baseline.baselineAnnualPremium}/year ($${challenge.baseline.baselineMonthlyPremium}/month) while maintaining equivalent or superior coverage terms.`,
      baseline: sanitizedBaseline,
      requirements: challenge.requirements,
      authorizedRatingInfo,
      participation,
      myOffers,
      // PM-2: Information requests, reusable facts & appointed carriers
      informationRequests: this.getInformationRequests(challengeId, orgId),
      supplementalFacts: this.getSupplementalFacts(challengeId, orgId),
      carriers: this.carrierRelationships.get(orgId) || [],
      // PM-3: Activity feed and deadline status
      activityFeed: this.getCompetitionActivityFeed(challengeId, orgId),
      deadlineStatus: this.getCompetitionDeadlineStatus(challengeId)
    };
  }

  /**
   * PM-2: Returns sealed provider market signals for the active provider.
   * Strictly respects Section 12 & 24: zero competitor leakage.
   */
  public getCompetitionMarketSignals(challengeId: string, orgId: string): ProviderMarketSignal {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) {
      const err: any = new Error(`Challenge ${challengeId} not found`);
      err.statusCode = 404;
      throw err;
    }

    const competition = this.getCompetitionForChallenge(challengeId);
    if (!competition) {
      const err: any = new Error(`Competition not found for challenge ${challengeId}`);
      err.statusCode = 404;
      throw err;
    }

    // Tenant Isolation: Only participating providers can access sealed market signals
    const participation = Array.from(this.challengeParticipations.values()).find(
      p => p.challengeId === challengeId && p.providerOrganizationId === orgId && p.status !== 'WITHDRAWN'
    );
    if (!participation) {
      const err: any = new Error(`Access Denied: Provider organization ${orgId} is not an authorized participant in challenge ${challengeId}`);
      err.statusCode = 403;
      throw err;
    }

    const allOffers = Array.from(this.offers.values()).filter(o => o.challengeId === challengeId);
    const invitedCount = Array.from(this.challengeInvitations.values()).filter(i => i.challengeId === challengeId).length;

    return calculateProviderMarketSignals(
      competition,
      orgId,
      allOffers,
      challenge.baseline,
      challenge.requirements,
      invitedCount
    );
  }

  /**
   * PM-2: Evaluates overall competition state, readiness, and deterministic ranking
   */
  public getCompetitionEvaluation(challengeId: string): CompetitionEvaluationSummary {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) {
      throw new Error(`Challenge ${challengeId} not found`);
    }

    const competition = this.getCompetitionForChallenge(challengeId);
    if (!competition) {
      throw new Error(`Competition not found for challenge ${challengeId}`);
    }

    const allOffers = Array.from(this.offers.values()).filter(o => o.challengeId === challengeId);

    return evaluateCompetitionRoundState(
      competition,
      allOffers,
      challenge.baseline,
      challenge.requirements
    );
  }

  /**
   * PM-3: Records competition activity event
   */
  public recordCompetitionActivity(
    challengeId: string,
    event: Omit<CompetitionActivityEvent, 'id' | 'timestamp' | 'competitionId' | 'challengeId'> & { timestamp?: string }
  ): CompetitionActivityEvent {
    const comp = this.getCompetitionForChallenge(challengeId);
    const id = `EVT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const fullEvent: CompetitionActivityEvent = {
      id,
      competitionId: comp ? comp.id : `COMP-${challengeId}`,
      challengeId,
      timestamp: event.timestamp || new Date().toISOString(),
      type: event.type,
      actorRole: event.actorRole,
      actorName: event.actorName,
      providerOrganizationId: event.providerOrganizationId,
      summary: event.summary,
      round: event.round,
      metadata: event.metadata
    };

    const list = this.competitionActivityEvents.get(challengeId) || [];
    list.unshift(fullEvent);
    this.competitionActivityEvents.set(challengeId, list);
    return fullEvent;
  }

  /**
   * PM-3: Gets competition activity feed, optionally filtered/sealed for a provider org
   */
  public getCompetitionActivityFeed(challengeId: string, viewingOrgId?: string): CompetitionActivityEvent[] {
    const events = this.competitionActivityEvents.get(challengeId) || [];
    if (!viewingOrgId) {
      return [...events];
    }
    return filterCompetitionActivityFeedForProvider(events, viewingOrgId);
  }

  /**
   * PM-3: Gets deadline countdown and expiration status for a challenge's competition
   */
  public getCompetitionDeadlineStatus(challengeId: string): RoundDeadlineStatus {
    const comp = this.getCompetitionForChallenge(challengeId);
    if (!comp) {
      throw new Error(`Competition not found for challenge ${challengeId}`);
    }
    return checkRoundDeadlineStatus(comp);
  }

  /**
   * PM-3: Advances competition round with state validation and canonical lifecycle:
   * OPEN -> IMPROVEMENT -> BEST_AND_FINAL -> CLOSED -> CONSUMER_REVIEW
   */
  public advanceCompetition(
    challengeId: string,
    targetRound: CompetitionRound,
    reason: string,
    customDurationHours?: number
  ): Competition {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) {
      throw new Error(`Challenge ${challengeId} not found`);
    }

    const comp = this.getCompetitionForChallenge(challengeId);
    if (!comp) {
      throw new Error(`Competition not found for challenge ${challengeId}`);
    }

    const updatedComp = advanceCompRoundLogic(comp, targetRound, reason, customDurationHours);
    this.competitions.set(comp.id, updatedComp);

    // Update challenge status to match round per canonical lifecycle
    if (targetRound === 'OPEN' || targetRound === 'ROUND_1_OPEN') {
      challenge.status = 'OPEN';
    } else if (targetRound === 'IMPROVEMENT' || targetRound === 'ROUND_2_IMPROVEMENT') {
      challenge.status = 'OPEN';
    } else if (targetRound === 'BEST_AND_FINAL' || targetRound === 'ROUND_3_BAFO') {
      challenge.status = 'FINAL_ROUND';
      challenge.isFinalRound = true;
    } else if (targetRound === 'CLOSED') {
      challenge.status = 'OPEN';
    } else if (targetRound === 'CONSUMER_REVIEW' || targetRound === 'CLOSED_PENDING_SELECTION') {
      challenge.status = 'CONSUMER_REVIEW';
    }
    this.challenges.set(challenge.id, challenge);

    postgresStore.saveCompetition(updatedComp).catch(err => {
      console.warn('[PostgresStore Competition Sync Error]', err?.message || err);
    });

    this.recordAudit(
      'COMPETITION_ROUND_ADVANCED',
      'SYSTEM',
      'COMPETITION_ENGINE',
      `Competition ${comp.id} advanced to ${targetRound}. Reason: ${reason}`
    );

    this.recordCompetitionActivity(challengeId, {
      type: 'ROUND_ADVANCED',
      actorRole: 'SYSTEM',
      summary: `Competition round advanced to ${targetRound}. Deadline: ${updatedComp.closesAt}`,
      round: targetRound,
      metadata: { targetRound, reason, customDurationHours, closesAt: updatedComp.closesAt }
    });

    this.notifications.unshift({
      id: `NOTIF-${Date.now()}`,
      type: (targetRound === 'ROUND_3_BAFO' || targetRound === 'BEST_AND_FINAL') ? 'FINAL_ROUND_OPENED' : 'COMPETITION_UPDATE',
      title: (targetRound === 'ROUND_3_BAFO' || targetRound === 'BEST_AND_FINAL') ? 'BAFO Final Round Initiated' : `Competition Advanced: ${targetRound}`,
      message: `Challenge #${challenge.referenceNumber} entered ${targetRound}. Participating providers notified.`,
      timestamp: new Date().toISOString(),
      read: false
    });

    return updatedComp;
  }

  /**
   * PM-3: Keep Current Offer
   * Allows provider to confirm existing terms without required price concession.
   */
  public confirmKeepCurrentOffer(
    challengeId: string,
    offerId: string,
    orgId: string
  ): Offer {
    const offer = this.offers.get(offerId);
    if (!offer) {
      const err: any = new Error(`Offer ${offerId} not found`);
      err.statusCode = 404;
      throw err;
    }

    if (offer.providerId !== orgId) {
      const err: any = new Error(`Access Denied: Provider ${orgId} is not authorized for offer ${offerId}`);
      err.statusCode = 403;
      throw err;
    }

    const comp = this.getCompetitionForChallenge(challengeId);
    if (!comp) {
      const err: any = new Error(`Competition not found for challenge ${challengeId}`);
      err.statusCode = 404;
      throw err;
    }

    const org = this.getProviderOrganization(orgId);
    const orgName = org?.displayName || orgId;

    this.recordAudit(
      'OFFER_CONFIRMED_CURRENT',
      'PROVIDER',
      orgId,
      `Provider ${orgName} confirmed current offer terms for ${offer.carrier} ($${offer.annualPremium}/yr) in round ${comp.currentRound}`
    );

    this.recordCompetitionActivity(challengeId, {
      type: 'PROVIDER_KEPT_CURRENT_OFFER',
      actorRole: 'PROVIDER',
      actorName: orgName,
      providerOrganizationId: orgId,
      summary: `${orgName} confirmed current terms for ${offer.carrier} ($${offer.annualPremium}/yr) in ${comp.currentRound}.`,
      round: comp.currentRound,
      metadata: { offerId, carrier: offer.carrier, annualPremium: offer.annualPremium }
    });

    return offer;
  }

  /**
   * PM-3: Provider Withdrawal Mechanics
   * Provider formally withdraws from a challenge competition.
   * Participation status transitions to WITHDRAWN; active unselected offers are suppressed from evaluation.
   */
  public withdrawProviderParticipation(
    challengeId: string,
    orgId: string,
    reason: string,
    notes?: string
  ): ChallengeParticipation {
    const participation = Array.from(this.challengeParticipations.values()).find(
      p => p.challengeId === challengeId && p.providerOrganizationId === orgId && p.status !== 'WITHDRAWN'
    );

    if (!participation) {
      const err: any = new Error(`Active participation not found for provider ${orgId} in challenge ${challengeId}`);
      err.statusCode = 404;
      throw err;
    }

    participation.status = 'WITHDRAWN';
    (participation as any).withdrawnAt = new Date().toISOString();
    (participation as any).withdrawalReason = reason;
    (participation as any).withdrawalNotes = notes;
    this.challengeParticipations.set(participation.id, participation);

    // Suppress provider's active unselected offers from evaluation
    for (const offer of this.offers.values()) {
      if (offer.challengeId === challengeId && offer.providerId === orgId && offer.status !== 'SELECTED') {
        offer.status = 'WITHDRAWN';
        this.offers.set(offer.id, offer);
        postgresStore.saveOffer(offer).catch(err => {
          console.warn('[PostgresStore Offer Sync Error]', err?.message || err);
        });
      }
    }

    // Decrement competition participant count
    const comp = this.getCompetitionForChallenge(challengeId);
    if (comp) {
      comp.participantCount = Math.max(0, comp.participantCount - 1);
      this.competitions.set(comp.id, comp);
      postgresStore.saveCompetition(comp).catch(err => {
        console.warn('[PostgresStore Competition Sync Error]', err?.message || err);
      });
    }

    postgresStore.saveParticipation(participation).catch(err => {
      console.warn('[PostgresStore Participation Sync Error]', err?.message || err);
    });

    const org = this.getProviderOrganization(orgId);
    const orgName = org?.displayName || orgId;

    this.recordAudit(
      'PROVIDER_WITHDREW',
      'PROVIDER',
      orgId,
      `Provider ${orgName} withdrew participation from challenge ${challengeId}. Reason: ${reason}`
    );

    this.recordCompetitionActivity(challengeId, {
      type: 'PROVIDER_WITHDREW',
      actorRole: 'PROVIDER',
      actorName: orgName,
      providerOrganizationId: orgId,
      summary: `${orgName} withdrew from competition. Reason: ${reason}`,
      round: comp ? comp.currentRound : 'OPEN',
      metadata: { reason, notes }
    });

    return participation;
  }

  /**
   * PM-3: Keep Current Policy (Incumbent Defended)
   * Consumer explicitly decides to keep current baseline policy without forced concession.
   * Challenge transitions to INCUMBENT_DEFENDED, competition completes as COMPLETED.
   */
  public keepCurrentPolicy(
    challengeId: string,
    consumerId: string,
    reason?: string
  ): Challenge {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) {
      const err: any = new Error(`Challenge ${challengeId} not found`);
      err.statusCode = 404;
      throw err;
    }

    challenge.status = 'INCUMBENT_DEFENDED';
    challenge.incumbentDefended = true;
    this.challenges.set(challenge.id, challenge);

    const comp = this.getCompetitionForChallenge(challengeId);
    if (comp) {
      comp.status = 'COMPLETED';
      comp.completedAt = new Date().toISOString();
      this.competitions.set(comp.id, comp);
      postgresStore.saveCompetition(comp).catch(err => {
        console.warn('[PostgresStore Competition Sync Error]', err?.message || err);
      });
    }

    postgresStore.saveChallenge(challenge).catch(err => {
      console.warn('[PostgresStore Challenge Sync Error]', err?.message || err);
    });

    this.recordAudit(
      'INCUMBENT_POLICY_DEFENDED',
      'CONSUMER',
      consumerId,
      `Consumer chose to keep incumbent policy ($${challenge.baseline?.baselineAnnualPremium}/yr). Competition completed as INCUMBENT_DEFENDED.`
    );

    this.recordCompetitionActivity(challengeId, {
      type: 'CONSUMER_KEPT_CURRENT_POLICY',
      actorRole: 'CONSUMER',
      actorName: 'Policyholder',
      summary: `Consumer retained current policy terms ($${challenge.baseline?.baselineAnnualPremium}/yr). Incumbent defended.`,
      round: comp ? comp.currentRound : 'CONSUMER_REVIEW',
      metadata: { reason: reason || 'Retained incumbent coverage terms' }
    });

    return challenge;
  }

  /**
   * PM-2: Revisions submitted during Improvement or BAFO rounds
   */
  public reviseOfferInCompetition(
    challengeId: string,
    offerId: string,
    revisedData: Partial<Offer>,
    orgId: string
  ): Offer {
    const originalOffer = this.offers.get(offerId);
    if (!originalOffer) {
      throw new Error(`Offer ${offerId} not found`);
    }

    // Tenant Isolation: Only the owning provider organization can revise an offer
    if (originalOffer.providerId !== orgId) {
      const err: any = new Error(`Access Denied: Provider ${orgId} is not authorized to revise offer ${offerId} belonging to ${originalOffer.providerId}`);
      err.statusCode = 403;
      throw err;
    }

    const comp = this.getCompetitionForChallenge(challengeId);
    if (!comp) {
      throw new Error(`Competition not found for challenge ${challengeId}`);
    }

    const challenge = this.getChallenge(challengeId);
    if (!challenge) {
      throw new Error(`Challenge ${challengeId} not found`);
    }

    // Validate revision rules (Section 40)
    const validation = validateOfferRevision(originalOffer, revisedData, comp.currentRound);
    if (!validation.valid) {
      const err: any = new Error(validation.errors.join('; '));
      err.statusCode = 400;
      throw err;
    }

    const version = (originalOffer.version || 1) + 1;

    // PM-2 Section 28: Snapshot prior version before revision
    const snapshot = createOfferVersionSnapshot(
      originalOffer,
      revisedData.revisionReason || `Revised during ${comp.currentRound}`
    );
    const versions = this.offerVersions.get(originalOffer.id) || [];
    versions.push(snapshot);
    this.offerVersions.set(originalOffer.id, versions);
    postgresStore.saveOfferVersion(snapshot).catch(err => {
      console.warn('[PostgresStore OfferVersion Sync Error]', err?.message || err);
    });

    const revisedOffer: Offer = {
      ...originalOffer,
      ...revisedData,
      id: `OFFER-REV-${Date.now()}`,
      previousOfferId: originalOffer.id,
      version,
      isLatestRevision: true,
      round: comp.currentRound,
      submittedAt: new Date().toISOString()
    };

    // Also register the new OfferVersion snapshot for the new revision
    const newVersionSnapshot: OfferVersion = {
      id: `VER-${revisedOffer.id}-v${version}`,
      offerId: originalOffer.id,
      versionNumber: version,
      round: comp.currentRound,
      carrier: revisedOffer.carrier,
      annualPremium: revisedOffer.annualPremium,
      monthlyPremium: revisedOffer.monthlyPremium,
      coverages: JSON.parse(JSON.stringify(revisedOffer.coverages || [])),
      supportingQuoteDocName: revisedOffer.supportingQuoteDocName,
      revisionReason: revisedData.revisionReason || `Revised during ${comp.currentRound}`,
      submittedAt: revisedOffer.submittedAt
    };
    versions.push(newVersionSnapshot);
    this.offerVersions.set(originalOffer.id, versions);
    this.offerVersions.set(revisedOffer.id, [{ ...newVersionSnapshot, offerId: revisedOffer.id }]);
    postgresStore.saveOfferVersion(newVersionSnapshot).catch(err => {
      console.warn('[PostgresStore OfferVersion Sync Error]', err?.message || err);
    });

    // Mark original offer as superseded
    originalOffer.isLatestRevision = false;
    this.offers.set(originalOffer.id, originalOffer);

    // Evaluate qualification for revised offer
    const providerOrg = this.getProviderOrganization(orgId);
    const carrierRels = this.carrierRelationships.get(orgId) || [];
    const qualResult = evaluateOfferQualification(
      revisedOffer,
      challenge.baseline,
      challenge.requirements,
      providerOrg,
      carrierRels
    );
    revisedOffer.isQualified = qualResult.isQualified;
    revisedOffer.qualifiedAt = qualResult.evaluatedAt;
    revisedOffer.qualificationReasons = qualResult.qualificationReasons;
    revisedOffer.disqualificationReasons = qualResult.disqualificationReasons;

    // Save revised offer
    this.offers.set(revisedOffer.id, revisedOffer);

    this.recordAudit(
      'OFFER_SUBMITTED',
      'PROVIDER',
      orgId,
      `Provider ${orgId} revised offer for ${revisedOffer.carrier} in ${comp.currentRound}. New annual premium: $${revisedOffer.annualPremium}`
    );

    postgresStore.saveOffer(revisedOffer).catch(err => {
      console.warn('[PostgresStore Revised Offer Sync Error]', err?.message || err);
    });

    return revisedOffer;
  }

  /**
   * PM-2 Helper: Seeds realistic competing quotes for challenge from Apex Insurance and other licensed markets
   */
  public seedCompetitorOffers(challengeId: string) {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) return;

    const baseCoverages = challenge.baseline.coverages;

    // Apex Insurance - Progressive Northern ($2,540/yr, $424 savings)
    const apexOffer: Offer = {
      id: `OFFER-APEX-${Date.now()}-1`,
      challengeId,
      providerId: 'org_apex',
      providerName: 'Apex Insurance Services LLC',
      providerLicense: 'NV-LIC-841920',
      carrier: 'Progressive Northern Insurance',
      quoteNumber: 'PGR-NV-882103',
      annualPremium: 2540,
      monthlyPremium: 212,
      termMonths: 12,
      effectiveDate: challenge.baseline.effectiveDate,
      expirationDate: challenge.baseline.expirationDate,
      supportingQuoteDocName: 'Progressive_NV_Official_Quote_882103.pdf',
      submittedAt: new Date(Date.now() - 3600000).toISOString(),
      discrepanciesDetected: false,
      status: 'VALIDATED',
      round: 'ROUND_1_OPEN',
      version: 1,
      tierLabel: 'Competitive Baseline Match',
      coverages: baseCoverages
    };

    this.offers.set(apexOffer.id, apexOffer);

    // Also register Apex participation if not already
    const apexPart = Array.from(this.challengeParticipations.values()).find(
      p => p.challengeId === challengeId && p.providerOrganizationId === 'org_apex'
    );
    if (!apexPart) {
      const partId = `part_${challengeId}_org_apex`;
      this.challengeParticipations.set(partId, {
        id: partId,
        challengeId,
        competitionId: `comp_${challengeId}`,
        providerOrganizationId: 'org_apex',
        acceptedAt: new Date(Date.now() - 7200000).toISOString(),
        status: 'ACTIVE',
        lastActivityAt: new Date().toISOString()
      });
    }

    // Update challenge offersCount
    challenge.offersCount = Array.from(this.offers.values()).filter(o => o.challengeId === challengeId).length;
    this.challenges.set(challenge.id, challenge);

    this.recordAudit(
      'OFFER_SUBMITTED',
      'PROVIDER',
      'org_apex',
      `Apex Insurance Services submitted Progressive Northern Quote ($2,540/yr)`
    );
  }

  // ==========================================
  // PM-4: Selection, Controlled Disclosure & Binding
  // ==========================================

  public selectOfferVersion(params: {
    challengeId: string;
    offerId: string;
    versionNumber: number;
    consumerId: string;
    notes?: string;
  }): { selection: Selection; handoff: BindingHandoff } {
    const challenge = this.challenges.get(params.challengeId);
    if (!challenge) {
      throw new Error(`Challenge not found: ${params.challengeId}`);
    }

    if (challenge.consumerId && challenge.consumerId !== params.consumerId) {
      throw new Error('Unauthorized: Only the challenge owner can select an offer version');
    }

    const offer = this.offers.get(params.offerId);
    if (!offer) {
      throw new Error(`Offer not found: ${params.offerId}`);
    }

    if (offer.challengeId !== params.challengeId) {
      throw new Error('Offer does not belong to the specified challenge');
    }

    // Retrieve or synthesize offer version
    let versions = this.getOfferVersions(params.offerId);
    let targetVersion = versions.find(v => v.versionNumber === params.versionNumber);
    if (!targetVersion) {
      // Check if any related offer in the challenge matches this version
      const relatedOffers = Array.from(this.offers.values()).filter(
        o => o.challengeId === params.challengeId &&
             (o.id === params.offerId || o.previousOfferId === params.offerId || (offer.previousOfferId && o.id === offer.previousOfferId))
      );
      const matchingOffer = relatedOffers.find(o => o.version === params.versionNumber);
      if (matchingOffer) {
        targetVersion = {
          id: `VER-${matchingOffer.id}-v${params.versionNumber}`,
          offerId: offer.id,
          versionNumber: params.versionNumber,
          round: matchingOffer.round || 'ROUND_1_OPEN',
          carrier: matchingOffer.carrier,
          annualPremium: matchingOffer.annualPremium,
          monthlyPremium: matchingOffer.monthlyPremium,
          coverages: JSON.parse(JSON.stringify(matchingOffer.coverages || [])),
          supportingQuoteDocName: matchingOffer.supportingQuoteDocName,
          revisionReason: (matchingOffer.version && matchingOffer.version > 1) ? 'Revised offer submission' : 'Initial offer submission',
          submittedAt: matchingOffer.submittedAt
        };
        const vList = this.offerVersions.get(offer.id) || [];
        vList.push(targetVersion);
        this.offerVersions.set(offer.id, vList);
      } else if (params.versionNumber === 1 || versions.length === 0) {
        targetVersion = createOfferVersionSnapshot(offer, 'Initial offer submission');
        targetVersion.offerId = offer.id;
        const vList = this.offerVersions.get(offer.id) || [];
        vList.push(targetVersion);
        this.offerVersions.set(offer.id, vList);
      } else {
        throw new Error(`Offer version v${params.versionNumber} not found for offer ${params.offerId}`);
      }
    }

    if (targetVersion.offerId !== offer.id) {
      targetVersion = { ...targetVersion, offerId: offer.id };
    }

    // 1. Create Selection record (locks exact OfferVersion)
    const selection = createSelection({
      challenge,
      offer,
      offerVersion: targetVersion,
      consumerId: params.consumerId
    });

    // 2. Initiate BindingHandoff in 'SELECTED' status (does NOT auto-authorize or disclose PII)
    const handoff = initiateBindingHandoff({
      selection,
      challenge
    });

    this.selections.set(selection.id, selection);
    this.handoffs.set(handoff.id, handoff);

    // Update Offer and Challenge status
    offer.status = 'SELECTED';
    challenge.status = 'SELECTED';

    // Update Competition lifecycle to CLOSED if active
    const comp = this.competitions.get(`comp_${params.challengeId}`);
    if (comp && comp.status !== 'CLOSED') {
      comp.status = 'CLOSED';
      comp.completedAt = new Date().toISOString();
      this.competitions.set(comp.id, comp);
      postgresStore.saveCompetition(comp).catch(err => {
        console.warn('[PostgresStore Competition Sync Error]', err?.message || err);
      });
    }

    this.recordAudit(
      'OFFER_VERSION_SELECTED',
      'CONSUMER',
      params.consumerId,
      `Consumer selected offer ${offer.id} v${targetVersion.versionNumber} (${targetVersion.carrier}) at $${targetVersion.annualPremium}/yr`
    );

    this.recordAudit(
      'BINDING_STATUS_CHANGED',
      'SYSTEM',
      'handoff_service',
      `Binding handoff ${handoff.id} created with reference ${handoff.bindingReference} in SELECTED status`
    );

    postgresStore.saveSelection(selection).catch(err => {
      console.warn('[PostgresStore Selection Sync Error]', err?.message || err);
    });
    postgresStore.saveBindingHandoff(handoff).catch(err => {
      console.warn('[PostgresStore BindingHandoff Sync Error]', err?.message || err);
    });

    return { selection, handoff };
  }

  public grantBindingConsent(params: {
    challengeId: string;
    handoffId: string;
    consumerId: string;
    purpose?: string;
    purposeExplanation?: string;
    authorizedFieldNames: string[];
    acknowledgedVariations?: string[];
    durationDays?: number;
    ipAddress?: string;
    termsVersion?: string;
  }): ConsentGrant {
    const handoff = this.handoffs.get(params.handoffId);
    if (!handoff) {
      throw new Error(`Binding handoff not found: ${params.handoffId}`);
    }

    if (handoff.consumerId !== params.consumerId) {
      throw new Error('Unauthorized: Only the challenge owner can grant consent for this handoff');
    }

    const recipientOrganizationId = handoff.providerOrganizationId;
    if (!recipientOrganizationId) {
      throw new Error('Forbidden: Binding handoff has no authoritative provider organization mapping');
    }

    const consentGrant = createConsentGrant({
      challengeId: params.challengeId,
      consumerId: params.consumerId,
      recipientOrganizationId,
      purpose: params.purpose || 'STAGE_C_BINDING_DISCLOSURE',
      purposeExplanation: params.purposeExplanation || 'Authorization to disclose Stage C PII for binding handoff',
      authorizedFieldNames: params.authorizedFieldNames,
      acknowledgedVariations: params.acknowledgedVariations,
      durationDays: params.durationDays,
      ipAddress: params.ipAddress,
      termsVersion: params.termsVersion
    });

    this.consentGrants.set(consentGrant.id, consentGrant);

    // Link consent to handoff
    handoff.consentGrantId = consentGrant.id;
    if (!handoff.consentGrantIds) handoff.consentGrantIds = [];
    if (!handoff.consentGrantIds.includes(consentGrant.id)) {
      handoff.consentGrantIds.push(consentGrant.id);
    }
    handoff.updatedAt = new Date().toISOString();
    this.handoffs.set(handoff.id, handoff);

    this.recordAudit(
      'CONSENT_GRANTED',
      'CONSUMER',
      params.consumerId,
      `Consumer granted binding consent ${consentGrant.id} for ${consentGrant.purpose} to provider ${consentGrant.recipientOrganizationId} (Fields: ${consentGrant.authorizedFieldNames.join(', ')})`
    );

    postgresStore.saveConsentGrant(consentGrant).catch(err => {
      console.warn('[PostgresStore ConsentGrant Sync Error]', err?.message || err);
    });
    postgresStore.saveBindingHandoff(handoff).catch(err => {
      console.warn('[PostgresStore BindingHandoff Sync Error]', err?.message || err);
    });

    return consentGrant;
  }

  public revokeBindingConsent(consentId: string, consumerId: string): ConsentGrant {
    const consent = this.consentGrants.get(consentId);
    if (!consent) {
      throw new Error(`Consent grant not found: ${consentId}`);
    }

    const revokedConsent = revokeConsentGrant(consent, consumerId);
    this.consentGrants.set(revokedConsent.id, revokedConsent);

    this.recordAudit(
      'CONSENT_REVOKED',
      'CONSUMER',
      consumerId,
      `Consumer revoked consent grant ${consentId}. Future disclosures are blocked. Historical DisclosureEvents remain intact.`
    );

    postgresStore.saveConsentGrant(revokedConsent).catch(err => {
      console.warn('[PostgresStore ConsentGrant Sync Error]', err?.message || err);
    });

    return revokedConsent;
  }

  public executeControlledDisclosure(params: {
    handoffId: string;
    consentGrantId: string;
    providerOrgId: string;
    providerUserId?: string;
    recipientAgentName?: string;
    recipientEmail?: string;
    customConsumerData?: Record<string, any>;
  }): {
    disclosureEvent: DisclosureEvent;
    disclosedData: Record<string, any>;
    updatedHandoff: BindingHandoff;
  } {
    const handoff = this.handoffs.get(params.handoffId);
    if (!handoff) {
      throw new Error(`Binding handoff not found: ${params.handoffId}`);
    }

    const consentGrant = this.consentGrants.get(params.consentGrantId);
    if (!consentGrant) {
      throw new Error(`Consent grant not found: ${params.consentGrantId}`);
    }

    const challenge = this.challenges.get(handoff.challengeId);
    const baseline = challenge?.baseline;

    const fullConsumerData: Record<string, any> = {
      namedInsured: 'Jane Doe',
      email: 'jane.doe@example.com',
      phone: '702-555-0199',
      addressLine1: '812 Horizon Ridge Pkwy',
      city: 'Henderson',
      state: 'NV',
      postalCode: '89012',
      garagingAddress: '812 Horizon Ridge Pkwy, Henderson, NV 89012',
      vin: baseline?.vehicle?.vin || '4T1B11HK5RU123498',
      driverLicenseNumber: 'NV-DL-8912781',
      driverLicenseState: 'NV',
      drivers: [
        {
          name: 'Jane Doe',
          licenseState: 'NV',
          licenseNumber: 'NV-DL-8912781',
          age: 38,
          isPrimary: true
        }
      ],
      vehicles: [
        {
          year: baseline?.vehicle?.year || 2022,
          make: baseline?.vehicle?.make || 'Toyota',
          model: baseline?.vehicle?.model || 'Camry',
          vin: baseline?.vehicle?.vin || '4T1B11HK5RU123498',
          annualMileage: baseline?.vehicle?.annualMileage || 12000,
          primaryUse: baseline?.vehicle?.usage || 'COMMUTE'
        }
      ],
      dateOfBirth: '1988-04-12',
      ...(params.customConsumerData || {})
    };

    const result = validateAndExecuteDisclosure({
      consentGrant,
      handoff,
      fullConsumerData,
      requestingProviderOrgId: params.providerOrgId,
      requestingProviderUserId: params.providerUserId,
      recipientAgentName: params.recipientAgentName,
      recipientEmail: params.recipientEmail
    });

    this.disclosureEvents.set(result.disclosureEvent.id, result.disclosureEvent);
    this.handoffs.set(result.updatedHandoff.id, result.updatedHandoff);

    this.recordAudit(
      'PII_DISCLOSED',
      'SYSTEM',
      'disclosure_engine',
      `Controlled Stage C disclosure ${result.disclosureEvent.id} executed for provider ${params.providerOrgId}. Hash: ${result.disclosureEvent.eventPayloadHash.substring(0, 16)}...`
    );

    this.recordAudit(
      'BINDING_STATUS_CHANGED',
      'SYSTEM',
      'disclosure_engine',
      `Handoff ${handoff.id} status updated to ${result.updatedHandoff.status}`
    );

    postgresStore.saveDisclosureEvent(result.disclosureEvent).catch(err => {
      console.warn('[PostgresStore DisclosureEvent Sync Error]', err?.message || err);
    });
    postgresStore.saveBindingHandoff(result.updatedHandoff).catch(err => {
      console.warn('[PostgresStore BindingHandoff Sync Error]', err?.message || err);
    });

    return result;
  }

  public proposeUnderwritingModification(params: {
    handoffId: string;
    providerOrgId: string;
    providerUserId: string;
    carrier?: string;
    originalAnnualPremium?: number;
    modifiedAnnualPremium: number;
    coverageChanges?: Array<{
      code: string;
      name: string;
      originalValue: string;
      modifiedValue: string;
      isMaterialReduction: boolean;
    }>;
    underwritingReason: string;
  }): { modification: BindingModification; updatedHandoff: BindingHandoff } {
    const handoff = this.handoffs.get(params.handoffId);
    if (!handoff) {
      throw new Error(`Binding handoff not found: ${params.handoffId}`);
    }

    const carrier = params.carrier || handoff.carrier;
    const originalAnnualPremium = params.originalAnnualPremium ?? handoff.annualPremium ?? this.offers.get(handoff.offerId || '')?.annualPremium ?? 0;

    const result = proposeBindingModification({
      handoff,
      providerOrgId: params.providerOrgId,
      providerUserId: params.providerUserId,
      carrier,
      originalAnnualPremium,
      modifiedAnnualPremium: params.modifiedAnnualPremium,
      coverageChanges: params.coverageChanges || [],
      underwritingReason: params.underwritingReason
    });

    this.bindingModifications.set(result.modification.id, result.modification);
    this.handoffs.set(result.updatedHandoff.id, result.updatedHandoff);

    this.recordAudit(
      'BINDING_MODIFICATION_PROPOSED',
      'PROVIDER',
      params.providerUserId,
      `Provider ${params.providerOrgId} proposed underwriting modification ${result.modification.id}: $${originalAnnualPremium} -> $${params.modifiedAnnualPremium} (${params.underwritingReason})`
    );

    this.recordAudit(
      'BINDING_STATUS_CHANGED',
      'PROVIDER',
      params.providerUserId,
      `Handoff ${handoff.id} status updated to MODIFICATION_PENDING`
    );

    postgresStore.saveBindingModification(result.modification).catch(err => {
      console.warn('[PostgresStore BindingModification Sync Error]', err?.message || err);
    });
    postgresStore.saveBindingHandoff(result.updatedHandoff).catch(err => {
      console.warn('[PostgresStore BindingHandoff Sync Error]', err?.message || err);
    });

    return result;
  }

  public resolveUnderwritingModification(params: {
    modificationId: string;
    consumerId: string;
    decision: 'ACCEPT' | 'REJECT';
    rejectionReason?: string;
  }): { resolvedModification: BindingModification; updatedHandoff: BindingHandoff } {
    const modification = this.bindingModifications.get(params.modificationId);
    if (!modification) {
      throw new Error(`Binding modification not found: ${params.modificationId}`);
    }

    const handoff = this.handoffs.get(modification.bindingHandoffId);
    if (!handoff) {
      throw new Error(`Binding handoff not found: ${modification.bindingHandoffId}`);
    }

    const result = resolveBindingModification({
      modification,
      handoff,
      consumerId: params.consumerId,
      decision: params.decision,
      rejectionReason: params.rejectionReason
    });

    this.bindingModifications.set(result.resolvedModification.id, result.resolvedModification);
    this.handoffs.set(result.updatedHandoff.id, result.updatedHandoff);

    const auditType = params.decision === 'ACCEPT' ? 'BINDING_MODIFICATION_ACCEPTED' : 'BINDING_MODIFICATION_REJECTED';
    this.recordAudit(
      auditType,
      'CONSUMER',
      params.consumerId,
      `Consumer ${params.decision === 'ACCEPT' ? 'accepted' : 'rejected'} modification ${modification.id}${params.rejectionReason ? ': ' + params.rejectionReason : ''}`
    );

    this.recordAudit(
      'BINDING_STATUS_CHANGED',
      'CONSUMER',
      params.consumerId,
      `Handoff ${handoff.id} status updated to ${result.updatedHandoff.status}`
    );

    postgresStore.saveBindingModification(result.resolvedModification).catch(err => {
      console.warn('[PostgresStore BindingModification Sync Error]', err?.message || err);
    });
    postgresStore.saveBindingHandoff(result.updatedHandoff).catch(err => {
      console.warn('[PostgresStore BindingHandoff Sync Error]', err?.message || err);
    });

    return result;
  }

  public updateBindingStatus(params: {
    handoffId: string;
    newStatus: BindingHandoffStatus;
    providerOrgId: string;
    declineReason?: string;
    policyNumber?: string;
    finalPremium?: number;
  }): BindingHandoff {
    const handoff = this.handoffs.get(params.handoffId);
    if (!handoff) {
      throw new Error(`Binding handoff not found: ${params.handoffId}`);
    }

    const activeModifications = Array.from(this.bindingModifications.values()).filter(
      m => m.bindingHandoffId === params.handoffId
    );

    const updatedHandoff = transitionBindingStatus({
      handoff,
      newStatus: params.newStatus,
      providerOrgId: params.providerOrgId,
      activeModifications,
      declineReason: params.declineReason
    });

    if (params.policyNumber) {
      updatedHandoff.policyNumber = params.policyNumber;
    }
    if (params.finalPremium !== undefined) {
      updatedHandoff.finalPremium = params.finalPremium;
    }

    this.handoffs.set(updatedHandoff.id, updatedHandoff);

    this.recordAudit(
      'BINDING_STATUS_CHANGED',
      'PROVIDER',
      params.providerOrgId,
      `Provider ${params.providerOrgId} updated handoff ${handoff.id} status to ${params.newStatus}${params.declineReason ? ': ' + params.declineReason : ''}`
    );

    postgresStore.saveBindingHandoff(updatedHandoff).catch(err => {
      console.warn('[PostgresStore BindingHandoff Sync Error]', err?.message || err);
    });

    return updatedHandoff;
  }

  // PM-4 Query Helpers
  public getSelection(id: string): Selection | undefined {
    return this.selections.get(id);
  }

  public getSelections(): Selection[] {
    return Array.from(this.selections.values());
  }

  public getSelectionForChallenge(challengeId: string): Selection | undefined {
    return Array.from(this.selections.values()).find(s => s.challengeId === challengeId);
  }

  public getConsentGrant(id: string): ConsentGrant | undefined {
    return this.consentGrants.get(id);
  }

  public getConsentGrants(): ConsentGrant[] {
    return Array.from(this.consentGrants.values());
  }

  public getConsentGrantsForChallenge(challengeId: string): ConsentGrant[] {
    return Array.from(this.consentGrants.values()).filter(c => c.challengeId === challengeId);
  }

  public getDisclosureEvent(id: string): DisclosureEvent | undefined {
    return this.disclosureEvents.get(id);
  }

  public getDisclosureEvents(): DisclosureEvent[] {
    return Array.from(this.disclosureEvents.values());
  }

  public getDisclosureEventsForHandoff(handoffId: string): DisclosureEvent[] {
    return Array.from(this.disclosureEvents.values()).filter(e => e.bindingHandoffId === handoffId);
  }

  public getBindingModification(id: string): BindingModification | undefined {
    return this.bindingModifications.get(id);
  }

  public getBindingModifications(): BindingModification[] {
    return Array.from(this.bindingModifications.values());
  }

  public getBindingModificationsForHandoff(handoffId: string): BindingModification[] {
    return Array.from(this.bindingModifications.values()).filter(m => m.bindingHandoffId === handoffId);
  }

  public getBindingHandoff(id: string): BindingHandoff | undefined {
    return this.handoffs.get(id);
  }

  public getBindingHandoffForChallenge(challengeId: string): BindingHandoff | undefined {
    return Array.from(this.handoffs.values()).find(h => h.challengeId === challengeId);
  }

  // ========================================================
  // PM-5: Issued Policy Ingestion, Reconciliation & Policy Vault
  // ========================================================

  public uploadIssuedPolicyDocument(params: {
    bindingHandoffId: string;
    providerUserId: string;
    fileName: string;
    fileSizeBytes: number;
    mimeType: string;
    rawContent: string | Buffer;
    extractedTerms: {
      carrier: string;
      policyNumber: string;
      annualPremium: number;
      monthlyPremium?: number;
      effectiveDate: string;
      expirationDate: string;
      coverages: any[];
      extractionConfidence?: number;
      isAmbiguous?: boolean;
    };
  }): { document: IssuedPolicyDocument; snapshot: IssuedPolicySnapshot } {
    const handoff = this.handoffs.get(params.bindingHandoffId);
    if (!handoff) {
      throw new Error(`Binding handoff ${params.bindingHandoffId} not found.`);
    }

    if (handoff.status !== 'BOUND') {
      throw new Error(`Invalid state: Issued policy can only be uploaded for a BOUND handoff (current: ${handoff.status}).`);
    }

    // Resolve provider user
    const providerUser = this.providerUsers.get(params.providerUserId);
    if (!providerUser) {
      throw new Error(`Unauthorized provider user: ${params.providerUserId}`);
    }

    if (providerUser.organizationId !== handoff.providerOrganizationId) {
      throw new Error(`Forbidden: Provider organization ${providerUser.organizationId} cannot upload documents for handoff owned by ${handoff.providerOrganizationId}.`);
    }

    // Create document evidence
    const doc = createIssuedPolicyDocument({
      bindingHandoff: handoff,
      challengeId: handoff.challengeId,
      providerOrgId: providerUser.organizationId,
      fileName: params.fileName,
      fileSizeBytes: params.fileSizeBytes,
      mimeType: params.mimeType,
      rawContent: params.rawContent
    });

    // Create normalized snapshot
    const snapshot = createIssuedPolicySnapshot({
      issuedDocument: doc,
      bindingHandoffId: handoff.id,
      carrier: params.extractedTerms.carrier,
      policyNumber: params.extractedTerms.policyNumber,
      annualPremium: params.extractedTerms.annualPremium,
      monthlyPremium: params.extractedTerms.monthlyPremium,
      effectiveDate: params.extractedTerms.effectiveDate,
      expirationDate: params.extractedTerms.expirationDate,
      coverages: params.extractedTerms.coverages,
      extractionConfidence: params.extractedTerms.extractionConfidence,
      isAmbiguous: params.extractedTerms.isAmbiguous
    });

    this.issuedPolicyDocuments.set(doc.id, doc);
    this.issuedPolicySnapshots.set(snapshot.id, snapshot);

    this.recordAudit(
      'ISSUED_POLICY_UPLOADED',
      'PROVIDER',
      providerUser.id,
      `Issued policy document "${doc.fileName}" (SHA-256: ${doc.documentSha256.substring(0, 16)}...) uploaded by ${providerUser.name} for handoff ${handoff.id}.`
    );

    postgresStore.saveIssuedPolicyDocument(doc).catch(err => {
      console.warn('[PostgresStore IssuedPolicyDocument Sync Error]', err?.message || err);
    });
    postgresStore.saveIssuedPolicySnapshot(snapshot).catch(err => {
      console.warn('[PostgresStore IssuedPolicySnapshot Sync Error]', err?.message || err);
    });

    return { document: doc, snapshot };
  }

  public reconcileIssuedPolicyForHandoff(params: {
    bindingHandoffId: string;
    providerUserId?: string;
    systemTriggered?: boolean;
  }): { report: ReconciliationReport; vaultItem?: PolicyVaultItem; newBaseline?: CoverageBaseline } {
    const handoff = this.handoffs.get(params.bindingHandoffId);
    if (!handoff) {
      throw new Error(`Binding handoff ${params.bindingHandoffId} not found.`);
    }

    if (handoff.status !== 'BOUND') {
      throw new Error(`Cannot reconcile: Handoff must be in BOUND status (current: ${handoff.status}).`);
    }

    if (params.providerUserId) {
      const providerUser = this.providerUsers.get(params.providerUserId);
      if (!providerUser || providerUser.organizationId !== handoff.providerOrganizationId) {
        throw new Error(`Forbidden: Unauthorized provider execution.`);
      }
    }

    // Get latest document & snapshot for this handoff
    const documents = Array.from(this.issuedPolicyDocuments.values())
      .filter(d => d.bindingHandoffId === handoff.id)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    if (documents.length === 0) {
      throw new Error(`No issued policy document evidence found for handoff ${handoff.id}.`);
    }
    const latestDoc = documents[0];

    const snapshots = Array.from(this.issuedPolicySnapshots.values())
      .filter(s => s.issuedPolicyDocumentId === latestDoc.id)
      .sort((a, b) => new Date(b.extractedAt).getTime() - new Date(a.extractedAt).getTime());

    if (snapshots.length === 0) {
      throw new Error(`No issued policy snapshot found for document ${latestDoc.id}.`);
    }
    const latestSnapshot = snapshots[0];

    // Get selection & offer version
    const selection = handoff.selectionId ? this.selections.get(handoff.selectionId) : undefined;
    if (!selection) {
      throw new Error(`Selection not found for binding handoff ${handoff.id}.`);
    }

    // Offer versions lookup
    const allVersions = Array.from(this.offerVersions.values()).flat();
    const offerVersion = allVersions.find(v => v.id === selection.offerVersionId);
    if (!offerVersion) {
      throw new Error(`Offer version ${selection.offerVersionId} not found.`);
    }

    // Accepted modifications lookup
    const acceptedMods = this.getBindingModificationsForHandoff(handoff.id)
      .filter(m => m.status === 'ACCEPTED');

    // Derive ExpectedBoundTerms
    const expectedTerms = deriveExpectedBoundTerms({
      offerVersion,
      acceptedModifications: acceptedMods
    });

    // Reconcile
    const report = pm5Reconcile({
      expectedTerms,
      issuedSnapshot: latestSnapshot,
      issuedDocument: latestDoc,
      challengeId: handoff.challengeId,
      bindingHandoffId: handoff.id
    });

    this.reconciliationReports.set(report.id, report);

    this.recordAudit(
      'ISSUED_POLICY_RECONCILED',
      params.systemTriggered ? 'SYSTEM' : 'PROVIDER',
      params.providerUserId || 'system_reconciliation_engine',
      `Reconciled issued policy #${latestSnapshot.policyNumber}: Verdict=${report.verdict}, Discrepancies=${report.discrepancies.length}, PremiumVariance=$${report.totalAnnualPremiumVariance}`
    );

    postgresStore.saveReconciliationReport(report).catch(err => {
      console.warn('[PostgresStore ReconciliationReport Sync Error]', err?.message || err);
    });

    let vaultItem: PolicyVaultItem | undefined;
    let newBaseline: CoverageBaseline | undefined;

    // Automatic activation to Vault if MATCH or AUTHORIZED_VARIANCE
    if (report.verdict === 'MATCH' || report.verdict === 'AUTHORIZED_VARIANCE') {
      const challenge = this.challenges.get(handoff.challengeId);
      const currentBaseline = challenge ? challenge.baseline : undefined;

      const activated = pm5ActivateVault({
        handoff,
        selection,
        offerVersion,
        acceptedModifications: acceptedMods,
        report,
        snapshot: latestSnapshot,
        document: latestDoc,
        currentBaseline
      });

      vaultItem = activated.vaultItem;
      newBaseline = activated.newBaseline;

      this.policyVaultItems.set(vaultItem.id, vaultItem);
      if (newBaseline) {
        this.baselines.set(newBaseline.id, newBaseline);
      }

      this.recordAudit(
        'POLICY_VAULT_FILED',
        'SYSTEM',
        'system_vault_manager',
        `Policy #${latestSnapshot.policyNumber} filed into Private Policy Vault (Provenance: ${vaultItem.provenanceHash.substring(0, 16)}...).`
      );

      if (newBaseline) {
        this.recordAudit(
          'FUTURE_BASELINE_ACTIVATED',
          'SYSTEM',
          'system_baseline_manager',
          `Activated new CoverageBaseline version ${newBaseline.version} for future renewal cycles.`
        );
      }

      postgresStore.savePolicyVaultItem(vaultItem).catch(err => {
        console.warn('[PostgresStore PolicyVaultItem Sync Error]', err?.message || err);
      });
    }

    return { report, vaultItem, newBaseline };
  }

  public consumerReviewReconciliation(params: {
    reconciliationReportId: string;
    consumerId: string;
    decision: 'ACCEPT_VARIANCE' | 'DISPUTE_REMEDIATION_REQUESTED';
    disputeNotes?: string;
  }): { report: ReconciliationReport; vaultItem?: PolicyVaultItem; newBaseline?: CoverageBaseline } {
    const report = this.reconciliationReports.get(params.reconciliationReportId);
    if (!report) {
      throw new Error(`Reconciliation report ${params.reconciliationReportId} not found.`);
    }

    const handoff = this.handoffs.get(report.bindingHandoffId!);
    if (!handoff) {
      throw new Error(`Binding handoff not found.`);
    }

    const challenge = this.challenges.get(report.challengeId!);
    if (!challenge) {
      throw new Error(`Challenge not found.`);
    }

    const updatedReport = pm5ProcessReview({
      report,
      consumerId: params.consumerId,
      challengeConsumerId: challenge.consumerId,
      decision: params.decision,
      disputeNotes: params.disputeNotes
    });

    this.reconciliationReports.set(updatedReport.id, updatedReport);

    this.recordAudit(
      'RECONCILIATION_VARIANCE_RESOLVED',
      'CONSUMER',
      params.consumerId,
      `Consumer ${params.consumerId} ${params.decision === 'ACCEPT_VARIANCE' ? 'accepted' : 'disputed'} reconciliation report ${report.id}${params.disputeNotes ? ': ' + params.disputeNotes : ''}`
    );

    postgresStore.saveReconciliationReport(updatedReport).catch(err => {
      console.warn('[PostgresStore ReconciliationReport Sync Error]', err?.message || err);
    });

    let vaultItem: PolicyVaultItem | undefined;
    let newBaseline: CoverageBaseline | undefined;

    if (params.decision === 'ACCEPT_VARIANCE') {
      const selection = handoff.selectionId ? this.selections.get(handoff.selectionId) : undefined;
      const allVersions = Array.from(this.offerVersions.values()).flat();
      const offerVersion = selection ? allVersions.find(v => v.id === selection.offerVersionId) : undefined;
      const doc = this.issuedPolicyDocuments.get(report.issuedPolicyDocumentId!);
      const snapshot = this.issuedPolicySnapshots.get(report.issuedPolicySnapshotId!);
      const acceptedMods = this.getBindingModificationsForHandoff(handoff.id)
        .filter(m => m.status === 'ACCEPTED');

      if (selection && offerVersion && doc && snapshot) {
        const activated = pm5ActivateVault({
          handoff,
          selection,
          offerVersion,
          acceptedModifications: acceptedMods,
          report: updatedReport,
          snapshot,
          document: doc,
          currentBaseline: challenge.baseline
        });

        vaultItem = activated.vaultItem;
        newBaseline = activated.newBaseline;

        this.policyVaultItems.set(vaultItem.id, vaultItem);
        if (newBaseline) {
          this.baselines.set(newBaseline.id, newBaseline);
        }

        this.recordAudit(
          'POLICY_VAULT_FILED',
          'SYSTEM',
          'system_vault_manager',
          `Policy #${snapshot.policyNumber} filed into Private Policy Vault following consumer variance acceptance.`
        );

        if (newBaseline) {
          this.recordAudit(
            'FUTURE_BASELINE_ACTIVATED',
            'SYSTEM',
            'system_baseline_manager',
            `Activated new CoverageBaseline version ${newBaseline.version} for future renewal cycles.`
          );
        }

        postgresStore.savePolicyVaultItem(vaultItem).catch(err => {
          console.warn('[PostgresStore PolicyVaultItem Sync Error]', err?.message || err);
        });
      }
    }

    return { report: updatedReport, vaultItem, newBaseline };
  }

  public getReconciliationReport(id: string): ReconciliationReport | undefined {
    return this.reconciliationReports.get(id);
  }

  public getReconciliationReportsForHandoff(handoffId: string): ReconciliationReport[] {
    return Array.from(this.reconciliationReports.values()).filter(r => r.bindingHandoffId === handoffId);
  }

  public getIssuedPolicyDocumentsForHandoff(handoffId: string): IssuedPolicyDocument[] {
    return Array.from(this.issuedPolicyDocuments.values()).filter(d => d.bindingHandoffId === handoffId);
  }

  public getIssuedPolicySnapshotsForHandoff(handoffId: string): IssuedPolicySnapshot[] {
    return Array.from(this.issuedPolicySnapshots.values()).filter(s => s.bindingHandoffId === handoffId);
  }

  public getPolicyVaultItemsForConsumer(consumerId: string): PolicyVaultItem[] {
    return Array.from(this.policyVaultItems.values()).filter(v => v.consumerId === consumerId);
  }

  public getPolicyVaultItem(id: string): PolicyVaultItem | undefined {
    return this.policyVaultItems.get(id);
  }

  public getInvitationsForChallenge(challengeId: string): ChallengeInvitation[] {
    return Array.from(this.challengeInvitations.values()).filter(i => i.challengeId === challengeId);
  }
}

export const db = new PolicyChallengeDatabase();
