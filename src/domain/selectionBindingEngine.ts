import crypto from 'crypto';
import {
  Selection,
  ConsentGrant,
  DisclosureEvent,
  BindingHandoff,
  BindingHandoffStatus,
  BindingModification,
  Challenge,
  Offer,
  OfferVersion,
  CoverageBaseline
} from '../types/insurance';

/**
 * Open Policy Selection, Controlled Disclosure & Binding Engine (PM-4)
 * 
 * Canonical Architectural Invariants:
 * 1. Selection & Consent are separate transactions. Selecting an OfferVersion
 *    locks the exact version and creates BindingHandoff ('SELECTED'), but does NOT
 *    release or authorize PII.
 * 2. ConsentGrant is purpose/recipient/field-extensible, authorizing specific fields
 *    exclusively to the selected provider organization.
 * 3. Controlled DisclosureEvent is recorded upon transmission, verified against active
 *    (non-expired, non-revoked) consent, releasing only authorized fields with factual
 *    eventPayloadHash provenance.
 * 4. Selected OfferVersion is strictly immutable. If carrier underwriting modifies terms,
 *    an immutable BindingModification record is created. Accepting a modification
 *    preserves the original OfferVersion untouched.
 * 5. Rejecting a modification stops continuation under that modification without
 *    forcing automatic resolution.
 * 6. Unresolved modifications strictly block 'BOUND' status transition.
 * 7. PM-4 ends at binding outcome (BOUND/DECLINED/CANCELLED/EXPIRED). Reconciliation
 *    belongs exclusively to PM-5.
 */

export interface CreateSelectionParams {
  challenge: Challenge;
  offer: Offer;
  offerVersion: OfferVersion;
  consumerId: string;
}

export function createSelection(params: CreateSelectionParams): Selection {
  const { challenge, offer, offerVersion, consumerId } = params;

  if (challenge.consumerId && challenge.consumerId !== consumerId) {
    throw new Error('Unauthorized: Only the challenge owner can select an offer version');
  }

  if (offerVersion.offerId !== offer.id) {
    throw new Error('Mismatched offer version: version does not belong to the selected offer');
  }

  return {
    id: `SEL-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    challengeId: challenge.id,
    consumerId,
    offerId: offer.id,
    offerVersionId: offerVersion.id,
    versionNumber: offerVersion.versionNumber,
    providerOrganizationId: offer.providerId,
    carrier: offerVersion.carrier,
    annualPremium: offerVersion.annualPremium,
    monthlyPremium: offerVersion.monthlyPremium,
    selectedAt: new Date().toISOString(),
    status: 'ACTIVE'
  };
}

export interface InitiateHandoffParams {
  selection: Selection;
  challenge: Challenge;
}

export function initiateBindingHandoff(params: InitiateHandoffParams): BindingHandoff {
  const { selection, challenge } = params;
  const now = new Date().toISOString();
  const bindingRef = `BIND-NV-${Math.floor(100000 + Math.random() * 900000)}`;

  return {
    id: `HND-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    bindingReference: bindingRef,
    challengeId: challenge.id,
    selectionId: selection.id,
    offerId: selection.offerId,
    offerVersionId: selection.offerVersionId,
    consumerId: selection.consumerId,
    providerOrganizationId: selection.providerOrganizationId,
    carrier: selection.carrier,
    status: 'SELECTED',
    createdAt: now,
    updatedAt: now,
    // Backward compatibility for legacy tests/views
    selectedOfferId: selection.offerId,
    handoffTimestamp: now
  };
}

export interface CreateConsentGrantParams {
  challengeId: string;
  consumerId: string;
  recipientOrganizationId: string;
  recipientUserId?: string;
  purpose: string;
  purposeExplanation: string;
  authorizedFieldNames: string[];
  acknowledgedVariations?: string[];
  durationDays?: number;
  ipAddress?: string;
  termsVersion?: string;
  now?: Date;
}

