/**
 * Open Policy PM-5: Issued Policy Reconciliation, Verification & Baseline Activation Engine
 * 
 * Canonical Principles:
 * 1. Evidence-first ingestion from raw issued declarations page document.
 * 2. ExpectedBoundTerms derived from immutable OfferVersion + accepted BindingModifications.
 *    Original OfferVersion is NEVER mutated or overwritten.
 * 3. Factual taxonomy: MATCH, AUTHORIZED_VARIANCE, UNAUTHORIZED_VARIANCE, REVIEW_REQUIRED.
 * 4. Separate ReconciliationStatus from BindingHandoff (handoff remains historically BOUND).
 * 5. Complete provenance in PolicyVaultItem linking document evidence, snapshot, and challenge lineage.
 * 6. Governed consumer review for variances.
 * 7. Future CoverageBaseline activation upon verified reconciliation, preserving prior baseline intact.
 * 8. Zero Platform Economics.
 */

import crypto from 'crypto';
import {
  OfferVersion,
  BindingModification,
  BindingHandoff,
  Selection,
  CoverageBaseline,
  CoverageItem,
  IssuedPolicyDocument,
  IssuedPolicySnapshot,
  ExpectedBoundTerms,
  ReconciliationDiscrepancy,
  ReconciliationReport,
  PolicyVaultItem
} from '../types/insurance';

/**
 * Derives the expected binding terms by dynamically layering accepted modifications
 * over the selected OfferVersion. The original OfferVersion is preserved strictly immutable.
 */
export function deriveExpectedBoundTerms(params: {
  offerVersion: OfferVersion;
  acceptedModifications: BindingModification[];
  effectiveDate?: string;
}): ExpectedBoundTerms {
  const { offerVersion, acceptedModifications, effectiveDate } = params;

  let expectedAnnualPremium = offerVersion.annualPremium;
  let expectedMonthlyPremium = offerVersion.monthlyPremium;
  const acceptedModificationIds: string[] = [];

  // Filter strictly to ACCEPTED modifications and sort chronologically
  const activeAccepted = acceptedModifications
    .filter(m => m.status === 'ACCEPTED')
    .sort((a, b) => new Date(a.proposedAt).getTime() - new Date(b.proposedAt).getTime());

  for (const mod of activeAccepted) {
    expectedAnnualPremium = mod.modifiedAnnualPremium;
    expectedMonthlyPremium = Math.round(mod.modifiedAnnualPremium / 12);
    acceptedModificationIds.push(mod.id);
  }

  // Coverages start from the immutable OfferVersion
  const expectedCoverages = JSON.parse(JSON.stringify(offerVersion.coverages || []));

  return {
    offerVersionId: offerVersion.id,
    versionNumber: offerVersion.versionNumber,
    carrier: offerVersion.carrier,
    expectedAnnualPremium,
    expectedMonthlyPremium,
    expectedEffectiveDate: effectiveDate || '2026-10-01',
    expectedCoverages,
    acceptedModificationIds
  };
}

/**
 * Creates an immutable record of the raw uploaded issued declarations page document.
 */
