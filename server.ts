import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { db } from './src/server/db';
import { postgresStore } from './src/server/db/postgresStore';
import { SAMPLE_DECLARATIONS_PAGES, detectQuoteDiscrepancies } from './src/domain/policyIntelligence';
import { compareOfferAgainstBaseline } from './src/domain/comparisonEngine';
import { explainCoverageComparison, generateDeterministicExplanation } from './src/server/geminiService';
import { Offer, OfferVersion, CoverageBaseline, ConsumerRequirements, Challenge, Competition, ChallengeInvitation,
  PlatformNotification, CompetitionActivityEvent, AuditEvent } from './src/types/insurance';
import { evaluateProviderEligibility, type EligibilityEvaluation } from './src/domain/eligibilityEngine';
import { evaluateOfferQualification } from './src/domain/qualificationEngine';
import { verifyCryptographicAuditChain, processReviewQueueResolution,
  generateRegulatoryAuditProof } from './src/domain/governanceAuditEngine';
import { assertProductionAuthConfiguration, attachRequestIdentity } from './src/server/auth/requestIdentity';
import { assertBindingRelationship, assertChallengeRelationship, enforceApiAuthorization } from './src/server/auth/routeAuthorization';

import { runComparisonEngineTestSuite } from './src/domain/comparisonEngine.test';
import { runEligibilityEngineTestSuite } from './src/domain/eligibilityEngine.test';
import { runCompetitionEngineTestSuite } from './src/domain/competitionEngine.test';
import { runBindingAndReconciliationTests } from './src/domain/bindingReconciliation.test';
import { runGovernanceAuditTestSuite } from './src/domain/governanceAudit.test';
import { runPM1AcceptanceTestSuite } from './src/domain/pm1Marketplace.test';
import { runPM2AcceptanceTestSuite } from './src/domain/pm2InformationOffers.test';
import { runPM3AcceptanceTestSuite } from './src/domain/pm3CompetitionRounds.test';
import { runPM4AcceptanceTestSuite } from './src/domain/pm4SelectionBinding.test';
import { runPM5DomainTestSuite } from './src/domain/pm5Reconciliation.test';
import { runCommercialEconomicsTestSuite } from './src/domain/commercialEconomics.test';
import { commercialStore } from './src/server/db/commercialStore';
import { jurisdictionStore } from './src/server/db/jurisdictionStore';
import { determineJurisdiction } from './src/domain/jurisdictionDetermination';
import { JurisdictionSignal } from './src/types/jurisdiction';
import {
  ensureJurisdictionFramework,
  inShadow,
  marketEnvironment,
  recordDetermination,
  shadowChallengeOpen,
  shadowOfferQualification,
  shadowProviderAuthority,
  transactionDateOf
} from './src/server/jurisdictionShadow';
import {
  createCommercialAccount,
  createCommercialAgreement,
  deriveEntitlementsFromPlanVersion,
  checkEntitlementCapacity,
  transitionAgreementLifecycle,
  buildCommercialEvent,
  calculateValueSummary
} from './src/domain/commercialEconomicsEngine';

export const app = express();
const DEFAULT_PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));
app.use('/api', attachRequestIdentity);
app.use('/api', enforceApiAuthorization);

// Provider and consumer identity is attached by verified Firebase ID token.
// Legacy identity headers exist only inside explicit non-production fixture mode.
async function getAuthenticatedProviderOrgId(req: express.Request): Promise<string> {
  const identity = req.openPolicyIdentity;
  if (!identity || identity.role !== 'PROVIDER') {
    const err: any = new Error('Unauthorized: verified provider identity required');
    err.statusCode = 401;
    throw err;
  }

  if (identity.source === 'FIREBASE' && identity.providerStatus !== 'ACTIVE') {
    const err: any = new Error(`Forbidden: Provider profile status is ${identity.providerStatus || 'UNVERIFIED'}`);
    err.statusCode = 403;
    throw err;
  }

  const providerUserId = identity.providerUserId;
  if (!providerUserId) {
    const err: any = new Error('Forbidden: Provider profile is not linked to a marketplace ProviderUser');
    err.statusCode = 403;
    throw err;
  }

  const user = await postgresStore.getProviderUser(providerUserId);
  if (!user) {
    const err: any = new Error(`Unauthorized: Provider user '${providerUserId}' is not registered`);
    err.statusCode = 401;
    throw err;
  }

  if (user.status !== 'ACTIVE') {
    const err: any = new Error(`Forbidden: Provider user '${providerUserId}' account is not active`);
    err.statusCode = 403;
    throw err;
  }

  const org = await postgresStore.getProviderOrganization(user.organizationId);
  if (!org) {
    const err: any = new Error(`Forbidden: Provider organization '${user.organizationId}' is not recognized or authorized`);
    err.statusCode = 403;
    throw err;
  }

  if (org.marketplaceStatus !== 'ACTIVE') {
    const err: any = new Error(`Forbidden: Provider organization '${org.id}' marketplace status is ${org.marketplaceStatus}`);
    err.statusCode = 403;
    throw err;
  }

  // BLOCKER 3: Direct Impersonation Attack Prevention
  // If the client attempts to override the organization via header, query param, or request body,
  // reject immediately with 403 Forbidden. Changing client-supplied values cannot change who the server believes the caller is.
  const clientSuppliedOrg = (req.headers['x-provider-org-id'] as string) || 
                            (req.query.providerId as string) || 
                            (req.query.orgId as string) || 
                            req.body?.providerId || 
                            req.body?.orgId;
  if (clientSuppliedOrg && clientSuppliedOrg !== user.organizationId) {
    const err: any = new Error(`Forbidden: Impersonation rejected. Authenticated organization '${user.organizationId}' does not match requested organization '${clientSuppliedOrg}'`);
    err.statusCode = 403;
    throw err;
  }

  if (identity.providerOrganizationId && identity.providerOrganizationId !== user.organizationId) {
    const err: any = new Error('Forbidden: Authenticated profile organization does not match the marketplace user organization');
    err.statusCode = 403;
    throw err;
  }

  return user.organizationId;
}

async function getAuthenticatedProviderUserId(req: express.Request): Promise<string> {
  const identity = req.openPolicyIdentity;
  if (!identity || identity.role !== 'PROVIDER' || !identity.providerUserId) {
    const err: any = new Error('Unauthorized: verified provider identity required');
    err.statusCode = 401;
    throw err;
  }
  const user = await postgresStore.getProviderUser(identity.providerUserId);
  if (!user) {
    const err: any = new Error(`Forbidden: Provider user '${identity.providerUserId}' is not registered`);
    err.statusCode = 403;
    throw err;
  }
  return user.id;
}

function getAuthenticatedConsumerId(req: express.Request): string {
  const identity = req.openPolicyIdentity;
  if (!identity || identity.role !== 'CONSUMER') {
    const err: any = new Error('Unauthorized: verified consumer identity required');
    err.statusCode = 401;
    throw err;
  }
  return identity.uid;
}

async function authorizeChallengeResource(req: express.Request, challengeId: string): Promise<void> {
  const challenge = await postgresStore.getChallenge(challengeId);
  if (!challenge) {
    const err: any = new Error('Challenge not found');
    err.statusCode = 404;
    throw err;
  }
  const identity = req.openPolicyIdentity!;
  const providerOrganizationId = identity.role === 'PROVIDER' ? await getAuthenticatedProviderOrgId(req) : undefined;
  const participatingOrganizationIds = (await postgresStore.getAllParticipations())
    .filter(p => p.challengeId === challengeId && p.status !== 'WITHDRAWN')
    .map(p => p.providerOrganizationId);
  assertChallengeRelationship({
    identity, challengeConsumerId: challenge.consumerId,
    providerOrganizationId, participatingOrganizationIds
  });
}

async function authorizeBindingResource(req: express.Request, handoffId: string): Promise<void> {
  const handoff = (await postgresStore.getBindingHandoffs()).find(candidate => candidate.id === handoffId);
  if (!handoff) {
    const err: any = new Error('Binding handoff not found');
    err.statusCode = 404;
    throw err;
  }
  const identity = req.openPolicyIdentity!;
  const providerOrganizationId = identity.role === 'PROVIDER' ? await getAuthenticatedProviderOrgId(req) : undefined;
  assertBindingRelationship({
    identity, handoffConsumerId: handoff.consumerId,
    handoffProviderOrganizationId: handoff.providerOrganizationId,
    providerOrganizationId
  });
}

function requireHandoffProviderOrganization(handoff: { providerOrganizationId?: string } | undefined): string {
  if (!handoff?.providerOrganizationId) {
    const err: any = new Error('Forbidden: Binding handoff has no authoritative provider organization mapping');
    err.statusCode = 403;
    throw err;
  }
  return handoff.providerOrganizationId;
}

async function notificationRecipientForRequest(req: express.Request) {
  const identity = req.openPolicyIdentity;
  if (!identity) throw Object.assign(new Error('Verified identity required'), { statusCode: 401 });
  if (identity.role === 'CONSUMER') return { consumerId: identity.uid };
  if (identity.role === 'ADMIN') return { operatorId: identity.uid };
  const providerOrganizationId = await getAuthenticatedProviderOrgId(req);
  const providerUserId = await getAuthenticatedProviderUserId(req);
  return { providerUserId, providerOrganizationId };
}

// ==========================================
// 1. Core Health & System Telemetry API
// ==========================================
app.get('/api/health', async (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    service: 'Policy Challenge Engine',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/tests/run', async (req, res) => {
  const comparisonResults = runComparisonEngineTestSuite();
  const eligibilityResults = runEligibilityEngineTestSuite();
  const competitionResults = runCompetitionEngineTestSuite();
  const bindingResults = runBindingAndReconciliationTests();
  const governanceResults = runGovernanceAuditTestSuite();
  const pm1Results = runPM1AcceptanceTestSuite();
  const pm2Results = runPM2AcceptanceTestSuite();
  const pm3Results = runPM3AcceptanceTestSuite();
  const pm4Results = runPM4AcceptanceTestSuite();
  const pm5Results = runPM5DomainTestSuite();
  const ceResults = runCommercialEconomicsTestSuite();

  const bindingPassed = bindingResults.filter(t => t.passed).length;
  const bindingFailed = bindingResults.length - bindingPassed;

  const total = comparisonResults.total + eligibilityResults.total + competitionResults.total + bindingResults.length + governanceResults.total + pm1Results.total + pm2Results.total + pm3Results.total + pm4Results.total + pm5Results.total + ceResults.total;
  const passed = comparisonResults.passed + eligibilityResults.passed + competitionResults.passed + bindingPassed + governanceResults.passed + pm1Results.passed + pm2Results.passed + pm3Results.passed + pm4Results.passed + pm5Results.passed + ceResults.passed;
  const failed = comparisonResults.failed + eligibilityResults.failed + competitionResults.failed + bindingFailed + governanceResults.failed + pm1Results.failed + pm2Results.failed + pm3Results.failed + pm4Results.failed + pm5Results.failed + ceResults.failed;
  const results = [
    ...comparisonResults.results,
    ...eligibilityResults.results,
    ...competitionResults.results,
    ...bindingResults,
    ...governanceResults.results,
    ...pm1Results.results,
    ...pm2Results.results,
    ...pm3Results.results,
    ...pm4Results.results,
    ...pm5Results.results,
    ...ceResults.results
  ];

  res.json({ passed, failed, total, results });
});

app.get('/api/metrics', async (req, res) => {
  res.json(db.getMetrics());
});