export function createConsentGrant(params: CreateConsentGrantParams): ConsentGrant {
  const {
    challengeId,
    consumerId,
    recipientOrganizationId,
    recipientUserId,
    purpose,
    purposeExplanation,
    authorizedFieldNames,
    acknowledgedVariations = [],
    durationDays = 30,
    ipAddress = '127.0.0.1',
    termsVersion = 'NV-DOI-2025-01',
    now = new Date()
  } = params;

  if (!authorizedFieldNames || authorizedFieldNames.length === 0) {
    throw new Error('ConsentGrant must authorize at least one specific data field');
  }

  if (!purpose) {
    throw new Error('ConsentGrant requires an explicit purpose specification');
  }

  const grantedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();
  const ipHash = crypto.createHash('sha256').update(ipAddress).digest('hex');

  return {
    id: `CSNT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    challengeId,
    consumerId,
    recipientOrganizationId,
    recipientUserId,
    purpose,
    purposeExplanation,
    authorizedFieldNames: [...authorizedFieldNames],
    acknowledgedVariations: [...acknowledgedVariations],
    grantedAt,
    expiresAt,
    ipAddressHash: ipHash,
    termsVersion
  };
}

export function revokeConsentGrant(consent: ConsentGrant, revokedByConsumerId: string, now: Date = new Date()): ConsentGrant {
  if (consent.consumerId !== revokedByConsumerId) {
    throw new Error('Unauthorized: Only the granting consumer can revoke a ConsentGrant');
  }

  if (consent.revokedAt) {
    throw new Error('ConsentGrant is already revoked');
  }

  return {
    ...consent,
    revokedAt: now.toISOString()
  };
}

export interface ExecuteDisclosureParams {
  consentGrant: ConsentGrant;
  handoff: BindingHandoff;
  fullConsumerData: Record<string, any>;
  requestingProviderOrgId: string;
  requestingProviderUserId?: string;
  recipientAgentName?: string;
  recipientEmail?: string;
  now?: Date;
}

export function validateAndExecuteDisclosure(params: ExecuteDisclosureParams): {
  disclosureEvent: DisclosureEvent;
  disclosedData: Record<string, any>;
  updatedHandoff: BindingHandoff;
} {
  const {
    consentGrant,
    handoff,
    fullConsumerData,
    requestingProviderOrgId,
    requestingProviderUserId,
    recipientAgentName,
    recipientEmail,
    now = new Date()
  } = params;

  // 1. Authorization & Recipient Verification
  if (consentGrant.recipientOrganizationId !== requestingProviderOrgId) {
    throw new Error(
      `Access Denied: Consent was granted to organization '${consentGrant.recipientOrganizationId}', but requested by '${requestingProviderOrgId}'`
    );
  }

  if (handoff.providerOrganizationId !== requestingProviderOrgId) {
    throw new Error(
      `Access Denied: Handoff is bound to organization '${handoff.providerOrganizationId}', but requested by '${requestingProviderOrgId}'`
    );
  }

  // 2. Liveness & Revocation Verification
  if (consentGrant.revokedAt) {
    throw new Error('Access Denied: ConsentGrant was revoked by consumer on ' + consentGrant.revokedAt);
  }

  if (consentGrant.expiresAt && now > new Date(consentGrant.expiresAt)) {
    throw new Error('Access Denied: ConsentGrant has expired on ' + consentGrant.expiresAt);
  }

  // 3. Field-Level Filtering (strictly bounded by authorizedFieldNames)
  const disclosedData: Record<string, any> = {};
  const authorizedFields = new Set(consentGrant.authorizedFieldNames);

  for (const field of authorizedFields) {
    if (fullConsumerData[field] !== undefined) {
      disclosedData[field] = fullConsumerData[field];
    }
  }

  // 4. Compute Factual SHA-256 Event Payload Hash
  const canonicalPayloadStr = JSON.stringify({
    handoffId: handoff.id,
    consentGrantId: consentGrant.id,
    recipientOrgId: requestingProviderOrgId,
    fields: Array.from(authorizedFields).sort(),
    timestamp: now.toISOString()
  });

  const eventPayloadHash = crypto.createHash('sha256').update(canonicalPayloadStr).digest('hex');

  const disclosureEvent: DisclosureEvent = {
    id: `DISC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    challengeId: handoff.challengeId,
    bindingHandoffId: handoff.id,
    consentGrantId: consentGrant.id,
    recipientProviderOrganizationId: requestingProviderOrgId,
    recipientProviderUserId: requestingProviderUserId || consentGrant.recipientUserId,
    disclosedAt: now.toISOString(),
    disclosedFieldNames: Array.from(authorizedFields),
    metadata: {
      recipientAgentName,
      recipientEmail
    },
    eventPayloadHash
  };

  const updatedHandoff: BindingHandoff = {
    ...handoff,
    status: handoff.status === 'SELECTED' ? 'DISCLOSURE_AUTHORIZED' : handoff.status,
    consentGrantId: consentGrant.id,
    disclosureEventId: disclosureEvent.id,
    updatedAt: now.toISOString()
  };

  return {
    disclosureEvent,
    disclosedData,
    updatedHandoff
  };
}

export interface ProposeModificationParams {
  handoff: BindingHandoff;
  providerOrgId: string;
  providerUserId: string;
  carrier: string;
  originalAnnualPremium: number;
  modifiedAnnualPremium: number;
  coverageChanges: Array<{
    code: string;
    name: string;
    originalValue: string;
    modifiedValue: string;
    isMaterialReduction: boolean;
  }>;
  underwritingReason: string;
  now?: Date;
}