export function createIssuedPolicyDocument(params: {
  bindingHandoff: BindingHandoff;
  challengeId: string;
  providerOrgId: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  rawContent: string | Buffer;
  storageRef?: string;
}): IssuedPolicyDocument {
  const {
    bindingHandoff,
    challengeId,
    providerOrgId,
    fileName,
    fileSizeBytes,
    mimeType,
    rawContent,
    storageRef
  } = params;

  const contentBuffer = typeof rawContent === 'string' ? Buffer.from(rawContent, 'utf-8') : rawContent;
  const documentSha256 = crypto.createHash('sha256').update(contentBuffer).digest('hex');

  return {
    id: `DOC-ISSUED-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    bindingHandoffId: bindingHandoff.id,
    challengeId,
    providerOrganizationId: providerOrgId,
    fileName,
    fileSizeBytes,
    mimeType,
    documentSha256,
    storageRef: storageRef || `vault/challenges/${challengeId}/issued/${fileName}`,
    uploadedAt: new Date().toISOString()
  };
}

/**
 * Creates an extracted and normalized snapshot of the issued policy terms from document evidence.
 */
export function createIssuedPolicySnapshot(params: {
  issuedDocument: IssuedPolicyDocument;
  bindingHandoffId: string;
  carrier: string;
  policyNumber: string;
  annualPremium: number;
  monthlyPremium?: number;
  effectiveDate: string;
  expirationDate: string;
  coverages: CoverageItem[];
  extractionConfidence?: number;
  isAmbiguous?: boolean;
}): IssuedPolicySnapshot {
  const {
    issuedDocument,
    bindingHandoffId,
    carrier,
    policyNumber,
    annualPremium,
    monthlyPremium,
    effectiveDate,
    expirationDate,
    coverages,
    extractionConfidence = 1.0,
    isAmbiguous = false
  } = params;

  const normalizedPayload = JSON.stringify({
    issuedPolicyDocumentId: issuedDocument.id,
    carrier,
    policyNumber,
    annualPremium,
    monthlyPremium: monthlyPremium ?? Math.round(annualPremium / 12),
    effectiveDate,
    expirationDate,
    coverages
  });

  const snapshotSha256 = crypto.createHash('sha256').update(normalizedPayload).digest('hex');

  return {
    id: `SNP-ISSUED-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    issuedPolicyDocumentId: issuedDocument.id,
    bindingHandoffId,
    carrier,
    policyNumber,
    annualPremium,
    monthlyPremium: monthlyPremium ?? Math.round(annualPremium / 12),
    effectiveDate,
    expirationDate,
    coverages,
    extractionConfidence,
    isAmbiguous,
    snapshotSha256,
    extractedAt: new Date().toISOString()
  };
}

/**
 * Deterministically reconciles the extracted issued policy snapshot against the derived ExpectedBoundTerms.
 * Emits factual discrepancy classifications:
 * - PREMIUM_INCREASE
 * - DEDUCTIBLE_INCREASE
 * - LIMIT_REDUCTION
 * - COVERAGE_MISSING
 * - ENDORSEMENT_MISSING
 * - OTHER_TERM_VARIANCE
 */
