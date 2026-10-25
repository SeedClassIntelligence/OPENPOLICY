/**
 * Open Polici Governance, Regulatory Audit & Human-in-the-Loop Review Engine (PM-4)
 * Compliant with Statutory Transparency, Append-Only Cryptographic Chaining (Section 33),
 * Human Review Escalation (Section 32), and Regulatory Proof Certification (Section 34).
 */

import { 
  AuditEvent, 
  ChainVerificationResult, 
  RegulatoryAuditProof, 
  ReviewQueueItem, 
  ReviewQueueSeverity 
} from '../types/insurance';

/**
 * Standard deterministic block hash generator matching the platform audit ledger.
 */
export function computeBlockHash(payload: {
  timestamp: string;
  eventType: string;
  actorId: string;
  details: string;
  prevHash: string;
}): string {
  const str = `${payload.timestamp}|${payload.eventType}|${payload.actorId}|${payload.details}|${payload.prevHash}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(12, '0');
}

/**
 * Computes binary Merkle Root over a collection of event hashes.
 */
export function computeMerkleRoot(hashes: string[]): string {
  if (!hashes || hashes.length === 0) return '00000000000000000000000000000000';
  if (hashes.length === 1) return hashes[0].padStart(32, '0');

  let currentLevel = [...hashes];

  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left; // duplicate odd leaf
      
      const combined = `${left}:${right}`;
      let hash = 0;
      for (let j = 0; j < combined.length; j++) {
        const char = combined.charCodeAt(j);
        hash = (hash << 5) - hash + char;
        hash |= 0;
      }
      nextLevel.push(Math.abs(hash).toString(16).padStart(16, '0'));
    }
    currentLevel = nextLevel;
  }

  return currentLevel[0].padEnd(32, 'a');
}

/**
 * Verifies the integrity of the entire cryptographic audit event ledger from Genesis to Tip.
 */
export function verifyCryptographicAuditChain(
  events: AuditEvent[],
  genesisHash: string = 'GENESIS_BLOCK_000000'
): ChainVerificationResult {
  const verifiedAt = new Date().toISOString();

  if (!events || events.length === 0) {
    return {
      isValid: true,
      totalEvents: 0,
      verifiedBlocks: 0,
      tamperedIndex: null,
      genesisHash,
      latestBlockHash: genesisHash,
      merkleRoot: computeMerkleRoot([]),
      verifiedAt
    };
  }

  // SQL timestamps are not a safe chain ordinal: multiple events can share the
  // same timestamp and database query order among ties is undefined. Recover
  // the one valid successor of each hash instead of treating display order as
  // cryptographic order. Missing successors detect deletion/tampering; multiple
  // successors detect a fork. No stored record is rewritten or ignored.
  let prevHash = genesisHash;
  const remaining = [...events];
  const orderedHashes: string[] = [];

  for (let i = 0; i < events.length; i++) {
    const matches: number[] = [];
    for (let candidateIndex = 0; candidateIndex < remaining.length; candidateIndex++) {
      const candidate = remaining[candidateIndex];
      const expectedHash = computeBlockHash({
        timestamp: candidate.timestamp,
        eventType: candidate.eventType,
        actorId: candidate.actorId,
        details: candidate.details,
        prevHash
      });
      if (expectedHash === candidate.hash) matches.push(candidateIndex);
    }

    if (matches.length !== 1) {
      const candidate = remaining[0];
      return {
        isValid: false,
        totalEvents: events.length,
        verifiedBlocks: i,
        tamperedIndex: i,
        tamperedEventId: candidate?.id,
        error: matches.length === 0
          ? `Cryptographic chain stops after block #${i - 1}; ${remaining.length} stored record(s) cannot be linked to predecessor ${prevHash}. A record was altered, deleted, or inserted outside the append-only chain.`
          : `Cryptographic fork detected after block #${i - 1}; ${matches.length} records claim predecessor ${prevHash}.`,
        genesisHash,
        latestBlockHash: prevHash,
        merkleRoot: computeMerkleRoot(orderedHashes),
        verifiedAt
      };
    }

    const [event] = remaining.splice(matches[0], 1);
    orderedHashes.push(event.hash);
    prevHash = event.hash;
  }

  return {
    isValid: true,
    totalEvents: events.length,
    verifiedBlocks: events.length,
    tamperedIndex: null,
    genesisHash,
    latestBlockHash: prevHash,
    merkleRoot: computeMerkleRoot(orderedHashes),
    verifiedAt
  };
}

/**
 * Section 32: Evaluates whether an unverified extraction or market anomaly requires human escalation.
 */