export function proposeBindingModification(params: ProposeModificationParams): {
  modification: BindingModification;
  updatedHandoff: BindingHandoff;
} {
  const {
    handoff,
    providerOrgId,
    providerUserId,
    carrier,
    originalAnnualPremium,
    modifiedAnnualPremium,
    coverageChanges,
    underwritingReason,
    now = new Date()
  } = params;

  if (handoff.providerOrganizationId !== providerOrgId) {
    throw new Error('Unauthorized: Only the assigned provider organization can propose binding modifications');
  }

  if (handoff.status === 'BOUND' || handoff.status === 'DECLINED' || handoff.status === 'CANCELLED') {
    throw new Error(`Cannot propose modification on handoff with terminal status '${handoff.status}'`);
  }

  if (!underwritingReason || underwritingReason.trim().length === 0) {
    throw new Error('Underwriting reason is required when proposing a binding modification');
  }

  const modification: BindingModification = {
    id: `MOD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    bindingHandoffId: handoff.id,
    challengeId: handoff.challengeId,
    providerOrganizationId: providerOrgId,
    providerUserId,
    carrier,
    originalAnnualPremium,
    modifiedAnnualPremium,
    coverageChanges: [...coverageChanges],
    underwritingReason,
    proposedAt: now.toISOString(),
    status: 'PENDING_CONSUMER_REVIEW'
  };

  const updatedHandoff: BindingHandoff = {
    ...handoff,
    status: 'MODIFICATION_PENDING',
    activeModificationId: modification.id,
    updatedAt: now.toISOString()
  };

  return { modification, updatedHandoff };
}

export interface ResolveModificationParams {
  modification: BindingModification;
  handoff: BindingHandoff;
  consumerId: string;
  decision: 'ACCEPT' | 'REJECT';
  rejectionReason?: string;
  now?: Date;
}

export function resolveBindingModification(params: ResolveModificationParams): {
  resolvedModification: BindingModification;
  updatedHandoff: BindingHandoff;
} {
  const { modification, handoff, consumerId, decision, rejectionReason, now = new Date() } = params;

  if (handoff.consumerId !== consumerId) {
    throw new Error('Unauthorized: Only the challenge owner can resolve a binding modification');
  }

  if (modification.status !== 'PENDING_CONSUMER_REVIEW') {
    throw new Error(`Modification is not pending review (current status: ${modification.status})`);
  }

  const decidedAt = now.toISOString();

  if (decision === 'ACCEPT') {
    const resolvedModification: BindingModification = {
      ...modification,
      status: 'ACCEPTED',
      decidedAt
    };

    // Note: Selected OfferVersion remains 100% immutable!
    // The modification record governs the changed proposition for subsequent binding.
    const updatedHandoff: BindingHandoff = {
      ...handoff,
      status: 'UNDERWRITING', // Resumes binding progression under modified terms
      updatedAt: decidedAt
    };

    return { resolvedModification, updatedHandoff };
  } else {
    // REJECT decision halts continuation under that modification
    // It does NOT force automatic resolution (KEEP_CURRENT_POLICY or REOPEN_COMPETITION are separate consumer actions)
    const resolvedModification: BindingModification = {
      ...modification,
      status: 'REJECTED',
      decidedAt,
      rejectionReason: rejectionReason || 'Consumer declined modified terms proposed by underwriting.'
    };

    const updatedHandoff: BindingHandoff = {
      ...handoff,
      status: 'MODIFICATION_PENDING', // Remains halted awaiting consumer subsequent choice
      updatedAt: decidedAt
    };

    return { resolvedModification, updatedHandoff };
  }
}

export interface TransitionStatusParams {
  handoff: BindingHandoff;
  newStatus: BindingHandoffStatus;
  providerOrgId: string;
  activeModifications: BindingModification[];
  declineReason?: string;
  now?: Date;
}

export function transitionBindingStatus(params: TransitionStatusParams): BindingHandoff {
  const { handoff, newStatus, providerOrgId, activeModifications, declineReason, now = new Date() } = params;

  if (handoff.providerOrganizationId !== providerOrgId) {
    throw new Error('Unauthorized: Only the selected provider organization can update binding status');
  }

  // Blocking rule: Unresolved modifications block BOUND status
  if (newStatus === 'BOUND') {
    const pendingMods = activeModifications.filter(m => m.status === 'PENDING_CONSUMER_REVIEW');
    if (pendingMods.length > 0) {
      throw new Error('Compliance Violation: Cannot mark handoff as BOUND while an underwriting modification is pending consumer review');
    }

    if (handoff.status !== 'UNDERWRITING' && handoff.status !== 'APPLICATION_SUBMITTED') {
      throw new Error(`Invalid transition: Cannot transition directly from '${handoff.status}' to 'BOUND'`);
    }
  }

  const updated: BindingHandoff = {
    ...handoff,
    status: newStatus,
    updatedAt: now.toISOString()
  };

  if (newStatus === 'BOUND') {
    updated.boundAt = now.toISOString();
  } else if (newStatus === 'DECLINED') {
    updated.declinedAt = now.toISOString();
    updated.declineReason = declineReason || 'Carrier declined risk during underwriting';
  }

  return updated;
}