// ==========================================
// PR-0A: Jurisdiction framework (read-only)
// Mutations (rulesets, publication, activation, gates) are store-level only until
// PR-1 provides authenticated operator authorization.
// ==========================================
app.get('/api/jurisdictions', async (req, res) => {
  try {
    await ensureJurisdictionFramework();
    res.json({ environment: marketEnvironment(), jurisdictions: await jurisdictionStore.getJurisdictions() });
  } catch (e: any) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

app.get('/api/jurisdictions/:code/rulesets', async (req, res) => {
  try {
    await ensureJurisdictionFramework();
    const code = req.params.code.toUpperCase();
    const ruleSets = await jurisdictionStore.getRuleSets(code);
    const withRules = [];
    for (const ruleSet of ruleSets) {
      withRules.push({ ...ruleSet, rules: await jurisdictionStore.getRules(ruleSet.id), reviews: await jurisdictionStore.getReviews(ruleSet.id) });
    }
    res.json({ jurisdictionCode: code, ruleSets: withRules, sources: await jurisdictionStore.getSources(code) });
  } catch (e: any) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

app.get('/api/jurisdictions/:code/market', async (req, res) => {
  try {
    await ensureJurisdictionFramework();
    const requested = String(req.query.environment || marketEnvironment()).toUpperCase();
    if (requested !== 'SANDBOX' && requested !== 'PRODUCTION') {
      return res.status(400).json({ error: 'environment must be SANDBOX or PRODUCTION' });
    }
    const key = { jurisdictionCode: req.params.code.toUpperCase(), insuranceLine: 'PERSONAL_AUTO' as const, environment: requested as 'SANDBOX' | 'PRODUCTION' };
    res.json({ ...(await jurisdictionStore.getMarketStatus(key)), events: await jurisdictionStore.getActivationEvents(key) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/jurisdiction-evaluations', async (req, res) => {
  try {
    await ensureJurisdictionFramework();
    const evaluations = await jurisdictionStore.getEvaluations({
      subjectType: req.query.subjectType ? String(req.query.subjectType) : undefined,
      subjectId: req.query.subjectId ? String(req.query.subjectId) : undefined,
      discrepancy: req.query.discrepancy === undefined ? undefined : req.query.discrepancy === 'true'
    });
    res.json({ evaluations });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/audit-events', async (req, res) => {
  res.json(db.getAuditEvents());
});

app.post('/api/reset', async (req, res) => {
  db.seedCanonicalDataset();
  res.json({ success: true, message: 'Database reset to canonical initial state' });
});

// ==========================================
// 2. Documents & Policy Intelligence API
// ==========================================
app.get('/api/documents/samples', async (req, res) => {
  res.json(SAMPLE_DECLARATIONS_PAGES);
});

app.post('/api/documents/upload-sample', async (req, res) => {
  const { sampleId } = req.body;
  const sample = SAMPLE_DECLARATIONS_PAGES.find(s => s.id === sampleId) || SAMPLE_DECLARATIONS_PAGES[0];

  const policyId = `POL-${Date.now()}`;
  const policy = {
    id: policyId,
    policyNumber: sample.policyData.policyNumber || 'POL-SAMPLE-1',
    carrier: sample.policyData.carrier || 'Sample Insurance Co',
    jurisdiction: sample.jurisdiction,
    namedInsured: sample.policyData.namedInsured || 'Consumer',
    effectiveDate: sample.policyData.effectiveDate || '2025-11-18',
    expirationDate: sample.policyData.expirationDate || '2026-11-18',
    termMonths: sample.policyData.termMonths || 12,
    annualPremium: sample.policyData.annualPremium || 2964,
    monthlyPremium: sample.policyData.monthlyPremium || 247,
    status: 'EXTRACTED' as const,
    drivers: sample.policyData.drivers || [],
    vehicles: sample.policyData.vehicles || [],
    coverages: sample.policyData.coverages || [],
    sourceDocumentId: sample.id,
    sourceDocumentName: sample.name
  };

  await postgresStore.commitPolicyWithAudit(policy, [
    {
      eventType: 'POLICY_UPLOADED', actorRole: 'ADMIN', actorId: req.openPolicyIdentity!.uid,
      details: `Policy ${policy.id} stored in private vault`
    },
    {
      eventType: 'DOCUMENT_PROCESSED', actorRole: 'SYSTEM', actorId: 'doc_intel_service',
      details: `Extracted ${policy.coverages.length} terms from ${sample.name}`
    }
  ]);

  res.json({
    success: true,
    policy,
    sampleEvidence: sample.rawTextExcerpt
  });
});

// Update / verify policy terms
app.post('/api/policies/:id/verify', async (req, res) => {
  const { id } = req.params;
  const updatedPolicy = req.body;
  updatedPolicy.id = id;
  updatedPolicy.status = 'VERIFIED';
  
  await postgresStore.commitPolicyWithAudit(updatedPolicy, [{
    eventType: 'CONSUMER_CORRECTED_FIELD', actorRole: 'ADMIN', actorId: req.openPolicyIdentity!.uid,
    details: `Consumer corrected/verified policy fields for ${updatedPolicy.carrier}`
  }]);
  res.json({ success: true, policy: updatedPolicy });
});

// ==========================================
// 3. Coverage Baseline API
// ==========================================
app.post('/api/baselines/create', async (req, res) => {
  const { policyId, verifiedBy } = req.body;
  const policy = await postgresStore.getPolicy(policyId);
  if (!policy) {
    return res.status(404).json({ error: 'Policy not found' });
  }

  const baselineId = `BL-${Date.now()}`;
  const baseline: CoverageBaseline = {
    id: baselineId,
    policyId: policy.id,
    version: 1,
    carrier: policy.carrier,
    effectiveDate: policy.effectiveDate,
    expirationDate: policy.expirationDate,
    baselineAnnualPremium: policy.annualPremium,
    baselineMonthlyPremium: policy.monthlyPremium,
    jurisdiction: policy.jurisdiction,
    vehicle: policy.vehicles[0],
    coverages: policy.coverages,
    verifiedAt: new Date().toISOString(),
    verifiedBy: verifiedBy || 'Consumer'
  };

  await postgresStore.commitCoverageBaselineWithAudit(baseline, {
    eventType: 'BASELINE_CREATED', actorRole: 'SYSTEM', actorId: 'baseline_engine',
    details: `Coverage baseline version ${baseline.version} created`
  });
  res.json({ success: true, baseline });
});

// ==========================================
// 4. Challenge & Marketplace API
// ==========================================
app.post('/api/challenges/create', async (req, res) => {
  let consumerId: string;
  try {
    consumerId = getAuthenticatedConsumerId(req);
  } catch (e: any) {
    return res.status(e.statusCode || 401).json({ error: e.message });
  }
  const { baselineId, requirements } = req.body;
  const baseline = await postgresStore.getCoverageBaseline(baselineId);
  if (!baseline) {
    return res.status(404).json({ error: 'Coverage baseline not found' });
  }

  const challengeId = `CHAL-${Date.now()}`;
  const openingTimestamp = new Date().toISOString();

  // PR-0A: the governing jurisdiction comes from evidence, never a default or a ZIP prefix.
  // The policy's stated state is the evidence; the baseline's copy is a cross-check, so a
  // disagreement surfaces as CONFLICT.
  const sourcePolicy = await postgresStore.getPolicy(baseline.policyId);
  const signals: JurisdictionSignal[] = [];
  if (sourcePolicy?.jurisdiction) {
    signals.push({ signal: 'POLICY_STATED_STATE', value: sourcePolicy.jurisdiction, evidenceRef: `policy:${sourcePolicy.id}` });
  }
  if (baseline.jurisdiction) {
    signals.push({ signal: 'POLICY_STATED_STATE', value: baseline.jurisdiction, evidenceRef: `baseline:${baseline.id}` });
  }
  const determination = determineJurisdiction({
    id: `JDET-${challengeId}`,
    signals,
    policyId: baseline.policyId,
    challengeId,
    determinedAt: openingTimestamp
  });
  await inShadow('determination', () => recordDetermination(determination));
  const jurisdiction = determination.confirmedJurisdiction || determination.proposedJurisdiction;
  if (determination.status === 'CONFLICT') {
    return res.status(422).json({
      error: 'JURISDICTION_CONFLICT',
      code: 'JURISDICTION_CONFLICT',
      message: 'Jurisdiction evidence for this policy conflicts; it must be resolved before the challenge can open.',
      determination
    });
  }
  if (!jurisdiction) {
    return res.status(422).json({
      error: 'JURISDICTION_UNDETERMINED',
      code: 'JURISDICTION_UNDETERMINED',
      message: 'The governing jurisdiction for this policy could not be determined; the challenge cannot open.',
      determination
    });
  }

  const challenge: Challenge = {
    id: challengeId,
    referenceNumber: `CHALLENGE #${jurisdiction}-${Math.floor(10000 + Math.random() * 90000)}`,
    consumerId,
    coverageBaselineId: baselineId,
    baseline,
    requirements: requirements || {
      id: `REQ-${Date.now()}`,
      ruleSummary: 'Beat my current price without reducing my protection.',
      minAnnualSavings: 150,
      maxCollisionDeductible: 500,
      maxCompDeductible: 250,
      mustIncludeRental: true,
      mustIncludeRoadside: true
    },
    jurisdiction,
    jurisdictionDeterminationId: determination.id,
    openingTimestamp,
    closingTimestamp: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'OPEN',
    disclosureLevel: 'MARKETPLACE_ANONYMOUS',
    offersCount: 0
  };

  // PR-0A shadow: market activation for opening, and the ruleset anchor. Never blocks (D4).
  const anchor = await inShadow('challenge-open', () => shadowChallengeOpen(challenge));
  if (anchor) {
    challenge.ruleSetId = anchor.ruleSetId;
    challenge.ruleSetContentSha256 = anchor.ruleSetContentSha256;
    challenge.regulatoryEvaluationDate = anchor.evaluationDate;
  }

  const competition: Competition = {
    id: `COMP-${challengeId.replace('CHAL-', '')}`,
    challengeId,
    status: 'OPEN',
    currentRound: 'ROUND_1_OPEN',
    openedAt: openingTimestamp,
    closesAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    participantCount: 0,
    improvementRoundEnabled: true,
    finalRoundEnabled: true
  };
  const evaluations: EligibilityEvaluation[] = [];
  const createdInvitations: ChallengeInvitation[] = [];
  const openingNotifications: PlatformNotification[] = [];
  const openingAudits: Array<Pick<AuditEvent, 'eventType' | 'actorRole' | 'actorId' | 'details'>> = [
    { eventType: 'CHALLENGE_OPENED', actorRole: 'CONSUMER', actorId: consumerId,
      details: `Challenge ${challenge.referenceNumber} opened in marketplace` },
    { eventType: 'COMPETITION_CREATED', actorRole: 'SYSTEM', actorId: 'competition_engine',
      details: `Competition ${competition.id} created for challenge ${challenge.referenceNumber}` },
    { eventType: 'COMPETITION_OPENED', actorRole: 'SYSTEM', actorId: 'competition_engine',
      details: `Competition ${competition.id} opened for 48h initial round` }
  ];
  for (const org of await postgresStore.getProviderOrganizations()) {
    const evaluation = evaluateProviderEligibility(
      challenge, org, await postgresStore.getProviderLicenses(org.id),
      await postgresStore.getProviderAppetite(org.id)
    );
    evaluations.push(evaluation);
    openingAudits.push({
      eventType: 'PROVIDER_MATCH_EVALUATED', actorRole: 'SYSTEM', actorId: 'eligibility_engine',
      details: `Evaluated ${org.displayName} (${org.id}) for challenge ${challenge.referenceNumber}: ${evaluation.isEligible ? 'ELIGIBLE' : 'INELIGIBLE'} [${evaluation.reasons.join(', ')}]`
    });
    if (!evaluation.isEligible) continue;
    const invitation: ChallengeInvitation = {
      id: `INV-${challengeId.replace('CHAL-', '')}-${org.id}`,
      challengeId, competitionId: competition.id, providerOrganizationId: org.id,
      eligibilityResult: 'ELIGIBLE', eligibilityReasons: evaluation.reasons,
      status: 'INVITED', invitedAt: openingTimestamp, expiresAt: competition.closesAt
    };
    createdInvitations.push(invitation);
    openingAudits.push({
      eventType: 'INVITATION_CREATED', actorRole: 'SYSTEM', actorId: 'invitation_service',
      details: `Created challenge invitation ${invitation.id} for ${org.displayName}`
    });
    openingNotifications.push({
      id: `NOTIF-${challenge.id}-${org.id}`, type: 'OPPORTUNITY_RECEIVED',
      title: 'New Policy Challenge Opportunity',
      message: `New verified ${challenge.jurisdiction} Personal Auto opportunity: ${challenge.referenceNumber}. Current premium: $${challenge.baseline.baselineAnnualPremium}/yr.`,
      timestamp: openingTimestamp, read: false, recipientType: 'PROVIDER_ORGANIZATION',
      recipientProviderOrganizationId: org.id, createdFromEvent: `INVITATION:${invitation.id}`,
      actionTarget: 'OPPORTUNITIES'
    });
  }
  const openingActivity: CompetitionActivityEvent = {
    id: `ACT-${competition.id}-OPENED`, competitionId: competition.id, challengeId,
    timestamp: openingTimestamp, type: 'COMPETITION_OPENED', actorRole: 'SYSTEM',
    actorName: 'competition_engine', summary: `Competition ${competition.id} opened`,
    round: competition.currentRound
  };
  await postgresStore.commitChallengeOpening({
    challenge, competition, invitations: createdInvitations,
    notifications: openingNotifications, activity: openingActivity, audits: openingAudits
  });

  // CE-3: Instrument VPO_AVAILABLE for every eligible invitation successfully committed
  for (const inv of createdInvitations) {
    // PR-0A shadow: provider jurisdictional authority for each invited provider.
    const invitedOrg = await postgresStore.getProviderOrganization(inv.providerOrganizationId);
    if (invitedOrg) {
      const invitedLicenses = await postgresStore.getProviderLicenses(invitedOrg.id);
      const invitedCarrierRelationships = await postgresStore.getCarrierRelationships(invitedOrg.id);
      await inShadow('authority-invitation', () => shadowProviderAuthority({
        invitation: inv,
        challenge,
        org: invitedOrg,
        licenses: invitedLicenses,
        carrierRelationships: invitedCarrierRelationships,
        legacyEligible: inv.eligibilityResult === 'ELIGIBLE',
        evaluationDate: transactionDateOf(inv.invitedAt),
        stage: 'INVITATION'
      }));
    }

    await commercialStore.projectMarketplaceEvent({
      eventType: 'VPO_AVAILABLE',
      sourceEntityType: 'CHALLENGE_INVITATION',
      sourceEntityId: inv.id,
      providerOrganizationId: inv.providerOrganizationId,
      challengeId: inv.challengeId,
      competitionId: inv.competitionId,
      occurredAt: inv.invitedAt
    }).catch(err => console.warn('[CommercialEvent Error]', err));
  }

  res.json({ success: true, challenge });
});

app.get('/api/challenges', async (req, res) => {
  try {
    const consumerId = getAuthenticatedConsumerId(req);
    res.json((await postgresStore.getChallenges()).filter(challenge => challenge.consumerId === consumerId));
  } catch (e: any) {
    res.status(e.statusCode || 403).json({ error: e.message });
  }
});

app.get('/api/challenges/:id', async (req, res) => {
  try {
    await authorizeChallengeResource(req, req.params.id);
  } catch (e: any) {
    return res.status(e.statusCode || 403).json({ error: e.message });
  }
  const challenge = await postgresStore.getChallenge(req.params.id);
  if (!challenge) {
    return res.status(404).json({ error: 'Challenge not found' });
  }
  const offers = await postgresStore.getOffers(challenge.id);
  
  // Calculate comparisons for each offer
  const comparisons = offers.map(offer => 
    compareOfferAgainstBaseline(challenge.baseline, challenge.requirements, offer)
  );

  res.json({
    challenge,
    offers,
    comparisons
  });
});

// ==========================================
// 5. Offers & Quote Discrepancy Validation
// ==========================================
app.post('/api/offers/validate-quote', async (req, res) => {
  const { enteredData, docData } = req.body;
  const discrepancyCheck = detectQuoteDiscrepancies(enteredData, docData);
  res.json(discrepancyCheck);
});

app.post('/api/offers/submit', async (req, res) => {
  const offerData: Offer = req.body;
  try {
    const authOrgId = await getAuthenticatedProviderOrgId(req);
    offerData.providerId = authOrgId;
    const org = await postgresStore.getProviderOrganization(authOrgId);
    if (org) {
      offerData.providerName = org.displayName;
    }
  } catch (e: any) {
    return res.status(e.statusCode || 401).json({ error: e.message });
  }
  offerData.id = offerData.id || `OFFER-${Date.now()}`;
  offerData.submittedAt = new Date().toISOString();
  offerData.status = offerData.status || (offerData.discrepanciesDetected ? 'DISCREPANCY_FLAGGED' : 'VALIDATED');
  offerData.coverages = offerData.coverages || [];
  offerData.round = offerData.round || 'ROUND_1_OPEN';
  offerData.version = offerData.version || 1;
  offerData.isLatestRevision = offerData.isLatestRevision ?? true;

  const challengeForOffer = await postgresStore.getChallenge(offerData.challengeId);
  if (!challengeForOffer) return res.status(404).json({ error: 'Challenge not found' });
  const competitionForOffer = await postgresStore.getCompetitionForChallenge(offerData.challengeId);
  if (!competitionForOffer) return res.status(404).json({ error: 'Competition not found' });
  const providerForOffer = await postgresStore.getProviderOrganization(offerData.providerId);
  const qualification = evaluateOfferQualification(
    offerData, challengeForOffer.baseline, challengeForOffer.requirements,
    providerForOffer, await postgresStore.getCarrierRelationships(offerData.providerId),
    await postgresStore.getOfferVerification(offerData.id)
  );
  offerData.isQualified = qualification.isQualified;
  offerData.qualifiedAt = qualification.evaluatedAt;
  offerData.qualificationReasons = qualification.qualificationReasons;
  offerData.disqualificationReasons = qualification.disqualificationReasons;
  const initialVersion: OfferVersion = {
    id: `VER-${offerData.id}-v${offerData.version || 1}`, offerId: offerData.id,
    versionNumber: offerData.version || 1, round: offerData.round || 'ROUND_1_OPEN',
    carrier: offerData.carrier, annualPremium: offerData.annualPremium,
    monthlyPremium: offerData.monthlyPremium, coverages: JSON.parse(JSON.stringify(offerData.coverages)),
    supportingQuoteDocName: offerData.supportingQuoteDocName,
    revisionReason: 'Initial offer submission', submittedAt: offerData.submittedAt
  };
  const offerActivity: CompetitionActivityEvent = {
    id: `ACT-${offerData.id}-SUBMITTED`, competitionId: competitionForOffer.id,
    challengeId: offerData.challengeId, timestamp: offerData.submittedAt,
    type: 'OFFER_SUBMITTED', actorRole: 'PROVIDER', actorName: offerData.providerName,
    providerOrganizationId: offerData.providerId,
    summary: `${offerData.providerName} submitted an offer for ${offerData.carrier}`,
    round: offerData.round || competitionForOffer.currentRound,
    metadata: { offerId: offerData.id, carrier: offerData.carrier, annualPremium: offerData.annualPremium }
  };
  const offerAudits: Array<Pick<AuditEvent, 'eventType' | 'actorRole' | 'actorId' | 'details'>> = [{
    eventType: 'OFFER_SUBMITTED', actorRole: 'PROVIDER', actorId: offerData.providerId,
    details: `Provider ${offerData.providerName} submitted quote #${offerData.quoteNumber} for ${offerData.carrier}`
  }];
  if (offerData.discrepanciesDetected) offerAudits.push({
    eventType: 'QUOTE_DISCREPANCY_DETECTED', actorRole: 'SYSTEM', actorId: 'quote_validator',
    details: `Discrepancy detected in offer ${offerData.id}: ${offerData.discrepancyDetails?.join('; ')}`
  });
  try {
    await postgresStore.commitOfferSubmission({
      offer: offerData, version: initialVersion, activity: offerActivity, audits: offerAudits
    });
  } catch (error: any) {
    return res.status(error.statusCode || 400).json({ error: error.message });
  }
  const savedOffer = (await postgresStore.getOffer(offerData.id))!;

  // PR-0A shadow: jurisdiction coverage evaluation compared with the frozen qualification (D4).
  await inShadow('offer-qualification', () => shadowOfferQualification(savedOffer, challengeForOffer));

  // CE-3: Instrument PROPOSITION_SUBMITTED for valid OfferVersion
  const offerVersions = await postgresStore.getOfferVersions(savedOffer.id);
  const latestVersion = offerVersions[offerVersions.length - 1];
  const versionId = latestVersion?.id || `VER-${savedOffer.id}-v${savedOffer.version || 1}`;
  await commercialStore.projectMarketplaceEvent({
    eventType: 'PROPOSITION_SUBMITTED',
    sourceEntityType: 'OFFER_VERSION',
    sourceEntityId: versionId,
    providerOrganizationId: savedOffer.providerId,
    challengeId: savedOffer.challengeId,
    occurredAt: savedOffer.submittedAt,
    metadata: {
      offerId: savedOffer.id,
      versionNumber: savedOffer.version || 1,
      carrier: savedOffer.carrier,
      annualPremium: savedOffer.annualPremium
    }
  }).catch(err => console.warn('[CommercialEvent Error]', err));

  res.json({ success: true, offer: savedOffer });
});

// ==========================================
// 6. Plain Language AI Explanation
// ==========================================
app.post('/api/explain-comparison', async (req, res) => {
  try {
    const { comparison } = req.body;
    if (!comparison) {
      return res.status(400).json({ error: 'Missing comparison payload' });
    }
    const explanation = await explainCoverageComparison(comparison);
    res.json({ explanation });
  } catch (error: any) {
    console.warn('Explain comparison endpoint handled exception:', error?.message || error);
    const fallback = req.body?.comparison ? generateDeterministicExplanation(req.body.comparison) : 'Comparison verified against coverage terms.';
    res.json({ explanation: fallback });
  }
});

// ==========================================
// 7. Consumer Selection & Binding Handoff (PM-3)
// ==========================================
app.post('/api/selection/handoff', async (req, res) => {
  const { challengeId, offerId, consumerContact, consumerConsentGiven, acknowledgedReductions } = req.body;
  try {
    await authorizeChallengeResource(req, challengeId);
    if (!consumerContact?.name || !consumerContact?.email || !consumerContact?.phone) {
      return res.status(400).json({ error: 'consumerContact name, email, and phone are required' });
    }
    const result = db.createBindingDossier({
      challengeId,
      offerId,
      consumerContact,
      consumerConsentGiven: consumerConsentGiven !== undefined ? consumerConsentGiven : true,
      acknowledgedReductions: acknowledgedReductions || []
    });
    res.json({ success: true, handoff: result.handoff, dossier: result.dossier });
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

app.get('/api/selection/dossier/:id', async (req, res) => {
  const dossier = db.getBindingDossier(req.params.id);
  if (!dossier) return res.status(404).json({ error: 'Binding dossier not found' });
  try { await authorizeChallengeResource(req, dossier.challengeId); }
  catch (e: any) { return res.status(e.statusCode || 403).json({ error: e.message }); }
  res.json(dossier);
});

app.get('/api/selection/dossier-by-challenge/:challengeId', async (req, res) => {
  try { await authorizeChallengeResource(req, req.params.challengeId); }
  catch (e: any) { return res.status(e.statusCode || 403).json({ error: e.message }); }
  const dossier = db.getDossierByChallenge(req.params.challengeId);
  if (!dossier) return res.status(404).json({ error: 'No binding dossier found for challenge' });
  res.json(dossier);
});

// ==========================================
// 8. Issued Policy Reconciliation API (PM-3)
// ==========================================
app.post('/api/reconciliation/verify', async (req, res) => {
  const { handoffId, dossierId, issuedData } = req.body;
  try {
    if (handoffId) await authorizeBindingResource(req, handoffId);
    if (dossierId && issuedData?.coverages) {
      const dossier = db.getBindingDossier(dossierId);
      if (!dossier) return res.status(404).json({ error: 'Binding dossier not found' });
      await authorizeChallengeResource(req, dossier.challengeId);
      const detailedRec = db.performDetailedReconciliation({
        dossierId,
        issuedData
      });
      return res.json({ success: true, report: detailedRec, isDetailed: true });
    }

    // Legacy fallback
    const report = db.reconcileIssuedPolicy(handoffId, issuedData);
    res.json({ success: true, report });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/reconciliation/dossier/:dossierId', async (req, res) => {
  const dossier = db.getBindingDossier(req.params.dossierId);
  if (!dossier) return res.status(404).json({ error: 'Binding dossier not found' });
  try { await authorizeChallengeResource(req, dossier.challengeId); }
  catch (e: any) { return res.status(e.statusCode || 403).json({ error: e.message }); }
  const report = db.getDetailedReconciliationByDossier(req.params.dossierId);
  if (!report) return res.status(404).json({ error: 'No reconciliation report found for dossier' });
  res.json(report);
});

// ==========================================
// 9. Private Policy Vault API (Section 4)
// ==========================================
app.get('/api/vault/documents', async (req, res) => {
  try {
    const consumerId = getAuthenticatedConsumerId(req);
    res.json(db.getVaultDocuments().filter(document => document.ownerId === consumerId));
  } catch (e: any) {
    res.status(e.statusCode || 403).json({ error: e.message });
  }
});

app.post('/api/vault/upload', async (req, res) => {
  try {
    const consumerId = getAuthenticatedConsumerId(req);
    const doc = db.uploadVaultDocument({ ...req.body, ownerId: consumerId });
    res.json({ success: true, document: doc });
  } catch (e: any) {
    res.status(e.statusCode || 403).json({ error: e.message });
  }
});

// ==========================================
// 10. Competition Engine: Final Round & Incumbent Defense
// ==========================================
app.post('/api/challenges/:id/final-round', async (req, res) => {
  try {
    const challenge = db.initiateFinalRound(req.params.id);
    res.json({ success: true, challenge });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/challenges/:id/incumbent-defense', async (req, res) => {
  try {
    const offer = db.requestIncumbentDefense(req.params.id);
    res.json({ success: true, offer });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ==========================================
// PM-1: Provider Marketplace & Multi-Tenant Routing (Sections 9-16)
// ==========================================
app.get('/api/marketplace/users', async (req, res) => {
  try {
    const users = await postgresStore.getProviderUsers();
    const orgs = await postgresStore.getProviderOrganizations();
    const orgMap = new Map(orgs.map(o => [o.id, o]));
    const result = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      organizationId: u.organizationId,
      organizationName: orgMap.get(u.organizationId)?.displayName || u.organizationId
    }));
    res.json({ users: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/marketplace/providers', async (req, res) => {
  // Authenticated discovery exposes only public provider profile fields.
  try {
    const orgs = await postgresStore.getProviderOrganizations();
    res.json({ orgs: orgs
      .filter(org => org.marketplaceStatus === 'ACTIVE' && ['ACTIVE', 'MARKETPLACE_APPROVED'].includes(org.verificationStatus))
      .map(org => ({
        displayName: org.displayName,
        organizationType: org.organizationType,
        states: org.states,
        linesOfBusiness: org.linesOfBusiness
      })) });
  } catch (e: any) {
    res.status(503).json({ error: 'Provider directory is temporarily unavailable' });
  }
});

// GET /api/marketplace/my-provider — derives org from authenticated session (x-provider-user-id)
// BLOCKER 2/3 FIX: Server resolves authenticated provider context. Client does not select its own org.
app.get('/api/marketplace/my-provider', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const org = await postgresStore.getProviderOrganization(orgId);
    const licenses = await postgresStore.getProviderLicenses(orgId);
    const appetite = await postgresStore.getProviderAppetite(orgId);
    const carriers = await postgresStore.getCarrierRelationships(orgId);
    res.json({ org, activeOrgId: orgId, licenses, appetite, carriers });
  } catch (e: any) {
    res.status(e.statusCode || 401).json({ error: e.message });
  }
});

// Legacy route alias for compatibility — resolves from session, not from client param
app.get('/api/marketplace/active-provider', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const org = await postgresStore.getProviderOrganization(orgId);
    const licenses = await postgresStore.getProviderLicenses(orgId);
    const appetite = await postgresStore.getProviderAppetite(orgId);
    const carriers = await postgresStore.getCarrierRelationships(orgId);
    res.json({ org, activeOrgId: orgId, licenses, appetite, carriers });
  } catch (e: any) {
    res.status(e.statusCode || 401).json({ error: e.message });
  }
});

app.get('/api/marketplace/opportunities', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const opportunities = db.getProviderOpportunities(orgId);
    res.json(opportunities);
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

app.post('/api/marketplace/invitations/:id/view', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const invitation = await postgresStore.viewInvitation(req.params.id, orgId);

    // CE-3: Instrument VPO_VIEWED for first canonical view of opportunity
    await commercialStore.projectMarketplaceEvent({
      eventType: 'VPO_VIEWED',
      sourceEntityType: 'CHALLENGE_INVITATION',
      sourceEntityId: invitation.id,
      providerOrganizationId: invitation.providerOrganizationId,
      challengeId: invitation.challengeId,
      competitionId: invitation.competitionId,
      occurredAt: invitation.viewedAt || new Date().toISOString()
    }).catch(err => console.warn('[CommercialEvent Error]', err));

    res.json({ success: true, invitation });
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

app.post('/api/marketplace/invitations/:id/accept', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const invitationId = req.params.id;

    // 1. Regulatory / Marketplace check: verify invitation exists and belongs to this organization
    const invitation = await postgresStore.getInvitation(invitationId);
    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }
    if (invitation.providerOrganizationId !== orgId) {
      return res.status(403).json({ error: 'Invitation does not belong to this organization' });
    }

    // Idempotency: if invitation is already accepted, return existing participation without re-consuming capacity
    if (invitation.status === 'ACCEPTED') {
      const result = await postgresStore.acceptInvitation(invitationId, orgId);
      return res.json({ success: true, ...result });
    }

    // PR-0A ordering invariant: provider jurisdictional authority is evaluated before any
    // commercial capacity is consumed. SHADOW mode records the result and never blocks (D4).
    const acceptingOrg = await postgresStore.getProviderOrganization(orgId);
    if (acceptingOrg) {
      const acceptanceChallenge = await postgresStore.getChallenge(invitation.challengeId);
      const acceptanceLicenses = await postgresStore.getProviderLicenses(orgId);
      const acceptanceRelationships = await postgresStore.getCarrierRelationships(orgId);
      await inShadow('authority-acceptance', () => shadowProviderAuthority({
        invitation,
        challenge: acceptanceChallenge,
        org: acceptingOrg,
        licenses: acceptanceLicenses,
        carrierRelationships: acceptanceRelationships,
        legacyEligible: true,
        evaluationDate: transactionDateOf(new Date().toISOString()),
        stage: 'ACCEPTANCE'
      }));
    }

    // 2. Commercial Capacity Check & Atomic Consumption
    const idempotencyKey = `usage:vpo_engagement:${orgId}:${invitationId}`;
    const capacityResult = await commercialStore.consumeEngagementCapacity({
      providerOrgId: orgId,
      invitationId,
      challengeId: invitation.challengeId,
      idempotencyKey
    });

    if (!capacityResult.allowed) {
      return res.status(403).json({
        success: false,
        error: 'COMMERCIAL_CAPACITY_REACHED',
        code: 'COMMERCIAL_CAPACITY_REACHED',
        message: 'Commercial capacity reached: provider organization has exhausted available VPO engagement capacity under its current agreement.',
        details: {
          entitlementType: 'VPO_ENGAGEMENT_CAPACITY',
          currentUsage: capacityResult.currentUsage,
          limit: capacityResult.limit,
          enforcementPolicy: capacityResult.enforcementPolicy,
          reason: capacityResult.reason
        }
      });
    }

    // 3. Execute Marketplace Participation
    let result;
    try {
      result = await postgresStore.acceptInvitation(invitationId, orgId);
      if (capacityResult.usageRecord && result.participation) {
        await commercialStore.linkParticipationToUsage(capacityResult.usageRecord.id, result.participation.id);
      }

      // CE-3: Instrument VPO_ENGAGED only after authoritative marketplace participation successfully created
      await commercialStore.projectMarketplaceEvent({
        eventType: 'VPO_ENGAGED',
        sourceEntityType: 'CHALLENGE_PARTICIPATION',
        sourceEntityId: result.participation.id,
        providerOrganizationId: result.participation.providerOrganizationId,
        challengeId: result.participation.challengeId,
        competitionId: result.participation.competitionId,
        occurredAt: result.participation.acceptedAt
      }).catch(err => console.warn('[CommercialEvent Error]', err));
    } catch (mpErr) {
      // Marketplace failure: rollback usage record to prevent phantom commercial consumption
      if (capacityResult.usageRecord && !capacityResult.alreadyConsumed) {
        await commercialStore.releaseUsageRecord(capacityResult.usageRecord.id);
      }
      throw mpErr;
    }

    res.json({
      success: true,
      ...result,
      commercial: {
        capacityAllowed: true,
        isOverage: capacityResult.isOverage,
        enforcementPolicy: capacityResult.enforcementPolicy
      }
    });
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

app.post('/api/marketplace/invitations/:id/decline', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const { reason, notes } = req.body;
    const invitation = await postgresStore.declineInvitation(req.params.id, orgId, reason, notes);
    res.json({ success: true, invitation });
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

app.get('/api/marketplace/competitions', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const competitions = db.getProviderCompetitions(orgId);
    res.json(competitions);
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

app.get('/api/marketplace/workspace/:challengeId', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const workspace = db.getChallengeWorkspace(req.params.challengeId, orgId);
    res.json(workspace);
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

app.post('/api/challenges/:id/compete', async (req, res) => {
  try {
    const result = db.openCompetitionForChallenge(req.params.id);
    res.json({ success: true, ...result });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ==========================================
// PM-2: Competition Engine & Multi-Round Lifecycle API
// ==========================================
app.get('/api/marketplace/competition/:challengeId/status', async (req, res) => {
  try {
    await authorizeChallengeResource(req, req.params.challengeId);
    const summary = db.getCompetitionEvaluation(req.params.challengeId);
    res.json(summary);
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

app.get('/api/marketplace/competition/:challengeId/signals', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const signals = db.getCompetitionMarketSignals(req.params.challengeId, orgId);
    res.json(signals);
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

app.post('/api/marketplace/competition/:challengeId/advance-round', async (req, res) => {
  const { targetRound, reason, customDurationHours } = req.body;
  try {
    const updatedComp = db.advanceCompetition(
      req.params.challengeId, 
      targetRound, 
      reason || `Advanced to ${targetRound} by operator`,
      customDurationHours
    );
    const summary = db.getCompetitionEvaluation(req.params.challengeId);
    res.json({ success: true, competition: updatedComp, summary });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/marketplace/competition/:challengeId/keep-current-offer/:offerId', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const offer = db.confirmKeepCurrentOffer(
      req.params.challengeId,
      req.params.offerId,
      orgId
    );
    res.json({ success: true, offer });
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

app.post('/api/marketplace/competition/:challengeId/withdraw', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const { reason, notes } = req.body;
    if (!reason) {
      return res.status(400).json({ error: 'Withdrawal reason is required' });
    }
    const participation = db.withdrawProviderParticipation(
      req.params.challengeId,
      orgId,
      reason,
      notes
    );
    res.json({ success: true, participation });
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

app.post('/api/marketplace/competition/:challengeId/keep-current-policy', async (req, res) => {
  try {
    const { reason } = req.body;
    const consumerId = getAuthenticatedConsumerId(req);
    const challenge = db.keepCurrentPolicy(
      req.params.challengeId,
      consumerId,
      reason
    );
    res.json({ success: true, challenge });
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

app.get('/api/marketplace/competition/:challengeId/activity-feed', async (req, res) => {
  try {
    await authorizeChallengeResource(req, req.params.challengeId);
    let orgId: string | undefined = undefined;
    if (req.openPolicyIdentity?.role === 'PROVIDER') {
      orgId = await getAuthenticatedProviderOrgId(req);
    }
    const events = db.getCompetitionActivityFeed(req.params.challengeId, orgId);
    res.json({ success: true, events });
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

app.get('/api/marketplace/competition/:challengeId/deadline-status', async (req, res) => {
  try {
    await authorizeChallengeResource(req, req.params.challengeId);
    const status = db.getCompetitionDeadlineStatus(req.params.challengeId);
    res.json({ success: true, status });
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

app.post('/api/marketplace/competition/:challengeId/revise-offer/:offerId', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const revisedOffer = db.reviseOfferInCompetition(
      req.params.challengeId,
      req.params.offerId,
      req.body.revisedData,
      orgId
    );

    // PR-0A shadow: re-evaluate jurisdiction coverage requirements for the revision (D4).
    await inShadow('offer-qualification', () => shadowOfferQualification(revisedOffer, db.getChallenge(req.params.challengeId)));

    // CE-3: Instrument PROPOSITION_SUBMITTED for revised OfferVersion
    const versionId = `VER-${revisedOffer.id}-v${revisedOffer.version || 2}`;
    await commercialStore.projectMarketplaceEvent({
      eventType: 'PROPOSITION_SUBMITTED',
      sourceEntityType: 'OFFER_VERSION',
      sourceEntityId: versionId,
      providerOrganizationId: orgId,
      challengeId: req.params.challengeId,
      occurredAt: revisedOffer.submittedAt,
      metadata: {
        offerId: revisedOffer.id,
        previousOfferId: req.params.offerId,
        versionNumber: revisedOffer.version,
        carrier: revisedOffer.carrier,
        annualPremium: revisedOffer.annualPremium
      }
    }).catch(err => console.warn('[CommercialEvent Error]', err));

    res.json({ success: true, offer: revisedOffer });
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

app.post('/api/marketplace/competition/:challengeId/seed-competitors', async (req, res) => {
  try {
    db.seedCompetitorOffers(req.params.challengeId);
    const summary = db.getCompetitionEvaluation(req.params.challengeId);
    res.json({ success: true, message: 'Seeded competing quote from Apex Insurance (Progressive $2,540/yr)', summary });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ==========================================
// PM-2: Information Requests, Supplemental Facts & Offer Integrity API (Sections 17, 18, 25, 26, 28, 30, 34)
// ==========================================

app.get('/api/marketplace/challenges/:id/information-requests', async (req, res) => {
  try {
    if (req.openPolicyIdentity?.role === 'CONSUMER') await authorizeChallengeResource(req, req.params.id);
    let orgId: string | undefined = undefined;
    if (req.openPolicyIdentity?.role === 'PROVIDER') {
      orgId = await getAuthenticatedProviderOrgId(req);
    }
    const requests = db.getInformationRequests(req.params.id, orgId);
    res.json({ requests });
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

app.post('/api/marketplace/challenges/:id/information-requests', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const { requestedField, customFieldName, purpose, purposeExplanation } = req.body;
    if (!requestedField || !purpose || !purposeExplanation) {
      return res.status(400).json({ error: 'Missing required fields: requestedField, purpose, purposeExplanation' });
    }
    const request = db.createInformationRequest({
      challengeId: req.params.id,
      providerOrganizationId: orgId,
      requestedField,
      customFieldName,
      purpose,
      purposeExplanation
    });
    res.json({ success: true, request });
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

app.post('/api/marketplace/information-requests/:id/answer', async (req, res) => {
  try {
    const { answerValue, consentScope, authorizedOrgIds } = req.body;
    const consumerId = getAuthenticatedConsumerId(req);
    if (answerValue === undefined) {
      return res.status(400).json({ error: 'Missing required field: answerValue' });
    }
    const result = db.answerInformationRequest({
      requestId: req.params.id,
      answerValue,
      consumerId,
      consentScope,
      authorizedOrgIds
    });
    res.json({ success: true, ...result });
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

app.post('/api/marketplace/supplemental-facts/:id/consent', async (req, res) => {
  try {
    const { organizationIds } = req.body;
    const consumerId = getAuthenticatedConsumerId(req);
    if (!organizationIds || !Array.isArray(organizationIds)) {
      return res.status(400).json({ error: 'organizationIds array is required' });
    }
    const updatedFact = db.grantFactConsent(req.params.id, organizationIds, consumerId);
    res.json({ success: true, fact: updatedFact });
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

app.get('/api/marketplace/challenges/:id/supplemental-facts', async (req, res) => {
  try {
    if (req.openPolicyIdentity?.role === 'CONSUMER') await authorizeChallengeResource(req, req.params.id);
    let orgId: string | undefined = undefined;
    if (req.openPolicyIdentity?.role === 'PROVIDER') {
      orgId = await getAuthenticatedProviderOrgId(req);
    }
    const facts = db.getSupplementalFacts(req.params.id, orgId);
    res.json({ facts });
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

app.get('/api/marketplace/offers/:id/versions', async (req, res) => {
  try {
    const offer = db.getOffer(req.params.id);
    if (!offer) return res.status(404).json({ error: 'Offer not found' });
    await authorizeChallengeResource(req, offer.challengeId);
    const versions = db.getOfferVersions(req.params.id);
    res.json({ versions });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/marketplace/offers/:id/verify-document', async (req, res) => {
  try {
    const verification = db.verifyOfferDocument(req.params.id, req.body.docData);
    res.json({ success: true, verification });
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

app.get('/api/marketplace/offers/:id/qualification', async (req, res) => {
  try {
    const offer = db.qualifyOffer(req.params.id);
    res.json({ success: true, offer, isQualified: offer.isQualified });
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

// ==========================================
// PM-4: Selection, Controlled Disclosure & Binding Endpoints
// ==========================================

// 1. Select specific OfferVersion (locks version, creates Selection & BindingHandoff, NO auto-disclosure)
app.post('/api/marketplace/challenges/:id/select-version', async (req, res) => {
  try {
    const challengeId = req.params.id;
    const { offerId, versionNumber, notes } = req.body;
    const consumerId = getAuthenticatedConsumerId(req);

    if (!offerId) {
      return res.status(400).json({ error: 'offerId is required to select an offer version' });
    }

    const result = db.selectOfferVersion({
      challengeId,
      offerId,
      versionNumber: Number(versionNumber || 1),
      consumerId,
      notes
    });

    // CE-3: Instrument CONSUMER_SELECTED for explicitly selected OfferVersion
    await commercialStore.projectMarketplaceEvent({
      eventType: 'CONSUMER_SELECTED',
      sourceEntityType: 'SELECTION',
      sourceEntityId: result.selection.id,
      providerOrganizationId: result.selection.providerOrganizationId,
      challengeId: result.selection.challengeId,
      occurredAt: result.selection.selectedAt,
      metadata: {
        selectedOfferVersionId: result.selection.offerVersionId,
        offerId: result.selection.offerId,
        versionNumber: result.selection.versionNumber
      }
    }).catch(err => console.warn('[CommercialEvent Error]', err));

    res.json({ success: true, selection: result.selection, handoff: result.handoff });
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

// 2. Grant Binding Consent (purpose/recipient/field-extensible, consumer-owned)
app.post('/api/marketplace/binding/:handoffId/grant-consent', async (req, res) => {
  try {
    const handoffId = req.params.handoffId;
    const consumerId = getAuthenticatedConsumerId(req);
    const {
      challengeId,
      authorizedFieldNames,
      acknowledgedVariations,
      purpose,
      purposeExplanation,
      durationDays,
      termsVersion
    } = req.body;

    if (!challengeId) {
      return res.status(400).json({ error: 'challengeId is required' });
    }

    if (!authorizedFieldNames || !Array.isArray(authorizedFieldNames) || authorizedFieldNames.length === 0) {
      return res.status(400).json({ error: 'authorizedFieldNames must be a non-empty array of field names' });
    }

    const consentGrant = db.grantBindingConsent({
      challengeId,
      handoffId,
      consumerId,
      purpose,
      purposeExplanation,
      authorizedFieldNames,
      acknowledgedVariations,
      durationDays,
      ipAddress: req.ip || '127.0.0.1',
      termsVersion
    });

    res.json({ success: true, consentGrant });
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

// 3. Revoke Binding Consent (blocks future disclosures, preserves historical records)
app.post('/api/marketplace/binding/:handoffId/revoke-consent', async (req, res) => {
  try {
    const consentId = req.body.consentGrantId || req.body.consentId;
    const consumerId = getAuthenticatedConsumerId(req);

    if (!consentId) {
      return res.status(400).json({ error: 'consentGrantId is required' });
    }

    const consentGrant = db.revokeBindingConsent(consentId, consumerId);
    res.json({ success: true, consentGrant });
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

// 4. Execute Controlled Disclosure (server-derived provider identity, verified active consent)
app.post('/api/marketplace/binding/:handoffId/execute-disclosure', async (req, res) => {
  try {
    const handoffId = req.params.handoffId;
    const { consentGrantId, recipientAgentName, recipientEmail, customConsumerData } = req.body;

    if (!consentGrantId) {
      return res.status(400).json({ error: 'consentGrantId is required' });
    }

    const providerOrgId = await getAuthenticatedProviderOrgId(req);
    const providerUserId = await getAuthenticatedProviderUserId(req);

    const result = db.executeControlledDisclosure({
      handoffId,
      consentGrantId,
      providerOrgId,
      providerUserId,
      recipientAgentName,
      recipientEmail,
      customConsumerData
    });

    // CE-3: Instrument AUTHORIZED_CONNECTION only upon successful controlled disclosure
    await commercialStore.projectMarketplaceEvent({
      eventType: 'AUTHORIZED_CONNECTION',
      sourceEntityType: 'DISCLOSURE_EVENT',
      sourceEntityId: result.disclosureEvent.id,
      providerOrganizationId: result.disclosureEvent.recipientProviderOrganizationId,
      challengeId: result.disclosureEvent.challengeId,
      occurredAt: result.disclosureEvent.disclosedAt,
      metadata: {
        consentGrantId: result.disclosureEvent.consentGrantId,
        bindingHandoffId: result.disclosureEvent.bindingHandoffId
      }
    }).catch(err => console.warn('[CommercialEvent Error]', err));

    res.json({
      success: true,
      disclosureEvent: result.disclosureEvent,
      disclosedData: result.disclosedData,
      handoff: result.updatedHandoff
    });
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

// 5. Propose Underwriting Modification (carrier changes terms; selected OfferVersion remains immutable)
app.post('/api/marketplace/binding/:handoffId/propose-modification', async (req, res) => {
  try {
    const handoffId = req.params.handoffId;
    const {
      carrier,
      originalAnnualPremium,
      modifiedAnnualPremium,
      coverageChanges,
      underwritingReason
    } = req.body;

    if (modifiedAnnualPremium === undefined || modifiedAnnualPremium === null) {
      return res.status(400).json({ error: 'modifiedAnnualPremium is required' });
    }

    if (!underwritingReason) {
      return res.status(400).json({ error: 'underwritingReason is required' });
    }

    const providerOrgId = await getAuthenticatedProviderOrgId(req);
    const providerUserId = await getAuthenticatedProviderUserId(req);

    const result = db.proposeUnderwritingModification({
      handoffId,
      providerOrgId,
      providerUserId,
      carrier,
      originalAnnualPremium,
      modifiedAnnualPremium: Number(modifiedAnnualPremium),
      coverageChanges: coverageChanges || [],
      underwritingReason
    });

    res.json({ success: true, modification: result.modification, handoff: result.updatedHandoff });
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

// 6. Resolve Underwriting Modification (ACCEPT / REJECT by consumer)
app.post('/api/marketplace/binding/:handoffId/resolve-modification', async (req, res) => {
  try {
    const { modificationId, decision, rejectionReason } = req.body;
    const consumerId = getAuthenticatedConsumerId(req);

    if (!modificationId) {
      return res.status(400).json({ error: 'modificationId is required' });
    }

    if (decision !== 'ACCEPT' && decision !== 'REJECT') {
      return res.status(400).json({ error: "decision must be 'ACCEPT' or 'REJECT'" });
    }

    const result = db.resolveUnderwritingModification({
      modificationId,
      consumerId,
      decision,
      rejectionReason
    });

    res.json({ success: true, modification: result.resolvedModification, handoff: result.updatedHandoff });
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

// Route aliases for explicit accept / reject actions
app.post('/api/marketplace/binding/:handoffId/accept-modification', async (req, res) => {
  try {
    const { modificationId } = req.body;
    const consumerId = getAuthenticatedConsumerId(req);

    if (!modificationId) {
      return res.status(400).json({ error: 'modificationId is required' });
    }

    const result = db.resolveUnderwritingModification({
      modificationId,
      consumerId,
      decision: 'ACCEPT'
    });

    res.json({ success: true, modification: result.resolvedModification, handoff: result.updatedHandoff });
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

app.post('/api/marketplace/binding/:handoffId/reject-modification', async (req, res) => {
  try {
    const { modificationId, rejectionReason } = req.body;
    const consumerId = getAuthenticatedConsumerId(req);

    if (!modificationId) {
      return res.status(400).json({ error: 'modificationId is required' });
    }

    const result = db.resolveUnderwritingModification({
      modificationId,
      consumerId,
      decision: 'REJECT',
      rejectionReason
    });

    res.json({ success: true, modification: result.resolvedModification, handoff: result.updatedHandoff });
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

// 7. Update Binding Progression Status (APPLICATION_SUBMITTED, UNDERWRITING, BOUND, DECLINED)
app.post('/api/marketplace/binding/:handoffId/update-status', async (req, res) => {
  try {
    const handoffId = req.params.handoffId;
    const { newStatus, declineReason, policyNumber, finalPremium } = req.body;

    if (!newStatus) {
      return res.status(400).json({ error: 'newStatus is required' });
    }

    const providerOrgId = await getAuthenticatedProviderOrgId(req);

    const updatedHandoff = db.updateBindingStatus({
      handoffId,
      newStatus,
      providerOrgId,
      declineReason,
      policyNumber,
      finalPremium
    });

    // CE-3: Instrument BOUND_ACQUISITION only when authoritative BindingHandoff reaches BOUND
    if (updatedHandoff.status === 'BOUND') {
      await commercialStore.projectMarketplaceEvent({
        eventType: 'BOUND_ACQUISITION',
        sourceEntityType: 'BINDING_HANDOFF',
        sourceEntityId: updatedHandoff.id,
        providerOrganizationId: updatedHandoff.providerOrganizationId || providerOrgId,
        challengeId: updatedHandoff.challengeId,
        occurredAt: updatedHandoff.boundAt || updatedHandoff.updatedAt || new Date().toISOString(),
        metadata: {
          policyNumber: updatedHandoff.policyNumber,
          finalPremium: updatedHandoff.finalPremium
        }
      }).catch(err => console.warn('[CommercialEvent Error]', err));
    }

    res.json({ success: true, handoff: updatedHandoff });
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

// 8. Query Binding Handoff Details
app.get('/api/marketplace/binding/:handoffId', async (req, res) => {
  try {
    await authorizeBindingResource(req, req.params.handoffId);
  } catch (e: any) {
    return res.status(e.statusCode || 403).json({ error: e.message });
  }
  const handoff = db.getBindingHandoff(req.params.handoffId);
  if (!handoff) {
    return res.status(404).json({ error: 'Binding handoff not found' });
  }

  const selection = db.getSelection(handoff.selectionId || '') || db.getSelectionForChallenge(handoff.challengeId);
  const consentGrants = db.getConsentGrantsForChallenge(handoff.challengeId);
  const disclosureEvents = db.getDisclosureEventsForHandoff(handoff.id);
  const modifications = db.getBindingModificationsForHandoff(handoff.id);

  res.json({
    success: true,
    handoff,
    selection,
    consentGrants,
    disclosureEvents,
    modifications
  });
});

// 9. Query Challenge Selection & Binding State
app.get('/api/marketplace/challenges/:id/selection-binding', async (req, res) => {
  try {
    await authorizeChallengeResource(req, req.params.id);
  } catch (e: any) {
    return res.status(e.statusCode || 403).json({ error: e.message });
  }
  const challengeId = req.params.id;
  const selection = db.getSelectionForChallenge(challengeId);
  const handoff = db.getBindingHandoffForChallenge(challengeId);
  const consentGrants = db.getConsentGrantsForChallenge(challengeId);
  const modifications = handoff ? db.getBindingModificationsForHandoff(handoff.id) : [];
  const disclosureEvents = handoff ? db.getDisclosureEventsForHandoff(handoff.id) : [];

  res.json({
    success: true,
    selection,
    handoff,
    consentGrants,
    modifications,
    disclosureEvents
  });
});

// ==========================================
// PM-5: Issued Policy Ingestion, Reconciliation & Policy Vault Endpoints
// ==========================================

// 1. Upload Issued Policy Document & Ingest Snapshot (Provider Only)
app.post('/api/marketplace/binding/:handoffId/upload-issued-policy', async (req, res) => {
  try {
    const handoffId = req.params.handoffId;
    const providerUserId = await getAuthenticatedProviderUserId(req);
    const { fileName, fileSizeBytes, mimeType, rawContent, extractedTerms } = req.body;

    if (!fileName || !rawContent || !extractedTerms) {
      return res.status(400).json({ error: 'fileName, rawContent, and extractedTerms are required' });
    }

    const result = db.uploadIssuedPolicyDocument({
      bindingHandoffId: handoffId,
      providerUserId,
      fileName,
      fileSizeBytes: fileSizeBytes || (typeof rawContent === 'string' ? rawContent.length : 1024),
      mimeType: mimeType || 'application/pdf',
      rawContent,
      extractedTerms
    });

    res.json({ success: true, document: result.document, snapshot: result.snapshot });
  } catch (e: any) {
    const status = e.message?.toLowerCase().includes('unauthorized') || e.message?.toLowerCase().includes('forbidden') ? 403 : (e.statusCode || 400);
    res.status(status).json({ error: e.message });
  }
});

// 2. Reconcile Issued Policy against Expected Terms (Provider or System)
app.post('/api/marketplace/binding/:handoffId/reconcile', async (req, res) => {
  try {
    const handoffId = req.params.handoffId;
    const providerUserId = await getAuthenticatedProviderUserId(req);

    const result = db.reconcileIssuedPolicyForHandoff({
      bindingHandoffId: handoffId,
      providerUserId,
      systemTriggered: req.body.systemTriggered ?? false
    });

    // CE-3: Instrument VERIFIED_BOUND_OUTCOME when issued outcome passes PM-5 evidence/reconciliation
    const isVerified = result.report.verdict === 'MATCH' || result.report.verdict === 'AUTHORIZED_VARIANCE';
    if (isVerified) {
      const handoff = db.getBindingHandoff(handoffId);
      await commercialStore.projectMarketplaceEvent({
        eventType: 'VERIFIED_BOUND_OUTCOME',
        sourceEntityType: 'RECONCILIATION_REPORT',
        sourceEntityId: result.report.id,
        providerOrganizationId: requireHandoffProviderOrganization(handoff),
        challengeId: result.report.challengeId,
        occurredAt: result.report.reconciledAt,
        metadata: {
          verdict: result.report.verdict,
          bindingHandoffId: result.report.bindingHandoffId
        }
      }).catch(err => console.warn('[CommercialEvent Error]', err));
    }

    // CE-3: Instrument BASELINE_ACTIVATED when new versioned CoverageBaseline is activated
    if (result.newBaseline) {
      const handoff = db.getBindingHandoff(handoffId);
      await commercialStore.projectMarketplaceEvent({
        eventType: 'BASELINE_ACTIVATED',
        sourceEntityType: 'COVERAGE_BASELINE',
        sourceEntityId: result.newBaseline.id,
        providerOrganizationId: requireHandoffProviderOrganization(handoff),
        challengeId: result.report.challengeId,
        occurredAt: result.newBaseline.effectiveDate || new Date().toISOString(),
        metadata: {
          baselineVersion: result.newBaseline.version,
          reconciliationReportId: result.report.id
        }
      }).catch(err => console.warn('[CommercialEvent Error]', err));
    }

    res.json({
      success: true,
      report: result.report,
      vaultItem: result.vaultItem,
      newBaseline: result.newBaseline
    });
  } catch (e: any) {
    const status = e.message?.toLowerCase().includes('unauthorized') || e.message?.toLowerCase().includes('forbidden') ? 403 : (e.statusCode || 400);
    res.status(status).json({ error: e.message });
  }
});

// 3. Query Reconciliation Reports for Handoff
app.get('/api/marketplace/binding/:handoffId/reconciliation', async (req, res) => {
  try {
    const handoffId = req.params.handoffId;
    await authorizeBindingResource(req, handoffId);
    const reports = db.getReconciliationReportsForHandoff(handoffId);
    const documents = db.getIssuedPolicyDocumentsForHandoff(handoffId);
    const snapshots = db.getIssuedPolicySnapshotsForHandoff(handoffId);

    res.json({
      success: true,
      reports,
      latestReport: reports[0] || null,
      documents,
      snapshots
    });
  } catch (e: any) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

// 4. Consumer Review of Reconciliation Variances (Consumer Only)
app.post('/api/marketplace/binding/:handoffId/consumer-verify', async (req, res) => {
  try {
    let { reconciliationReportId, decision, disputeNotes } = req.body;
    const consumerId = getAuthenticatedConsumerId(req);

    if (!reconciliationReportId) {
      const reports = db.getReconciliationReportsForHandoff(req.params.handoffId);
      if (reports.length > 0) {
        reconciliationReportId = reports[0].id;
      }
    }

    if (!reconciliationReportId || !decision) {
      return res.status(400).json({ error: 'reconciliationReportId and decision are required' });
    }

    if (!['ACCEPT_VARIANCE', 'DISPUTE_REMEDIATION_REQUESTED'].includes(decision)) {
      return res.status(400).json({ error: 'decision must be ACCEPT_VARIANCE or DISPUTE_REMEDIATION_REQUESTED' });
    }

    const result = db.consumerReviewReconciliation({
      reconciliationReportId,
      consumerId,
      decision,
      disputeNotes
    });

    // CE-3: Instrument VERIFIED_BOUND_OUTCOME if consumer accepts variance
    if (result.report.status === 'CONSUMER_ACCEPTED_VARIANCE') {
      const handoff = db.getBindingHandoff(req.params.handoffId);
      await commercialStore.projectMarketplaceEvent({
        eventType: 'VERIFIED_BOUND_OUTCOME',
        sourceEntityType: 'RECONCILIATION_REPORT',
        sourceEntityId: result.report.id,
        providerOrganizationId: requireHandoffProviderOrganization(handoff),
        challengeId: result.report.challengeId,
        occurredAt: result.report.reconciledAt,
        metadata: {
          verdict: result.report.verdict,
          status: result.report.status,
          bindingHandoffId: result.report.bindingHandoffId
        }
      }).catch(err => console.warn('[CommercialEvent Error]', err));
    }

    // CE-3: Instrument BASELINE_ACTIVATED when new versioned CoverageBaseline is activated following consumer review
    if (result.newBaseline) {
      const handoff = db.getBindingHandoff(req.params.handoffId);
      await commercialStore.projectMarketplaceEvent({
        eventType: 'BASELINE_ACTIVATED',
        sourceEntityType: 'COVERAGE_BASELINE',
        sourceEntityId: result.newBaseline.id,
        providerOrganizationId: requireHandoffProviderOrganization(handoff),
        challengeId: result.report.challengeId,
        occurredAt: result.newBaseline.effectiveDate || new Date().toISOString(),
        metadata: {
          baselineVersion: result.newBaseline.version,
          reconciliationReportId: result.report.id
        }
      }).catch(err => console.warn('[CommercialEvent Error]', err));
    }

    res.json({
      success: true,
      report: result.report,
      vaultItem: result.vaultItem,
      newBaseline: result.newBaseline
    });
  } catch (e: any) {
    const status = e.message?.toLowerCase().includes('unauthorized') || e.message?.toLowerCase().includes('forbidden') ? 403 : (e.statusCode || 400);
    res.status(status).json({ error: e.message });
  }
});

// 5. Query Private Policy Vault Items (Consumer Only)
app.get('/api/marketplace/vault/policies', async (req, res) => {
  try {
    const consumerId = getAuthenticatedConsumerId(req);
    const vaultItems = db.getPolicyVaultItemsForConsumer(consumerId);
    res.json({ success: true, vaultItems });
  } catch (e: any) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

// 6. Query Specific Vault Policy Item
app.get('/api/marketplace/vault/policies/:id', async (req, res) => {
  try {
    const item = db.getPolicyVaultItem(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Policy vault item not found' });
    }
    const consumerId = getAuthenticatedConsumerId(req);
    if (item.consumerId !== consumerId) {
      return res.status(403).json({ error: 'Forbidden: Policy vault item belongs to another consumer' });
    }
    const report = db.getReconciliationReport(item.reconciliationReportId);
    res.json({ success: true, vaultItem: item, policy: item, reconciliationReport: report });
  } catch (e: any) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

// ==========================================
// Commercial Economics Domain API (/api/commercial/*)
// ==========================================

// 1. Get Commercial Account for Authenticated Provider Organization (Read-Only)
app.get('/api/commercial/account', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const account = await commercialStore.getCommercialAccountByOrgId(orgId);
    res.json({
      success: true,
      configured: !!account,
      account: account || null
    });
  } catch (e: any) {
    const status = e.statusCode || 400;
    res.status(status).json({ error: e.message });
  }
});

// 2. Get Active Commercial Agreement & Plan Version (Read-Only)
app.get('/api/commercial/agreement', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const agreement = await commercialStore.getActiveAgreementForOrg(orgId);
    if (!agreement) {
      return res.json({
        success: true,
        configured: false,
        agreement: null,
        planVersion: null,
        plan: null
      });
    }
    const planVersion = await commercialStore.getCommercialPlanVersion(agreement.planVersionId);
    const plan = planVersion ? await commercialStore.getCommercialPlanById(planVersion.planId) : null;
    res.json({
      success: true,
      configured: true,
      agreement,
      planVersion,
      plan
    });
  } catch (e: any) {
    const status = e.statusCode || 400;
    res.status(status).json({ error: e.message });
  }
});

// 3. List Available Commercial Plans
app.get('/api/commercial/plans', async (req, res) => {
  try {
    const plans = await commercialStore.listActivePlans();
    res.json({ success: true, plans });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 4. Get Provider Entitlements (Read-Only with durable usage counts)
app.get('/api/commercial/entitlements', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const entitlements = await commercialStore.getEntitlementsForOrg(orgId);
    const enriched = await Promise.all(
      entitlements.map(async (ent) => {
        const usageCount = await commercialStore.getUsageCountForEntitlement(ent.id, orgId);
        return {
          ...ent,
          currentUsage: usageCount
        };
      })
    );
    res.json({ success: true, entitlements: enriched });
  } catch (e: any) {
    const status = e.statusCode || 400;
    res.status(status).json({ error: e.message });
  }
});

// 5. Explicit Commercial Enrollment Command (CE-2)
app.post('/api/commercial/agreements/enroll', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const { planId, planCode, planVersionId, customTerms, enforcementPolicy } = req.body;

    let targetPlanId = planId;
    if (!targetPlanId && planCode) {
      const plan = await commercialStore.getCommercialPlanByCode(planCode);
      if (!plan) {
        return res.status(404).json({ error: `Commercial plan with code '${planCode}' not found` });
      }
      targetPlanId = plan.id;
    }

    if (!targetPlanId) {
      return res.status(400).json({ error: 'planId or planCode is required to enroll in a commercial agreement' });
    }

    const enrolled = await commercialStore.enrollCommercialAgreement({
      providerOrgId: orgId,
      planId: targetPlanId,
      planVersionId,
      customTerms,
      enforcementPolicy
    });

    res.status(201).json({
      success: true,
      agreement: enrolled.agreement,
      entitlements: enrolled.entitlements,
      planVersion: enrolled.planVersion
    });
  } catch (e: any) {
    const status = e.statusCode || 400;
    res.status(status).json({ error: e.message });
  }
});

// 6. Explicit Commercial Agreement Lifecycle Transition Command (CE-2)
app.post('/api/commercial/agreements/:id/transition', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const agreement = await commercialStore.getCommercialAgreementById(req.params.id);
    if (!agreement) {
      return res.status(404).json({ error: 'Commercial agreement not found' });
    }
    if (agreement.providerOrganizationId !== orgId) {
      return res.status(403).json({ error: 'Forbidden: agreement belongs to another provider organization' });
    }

    const { targetStatus, reason } = req.body;
    const transitionResult = transitionAgreementLifecycle({
      currentAgreement: agreement,
      targetStatus,
      reason
    });

    if (!transitionResult.success) {
      return res.status(400).json({ error: transitionResult.error });
    }

    await commercialStore.saveCommercialAgreement(transitionResult.agreement);
    res.json({ success: true, agreement: transitionResult.agreement });
  } catch (e: any) {
    const status = e.statusCode || 400;
    res.status(status).json({ error: e.message });
  }
});

// 7. Get Auditable Usage Records (CE-2)
app.get('/api/commercial/usage', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const limit = Number(req.query.limit) || 100;
    const usageRecords = await commercialStore.getUsageRecordsForOrg(orgId, limit);
    res.json({ success: true, usageRecords });
  } catch (e: any) {
    const status = e.statusCode || 400;
    res.status(status).json({ error: e.message });
  }
});

// 5. Get Commercial Events Ledger for Provider Organization
app.get('/api/commercial/events', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const limit = Number(req.query.limit) || 100;
    const events = await commercialStore.getCommercialEventsForOrg(orgId, limit);
    res.json({ success: true, events });
  } catch (e: any) {
    const status = e.statusCode || 400;
    res.status(status).json({ error: e.message });
  }
});

// ==========================================
// CE-4: Commercial Rating Engine API (Billable Events & Adjustments)
// ==========================================

// 1. Get Billable Events with Filtering & Tenant Isolation
app.get('/api/commercial/billable-events', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const status = req.query.status as any;
    const chargeCode = req.query.chargeCode as string;
    const limit = Number(req.query.limit) || 100;
    const billableEvents = await commercialStore.getBillableEvents({
      providerOrganizationId: orgId,
      status,
      chargeCode,
      limit
    });
    res.json({ success: true, billableEvents });
  } catch (e: any) {
    const status = e.statusCode || 400;
    res.status(status).json({ error: e.message });
  }
});

// 2. Get Rated Commercial Activity Summary
app.get('/api/commercial/billable-events/summary', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const summary = await commercialStore.getCommercialActivitySummary(orgId);
    res.json({ success: true, summary });
  } catch (e: any) {
    const status = e.statusCode || 400;
    res.status(status).json({ error: e.message });
  }
});

// 3. Get Single Billable Event with Adjustments
app.get('/api/commercial/billable-events/:id', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const billableEvent = await commercialStore.getBillableEventById(req.params.id);
    if (!billableEvent) {
      return res.status(404).json({ error: 'Billable event not found' });
    }
    if (billableEvent.providerOrganizationId !== orgId) {
      return res.status(403).json({ error: 'Forbidden: Billable event belongs to another provider organization' });
    }
    const adjustments = await commercialStore.getRatingAdjustmentsForBillableEvent(billableEvent.id);
    res.json({ success: true, billableEvent, adjustments });
  } catch (e: any) {
    const status = e.statusCode || 400;
    res.status(status).json({ error: e.message });
  }
});

// 4. Get Rating Adjustments for Provider Organization
app.get('/api/commercial/adjustments', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const adjustments = await commercialStore.getRatingAdjustmentsForOrg(orgId);
    res.json({ success: true, adjustments });
  } catch (e: any) {
    const status = e.statusCode || 400;
    res.status(status).json({ error: e.message });
  }
});

// 5. Create Rating Adjustment (Credit Memo / Reversal / Overage Forgiveness)
app.post('/api/commercial/billable-events/:id/adjustments', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const billableEvent = await commercialStore.getBillableEventById(req.params.id);
    if (!billableEvent) {
      return res.status(404).json({ error: 'Billable event not found' });
    }
    if (billableEvent.providerOrganizationId !== orgId) {
      return res.status(403).json({ error: 'Forbidden: Billable event belongs to another provider organization' });
    }

    const { adjustmentType, amountCents, reason, idempotencyKey } = req.body;
    if (!adjustmentType || !reason) {
      return res.status(400).json({ error: 'adjustmentType and reason are required' });
    }

    const authActor = await getAuthenticatedProviderUserId(req);
    const adjustment = await commercialStore.createRatingAdjustment({
      originalBillableEventId: billableEvent.id,
      adjustmentType,
      amountCents,
      reason,
      authorizedBy: authActor,
      idempotencyKey
    });

    res.status(201).json({ success: true, adjustment });
  } catch (e: any) {
    const status = e.statusCode || 400;
    res.status(status).json({ error: e.message });
  }
});

// 6. Evaluate Single Commercial Event (Deterministic Rating Command)
app.post('/api/commercial/rating/evaluate-event', async (req, res) => {
  try {
    const { eventId } = req.body;
    if (!eventId) {
      return res.status(400).json({ error: 'eventId is required' });
    }

    // Verify tenant isolation if request comes from provider context
    const orgId = await getAuthenticatedProviderOrgId(req);
    const event = await commercialStore.getCommercialEventById(eventId);
    if (event && event.providerOrganizationId !== orgId) {
      return res.status(403).json({ error: 'Forbidden: Commercial event belongs to another provider organization' });
    }

    const decision = await commercialStore.rateCommercialEventById(eventId);
    res.json({ success: true, decision });
  } catch (e: any) {
    const status = e.statusCode || 400;
    res.status(status).json({ error: e.message });
  }
});

// 7. Run Rating Engine Reconcile (Batch / Catch-Up)
app.post(['/api/commercial/rating/run', '/api/commercial/rating/reconcile'], async (req, res) => {
  try {
    const limit = Number(req.body?.limit) || 1000;
    const run = await commercialStore.reconcileUnratedCommercialEvents(limit);
    res.json({ success: true, run });
  } catch (e: any) {
    const status = e.statusCode || 500;
    res.status(status).json({ error: e.message });
  }
});

// 8. List Historical Rating Runs
app.get('/api/commercial/rating/runs', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const runs = await commercialStore.getRatingRuns(limit);
    res.json({ success: true, runs });
  } catch (e: any) {
    const status = e.statusCode || 500;
    res.status(status).json({ error: e.message });
  }
});

// 9. Get Rating Run Details
app.get('/api/commercial/rating/runs/:id', async (req, res) => {
  try {
    const run = await commercialStore.getRatingRunById(req.params.id);
    if (!run) {
      return res.status(404).json({ error: 'Rating run not found' });
    }
    res.json({ success: true, run });
  } catch (e: any) {
    const status = e.statusCode || 500;
    res.status(status).json({ error: e.message });
  }
});

// 7. Get Factual Value Summary & Conversion Funnel
app.get('/api/commercial/value-summary', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const counts = await commercialStore.getEventCountsByType(orgId);
    const from = (req.query.from as string) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const to = (req.query.to as string) || new Date().toISOString();
    const summary = calculateValueSummary({
      providerOrganizationId: orgId,
      from,
      to,
      counts
    });
    res.json({ success: true, valueSummary: summary, summary });
  } catch (e: any) {
    const status = e.statusCode || 400;
    res.status(status).json({ error: e.message });
  }
});

// Alias for /api/commercial/events/summary
app.get('/api/commercial/events/summary', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const counts = await commercialStore.getEventCountsByType(orgId);
    const from = (req.query.from as string) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const to = (req.query.to as string) || new Date().toISOString();
    const summary = calculateValueSummary({
      providerOrganizationId: orgId,
      from,
      to,
      counts
    });
    res.json({ success: true, valueSummary: summary, summary });
  } catch (e: any) {
    const status = e.statusCode || 400;
    res.status(status).json({ error: e.message });
  }
});

// 8. Reconcile & Backfill Commercial Events (CE-3 Section 11 & 12)
app.post('/api/commercial/events/reconcile', async (req, res) => {
  try {
    const result = await commercialStore.reconcileCommercialEvents();
    res.json({ success: true, reconciliation: result });
  } catch (e: any) {
    const status = e.statusCode || 500;
    res.status(status).json({ error: e.message });
  }
});

// ==========================================
// CE-5: Invoicing, Billing Periods & Settlement API
// ==========================================

// 1. List Billing Periods
app.get('/api/commercial/billing-periods', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const periods = await commercialStore.getBillingPeriodsForOrg(orgId);
    res.json({ success: true, billingPeriods: periods });
  } catch (e: any) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

// 2. Create Billing Period
app.post('/api/commercial/billing-periods', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const { commercialAgreementId, commercialPlanVersionId, periodStart, periodEnd } = req.body;
    if (!commercialAgreementId || !commercialPlanVersionId || !periodStart || !periodEnd) {
      return res.status(400).json({ error: 'commercialAgreementId, commercialPlanVersionId, periodStart, and periodEnd are required' });
    }

    const agreement = await commercialStore.getCommercialAgreementById(commercialAgreementId);
    if (!agreement || agreement.providerOrganizationId !== orgId) {
      return res.status(403).json({ error: 'Agreement not found or does not belong to provider' });
    }

    const { buildBillingPeriod } = await import('./src/domain/commercialEconomicsEngine');
    const period = buildBillingPeriod({
      providerOrganizationId: orgId,
      commercialAgreementId,
      commercialPlanVersionId,
      periodStart,
      periodEnd
    });

    await commercialStore.saveBillingPeriod(period);
    res.status(201).json({ success: true, billingPeriod: period });
  } catch (e: any) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

// 3. Close Billing Period
app.post('/api/commercial/billing-periods/:id/close', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const period = await commercialStore.getBillingPeriodById(req.params.id);
    if (!period) return res.status(404).json({ error: 'BillingPeriod not found' });
    if (period.providerOrganizationId !== orgId) {
      return res.status(403).json({ error: 'Access forbidden: cross-tenant billing period access denied' });
    }
    const closed = await commercialStore.closeBillingPeriod(period.id);
    res.json({ success: true, billingPeriod: closed });
  } catch (e: any) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

// 4. List Invoices
app.get('/api/commercial/invoices', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const invoices = await commercialStore.getInvoicesForOrg(orgId);
    res.json({ success: true, invoices });
  } catch (e: any) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

// 5. Get Invoice by ID
app.get('/api/commercial/invoices/:id', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const invoice = await commercialStore.getInvoiceById(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.providerOrganizationId !== orgId) {
      return res.status(403).json({ error: 'Access forbidden: cross-tenant invoice access denied' });
    }
    res.json({ success: true, invoice });
  } catch (e: any) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

// 6. Generate Draft Invoice
app.post('/api/commercial/invoices/generate-draft', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const { billingPeriodId, idempotencyKey } = req.body;
    if (!billingPeriodId) {
      return res.status(400).json({ error: 'billingPeriodId is required' });
    }
    const period = await commercialStore.getBillingPeriodById(billingPeriodId);
    if (!period) return res.status(404).json({ error: 'BillingPeriod not found' });
    if (period.providerOrganizationId !== orgId) {
      return res.status(403).json({ error: 'Access forbidden: cross-tenant billing period access denied' });
    }

    const draft = await commercialStore.generateDraftInvoice({
      providerOrganizationId: orgId,
      billingPeriodId,
      idempotencyKey
    });

    res.status(201).json({ success: true, invoice: draft.invoice, lineItems: draft.lineItems });
  } catch (e: any) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

// 7. Finalize Invoice
app.post('/api/commercial/invoices/:id/finalize', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const invoice = await commercialStore.getInvoiceById(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.providerOrganizationId !== orgId) {
      return res.status(403).json({ error: 'Access forbidden: cross-tenant invoice access denied' });
    }

    const finalized = await commercialStore.finalizeInvoiceById(invoice.id);
    res.json({ success: true, invoice: finalized });
  } catch (e: any) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

// 8. Record Payment
app.post('/api/commercial/payments', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const { amountCents, paymentMethod, invoiceId, externalReference, idempotencyKey } = req.body;
    if (!amountCents || !paymentMethod) {
      return res.status(400).json({ error: 'amountCents and paymentMethod are required' });
    }

    if (invoiceId) {
      const inv = await commercialStore.getInvoiceById(invoiceId);
      if (!inv || inv.providerOrganizationId !== orgId) {
        return res.status(403).json({ error: 'Invoice not found or does not belong to provider' });
      }
    }

    const result = await commercialStore.recordPayment({
      providerOrganizationId: orgId,
      amountCents: Number(amountCents),
      paymentMethod,
      invoiceId,
      externalReference,
      idempotencyKey
    });

    res.status(201).json({
      success: true,
      payment: result.payment,
      allocation: result.allocation,
      invoice: result.updatedInvoice
    });
  } catch (e: any) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

// 9. Record Refund
app.post('/api/commercial/refunds', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const { paymentId, amountCents, reason, idempotencyKey } = req.body;
    if (!paymentId || !amountCents || !reason) {
      return res.status(400).json({ error: 'paymentId, amountCents, and reason are required' });
    }

    const payment = await commercialStore.getPaymentRecordById(paymentId);
    if (!payment || payment.providerOrganizationId !== orgId) {
      return res.status(403).json({ error: 'Payment not found or does not belong to provider' });
    }

    const result = await commercialStore.recordRefund({
      paymentId,
      amountCents: Number(amountCents),
      reason,
      idempotencyKey
    });

    res.status(201).json({
      success: true,
      refund: result.refund,
      allocation: result.allocation,
      invoice: result.updatedInvoice
    });
  } catch (e: any) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

// 10. Provider Account Balance & Statement
app.get(['/api/commercial/statements/balance', '/api/commercial/account-balance'], async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const balance = await commercialStore.getAuthoritativeAccountBalance(orgId);
    res.json({ success: true, balance });
  } catch (e: any) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

// 11. Current Commercial Statement (Overview)
app.get('/api/commercial/statements/current', async (req, res) => {
  try {
    const orgId = await getAuthenticatedProviderOrgId(req);
    const balance = await commercialStore.getAuthoritativeAccountBalance(orgId);
    const invoices = await commercialStore.getInvoicesForOrg(orgId);
    const periods = await commercialStore.getBillingPeriodsForOrg(orgId);
    const payments = await commercialStore.getPaymentsForOrg(orgId);

    res.json({
      success: true,
      statement: {
        providerOrganizationId: orgId,
        balance,
        activeBillingPeriod: periods.find(p => p.status === 'OPEN') || null,
        latestInvoice: invoices[0] || null,
        totalInvoicesCount: invoices.length,
        totalPaymentsCount: payments.length
      }
    });
  } catch (e: any) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

// ==========================================
// 11. Notification Stream API (Section 28)
// ==========================================
app.get('/api/notifications', async (req, res) => {
  try {
    const recipient = await notificationRecipientForRequest(req);
    const selectors = 'consumerId' in recipient && recipient.consumerId
      ? [{ recipientType: 'CONSUMER' as const, recipientId: recipient.consumerId }]
      : 'operatorId' in recipient && recipient.operatorId
        ? [{ recipientType: 'PLATFORM_OPERATOR' as const, recipientId: recipient.operatorId }]
        : [
            { recipientType: 'PROVIDER_USER' as const, recipientId: recipient.providerUserId! },
            { recipientType: 'PROVIDER_ORGANIZATION' as const, recipientId: recipient.providerOrganizationId! }
          ];
    const lists = await Promise.all(selectors.map(selector => postgresStore.getNotificationsForRecipient(selector)));
    res.json(lists.flat().sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
  } catch (e: any) {
    res.status(e.statusCode || 403).json({ error: e.message });
  }
});

app.post('/api/notifications/:id/read', async (req, res) => {
  try {
    const recipient = await notificationRecipientForRequest(req);
    const selectors = 'consumerId' in recipient && recipient.consumerId
      ? [{ recipientType: 'CONSUMER' as const, recipientId: recipient.consumerId }]
      : 'operatorId' in recipient && recipient.operatorId
        ? [{ recipientType: 'PLATFORM_OPERATOR' as const, recipientId: recipient.operatorId }]
        : [
            { recipientType: 'PROVIDER_USER' as const, recipientId: recipient.providerUserId! },
            { recipientType: 'PROVIDER_ORGANIZATION' as const, recipientId: recipient.providerOrganizationId! }
          ];
    let updated = false;
    const readAt = new Date().toISOString();
    for (const selector of selectors) {
      updated = (await postgresStore.markNotificationReadForRecipient(req.params.id, selector, readAt)) || updated;
    }
    if (!updated) return res.status(403).json({ error: 'Notification is not owned by this identity' });
    res.json({ success: true });
  } catch (e: any) {
    res.status(e.statusCode || 403).json({ error: e.message });
  }
});

// ==========================================
// PM-4: Governance, Review Queue & Cryptographic Audit API (Sections 32-34)
// ==========================================
app.get('/api/admin/review-queue', async (req, res) => {
  const status = req.query.status as any;
  const items = await postgresStore.getReviewQueue(status);
  res.json(items);
});

app.get('/api/admin/review-queue/:id', async (req, res) => {
  const item = (await postgresStore.getReviewQueue()).find(candidate => candidate.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Review queue ticket not found' });
  res.json(item);
});

app.post('/api/admin/review-queue/:id/resolve', async (req, res) => {
  const { action, notes } = req.body;
  if (!action || !['OVERRIDE', 'REJECT'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action. Must be OVERRIDE or REJECT.' });
  }
  try {
    const item = (await postgresStore.getReviewQueue()).find(candidate => candidate.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Review queue ticket not found' });
    const result = processReviewQueueResolution(item, action, req.openPolicyIdentity!.uid,
      notes || 'Reviewed and adjudicated under Section 32 protocol.');
    const committed = await postgresStore.resolveReviewQueueItem(item, result.updatedItem, result.auditPayload);
    if (!committed) return res.status(409).json({ error: 'Review queue ticket was already resolved' });
    const updated = result.updatedItem;
    res.json({ success: true, item: updated });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/admin/review-queue/enqueue', async (req, res) => {
  try {
    const item = { ...req.body, id: `REV-${Date.now()}`, createdAt: new Date().toISOString(), status: 'PENDING_REVIEW' };
    await postgresStore.enqueueReviewQueueItem(item, {
      eventType: 'QUOTE_DISCREPANCY_DETECTED', actorRole: 'SYSTEM', actorId: 'review_escalation_service',
      details: `Escalated ${item.type} to Human Review Queue [#${item.id}] with severity ${item.severity}: ${item.summary}`
    });
    res.json({ success: true, item });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/admin/audit-chain/verify', async (req, res) => {
  try {
    const verification = verifyCryptographicAuditChain(await postgresStore.getAuditEvents());
    res.json(verification);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/audit-chain/generate-proof', async (req, res) => {
  const { jurisdiction, challengeReference, auditorName } = req.body;
  try {
    const proof = generateRegulatoryAuditProof(await postgresStore.getAuditEvents(), {
      jurisdiction: jurisdiction || 'NV',
      challengeReference: challengeReference || 'CHAL-NV-49281',
      auditorName: auditorName || 'Marcus Vance, CIC'
    });
    res.json({ success: true, proof });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ==========================================
// 9. Interactive API Documentation & Specs
// ==========================================
app.get('/api/docs/spec', async (req, res) => {
  res.json({
    name: 'Policy Challenge High-Performance Engine API',
    version: '1.0.0',
    description: 'Decoupled domain microservices specification for consumer insurance competition',
    architecture: {
      packages: [
        { name: '@policy-challenge/policy-schema', responsibility: 'Carrier-independent canonical insurance representation' },
        { name: '@policy-challenge/document-intelligence', responsibility: 'Extraction, source evidence tracking, provenance' },
        { name: '@policy-challenge/comparison-engine', responsibility: 'Deterministic field comparisons & whole-offer classification' },
        { name: '@policy-challenge/challenge-engine', responsibility: 'Consumer requirements, marketplace lifecycle, progressive disclosure' },
        { name: '@policy-challenge/reconciliation', responsibility: 'Issued policy verification against agreed quote' },
        { name: '@policy-challenge/audit', responsibility: 'Append-only cryptographically chained event ledger' }
      ],
      infrastructure: {
        database: 'PostgreSQL with relational integrity and strict migrations',
        cache: 'Redis cluster for high-velocity rating cache and challenge locks',
        queues: 'BullMQ for asynchronous OCR extraction, renewal loops, and notifications',
        monitoring: 'Grafana telemetry dashboard for latency, cache hit ratios, and throughput'
      }
    }
  });
});

// Direct Codebase Zip Download Route
app.get(['/download/codebase.zip', '/download/OPENPOLICY_2026-10-02.zip'], async (req, res) => {
  const candidatePaths = [
    path.resolve('c:/Users/SEEDN/Downloads/OPENPOLICY_2026-10-02.zip'),
    path.resolve(process.cwd(), 'OPENPOLICY_2026-10-02.zip'),
    path.resolve('c:/Users/SEEDN/Downloads/OPENPOLICY_2026-09-30.zip'),
    path.resolve(process.cwd(), 'OPENPOLICY_2026-09-30.zip')
  ];
  const zipPath = candidatePaths.find(p => fs.existsSync(p));
  if (zipPath) {
    const filename = path.basename(zipPath);
    res.download(zipPath, filename);
  } else {
    res.status(404).json({ error: 'Codebase archive not found' });
  }
});

// Vite Middleware for SPA Frontend
async function startServer() {
  // Production must never boot with an implicit fixture mode or an unusable
  // Firebase Admin configuration. This checks configuration presence only;
  // credential validity is proven by the real Firebase acceptance gate.
  assertProductionAuthConfiguration();
  // BLOCKER 1: Initialize authoritative durable store on startup
  try {
    await postgresStore.init();
    await postgresStore.seedCanonicalProviderData();
    await commercialStore.seedCanonicalPlans();
    await ensureJurisdictionFramework();
  } catch (err: any) {
    console.warn('[PostgresStore Initialization Warning]:', err?.message || err);
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', async (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  function tryListen(portToTry: number) {
    const server = app.listen(portToTry, '0.0.0.0', () => {
      console.log(`Policy Challenge Server running on http://localhost:${portToTry}`);
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`Port ${portToTry} is in use, attempting port ${portToTry + 1}...`);
        tryListen(portToTry + 1);
      } else {
        console.error('Server error:', err);
      }
    });
  }

  tryListen(DEFAULT_PORT);
}

const isMain = process.argv[1] && (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.cjs') || process.argv[1].endsWith('server.js'));
if (isMain) {
  startServer();
}
