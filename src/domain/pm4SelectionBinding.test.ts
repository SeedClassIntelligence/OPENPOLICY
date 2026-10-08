/**
 * PM-4: Selection, Controlled Disclosure & Binding Test Suite
 * 
 * Verifies canonical specifications:
 *   1. Selection & Consent Separation:
 *      Selecting an exact OfferVersion locks the version and initiates BindingHandoff ('SELECTED'),
 *      without authorizing or releasing PII.
 *   2. Extensible ConsentGrant:
 *      Purpose/recipient/field-extensible authorization model (not hardcoded to Stage C).
 *      Strict recipient restriction to selected provider organization.
 *   3. Controlled DisclosureEvent & Factual eventPayloadHash:
 *      Active non-expired non-revoked consent enforcement. Field-level filtering.
 *      Factual SHA-256 eventPayloadHash. Revocation non-erasure of historical events.
 *   4. Underwriting Modification & OfferVersion Immutability:
 *      Carrier modifications recorded in separate BindingModification.
 *      Acceptance does not alter historical OfferVersion.
 *      Rejection halts continuation under that modification without forcing automatic resolution.
 *   5. Blocking Invariant for BOUND:
 *      Unresolved modifications strictly block transition to BOUND.
 *   6. Terminal Boundary:
 *      PM-4 ends at binding outcome (BOUND, DECLINED, CANCELLED, EXPIRED). No RECONCILED in PM-4.
 */

