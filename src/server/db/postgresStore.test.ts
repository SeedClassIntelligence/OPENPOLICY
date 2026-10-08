import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { PostgresStore } from './postgresStore';
import { runMigrations, SQL_MIGRATION_V12 } from './migrate';
import {
  createSelection,
  initiateBindingHandoff,
  createConsentGrant,
  validateAndExecuteDisclosure
} from '../../domain/selectionBindingEngine';
import {
  createIssuedPolicyDocument,
  createIssuedPolicySnapshot,
  deriveExpectedBoundTerms,
  reconcileIssuedPolicy,
  activateVerifiedPolicyToVault
} from '../../domain/pm5ReconciliationEngine';

test('PR-2 migration collapses legacy rounds idempotently while retaining legacy evidence', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpolicy-pr2-migration-'));
  const database = await runMigrations(dataDir);
  try {
    const payload = JSON.stringify({ currentRound: 'BEST_AND_FINAL', status: 'BEST_AND_FINAL', roundHistory: [{ round: 'IMPROVEMENT' }], isBafoTriggered: true });
    await database.query(
      `INSERT INTO competitions (id, challenge_id, jurisdiction, line_of_business, status, current_round, participant_count, opened_at, closes_at, rules, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      ['COMP-PR2-LEGACY', 'CHAL-PR2-LEGACY', 'NV', 'PERSONAL_AUTO', 'BEST_AND_FINAL', 'BEST_AND_FINAL', 1, '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z', '{}', payload]
    );
    await database.exec(SQL_MIGRATION_V12);
    await database.exec(SQL_MIGRATION_V12);
    const migrated = await database.query<any>(`SELECT status, current_round, legacy_round_state, payload FROM competitions WHERE id='COMP-PR2-LEGACY'`);
    assert.equal(migrated.rows[0].status, 'CONSUMER_REVIEW');
    assert.equal(migrated.rows[0].current_round, 'CONSUMER_REVIEW');
    assert.equal(migrated.rows[0].legacy_round_state, 'BEST_AND_FINAL');
    assert.deepEqual(JSON.parse(migrated.rows[0].payload).legacyRoundHistory, [{ round: 'IMPROVEMENT' }]);
    const audits = await database.query<any>(`SELECT count(*)::int AS count FROM audit_events WHERE id='AUDIT-PR2-COMP-PR2-LEGACY'`);
    assert.equal(audits.rows[0].count, 1);
  } finally {
    await database.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('required durable storage fails closed instead of falling back to PGlite', () => {
  const before = { ...process.env };
  try {
    process.env.OPENPOLICY_REQUIRE_DURABLE_STORAGE = 'true';
    delete process.env.DATABASE_URL;
    delete process.env.CLOUD_SQL_INSTANCE;
    delete process.env.OPENPOLICY_DATA_DIR;
    assert.throws(
      () => new PostgresStore(),
      /Durable storage is required/
    );
  } finally {
    process.env = before;
  }
});

test('explicit local validator storage remains available when durability is not required', async () => {
  const before = process.env.OPENPOLICY_REQUIRE_DURABLE_STORAGE;
  delete process.env.OPENPOLICY_REQUIRE_DURABLE_STORAGE;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpolicy-storage-selection-'));
  const store = new PostgresStore(dataDir);
  try {
    await store.init();
    const result = await (await store.getPgClient()).query<{ value: number }>('SELECT 1 AS value');
    assert.equal(result.rows[0]?.value, 1);
  } finally {
    await store.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
    if (before === undefined) delete process.env.OPENPOLICY_REQUIRE_DURABLE_STORAGE;
    else process.env.OPENPOLICY_REQUIRE_DURABLE_STORAGE = before;
  }
});

test('foundation records survive an empty-process restart and continue mutating durably', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpolicy-foundation-restart-'));
  const first = new PostgresStore(dataDir);
  const policy = {
    id: 'POL-RESTART-1', policyNumber: 'RESTART-1', carrier: 'Test Carrier',
    jurisdiction: 'X1', effectiveDate: '2026-01-01', expirationDate: '2027-01-01',
    termMonths: 12, annualPremium: 1200, monthlyPremium: 100, status: 'VERIFIED' as const,
    namedInsured: 'Test Consumer', drivers: [], vehicles: [], coverages: [],
    sourceDocumentId: 'DOC-1', sourceDocumentName: 'fixture.pdf'
  };
  const baseline = {
    id: 'BL-RESTART-1', policyId: policy.id, version: 1, carrier: policy.carrier,
    effectiveDate: policy.effectiveDate, expirationDate: policy.expirationDate,
    baselineAnnualPremium: 1200, baselineMonthlyPremium: 100, jurisdiction: 'X1',
    vehicle: { year: 2024, make: 'Test', model: 'Car', vin: 'TESTVIN',
      usage: 'PLEASURE' as const, annualMileage: 1000, garagingZip: '00000', ownership: 'OWNED' as const },
    coverages: [], verifiedAt: '2026-01-01T00:00:00.000Z', verifiedBy: 'test'
  };
  const requirements = {
    id: 'REQ-RESTART-1', ruleSummary: 'Preserve protection', minAnnualSavings: 100,
    maxCollisionDeductible: 500, maxCompDeductible: 250,
    mustIncludeRental: true, mustIncludeRoadside: true
  };
  const review = {
    id: 'REV-RESTART-1', type: 'QUOTE_DISCREPANCY' as const, source: 'test',
    summary: 'restart test', severity: 'HIGH' as const, status: 'PENDING_REVIEW' as const,
    createdAt: '2026-01-01T00:00:00.000Z'
  };
  try {
    await first.commitPolicyWithAudit(policy, [{
      eventType: 'POLICY_UPLOADED', actorRole: 'CONSUMER', actorId: 'consumer_restart', details: 'test policy'
    }]);
    await first.commitCoverageBaselineWithAudit(baseline, {
      eventType: 'BASELINE_CREATED', actorRole: 'SYSTEM', actorId: 'test', details: 'test baseline'
    });
    await first.saveConsumerRequirements(requirements);
    await first.seedCanonicalProviderData();
    const challenge = {
      id: 'CHAL-RESTART-1', referenceNumber: 'CHALLENGE #X1-RESTART',
      consumerId: 'consumer_restart', coverageBaselineId: baseline.id, baseline,
      qualificationStandardVersion: 'QS-1', legacyRequirements: requirements,
      jurisdiction: 'X1', openingTimestamp: '2026-01-01T00:00:00.000Z',
      closingTimestamp: '2026-02-01T00:00:00.000Z', status: 'OPEN' as const,
      disclosureLevel: 'MARKETPLACE_ANONYMOUS' as const, offersCount: 0
    };
    const competition = {
      id: 'COMP-RESTART-1', challengeId: challenge.id, status: 'OPEN' as const,
      currentRound: 'OPEN' as const, openedAt: challenge.openingTimestamp,
      closesAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), participantCount: 0
    };
    const invitation = {
      id: 'INV-RESTART-1', challengeId: challenge.id, competitionId: competition.id,
      providerOrganizationId: 'org_sierra', eligibilityResult: 'ELIGIBLE' as const,
      eligibilityReasons: ['restart fixture'], status: 'INVITED' as const,
      invitedAt: challenge.openingTimestamp, expiresAt: competition.closesAt
    };
    await first.commitChallengeOpening({
      challenge, competition, invitations: [invitation], notifications: [],
      activity: {
        id: 'ACT-RESTART-1', competitionId: competition.id, challengeId: challenge.id,
        timestamp: challenge.openingTimestamp, type: 'COMPETITION_OPENED', actorRole: 'SYSTEM',
        summary: 'opened', round: competition.currentRound
      },
      audits: [{ eventType: 'CHALLENGE_OPENED', actorRole: 'CONSUMER',
        actorId: challenge.consumerId, details: 'restart challenge' }]
    });
    await first.saveReviewQueueItem(review);
    await first.saveNotification({
      id: 'NOTIF-RESTART-1', type: 'COMPETITION_UPDATE', title: 'Test', message: 'Persisted',
      timestamp: '2026-01-01T00:00:00.000Z', read: false, recipientType: 'CONSUMER',
      recipientConsumerId: 'consumer_restart', createdFromEvent: 'TEST'
    });
    await first.close();

    const second = new PostgresStore(dataDir);
    assert.deepEqual(await second.getPolicy(policy.id), policy);
    assert.deepEqual(await second.getCoverageBaseline(baseline.id), baseline);
    assert.deepEqual(await second.getConsumerRequirements(requirements.id), requirements);
    assert.deepEqual(await second.getChallenge(challenge.id), challenge);
    const restartedCompetition = await second.getCompetition(competition.id);
    assert.equal(restartedCompetition?.status, 'OPEN');
    assert.equal(restartedCompetition?.currentRound, 'OPEN');
    assert.equal(restartedCompetition?.closesAt, competition.closesAt);
    assert.deepEqual(await second.getInvitation(invitation.id), invitation);
    assert.equal((await second.getCompetitionActivity(challenge.id))[0]?.id, 'ACT-RESTART-1');
    const accepted = await second.acceptInvitation(invitation.id, 'org_sierra');
    await second.close();
    const concurrentProcess = new PostgresStore(dataDir);
    const retried = await concurrentProcess.acceptInvitation(invitation.id, 'org_sierra');
    assert.equal(retried.participation.id, accepted.participation.id,
      'a retry from another process returns the one durable participation');
    assert.equal((await concurrentProcess.getParticipationsForChallenge(challenge.id)).length, 1,
      'cross-process retry cannot duplicate participation');
    const offer = {
      id: 'OFFER-RESTART-1', challengeId: challenge.id, providerId: 'org_sierra',
      providerName: 'Sierra Brokerage Group', providerLicense: 'NV-LIC-902188',
      carrier: 'Test Carrier', quoteNumber: 'QUOTE-1', annualPremium: 1000,
      monthlyPremium: 83, termMonths: 12, effectiveDate: '2026-01-01',
      expirationDate: '2027-01-01', coverages: [], supportingQuoteDocName: 'quote.pdf',
      submittedAt: '2026-01-02T00:00:00.000Z', discrepanciesDetected: false,
      status: 'VALIDATED' as const, round: 'ROUND_1_OPEN' as const, version: 1,
      isLatestRevision: true
    };
    const offerVersion = {
      id: 'VER-OFFER-RESTART-1-v1', offerId: offer.id, versionNumber: 1,
      round: 'ROUND_1_OPEN' as const, carrier: offer.carrier,
      annualPremium: offer.annualPremium, monthlyPremium: offer.monthlyPremium,
      coverages: [], supportingQuoteDocName: offer.supportingQuoteDocName,
      revisionReason: 'Initial offer submission', submittedAt: offer.submittedAt
    };
    await concurrentProcess.commitOfferSubmission({
      offer, version: offerVersion,
      activity: { id: 'ACT-OFFER-RESTART-1', competitionId: competition.id,
        challengeId: challenge.id, timestamp: offer.submittedAt, type: 'OFFER_SUBMITTED',
        actorRole: 'PROVIDER', providerOrganizationId: 'org_sierra', summary: 'submitted',
        round: 'ROUND_1_OPEN' },
      audits: [{ eventType: 'OFFER_SUBMITTED', actorRole: 'PROVIDER', actorId: 'org_sierra',
        details: 'restart offer' }]
    });
    assert.deepEqual(await concurrentProcess.getOffer(offer.id), offer);
    await assert.rejects(() => concurrentProcess.commitOfferSubmission({
      offer: { ...offer, id: 'OFFER-NONPARTICIPANT', providerId: 'org_buckeye' },
      version: { ...offerVersion, id: 'VER-NONPARTICIPANT-v1', offerId: 'OFFER-NONPARTICIPANT' },
      activity: { id: 'ACT-NONPARTICIPANT', competitionId: competition.id,
        challengeId: challenge.id, timestamp: offer.submittedAt, type: 'OFFER_SUBMITTED',
        actorRole: 'PROVIDER', providerOrganizationId: 'org_buckeye', summary: 'invalid',
        round: 'ROUND_1_OPEN' },
      audits: []
    }), /not an active participant/);
    assert.equal(await concurrentProcess.getOffer('OFFER-NONPARTICIPANT'), undefined);
    await concurrentProcess.close();
    const restarted = new PostgresStore(dataDir);
    assert.deepEqual(await restarted.getOffer(offer.id), offer,
      'a new process reconstructs the committed offer');
    await restarted.saveChallenge({ ...challenge, status: 'FINAL_ROUND' });
    assert.equal((await restarted.getChallenge(challenge.id))?.status, 'FINAL_ROUND',
      'the lifecycle continues after restart using durable state');
    assert.equal((await restarted.getReviewQueue('PENDING_REVIEW'))[0]?.id, review.id);
    assert.equal((await restarted.getNotificationsForRecipient({
      recipientType: 'CONSUMER', recipientId: 'consumer_restart'
    }))[0]?.id, 'NOTIF-RESTART-1');
    const resolved = { ...review, status: 'RESOLVED_OVERRIDE' as const,
      resolvedAt: '2026-01-02T00:00:00.000Z', resolvedBy: 'operator',
      resolutionNotes: 'accepted', decision: 'OVERRIDE' as const };
    assert.equal(await restarted.resolveReviewQueueItem(review, resolved), true);
    assert.equal(await restarted.resolveReviewQueueItem(review, resolved), false,
      'a second instance cannot resolve the already-resolved item as first');
    const informationRequest = {
      id: 'INFOREQ-RESTART-1', challengeId: challenge.id, competitionId: competition.id,
      providerOrganizationId: 'org_sierra', requestedField: 'ANNUAL_MILEAGE' as const,
      purpose: 'DISCOUNT_ELIGIBILITY' as const, purposeExplanation: 'Confirm mileage discount',
      status: 'PENDING' as const, requestedAt: '2026-01-02T01:00:00.000Z'
    };
    const createdRequest = await restarted.createInformationRequestAtomic(
      informationRequest,
      'pm2-restart-idempotency-key'
    );
    const retriedRequest = await restarted.createInformationRequestAtomic(
      { ...informationRequest, id: 'INFOREQ-SHOULD-NOT-EXIST' },
      'pm2-restart-idempotency-key'
    );
    assert.equal(retriedRequest.id, createdRequest.id,
      'information-request retry returns the committed request');
    const answered = await restarted.answerInformationRequestAtomic({
      requestId: createdRequest.id,
      answerValue: 5000,
      consumerId: challenge.consumerId
    });
    const answeredRetry = await restarted.answerInformationRequestAtomic({
      requestId: createdRequest.id,
      answerValue: 5000,
      consumerId: challenge.consumerId
    });
    assert.equal(answeredRetry.fact.id, answered.fact.id,
      'answer retry cannot manufacture a second supplemental fact');
    await assert.rejects(
      () => restarted.grantSupplementalFactConsentAtomic({
        factId: answered.fact.id,
        consumerId: 'different-consumer',
        organizationIds: ['org_buckeye']
      }),
      /Only the consumer/
    );
    const consented = await restarted.grantSupplementalFactConsentAtomic({
      factId: answered.fact.id,
      consumerId: challenge.consumerId,
      organizationIds: ['org_buckeye']
    });
    assert.deepEqual(consented.sharedWithOrganizationIds.sort(), ['org_buckeye', 'org_sierra']);
    const verification = {
      id: `VERIFY-${offer.id}`, offerId: offer.id, documentName: offer.supportingQuoteDocName,
      status: 'VERIFIED' as const, verifiedAt: '2026-01-02T02:00:00.000Z',
      discrepancyCount: 0, discrepancies: [], extractedPremium: offer.annualPremium,
      enteredPremium: offer.annualPremium
    };
    const verified = await restarted.commitOfferVerification({
      verification, offer: { ...offer, verificationId: verification.id }, actorId: 'org_sierra'
    });
    const verifiedRetry = await restarted.commitOfferVerification({
      verification: { ...verification, id: 'VERIFY-SHOULD-NOT-EXIST' },
      offer: { ...offer, verificationId: verification.id }, actorId: 'org_sierra'
    });
    assert.equal(verifiedRetry.id, verified.id,
      'offer-verification retry returns the one durable verification');
    const auditBeforeFailure = (await restarted.getAuditEvents()).length;
    await assert.rejects(
      () => restarted.commitCoverageBaselineWithAudit(
        { ...baseline, id: 'BL-INVALID-FK', policyId: 'POL-DOES-NOT-EXIST' },
        { eventType: 'BASELINE_CREATED', actorRole: 'SYSTEM', actorId: 'test', details: 'must roll back' }
      )
    );
    assert.equal(await restarted.getCoverageBaseline('BL-INVALID-FK'), undefined);
    assert.equal((await restarted.getAuditEvents()).length, auditBeforeFailure,
      'failed business mutation cannot leave audit or business state partially committed');
    await restarted.close();
    const pm2Restart = new PostgresStore(dataDir);
    assert.equal((await pm2Restart.getInformationRequest(informationRequest.id))?.status, 'ANSWERED');
    assert.deepEqual(
      (await pm2Restart.getVerifiedSupplementalFact(`FACT-${informationRequest.id}`))?.sharedWithOrganizationIds.sort(),
      ['org_buckeye', 'org_sierra'],
      'supplemental fact and consent survive an empty-process restart'
    );
    assert.equal((await pm2Restart.getOfferVerification(offer.id))?.id, verification.id,
      'offer verification survives an empty-process restart');
    const durableOffer = await pm2Restart.getOffer(offer.id);
    const durableChallenge = await pm2Restart.getChallenge(challenge.id);
    const durableVersion = (await pm2Restart.getOfferVersions(offer.id))[0];
    assert.ok(durableOffer && durableChallenge && durableVersion);
    const selection = createSelection({
      challenge: durableChallenge, offer: durableOffer,
      offerVersion: durableVersion, consumerId: challenge.consumerId
    });
    const handoff = initiateBindingHandoff({ selection, challenge: durableChallenge });
    const selected = await pm2Restart.commitSelection({ selection, handoff });
    const selectedRetry = await pm2Restart.commitSelection({
      selection: { ...selection, id: 'SELECTION-SHOULD-NOT-EXIST' },
      handoff: { ...handoff, id: 'HANDOFF-SHOULD-NOT-EXIST' }
    });
    assert.equal(selectedRetry.selection.id, selected.selection.id,
      'selection retry preserves the exact durable consumer choice');
    const grant = createConsentGrant({
      challengeId: challenge.id, consumerId: challenge.consumerId,
      recipientOrganizationId: offer.providerId,
      purpose: 'STAGE_C_BINDING_DISCLOSURE', purposeExplanation: 'binding test',
      authorizedFieldNames: ['namedInsured'], ipAddress: '127.0.0.1'
    });
    const consentedHandoff = { ...selected.handoff, consentGrantId: grant.id, updatedAt: new Date().toISOString() };
    await pm2Restart.commitConsentGrant({ grant, handoff: consentedHandoff });
    const disclosure = validateAndExecuteDisclosure({
      consentGrant: grant, handoff: consentedHandoff,
      fullConsumerData: { namedInsured: 'Test Consumer', email: 'must-not-disclose@example.com' },
      requestingProviderOrgId: offer.providerId,
      requestingProviderUserId: 'usr_sierra_agent'
    });
    await pm2Restart.commitControlledDisclosure({
      event: disclosure.disclosureEvent, handoff: disclosure.updatedHandoff,
      providerOrganizationId: offer.providerId
    });
    await pm2Restart.close();
    const pm4Restart = new PostgresStore(dataDir);
    assert.equal((await pm4Restart.getSelection(selection.id))?.offerVersionId, durableVersion.id);
    assert.equal((await pm4Restart.getBindingHandoff(handoff.id))?.disclosureEventId, disclosure.disclosureEvent.id);
    assert.deepEqual((await pm4Restart.getDisclosureEvents(handoff.id))[0]?.disclosedFieldNames, ['namedInsured']);
    const disclosedHandoff = await pm4Restart.getBindingHandoff(handoff.id);
    assert.ok(disclosedHandoff);
    const boundHandoff = await pm4Restart.commitBindingStatus({
      ...disclosedHandoff, status:'BOUND', boundAt:new Date().toISOString(), updatedAt:new Date().toISOString()
    }, offer.providerId);
    const issuedDocument=createIssuedPolicyDocument({bindingHandoff:boundHandoff,challengeId:challenge.id,
      providerOrgId:offer.providerId,fileName:'issued.pdf',fileSizeBytes:128,mimeType:'application/pdf',rawContent:'issued-policy-evidence'});
    const issuedSnapshot=createIssuedPolicySnapshot({issuedDocument,bindingHandoffId:boundHandoff.id,carrier:offer.carrier,
      policyNumber:'ISSUED-1',annualPremium:offer.annualPremium,monthlyPremium:offer.monthlyPremium,
      effectiveDate:offer.effectiveDate,expirationDate:offer.expirationDate,coverages:offer.coverages});
    const issued=await pm4Restart.commitIssuedPolicyEvidence({document:issuedDocument,snapshot:issuedSnapshot,providerUserId:'user_sierra_1'});
    const issuedRetry=await pm4Restart.commitIssuedPolicyEvidence({document:{...issuedDocument,id:'DOC-SHOULD-NOT-EXIST'},snapshot:{...issuedSnapshot,id:'SNAP-SHOULD-NOT-EXIST'},providerUserId:'user_sierra_1'});
    assert.equal(issuedRetry.document.id,issued.document.id,'issued evidence retry preserves original document');
    const expectedTerms=deriveExpectedBoundTerms({offerVersion:durableVersion,acceptedModifications:[]});
    const report=reconcileIssuedPolicy({expectedTerms,issuedSnapshot,issuedDocument,challengeId:challenge.id,bindingHandoffId:boundHandoff.id});
    const activated=activateVerifiedPolicyToVault({handoff:boundHandoff,selection,offerVersion:durableVersion,
      acceptedModifications:[],report,snapshot:issuedSnapshot,document:issuedDocument,currentBaseline:durableChallenge.baseline});
    await pm4Restart.commitReconciliation({report,vaultItem:activated.vaultItem,newBaseline:activated.newBaseline,
      actorRole:'PROVIDER',actorId:'user_sierra_1'});
    await pm4Restart.close();
    const pm5Restart=new PostgresStore(dataDir);
    assert.equal((await pm5Restart.getIssuedPolicyDocuments(boundHandoff.id))[0]?.documentSha256,issuedDocument.documentSha256);
    assert.equal((await pm5Restart.getReconciliationReports(boundHandoff.id))[0]?.id,report.id);
    assert.equal((await pm5Restart.getPolicyVaultItems(challenge.consumerId))[0]?.reconciliationReportId,report.id);
    await pm5Restart.close();
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