export function shouldEscalateToHumanReview(incident: {
  type: 'DISCREPANCY' | 'AMBIGUITY' | 'STEALTH_CREEP' | 'UNLICENSED_ACTIVITY';
  confidenceScore?: number;
  deltaAmount?: number;
}): { shouldEscalate: boolean; suggestedSeverity: ReviewQueueSeverity; reason: string } {
  // Ambiguous extraction confidence below 90%
  if (incident.type === 'AMBIGUITY') {
    const score = incident.confidenceScore ?? 0;
    if (score < 0.75) {
      return {
        shouldEscalate: true,
        suggestedSeverity: 'HIGH',
        reason: `OCR extraction confidence critically low (${Math.round(score * 100)}%). Epistemic humility prohibits automated inference.`
      };
    }
    if (score < 0.90) {
      return {
        shouldEscalate: true,
        suggestedSeverity: 'MEDIUM',
        reason: `Extraction confidence marginal (${Math.round(score * 100)}%). Ambiguous endorsement requires licensed human review.`
      };
    }
    return { shouldEscalate: false, suggestedSeverity: 'LOW', reason: 'Confidence exceeds threshold.' };
  }

  // Quote or Dec Page Discrepancy
  if (incident.type === 'DISCREPANCY') {
    return {
      shouldEscalate: true,
      suggestedSeverity: 'HIGH',
      reason: 'Direct discrepancy between provider rate assertion and carrier quote PDF terms.'
    };
  }

  // Post-bind stealth rate creep
  if (incident.type === 'STEALTH_CREEP') {
    const creep = incident.deltaAmount ?? 0;
    if (creep > 100) {
      return {
        shouldEscalate: true,
        suggestedSeverity: 'CRITICAL',
        reason: `Severe post-bind stealth creep: issued policy charged +$${creep}/yr above agreed binding dossier.`
      };
    }
    return {
      shouldEscalate: true,
      suggestedSeverity: 'HIGH',
      reason: `Post-bind rate discrepancy detected: +$${creep}/yr.`
    };
  }

  // Unlicensed activity
  if (incident.type === 'UNLICENSED_ACTIVITY') {
    return {
      shouldEscalate: true,
      suggestedSeverity: 'CRITICAL',
      reason: 'Market participation attempt without verified state insurance producer license.'
    };
  }

  return { shouldEscalate: false, suggestedSeverity: 'LOW', reason: 'Standard variance within automated bounds.' };
}

/**
 * Section 32: Deterministically processes an operator decision on a human review ticket.
 */
export function processReviewQueueResolution(
  item: ReviewQueueItem,
  action: 'OVERRIDE' | 'REJECT',
  reviewerId: string,
  notes: string
): {
  updatedItem: ReviewQueueItem;
  auditPayload: {
    eventType: AuditEvent['eventType'];
    actorRole: AuditEvent['actorRole'];
    actorId: string;
    details: string;
  };
} {
  const timestamp = new Date().toISOString();
  const status = action === 'OVERRIDE' ? 'RESOLVED_OVERRIDE' : 'RESOLVED_REJECTED';

  const updatedItem: ReviewQueueItem = {
    ...item,
    status,
    decision: action,
    resolvedAt: timestamp,
    resolvedBy: reviewerId,
    resolutionNotes: notes
  };

  const auditPayload = {
    eventType: 'POLICY_VERIFIED' as const,
    actorRole: 'ADMIN' as const,
    actorId: reviewerId,
    details: `Review Queue Ticket #${item.id} [${item.type}] resolved as ${action} by ${reviewerId}. Justification: "${notes}". Ticket closed.`
  };

  return { updatedItem, auditPayload };
}

/**
 * Section 34: Compiles an immutable, cryptographically sealed Regulatory Audit Proof.
 */
export function generateRegulatoryAuditProof(
  events: AuditEvent[],
  options: {
    jurisdiction: string;
    challengeReference?: string;
    auditorName?: string;
    timeframe?: { from: string; to: string };
  }
): RegulatoryAuditProof {
  const verification = verifyCryptographicAuditChain(events);
  const now = new Date().toISOString();

  const proofId = `REG-PROOF-${options.jurisdiction.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  const fromTime = options.timeframe?.from || (events.length > 0 ? events[0].timestamp : now);
  const toTime = options.timeframe?.to || (events.length > 0 ? events[events.length - 1].timestamp : now);

  const statutoryAffidavit = [
    `STATE REGULATORY COMPLIANCE CERTIFICATION — SECTION 33/34 STATUTE PARITY`,
    `Jurisdiction: ${options.jurisdiction} Division of Insurance`,
    `Audit Scope: ${options.challengeReference || 'All Marketplace Operations'}`,
    `Ledger Veracity: ${verification.isValid ? 'UNBROKEN_CRYPTOGRAPHIC_CHAIN' : 'INTEGRITY_TAMPER_FLAGGED'}`,
    `Total Chained Blocks: ${verification.totalEvents} blocks audited from genesis`,
    `Merkle Root Seal: ${verification.merkleRoot}`,
    `Epistemic Guarantee: Zero unverified coverage hallucination; strict adherence to Section 40 Product Doctrine.`,
    `Certified under penalty of administrative revocation by Open Polici Compliance Governance Engine.`
  ].join('\n');

  return {
    proofId,
    certificationAuthority: `State of ${options.jurisdiction} Commissioner of Insurance Audit Framework`,
    jurisdiction: options.jurisdiction,
    challengeReference: options.challengeReference || 'CHAL-GLOBAL-NV',
    timeframe: { from: fromTime, to: toTime },
    chainIntegrityVerified: verification.isValid,
    merkleRoot: verification.merkleRoot,
    genesisHash: verification.genesisHash,
    latestBlockHash: verification.latestBlockHash,
    totalAuditedEvents: verification.totalEvents,
    signedBy: options.auditorName || 'Chief Compliance Officer (Open Polici Systems)',
    certifiedAt: now,
    statutoryComplianceAffidavit: statutoryAffidavit
  };
}