import {
  createSelection,
  initiateBindingHandoff,
  createConsentGrant,
  revokeConsentGrant,
  validateAndExecuteDisclosure,
  proposeBindingModification,
  resolveBindingModification,
  transitionBindingStatus
} from './selectionBindingEngine';
import {
  Challenge,
  Offer,
  OfferVersion,
  CoverageBaseline,
  LegacyConsumerRequirements,
  BindingHandoff,
  ConsentGrant,
  BindingModification
} from '../types/insurance';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export function runPM4AcceptanceTestSuite(): { passed: number; failed: number; total: number; results: TestResult[] } {
  const results: TestResult[] = [];

  function test(name: string, fn: () => void) {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err?.message || String(err) });
    }
  }

  function assert(condition: boolean, msg: string) {
    if (!condition) throw new Error(msg);
  }

  // --- Fixtures ---
  const mockBaseline: CoverageBaseline = {
    id: 'BASE-1',
    policyId: 'POL-1',
    version: 1,
    carrier: 'State Farm',
    effectiveDate: '2026-10-01',
    expirationDate: '2027-10-01',
    baselineAnnualPremium: 2964,
    baselineMonthlyPremium: 247,
    jurisdiction: 'NV',
    vehicle: {
      vin: '4T1B11HK5RU123498',
      year: 2022,
      make: 'Toyota',
      model: 'Camry',
      usage: 'COMMUTE',
      annualMileage: 12000,
      garagingZip: '89012',
      ownership: 'OWNED'
    },
    coverages: [],
    verifiedAt: '2026-09-01T00:00:00Z',
    verifiedBy: 'system'
  };

  const mockRequirements: LegacyConsumerRequirements = {
    id: 'REQ-1',
    ruleSummary: 'Beat price without reducing protection',
    minAnnualSavings: 100,
    maxCollisionDeductible: 500,
    maxCompDeductible: 250,
    mustIncludeRental: true,
    mustIncludeRoadside: true
  };

  const mockChallenge: Challenge = {
    id: 'CHAL-TEST-001',
    consumerId: 'usr_consumer_alice',
    referenceNumber: 'CHAL-NV-1001',
    coverageBaselineId: 'cb-1',
    jurisdiction: 'NV',
    openingTimestamp: '2026-09-29T00:00:00Z',
    closingTimestamp: '2026-10-02T00:00:00Z',
    status: 'OFFERS_RECEIVED',
    disclosureLevel: 'MARKETPLACE_ANONYMOUS',
    baseline: mockBaseline,
    qualificationStandardVersion: 'QS-1',
    legacyRequirements: mockRequirements,
    offersCount: 2
  };

  const mockOffer: Offer = {
    id: 'OFFER-TEST-101',
    challengeId: 'CHAL-TEST-001',
    providerId: 'org_apex',
    providerName: 'Apex Insurance Services LLC',
    providerLicense: 'NV-LIC-841920',
    carrier: 'Progressive Northern Insurance',
    quoteNumber: 'PGR-NV-882103',
    annualPremium: 2540,
    monthlyPremium: 212,
    termMonths: 12,
    effectiveDate: '2026-10-01',
    expirationDate: '2027-10-01',
    supportingQuoteDocName: 'quote_pgr.pdf',
    submittedAt: '2026-09-29T01:00:00Z',
    discrepanciesDetected: false,
    status: 'VALIDATED',
    round: 'ROUND_1_OPEN',
    version: 2,
    tierLabel: 'Competitive Baseline Match',
    coverages: []
  };

  const mockOfferVersion1: OfferVersion = {
    id: 'VER-OFFER-TEST-101-v1',
    offerId: 'OFFER-TEST-101',
    versionNumber: 1,
    round: 'ROUND_1_OPEN',
    carrier: 'Progressive Northern Insurance',
    annualPremium: 2600,
    monthlyPremium: 217,
    coverages: [],
    supportingQuoteDocName: 'quote_v1.pdf',
    revisionReason: 'Initial offer',
    submittedAt: '2026-09-29T01:00:00Z'
  };

  const mockOfferVersion2: OfferVersion = {
    id: 'VER-OFFER-TEST-101-v2',
    offerId: 'OFFER-TEST-101',
    versionNumber: 2,
    round: 'ROUND_2_IMPROVEMENT',
    carrier: 'Progressive Northern Insurance',
    annualPremium: 2540,
    monthlyPremium: 212,
    coverages: [],
    supportingQuoteDocName: 'quote_v2.pdf',
    revisionReason: 'Improvement round rate refinement',
    submittedAt: '2026-09-29T03:00:00Z'
  };

  const mockFullConsumerVault = {
    namedInsured: 'Alice Smith',
    email: 'alice.smith@example.com',
    phone: '702-555-8833',
    addressLine1: '812 Horizon Ridge Pkwy',
    city: 'Henderson',
    state: 'NV',
    postalCode: '89012',
    vin: '4T1B11HK5RU123498',
    driverLicenseNumber: 'NV-DL-8912781',
    driverLicenseState: 'NV',
    dateOfBirth: '1988-04-12',
    salary: 95000, // Sensitive non-authorized field
    creditScore: 780 // Sensitive non-authorized field
  };

  // ========================================================
  // 1. Selection & Consent Separation Tests
  // ========================================================
  test('Selection locks exact OfferVersion and creates active Selection record', () => {
    const sel = createSelection({
      challenge: mockChallenge,
      offer: mockOffer,
      offerVersion: mockOfferVersion2,
      consumerId: 'usr_consumer_alice'
    });

    assert(sel.id.startsWith('SEL-'), 'Selection ID must follow convention');
    assert(sel.challengeId === mockChallenge.id, 'Challenge ID must match');
    assert(sel.offerId === mockOffer.id, 'Offer ID must match');
    assert(sel.offerVersionId === mockOfferVersion2.id, 'OfferVersion ID must match');
    assert(sel.versionNumber === 2, 'Version number must be locked at 2');
    assert(sel.annualPremium === 2540, 'Annual premium must reflect selected version');
    assert(sel.status === 'ACTIVE', 'Selection status must be ACTIVE');
  });

  test('Selection initiation creates BindingHandoff in SELECTED status without disclosing PII', () => {
    const sel = createSelection({
      challenge: mockChallenge,
      offer: mockOffer,
      offerVersion: mockOfferVersion2,
      consumerId: 'usr_consumer_alice'
    });

    const handoff = initiateBindingHandoff({
      selection: sel,
      challenge: mockChallenge
    });

    assert(handoff.status === 'SELECTED', 'Initial handoff status must be SELECTED');
    assert(handoff.selectionId === sel.id, 'Handoff must link to Selection ID');
    assert(handoff.providerOrganizationId === 'org_apex', 'Handoff must record provider org');
    assert(handoff.bindingReference.startsWith('BIND-NV-'), 'Must generate binding reference');
    // Invariant: No PII disclosed or consent grant linked yet
    assert(!handoff.consentGrantId, 'No ConsentGrant should exist upon selection');
    assert(!handoff.disclosureEventId, 'No DisclosureEvent should exist upon selection');
  });

  test('Selection rejects non-owner consumer attempt', () => {
    let threw = false;
    try {
      createSelection({
        challenge: mockChallenge,
        offer: mockOffer,
        offerVersion: mockOfferVersion2,
        consumerId: 'usr_intruder'
      });
    } catch (e: any) {
      threw = true;
      assert(e.message.includes('Unauthorized'), 'Should fail authorization');
    }
    assert(threw, 'Should throw for non-owner consumer');
  });

  test('Selection rejects mismatched offer version', () => {
    const foreignVersion: OfferVersion = {
      ...mockOfferVersion1,
      id: 'VER-FOREIGN',
      offerId: 'OFFER-FOREIGN-999'
    };
    let threw = false;
    try {
      createSelection({
        challenge: mockChallenge,
        offer: mockOffer,
        offerVersion: foreignVersion,
        consumerId: 'usr_consumer_alice'
      });
    } catch (e: any) {
      threw = true;
      assert(e.message.includes('Mismatched offer version'), 'Should detect mismatched offer version');
    }
    assert(threw, 'Should throw for mismatched version');
  });

  // ========================================================
  // 2. Extensible ConsentGrant Tests
  // ========================================================
  test('ConsentGrant requires explicit purpose and non-empty authorized fields', () => {
    let threwEmptyFields = false;
    try {
      createConsentGrant({
        challengeId: mockChallenge.id,
        consumerId: 'usr_consumer_alice',
        recipientOrganizationId: 'org_apex',
        purpose: 'STAGE_C_BINDING_DISCLOSURE',
        purposeExplanation: 'Binding handoff disclosure',
        authorizedFieldNames: []
      });
    } catch {
      threwEmptyFields = true;
    }
    assert(threwEmptyFields, 'Empty authorizedFieldNames must be rejected');

    let threwEmptyPurpose = false;
    try {
      createConsentGrant({
        challengeId: mockChallenge.id,
        consumerId: 'usr_consumer_alice',
        recipientOrganizationId: 'org_apex',
        purpose: '',
        purposeExplanation: 'Binding handoff disclosure',
        authorizedFieldNames: ['namedInsured', 'vin']
      });
    } catch {
      threwEmptyPurpose = true;
    }
    assert(threwEmptyPurpose, 'Empty purpose must be rejected');
  });

  test('ConsentGrant is extensible for arbitrary purpose and custom fields', () => {
    const grant = createConsentGrant({
      challengeId: mockChallenge.id,
      consumerId: 'usr_consumer_alice',
      recipientOrganizationId: 'org_apex',
      purpose: 'CUSTOM_ENDORSEMENT_VERIFICATION',
      purposeExplanation: 'Verification of specialized commercial equipment endorsement',
      authorizedFieldNames: ['namedInsured', 'equipmentSchedule', 'garagingAddress'],
      durationDays: 14
    });

    assert(grant.purpose === 'CUSTOM_ENDORSEMENT_VERIFICATION', 'ConsentGrant must support extensible purpose');
    assert(grant.authorizedFieldNames.length === 3, 'Must retain authorized fields');
    assert(grant.recipientOrganizationId === 'org_apex', 'Must bind to specific provider');
    assert(!grant.revokedAt, 'Must not be revoked at creation');
    assert(grant.ipAddressHash.length === 64, 'Must compute SHA-256 IP address hash');
  });

  test('ConsentGrant revocation blocks future use and requires owner authorization', () => {
    const grant = createConsentGrant({
      challengeId: mockChallenge.id,
      consumerId: 'usr_consumer_alice',
      recipientOrganizationId: 'org_apex',
      purpose: 'STAGE_C_BINDING_DISCLOSURE',
      purposeExplanation: 'Binding disclosure',
      authorizedFieldNames: ['namedInsured', 'vin', 'addressLine1']
    });

    // Non-owner revocation fails
    let threwUnauthorized = false;
    try {
      revokeConsentGrant(grant, 'usr_intruder');
    } catch {
      threwUnauthorized = true;
    }
    assert(threwUnauthorized, 'Non-owner revocation must fail');

    // Owner revocation succeeds
    const revoked = revokeConsentGrant(grant, 'usr_consumer_alice');
    assert(!!revoked.revokedAt, 'revokedAt timestamp must be set');

    // Double revocation fails
    let threwDouble = false;
    try {
      revokeConsentGrant(revoked, 'usr_consumer_alice');
    } catch {
      threwDouble = true;
    }
    assert(threwDouble, 'Double revocation must fail');
  });

  // ========================================================
  // 3. Controlled Disclosure & Provenance Tests
  // ========================================================
  test('Disclosure executes only for matching recipient provider organization', () => {
    const sel = createSelection({
      challenge: mockChallenge,
      offer: mockOffer,
      offerVersion: mockOfferVersion2,
      consumerId: 'usr_consumer_alice'
    });
    const handoff = initiateBindingHandoff({ selection: sel, challenge: mockChallenge });

    const grant = createConsentGrant({
      challengeId: mockChallenge.id,
      consumerId: 'usr_consumer_alice',
      recipientOrganizationId: 'org_apex',
      purpose: 'STAGE_C_BINDING_DISCLOSURE',
      purposeExplanation: 'Binding handoff disclosure',
      authorizedFieldNames: ['namedInsured', 'email', 'phone', 'vin']
    });

    // Foreign provider org request fails
    let threwWrongOrg = false;
    try {
      validateAndExecuteDisclosure({
        consentGrant: grant,
        handoff,
        fullConsumerData: mockFullConsumerVault,
        requestingProviderOrgId: 'org_foreign_broker'
      });
    } catch (e: any) {
      threwWrongOrg = true;
      assert(e.message.includes('Access Denied'), 'Should reject foreign organization');
    }
    assert(threwWrongOrg, 'Foreign provider org must be denied access');
  });

  test('Disclosure execution strictly filters to authorized fields (no sensitive data leaks)', () => {
    const sel = createSelection({
      challenge: mockChallenge,
      offer: mockOffer,
      offerVersion: mockOfferVersion2,
      consumerId: 'usr_consumer_alice'
    });
    const handoff = initiateBindingHandoff({ selection: sel, challenge: mockChallenge });

    const grant = createConsentGrant({
      challengeId: mockChallenge.id,
      consumerId: 'usr_consumer_alice',
      recipientOrganizationId: 'org_apex',
      purpose: 'STAGE_C_BINDING_DISCLOSURE',
      purposeExplanation: 'Binding handoff disclosure',
      authorizedFieldNames: ['namedInsured', 'vin', 'addressLine1']
    });

    const result = validateAndExecuteDisclosure({
      consentGrant: grant,
      handoff,
      fullConsumerData: mockFullConsumerVault,
      requestingProviderOrgId: 'org_apex',
      requestingProviderUserId: 'usr_marcus'
    });

    assert(result.disclosedData.namedInsured === 'Alice Smith', 'Authorized field must be present');
    assert(result.disclosedData.vin === '4T1B11HK5RU123498', 'Authorized field must be present');
    assert(result.disclosedData.addressLine1 === '812 Horizon Ridge Pkwy', 'Authorized field must be present');
    // Non-authorized fields must be excluded!
    assert(result.disclosedData.salary === undefined, 'Non-authorized salary must be excluded');
    assert(result.disclosedData.creditScore === undefined, 'Non-authorized credit score must be excluded');
    assert(result.disclosedData.phone === undefined, 'Non-authorized phone must be excluded');

    // Verify factual SHA-256 eventPayloadHash
    assert(result.disclosureEvent.eventPayloadHash.length === 64, 'Must compute 64-char SHA-256 hash');
    assert(result.updatedHandoff.status === 'DISCLOSURE_AUTHORIZED', 'Handoff transitions to DISCLOSURE_AUTHORIZED');
  });

  test('Revoked consent strictly prevents subsequent disclosure attempts', () => {
    const sel = createSelection({
      challenge: mockChallenge,
      offer: mockOffer,
      offerVersion: mockOfferVersion2,
      consumerId: 'usr_consumer_alice'
    });
    const handoff = initiateBindingHandoff({ selection: sel, challenge: mockChallenge });

    const grant = createConsentGrant({
      challengeId: mockChallenge.id,
      consumerId: 'usr_consumer_alice',
      recipientOrganizationId: 'org_apex',
      purpose: 'STAGE_C_BINDING_DISCLOSURE',
      purposeExplanation: 'Binding handoff disclosure',
      authorizedFieldNames: ['namedInsured', 'vin']
    });

    const revokedGrant = revokeConsentGrant(grant, 'usr_consumer_alice');

    let threwRevoked = false;
    try {
      validateAndExecuteDisclosure({
        consentGrant: revokedGrant,
        handoff,
        fullConsumerData: mockFullConsumerVault,
        requestingProviderOrgId: 'org_apex'
      });
    } catch (e: any) {
      threwRevoked = true;
      assert(e.message.includes('revoked'), 'Error message must specify revoked consent');
    }
    assert(threwRevoked, 'Revoked consent must prevent disclosure');
  });

  test('Historical DisclosureEvents persist untouched even if consent is later revoked', () => {
    const sel = createSelection({
      challenge: mockChallenge,
      offer: mockOffer,
      offerVersion: mockOfferVersion2,
      consumerId: 'usr_consumer_alice'
    });
    const handoff = initiateBindingHandoff({ selection: sel, challenge: mockChallenge });

    const grant = createConsentGrant({
      challengeId: mockChallenge.id,
      consumerId: 'usr_consumer_alice',
      recipientOrganizationId: 'org_apex',
      purpose: 'STAGE_C_BINDING_DISCLOSURE',
      purposeExplanation: 'Binding handoff disclosure',
      authorizedFieldNames: ['namedInsured', 'vin']
    });

    const result = validateAndExecuteDisclosure({
      consentGrant: grant,
      handoff,
      fullConsumerData: mockFullConsumerVault,
      requestingProviderOrgId: 'org_apex'
    });

    const initialEventId = result.disclosureEvent.id;
    const initialHash = result.disclosureEvent.eventPayloadHash;

    // Consumer revokes consent after disclosure has already occurred
    const revoked = revokeConsentGrant(grant, 'usr_consumer_alice');
    assert(!!revoked.revokedAt, 'Consent is now revoked');

    // Historical DisclosureEvent remains completely unchanged
    assert(result.disclosureEvent.id === initialEventId, 'Historical event ID must remain intact');
    assert(result.disclosureEvent.eventPayloadHash === initialHash, 'Historical event hash must remain intact');
  });

  // ========================================================
  // 4. Underwriting Modification & Immutability Tests
  // ========================================================
  test('Carrier underwriting modification creates separate BindingModification and does not alter original OfferVersion', () => {
    const sel = createSelection({
      challenge: mockChallenge,
      offer: mockOffer,
      offerVersion: mockOfferVersion2,
      consumerId: 'usr_consumer_alice'
    });
    const handoff = initiateBindingHandoff({ selection: sel, challenge: mockChallenge });

    const originalVersionPremium = mockOfferVersion2.annualPremium;

    const { modification, updatedHandoff } = proposeBindingModification({
      handoff,
      providerOrgId: 'org_apex',
      providerUserId: 'usr_marcus',
      carrier: 'Progressive Northern Insurance',
      originalAnnualPremium: 2540,
      modifiedAnnualPremium: 2680,
      coverageChanges: [
        {
          code: 'COLLISION',
          name: 'Collision',
          originalValue: '$500 deductible',
          modifiedValue: '$1000 deductible',
          isMaterialReduction: true
        }
      ],
      underwritingReason: 'Recent comprehensive windshield claim reported in CLUE database'
    });

    assert(modification.status === 'PENDING_CONSUMER_REVIEW', 'Modification status must be PENDING_CONSUMER_REVIEW');
    assert(modification.modifiedAnnualPremium === 2680, 'Modified premium must reflect underwriting change');
    assert(updatedHandoff.status === 'MODIFICATION_PENDING', 'Handoff must enter MODIFICATION_PENDING');
    assert(updatedHandoff.activeModificationId === modification.id, 'Active modification linked');

    // OfferVersion remains completely unchanged!
    assert(mockOfferVersion2.annualPremium === originalVersionPremium, 'Original OfferVersion must remain strictly immutable');
  });

  test('Consumer acceptance of modification preserves original OfferVersion and resumes underwriting progression', () => {
    const sel = createSelection({
      challenge: mockChallenge,
      offer: mockOffer,
      offerVersion: mockOfferVersion2,
      consumerId: 'usr_consumer_alice'
    });
    const handoff = initiateBindingHandoff({ selection: sel, challenge: mockChallenge });

    const { modification, updatedHandoff: pendingHandoff } = proposeBindingModification({
      handoff,
      providerOrgId: 'org_apex',
      providerUserId: 'usr_marcus',
      carrier: 'Progressive Northern Insurance',
      originalAnnualPremium: 2540,
      modifiedAnnualPremium: 2680,
      coverageChanges: [],
      underwritingReason: 'Slight mileage tier adjustment'
    });

    const { resolvedModification, updatedHandoff } = resolveBindingModification({
      modification,
      handoff: pendingHandoff,
      consumerId: 'usr_consumer_alice',
      decision: 'ACCEPT'
    });

    assert(resolvedModification.status === 'ACCEPTED', 'Modification status must be ACCEPTED');
    assert(updatedHandoff.status === 'UNDERWRITING', 'Handoff resumes under modified terms in UNDERWRITING status');
    // Original OfferVersion still immutable
    assert(mockOfferVersion2.annualPremium === 2540, 'Original selected OfferVersion must stay intact');
  });

  test('Consumer rejection of modification halts continuation under that modification without forcing automatic resolution', () => {
    const sel = createSelection({
      challenge: mockChallenge,
      offer: mockOffer,
      offerVersion: mockOfferVersion2,
      consumerId: 'usr_consumer_alice'
    });
    const handoff = initiateBindingHandoff({ selection: sel, challenge: mockChallenge });

    const { modification, updatedHandoff: pendingHandoff } = proposeBindingModification({
      handoff,
      providerOrgId: 'org_apex',
      providerUserId: 'usr_marcus',
      carrier: 'Progressive Northern Insurance',
      originalAnnualPremium: 2540,
      modifiedAnnualPremium: 2900,
      coverageChanges: [],
      underwritingReason: 'Underwriting premium surcharge'
    });

    const { resolvedModification, updatedHandoff } = resolveBindingModification({
      modification,
      handoff: pendingHandoff,
      consumerId: 'usr_consumer_alice',
      decision: 'REJECT',
      rejectionReason: 'Premium increase exceeds acceptable threshold'
    });

    assert(resolvedModification.status === 'REJECTED', 'Modification status must be REJECTED');
    assert(Boolean(resolvedModification.rejectionReason?.includes('threshold')), 'Rejection reason preserved');
    // Handoff remains halted in MODIFICATION_PENDING, awaiting subsequent consumer decision
    assert(updatedHandoff.status === 'MODIFICATION_PENDING', 'Continuation halted; awaiting subsequent consumer choice');
  });

  // ========================================================
  // 5. Blocking Invariant for BOUND & Status Transitions
  // ========================================================
  test('Pending modification strictly blocks transition to BOUND status', () => {
    const sel = createSelection({
      challenge: mockChallenge,
      offer: mockOffer,
      offerVersion: mockOfferVersion2,
      consumerId: 'usr_consumer_alice'
    });
    const handoff: BindingHandoff = {
      ...initiateBindingHandoff({ selection: sel, challenge: mockChallenge }),
      status: 'UNDERWRITING'
    };

    const pendingMod: BindingModification = {
      id: 'MOD-PENDING-01',
      bindingHandoffId: handoff.id,
      challengeId: mockChallenge.id,
      providerOrganizationId: 'org_apex',
      providerUserId: 'usr_marcus',
      carrier: 'Progressive',
      originalAnnualPremium: 2540,
      modifiedAnnualPremium: 2700,
      coverageChanges: [],
      underwritingReason: 'Additional driver fee',
      proposedAt: new Date().toISOString(),
      status: 'PENDING_CONSUMER_REVIEW'
    };

    let threwBlocking = false;
    try {
      transitionBindingStatus({
        handoff,
        newStatus: 'BOUND',
        providerOrgId: 'org_apex',
        activeModifications: [pendingMod]
      });
    } catch (e: any) {
      threwBlocking = true;
      assert(e.message.includes('Compliance Violation') && e.message.includes('pending consumer review'), 'Must block BOUND transition');
    }
    assert(threwBlocking, 'Unresolved modification must strictly block transition to BOUND');
  });

  test('Resolved modification permits transition to BOUND status', () => {
    const sel = createSelection({
      challenge: mockChallenge,
      offer: mockOffer,
      offerVersion: mockOfferVersion2,
      consumerId: 'usr_consumer_alice'
    });
    const handoff: BindingHandoff = {
      ...initiateBindingHandoff({ selection: sel, challenge: mockChallenge }),
      status: 'UNDERWRITING'
    };

    const resolvedMod: BindingModification = {
      id: 'MOD-ACCEPTED-01',
      bindingHandoffId: handoff.id,
      challengeId: mockChallenge.id,
      providerOrganizationId: 'org_apex',
      providerUserId: 'usr_marcus',
      carrier: 'Progressive',
      originalAnnualPremium: 2540,
      modifiedAnnualPremium: 2700,
      coverageChanges: [],
      underwritingReason: 'Additional driver fee',
      proposedAt: new Date().toISOString(),
      status: 'ACCEPTED',
      decidedAt: new Date().toISOString()
    };

    const boundHandoff = transitionBindingStatus({
      handoff,
      newStatus: 'BOUND',
      providerOrgId: 'org_apex',
      activeModifications: [resolvedMod]
    });

    assert(boundHandoff.status === 'BOUND', 'Handoff must reach BOUND status');
    assert(!!boundHandoff.boundAt, 'boundAt timestamp must be recorded');
  });

  test('Decline risk records declineReason and declinedAt timestamp', () => {
    const sel = createSelection({
      challenge: mockChallenge,
      offer: mockOffer,
      offerVersion: mockOfferVersion2,
      consumerId: 'usr_consumer_alice'
    });
    const handoff: BindingHandoff = {
      ...initiateBindingHandoff({ selection: sel, challenge: mockChallenge }),
      status: 'UNDERWRITING'
    };

    const declinedHandoff = transitionBindingStatus({
      handoff,
      newStatus: 'DECLINED',
      providerOrgId: 'org_apex',
      activeModifications: [],
      declineReason: 'Vehicle garaging location ineligible under carrier territorial underwriting guidelines'
    });

    assert(declinedHandoff.status === 'DECLINED', 'Status must be DECLINED');
    assert(Boolean(declinedHandoff.declineReason?.includes('territorial')), 'Decline reason must be preserved');
    assert(!!declinedHandoff.declinedAt, 'declinedAt timestamp must be recorded');
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return { passed, failed, total: results.length, results };
}

// Direct execution CLI runner
if (process.argv[1] && process.argv[1].endsWith('pm4SelectionBinding.test.ts')) {
  const { passed, failed, total, results } = runPM4AcceptanceTestSuite();
  console.log(`\n========================================`);
  console.log(`PM-4 Selection, Disclosure & Binding Suite: ${passed}/${total} PASSED (${failed} FAILED)`);
  console.log(`========================================`);
  results.forEach(r => {
    console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.name}`);
    if (r.error) console.error(`       Error: ${r.error}`);
  });
  if (failed > 0) process.exit(1);
}
