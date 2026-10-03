/**
 * Automated Domain Test Suite for PM-4 Governance, Cryptographic Audit Ledger & Review Queue
 * Validates Section 32 Human-in-the-Loop Review Queue, Section 33 Cryptographic Chaining,
 * Merkle Root generation, and Section 34 Regulatory Compliance Proofs.
 */

import { 
  computeBlockHash, 
  computeMerkleRoot, 
  verifyCryptographicAuditChain, 
  shouldEscalateToHumanReview, 
  processReviewQueueResolution, 
  generateRegulatoryAuditProof 
} from './governanceAuditEngine';
import { AuditEvent, ReviewQueueItem } from '../types/insurance';

export interface GovernanceTestCaseResult {
  name: string;
  category: string;
  passed: boolean;
  actual: any;
  expected: any;
  details?: string;
}

export function runGovernanceAuditTestSuite(): {
  total: number;
  passed: number;
  failed: number;
  results: GovernanceTestCaseResult[];
} {
  const results: GovernanceTestCaseResult[] = [];

  const assert = (
    name: string,
    category: string,
    actual: any,
    expected: any,
    details?: string
  ) => {
    const passed = JSON.stringify(actual) === JSON.stringify(expected);
    results.push({ name, category, passed, actual, expected, details });
  };

  // Helper to build chained test events
  function createChainedEvents(count: number): AuditEvent[] {
    const events: AuditEvent[] = [];
    let prevHash = 'GENESIS_BLOCK_000000';

    const mockActions: Array<{ eventType: AuditEvent['eventType']; actorRole: AuditEvent['actorRole']; actorId: string; details: string }> = [
      { eventType: 'POLICY_UPLOADED', actorRole: 'CONSUMER', actorId: 'user_1', details: 'Uploaded Dec Page PDF' },
      { eventType: 'DOCUMENT_PROCESSED', actorRole: 'SYSTEM', actorId: 'doc_intel', details: 'Extracted 6 coverage items' },
      { eventType: 'CHALLENGE_OPENED', actorRole: 'CONSUMER', actorId: 'user_1', details: 'Challenge #NV-49281 opened for market' },
      { eventType: 'OFFER_SUBMITTED', actorRole: 'PROVIDER', actorId: 'prov_apex', details: 'Submitted Safeco quote $2,490/yr' },
      { eventType: 'CONSUMER_SELECTED_OFFER', actorRole: 'CONSUMER', actorId: 'user_1', details: 'Selected Safeco quote' }
    ];

    for (let i = 0; i < count; i++) {
      const action = mockActions[i % mockActions.length];
      const timestamp = new Date(Date.now() + i * 1000).toISOString();
      const hash = computeBlockHash({
        timestamp,
        eventType: action.eventType,
        actorId: action.actorId,
        details: action.details,
        prevHash
      });

      const event: AuditEvent = {
        id: `AUD-TEST-${i}`,
        timestamp,
        eventType: action.eventType,
        actorRole: action.actorRole,
        actorId: action.actorId,
        details: action.details,
        hash
      };

      events.push(event);
      prevHash = hash;
    }

    return events;
  }

  // =========================================================================
  // 1. Cryptographic Chaining & Genesis Invariant
  // =========================================================================
  const validChain = createChainedEvents(5);
  const verifyValid = verifyCryptographicAuditChain(validChain);

  assert(
    'Valid audit event chain from genesis must verify with 100% integrity',
    'Cryptographic Chaining (Section 33)',
    { isValid: verifyValid.isValid, verifiedBlocks: verifyValid.verifiedBlocks, tamperedIndex: verifyValid.tamperedIndex },
    { isValid: true, verifiedBlocks: 5, tamperedIndex: null },
    'All 5 blocks sequentially hash with previous block hash to verify tamper-proof audit ledger.'
  );

  // =========================================================================
  // 2. Tamper Detection on Payload Alteration
  // =========================================================================
  const tamperedChain = createChainedEvents(5);
  // Malicious attacker attempts to change details of block #2
  tamperedChain[2].details = 'Tampered: Consumer accepted unauthorized rate increase';
  const verifyTampered = verifyCryptographicAuditChain(tamperedChain);

  assert(
    'Altering block payload in middle of chain must immediately fail verification',
    'Tamper Detection (Section 33)',
    { isValid: verifyTampered.isValid, tamperedIndex: verifyTampered.tamperedIndex },
    { isValid: false, tamperedIndex: 2 },
    `Correctly intercepted tampered block at index 2 (${verifyTampered.error?.substring(0, 45)}...)`
  );

  // =========================================================================
  // 3. Deletion / Reordering Interception
  // =========================================================================
  const deletedBlockChain = createChainedEvents(5);
  // Delete block #1 (second event)
  deletedBlockChain.splice(1, 1);
  const verifyDeleted = verifyCryptographicAuditChain(deletedBlockChain);

  assert(
    'Deleting or skipping an audit record must break hash chaining',
    'Ledger Immutability (Section 33)',
    { isValid: verifyDeleted.isValid, tamperedIndex: verifyDeleted.tamperedIndex },
    { isValid: false, tamperedIndex: 1 },
    'Chain breakage caught at index 1 because prevHash of block 2 no longer points to block 0.'
  );

  // =========================================================================
  // 4. Merkle Root Integrity
  // =========================================================================
  const hashes = validChain.map(e => e.hash);
  const root1 = computeMerkleRoot(hashes);
  const root2 = computeMerkleRoot(hashes);
  const mutatedHashes = [...hashes];
  mutatedHashes[0] = 'deadbeef0000';
  const mutatedRoot = computeMerkleRoot(mutatedHashes);

  assert(
    'Merkle root computation must be deterministic and sensitive to single hash mutations',
    'Merkle Tree Proofs (Section 33)',
    { identical: root1 === root2, changedOnMutation: root1 !== mutatedRoot },
    { identical: true, changedOnMutation: true },
    `Merkle root: ${root1.substring(0, 16)}... mutates to ${mutatedRoot.substring(0, 16)}...`
  );

  // =========================================================================
  // 5. Section 32 Human Review Escalation Engine
  // =========================================================================
  const ambiguityCheck = shouldEscalateToHumanReview({
    type: 'AMBIGUITY',
    confidenceScore: 0.72
  });

  const quoteDiscrepancyCheck = shouldEscalateToHumanReview({
    type: 'DISCREPANCY'
  });

  assert(
    'Low-confidence extraction (<75%) and quote discrepancies must escalate to Human Review Queue',
    'Human Review Escalation (Section 32)',
    { 
      ambiguityEscalated: ambiguityCheck.shouldEscalate, 
      ambiguitySeverity: ambiguityCheck.suggestedSeverity,
      quoteEscalated: quoteDiscrepancyCheck.shouldEscalate,
      quoteSeverity: quoteDiscrepancyCheck.suggestedSeverity
    },
    { 
      ambiguityEscalated: true, 
      ambiguitySeverity: 'HIGH',
      quoteEscalated: true,
      quoteSeverity: 'HIGH'
    },
    'Epistemic humility forbids AI from silently guessing ambiguous insurance terms.'
  );

  // =========================================================================
  // 6. Section 32 Review Queue Operator Override Resolution
  // =========================================================================
  const mockTicket: ReviewQueueItem = {
    id: 'REV-TEST-901',
    type: 'AMBIGUOUS_EXTRACTION',
    source: 'Dec Page OCR Page 3',
    summary: 'Endorsement code ERS vs Towing ambiguous',
    severity: 'MEDIUM',
    status: 'PENDING_REVIEW',
    createdAt: new Date().toISOString()
  };

  const overrideResult = processReviewQueueResolution(
    mockTicket,
    'OVERRIDE',
    'admin_sarah',
    'Confirmed manual inspection of policy jacket: Emergency Roadside Towing endorsement is included up to $100.'
  );

  assert(
    'Administrative override must record reviewer identity, justification, and audit payload',
    'Human Review Resolution (Section 32)',
    {
      status: overrideResult.updatedItem.status,
      decision: overrideResult.updatedItem.decision,
      resolvedBy: overrideResult.updatedItem.resolvedBy,
      hasAudit: overrideResult.auditPayload.actorRole === 'ADMIN'
    },
    {
      status: 'RESOLVED_OVERRIDE',
      decision: 'OVERRIDE',
      resolvedBy: 'admin_sarah',
      hasAudit: true
    },
    'Review queue ticket resolved with audit trail attribution.'
  );

  // =========================================================================
  // 7. Section 32 Review Queue Rejection of Non-Compliant Quote
  // =========================================================================
  const discrepantTicket: ReviewQueueItem = {
    id: 'REV-TEST-902',
    type: 'QUOTE_DISCREPANCY',
    source: 'Carrier Quote PDF vs Submitted Terms',
    summary: 'Provider claimed $500 deductible; PDF states $1,000 deductible',
    severity: 'HIGH',
    status: 'PENDING_REVIEW',
    createdAt: new Date().toISOString()
  };

  const rejectResult = processReviewQueueResolution(
    discrepantTicket,
    'REJECT',
    'admin_sarah',
    'Deductible discrepancy confirmed. Submitting provider penalized and quote rejected from competition.'
  );

  assert(
    'Rejecting deceptive or discrepant quote protects consumer and updates ticket status',
    'Quote Defense & Rejection (Section 32)',
    {
      status: rejectResult.updatedItem.status,
      decision: rejectResult.updatedItem.decision,
      resolvedBy: 'admin_sarah'
    },
    {
      status: 'RESOLVED_REJECTED',
      decision: 'REJECT',
      resolvedBy: 'admin_sarah'
    },
    'Deceptive offer successfully quarantined and rejected from consumer view.'
  );

  // =========================================================================
  // 8. Section 34 Statutory Regulatory Audit Proof Generation
  // =========================================================================
  const regProof = generateRegulatoryAuditProof(validChain, {
    jurisdiction: 'NV',
    challengeReference: 'CHAL-NV-49281',
    auditorName: 'Marcus Vance, Compliance Officer'
  });

  assert(
    'Compiles certified Regulatory Audit Proof with verified Merkle root and statutory affidavit',
    'Regulatory Certification (Section 34)',
    {
      jurisdiction: regProof.jurisdiction,
      chainIntegrityVerified: regProof.chainIntegrityVerified,
      totalAuditedEvents: regProof.totalAuditedEvents,
      hasAffidavit: regProof.statutoryComplianceAffidavit.includes('SECTION 33/34 STATUTE PARITY')
    },
    {
      jurisdiction: 'NV',
      chainIntegrityVerified: true,
      totalAuditedEvents: 5,
      hasAffidavit: true
    },
    `Proof #${regProof.proofId} certified with Merkle root ${regProof.merkleRoot.substring(0, 12)}... for Nevada DOI.`
  );

  return {
    total: results.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    results
  };
}