export function reconcileIssuedPolicy(params: {
  expectedTerms: ExpectedBoundTerms;
  issuedSnapshot: IssuedPolicySnapshot;
  issuedDocument: IssuedPolicyDocument;
  challengeId: string;
  bindingHandoffId: string;
}): ReconciliationReport {
  const {
    expectedTerms,
    issuedSnapshot,
    issuedDocument,
    challengeId,
    bindingHandoffId
  } = params;

  const discrepancies: ReconciliationDiscrepancy[] = [];

  // Check for ambiguous extraction or OCR confidence failure
  if (issuedSnapshot.isAmbiguous || issuedSnapshot.extractionConfidence < 0.85) {
    return {
      id: `REC-REP-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      bindingHandoffId,
      challengeId,
      issuedPolicyDocumentId: issuedDocument.id,
      issuedPolicySnapshotId: issuedSnapshot.id,
      verdict: 'REVIEW_REQUIRED',
      status: 'PENDING_CONSUMER_REVIEW',
      discrepancies: [{
        category: 'OTHER_TERM_VARIANCE',
        fieldCode: 'EXTRACTION_CONFIDENCE',
        fieldName: 'Extraction Confidence & Ambiguity',
        expectedValue: 'Clear machine-verifiable declarations text',
        actualIssuedValue: `Ambiguous extraction (confidence: ${(issuedSnapshot.extractionConfidence * 100).toFixed(0)}%)`,
        explanation: 'The uploaded document contains unverified or ambiguous terms requiring human review.',
        isMaterial: true
      }],
      totalAnnualPremiumVariance: 0,
      expectedTermsSummary: {
        annualPremium: expectedTerms.expectedAnnualPremium,
        carrier: expectedTerms.carrier,
        acceptedModificationCount: expectedTerms.acceptedModificationIds.length
      },
      issuedTermsSummary: {
        policyNumber: issuedSnapshot.policyNumber,
        annualPremium: issuedSnapshot.annualPremium,
        carrier: issuedSnapshot.carrier
      },
      reconciledAt: new Date().toISOString(),
      reconciledBy: 'SYSTEM_DETERMINISTIC_ENGINE'
    };
  }

  // 1. Carrier Identity Check
  if (
    issuedSnapshot.carrier.trim().toLowerCase() !==
    expectedTerms.carrier.trim().toLowerCase()
  ) {
    discrepancies.push({
      category: 'OTHER_TERM_VARIANCE',
      fieldCode: 'CARRIER_NAME',
      fieldName: 'Underwriting Carrier',
      expectedValue: expectedTerms.carrier,
      actualIssuedValue: issuedSnapshot.carrier,
      explanation: `Issued policy carrier (${issuedSnapshot.carrier}) does not match agreed carrier (${expectedTerms.carrier}).`,
      isMaterial: true
    });
  }

  // 2. Annual Premium Reconciliation
  const premiumVariance = issuedSnapshot.annualPremium - expectedTerms.expectedAnnualPremium;
  if (premiumVariance > 0) {
    discrepancies.push({
      category: 'PREMIUM_INCREASE',
      fieldCode: 'ANNUAL_PREMIUM',
      fieldName: 'Annual Premium',
      expectedValue: `$${expectedTerms.expectedAnnualPremium.toLocaleString()}/yr`,
      actualIssuedValue: `$${issuedSnapshot.annualPremium.toLocaleString()}/yr`,
      financialImpactAnnual: premiumVariance,
      explanation: `Issued annual premium exceeds accepted bound terms by $${premiumVariance}/yr.`,
      isMaterial: premiumVariance >= 25
    });
  } else if (premiumVariance < 0) {
    // Premium decrease is recorded as a non-material variance
    discrepancies.push({
      category: 'OTHER_TERM_VARIANCE',
      fieldCode: 'ANNUAL_PREMIUM',
      fieldName: 'Annual Premium (Favorable Reduction)',
      expectedValue: `$${expectedTerms.expectedAnnualPremium.toLocaleString()}/yr`,
      actualIssuedValue: `$${issuedSnapshot.annualPremium.toLocaleString()}/yr`,
      financialImpactAnnual: premiumVariance,
      explanation: `Issued annual premium is $${Math.abs(premiumVariance)}/yr lower than expected.`,
      isMaterial: false
    });
  }

  // 3. Coverages & Endorsements Reconciliation
  for (const expCov of expectedTerms.expectedCoverages) {
    const actCov = issuedSnapshot.coverages.find(
      c => c.code.toLowerCase() === expCov.code.toLowerCase()
    );

    // Dropped coverage / endorsement
    if (expCov.isIncluded && (!actCov || !actCov.isIncluded)) {
      const isEndorsement = expCov.code.includes('RENTAL') || expCov.code.includes('ROADSIDE') || expCov.category === 'ADDITIONAL';
      discrepancies.push({
        category: isEndorsement ? 'ENDORSEMENT_MISSING' : 'COVERAGE_MISSING',
        fieldCode: expCov.code,
        fieldName: expCov.name,
        expectedValue: 'Included in Bound Terms',
        actualIssuedValue: 'Omitted / Excluded from Issued Policy',
        explanation: `Agreed ${expCov.name} was omitted from the issued policy declarations.`,
        isMaterial: true
      });
      continue;
    }

    if (!actCov) continue;

    // Deductible Inflation
    if (
      expCov.deductible !== undefined &&
      actCov.deductible !== undefined &&
      actCov.deductible > expCov.deductible
    ) {
      const dedDiff = actCov.deductible - expCov.deductible;
      discrepancies.push({
        category: 'DEDUCTIBLE_INCREASE',
        fieldCode: `${expCov.code}_DEDUCTIBLE`,
        fieldName: `${expCov.name} Deductible`,
        expectedValue: `$${expCov.deductible}`,
        actualIssuedValue: `$${actCov.deductible}`,
        financialImpactAnnual: dedDiff,
        explanation: `Deductible for ${expCov.name} increased by $${dedDiff}.`,
        isMaterial: dedDiff >= 100
      });
    }

    // Limit Reduction (Bodily Injury / Property Damage)
    if (
      expCov.perPersonLimit !== undefined &&
      actCov.perPersonLimit !== undefined &&
      actCov.perPersonLimit < expCov.perPersonLimit
    ) {
      discrepancies.push({
        category: 'LIMIT_REDUCTION',
        fieldCode: `${expCov.code}_PER_PERSON_LIMIT`,
        fieldName: `${expCov.name} Per-Person Limit`,
        expectedValue: `$${expCov.perPersonLimit.toLocaleString()}`,
        actualIssuedValue: `$${actCov.perPersonLimit.toLocaleString()}`,
        explanation: `Per-person coverage limit was reduced from $${expCov.perPersonLimit.toLocaleString()} to $${actCov.perPersonLimit.toLocaleString()}.`,
        isMaterial: true
      });
    }

    if (
      expCov.propertyLimit !== undefined &&
      actCov.propertyLimit !== undefined &&
      actCov.propertyLimit < expCov.propertyLimit
    ) {
      discrepancies.push({
        category: 'LIMIT_REDUCTION',
        fieldCode: `${expCov.code}_PROPERTY_LIMIT`,
        fieldName: `${expCov.name} Property Damage Limit`,
        expectedValue: `$${expCov.propertyLimit.toLocaleString()}`,
        actualIssuedValue: `$${actCov.propertyLimit.toLocaleString()}`,
        explanation: `Property damage limit was reduced from $${expCov.propertyLimit.toLocaleString()} to $${actCov.propertyLimit.toLocaleString()}.`,
        isMaterial: true
      });
    }
  }

  // Determine Factual Reconciliation Verdict
  let verdict: ReconciliationReport['verdict'];
  let status: ReconciliationReport['status'];

  if (discrepancies.length === 0) {
    verdict = 'MATCH';
    status = 'COMPLETED_MATCH';
  } else {
    // If every discrepancy is non-material (e.g. favorable premium reduction), mark AUTHORIZED_VARIANCE
    const hasMaterialDiscrepancy = discrepancies.some(d => d.isMaterial);
    if (!hasMaterialDiscrepancy) {
      verdict = 'AUTHORIZED_VARIANCE';
      status = 'COMPLETED_AUTHORIZED_VARIANCE';
    } else {
      verdict = 'UNAUTHORIZED_VARIANCE';
      status = 'PENDING_CONSUMER_REVIEW';
    }
  }

  return {
    id: `REC-REP-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    bindingHandoffId,
    challengeId,
    issuedPolicyDocumentId: issuedDocument.id,
    issuedPolicySnapshotId: issuedSnapshot.id,
    verdict,
    status,
    discrepancies,
    totalAnnualPremiumVariance: Math.max(0, premiumVariance),
    expectedTermsSummary: {
      annualPremium: expectedTerms.expectedAnnualPremium,
      carrier: expectedTerms.carrier,
      acceptedModificationCount: expectedTerms.acceptedModificationIds.length
    },
    issuedTermsSummary: {
      policyNumber: issuedSnapshot.policyNumber,
      annualPremium: issuedSnapshot.annualPremium,
      carrier: issuedSnapshot.carrier
    },
    reconciledAt: new Date().toISOString(),
    reconciledBy: 'SYSTEM_DETERMINISTIC_ENGINE'
  };
}

/**
 * Handles explicit consumer review and sign-off on flagged variances or review-required reconciliations.
 * Consumer acceptance of a variance does NOT rewrite historical Selection or OfferVersion records.
 */
export function processConsumerVarianceReview(params: {
  report: ReconciliationReport;
  consumerId: string;
  challengeConsumerId: string;
  decision: 'ACCEPT_VARIANCE' | 'DISPUTE_REMEDIATION_REQUESTED';
  disputeNotes?: string;
}): ReconciliationReport {
  const { report, consumerId, challengeConsumerId, decision, disputeNotes } = params;

  if (consumerId !== challengeConsumerId) {
    throw new Error('Unauthorized: Only the challenge owner can review reconciliation variances.');
  }

  if (report.status !== 'PENDING_CONSUMER_REVIEW') {
    throw new Error(`Invalid state: Cannot review reconciliation report with status ${report.status}.`);
  }

  const updatedReport: ReconciliationReport = {
    ...report,
    consumerReviewedAt: new Date().toISOString(),
    consumerDecision: decision,
    consumerDisputeNotes: disputeNotes,
    status: decision === 'ACCEPT_VARIANCE' ? 'CONSUMER_ACCEPTED_VARIANCE' : 'CONSUMER_DISPUTED'
  };

  return updatedReport;
}

/**
 * Activates a verified, reconciled policy into the consumer's Private Policy Vault
 * and spawns the next CoverageBaseline for future challenges/renewals.
 * The prior baseline remains preserved historically.
 */
export interface VaultActivationParams {
  handoff: BindingHandoff;
  selection: Selection;
  offerVersion: OfferVersion;
  acceptedModifications: BindingModification[];
  report: ReconciliationReport;
  snapshot: IssuedPolicySnapshot;
  document: IssuedPolicyDocument;
  currentBaseline?: CoverageBaseline;
}

// A future baseline is derived only from a prior verified baseline, so it is guaranteed
// exactly when one is supplied.
export function activateVerifiedPolicyToVault(
  params: VaultActivationParams & { currentBaseline: CoverageBaseline }
): { vaultItem: PolicyVaultItem; newBaseline: CoverageBaseline };
export function activateVerifiedPolicyToVault(
  params: VaultActivationParams
): { vaultItem: PolicyVaultItem; newBaseline: CoverageBaseline | undefined };
export function activateVerifiedPolicyToVault(
  params: VaultActivationParams
): { vaultItem: PolicyVaultItem; newBaseline: CoverageBaseline | undefined } {
  const {
    handoff,
    selection,
    offerVersion,
    acceptedModifications,
    report,
    snapshot,
    document,
    currentBaseline
  } = params;

  // Activation requires MATCH, AUTHORIZED_VARIANCE, or CONSUMER_ACCEPTED_VARIANCE
  const isAuthorized =
    report.verdict === 'MATCH' ||
    report.verdict === 'AUTHORIZED_VARIANCE' ||
    report.status === 'CONSUMER_ACCEPTED_VARIANCE';

  if (!isAuthorized) {
    throw new Error(
      `Cannot activate policy to vault: Reconciliation verdict is ${report.verdict} with status ${report.status}.`
    );
  }

  // Calculate tamper-evident provenance hash covering full cryptographic lineage
  const acceptedModIds = acceptedModifications
    .filter(m => m.status === 'ACCEPTED')
    .map(m => m.id);

  const lineageString = [
    selection.consumerId,
    handoff.challengeId,
    selection.id,
    offerVersion.id,
    document.documentSha256,
    snapshot.snapshotSha256,
    report.id
  ].join('::');

  const provenanceHash = crypto.createHash('sha256').update(lineageString).digest('hex');

  const vaultItemId = `VAULT-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const newBaselineId = `BASE-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  const vaultItem: PolicyVaultItem = {
    id: vaultItemId,
    consumerId: selection.consumerId,
    challengeId: handoff.challengeId,
    selectionId: selection.id,
    bindingHandoffId: handoff.id,
    selectedOfferVersionId: offerVersion.id,
    acceptedBindingModificationIds: acceptedModIds,
    issuedPolicyDocumentId: document.id,
    issuedPolicySnapshotId: snapshot.id,
    reconciliationReportId: report.id,
    futureCoverageBaselineId: newBaselineId,
    carrier: snapshot.carrier,
    policyNumber: snapshot.policyNumber,
    annualPremium: snapshot.annualPremium,
    effectiveDate: snapshot.effectiveDate,
    expirationDate: snapshot.expirationDate,
    coverages: snapshot.coverages,
    provenanceHash,
    status: 'ACTIVE',
    filedAt: new Date().toISOString()
  };

  // Generate fresh, versioned CoverageBaseline for future challenges.
  // Jurisdiction and insured vehicle come only from the prior verified baseline; when
  // that provenance is missing, no future baseline is manufactured.
  if (!currentBaseline) {
    vaultItem.futureCoverageBaselineId = undefined;
    return { vaultItem, newBaseline: undefined };
  }

  const newBaseline: CoverageBaseline = {
    id: newBaselineId,
    policyId: vaultItem.id,
    version: (currentBaseline.version ?? 1) + 1,
    carrier: snapshot.carrier,
    effectiveDate: snapshot.effectiveDate,
    expirationDate: snapshot.expirationDate,
    baselineAnnualPremium: snapshot.annualPremium,
    baselineMonthlyPremium: snapshot.monthlyPremium ?? Math.round(snapshot.annualPremium / 12),
    jurisdiction: currentBaseline.jurisdiction,
    vehicle: currentBaseline.vehicle,
    coverages: snapshot.coverages,
    verifiedAt: new Date().toISOString(),
    verifiedBy: 'system_post_bind_reconciliation'
  };

  return { vaultItem, newBaseline };
}
