import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/apiClient';
import { 
  FileText, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  Hash, 
  Search, 
  Filter, 
  AlertTriangle,
  User,
  ChevronDown,
  RefreshCw,
  SlidersHorizontal,
  ShieldCheck,
  Award,
  Download,
  ExternalLink,
  X,
  FileCheck,
  Lock,
  Flame,
  AlertOctagon,
  Copy,
  Layers
} from 'lucide-react';
import { 
  AuditEvent, 
  ReviewQueueItem, 
  ChainVerificationResult, 
  RegulatoryAuditProof 
} from '../types/insurance';

interface AdminConsoleProps {
  onRefreshData: () => void;
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({ onRefreshData }) => {
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Section 32 Human Review Queue state
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([]);
  const [reviewFilter, setReviewFilter] = useState<'ALL' | 'PENDING' | 'RESOLVED'>('ALL');
  const [selectedTicket, setSelectedTicket] = useState<ReviewQueueItem | null>(null);
  const [resolutionAction, setResolutionAction] = useState<'OVERRIDE' | 'REJECT'>('OVERRIDE');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [reviewerName, setReviewerName] = useState('Sarah Jenkins, Compliance Lead');
  const [isSubmittingResolution, setIsSubmittingResolution] = useState(false);

  // Section 33 Cryptographic Chain Verification state
  const [verificationResult, setVerificationResult] = useState<ChainVerificationResult | null>(null);
  const [isVerifyingChain, setIsVerifyingChain] = useState(false);
  const [simulatedTamperIndex, setSimulatedTamperIndex] = useState<number | null>(null);

  // Section 34 Regulatory Proof state
  const [proofData, setProofData] = useState<RegulatoryAuditProof | null>(null);
  const [showProofModal, setShowProofModal] = useState(false);
  const [isGeneratingProof, setIsGeneratingProof] = useState(false);
  const [copiedProof, setCopiedProof] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [eventsRes, queueRes, verifyRes] = await Promise.all([
        apiFetch('/api/audit-events'),
        apiFetch('/api/admin/review-queue'),
        apiFetch('/api/admin/audit-chain/verify')
      ]);

      const eventsData = await eventsRes.json();
      const queueData = await queueRes.json();
      const verifyData = await verifyRes.json();

      setAuditEvents(eventsData);
      setReviewQueue(queueData);
      setVerificationResult(verifyData);
    } catch (e) {
      console.error('Failed to load admin audit console data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle Review Resolution
  const handleResolveTicket = async () => {
    if (!selectedTicket) return;
    setIsSubmittingResolution(true);
    try {
      const res = await apiFetch(`/api/admin/review-queue/${selectedTicket.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: resolutionAction,
          resolvedBy: reviewerName,
          notes: resolutionNotes || `${resolutionAction === 'OVERRIDE' ? 'Manual override confirmed upon inspection' : 'Submission rejected for discrepancy'} under Section 32 human review protocol.`
        })
      });
      const data = await res.json();
      if (data.success) {
        setSelectedTicket(null);
        setResolutionNotes('');
        await loadData();
        onRefreshData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmittingResolution(false);
    }
  };

  // Re-verify Cryptographic Chain
  const handleVerifyChain = async () => {
    setIsVerifyingChain(true);
    try {
      const res = await apiFetch('/api/admin/audit-chain/verify');
      const data = await res.json();
      setVerificationResult(data);
      setSimulatedTamperIndex(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsVerifyingChain(false);
    }
  };

  // Simulate Tamper to show live regulatory fault-detection
  const handleSimulateTamper = () => {
    if (!verificationResult || auditEvents.length < 3) return;
    const targetIdx = 2;
    setSimulatedTamperIndex(targetIdx);
    setVerificationResult({
      ...verificationResult,
      isValid: false,
      verifiedBlocks: targetIdx,
      tamperedIndex: targetIdx,
      tamperedEventId: auditEvents[auditEvents.length - 1 - targetIdx]?.id || 'AUD-SIMULATED',
      error: `Cryptographic mismatch at block #${targetIdx}: expected hash 9a83f10c0291, found 4b29f018a920. Tampered block payload detected.`
    });
  };

  // Generate Regulatory Audit Proof
  const handleGenerateRegulatoryProof = async () => {
    setIsGeneratingProof(true);
    try {
      const res = await apiFetch('/api/admin/audit-chain/generate-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jurisdiction: 'NV',
          challengeReference: 'CHAL-NV-49281',
          auditorName: reviewerName
        })
      });
      const data = await res.json();
      if (data.success) {
        setProofData(data.proof);
        setShowProofModal(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingProof(false);
    }
  };

  const handleCopyProof = () => {
    if (!proofData) return;
    navigator.clipboard.writeText(JSON.stringify(proofData, null, 2));
    setCopiedProof(true);
    setTimeout(() => setCopiedProof(false), 3000);
  };

  // Filtered Events
  const filteredEvents = auditEvents.filter(event => {
    const matchesFilter = 
      filterType === 'ALL' ? true :
      filterType === 'DISCREPANCY' ? (event.eventType.includes('DISCREPANCY') || event.details.toLowerCase().includes('discrepancy') || event.details.toLowerCase().includes('creep')) :
      filterType === 'CONSUMER' ? event.actorRole === 'CONSUMER' :
      filterType === 'PROVIDER' ? event.actorRole === 'PROVIDER' :
      filterType === 'ADMIN' ? event.actorRole === 'ADMIN' :
      event.actorRole === 'SYSTEM';

    const matchesSearch = 
      searchTerm.trim() === '' ? true :
      event.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.eventType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.actorId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.hash.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  // Filtered Review Queue
  const filteredQueue = reviewQueue.filter(item => {
    if (reviewFilter === 'ALL') return true;
    if (reviewFilter === 'PENDING') return item.status === 'PENDING_REVIEW' || item.status === 'UNDER_INVESTIGATION';
    if (reviewFilter === 'RESOLVED') return item.status === 'RESOLVED_OVERRIDE' || item.status === 'RESOLVED_REJECTED';
    return true;
  });

  const pendingCount = reviewQueue.filter(i => i.status === 'PENDING_REVIEW' || i.status === 'UNDER_INVESTIGATION').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 text-white rounded-xl p-6 border border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30 flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>REGULATORY COMPLIANCE & GOVERNANCE • PM-4</span>
            </span>
            <span className="text-[11px] font-mono text-slate-400">Jurisdiction: NV DOI</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">
            Section 32/33: Append-Only Audit Trail & Human Review Queue
          </h2>
          <p className="text-xs text-slate-400">
            Cryptographically chained SHA-256 event ledger, human-in-the-loop review tickets, Merkle tree root verification, and Section 34 regulatory compliance proofs.
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start md:self-auto">
          <button
            onClick={handleGenerateRegulatoryProof}
            disabled={isGeneratingProof}
            className="flex items-center space-x-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-lg font-semibold transition shadow-xs"
          >
            <Award className="w-3.5 h-3.5" />
            <span>{isGeneratingProof ? 'Generating...' : 'Export Statutory Proof'}</span>
          </button>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center space-x-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. CRYPTOGRAPHIC CHAIN & MERKLE ROOT INTEGRITY CARD (Section 33)           */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Lock className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Cryptographic Append-Only Chain & Merkle Tree Verification (Section 33)
              </h3>
              <p className="text-xs text-slate-500">
                Verifies the recorded hash chain so changes to previously recorded transactions can be detected.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleVerifyChain}
              disabled={isVerifyingChain}
              className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isVerifyingChain ? 'Verifying Chain...' : 'Verify Cryptographic Chain'}</span>
            </button>

            <button
              onClick={simulatedTamperIndex === null ? handleSimulateTamper : handleVerifyChain}
              className={`flex items-center space-x-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition border ${
                simulatedTamperIndex === null
                  ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>{simulatedTamperIndex === null ? 'Simulate Tamper' : 'Restore Clean Chain'}</span>
            </button>
          </div>
        </div>

        {/* Verification Status Banner */}
        {verificationResult && (
          <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            verificationResult.isValid 
              ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900' 
              : 'bg-rose-50/70 border-rose-200 text-rose-900'
          }`}>
            <div className="flex items-start space-x-3">
              {verificationResult.isValid ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertOctagon className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-sm">
                    {verificationResult.isValid ? '100% UNBROKEN CRYPTOGRAPHIC INTEGRITY' : 'LEDGER TAMPERING DETECTED'}
                  </span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    verificationResult.isValid ? 'bg-emerald-200 text-emerald-800' : 'bg-rose-200 text-rose-800'
                  }`}>
                    {verificationResult.isValid ? 'CHAIN VERIFIED' : `FAILED AT BLOCK #${verificationResult.tamperedIndex}`}
                  </span>
                </div>
                <p className="text-xs">
                  {verificationResult.isValid 
                    ? `All ${verificationResult.totalEvents} audit blocks validated sequentially from Genesis (${verificationResult.genesisHash}) to Tip. Zero record tampering or alterations.`
                    : verificationResult.error}
                </p>
              </div>
            </div>

            {/* Cryptographic Hashes Pillbox */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono bg-white/80 p-2.5 rounded-lg border border-slate-200/80">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-sans font-semibold">Total Blocks</span>
                <span className="font-bold text-slate-900">{verificationResult.totalEvents}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-sans font-semibold">Merkle Root</span>
                <span className="font-bold text-slate-800 truncate block max-w-[110px]" title={verificationResult.merkleRoot}>
                  {verificationResult.merkleRoot.substring(0, 12)}...
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-500 block uppercase font-sans font-semibold">Latest Block Hash</span>
                <span className="font-bold text-slate-800 truncate block max-w-[110px]" title={verificationResult.latestBlockHash}>
                  {verificationResult.latestBlockHash.substring(0, 10)}...
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. SECTION 32 HUMAN-IN-THE-LOOP REVIEW QUEUE                              */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900">
                  Section 32 Human Review Queue ({reviewQueue.length} Total • {pendingCount} Pending)
                </h3>
                {pendingCount > 0 && (
                  <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full animate-pulse">
                    ACTION REQUIRED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Epistemic humility guardrail: ambiguous OCR scans or conflicting provider terms are never silently accepted by AI.
              </p>
            </div>
          </div>

          {/* Review Filter */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg text-xs">
            <button
              onClick={() => setReviewFilter('ALL')}
              className={`px-2.5 py-1 rounded font-medium transition ${reviewFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
            >
              All ({reviewQueue.length})
            </button>
            <button
              onClick={() => setReviewFilter('PENDING')}
              className={`px-2.5 py-1 rounded font-medium transition ${reviewFilter === 'PENDING' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600'}`}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setReviewFilter('RESOLVED')}
              className={`px-2.5 py-1 rounded font-medium transition ${reviewFilter === 'RESOLVED' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600'}`}
            >
              Resolved ({reviewQueue.length - pendingCount})
            </button>
          </div>
        </div>

        {/* Queue Items */}
        {filteredQueue.length > 0 ? (
          <div className="space-y-3">
            {filteredQueue.map(item => {
              const isPending = item.status === 'PENDING_REVIEW' || item.status === 'UNDER_INVESTIGATION';
              const severityColor = 
                item.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                item.severity === 'HIGH' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                item.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                'bg-slate-100 text-slate-700 border-slate-200';

              return (
                <div 
                  key={item.id}
                  className={`border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs transition ${
                    isPending ? 'bg-amber-50/40 border-amber-200 hover:border-amber-300' : 'bg-slate-50/50 border-slate-200'
                  }`}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 bg-white border border-slate-300 px-1.5 py-0.5 rounded">
                        {item.id}
                      </span>
                      <span className="font-bold text-slate-800">{item.type}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${severityColor}`}>
                        {item.severity} SEVERITY
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        item.status === 'RESOLVED_OVERRIDE' ? 'bg-emerald-100 text-emerald-800' :
                        item.status === 'RESOLVED_REJECTED' ? 'bg-rose-100 text-rose-800' :
                        'bg-amber-100 text-amber-900'
                      }`}>
                        STATUS: {item.status}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        • {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-slate-800 font-medium leading-relaxed">{item.summary}</p>
                    
                    {item.details && (
                      <p className="text-[11px] text-slate-600 bg-white/70 p-2 rounded border border-slate-200/60 font-mono">
                        {item.details}
                      </p>
                    )}

                    {item.resolvedBy && (
                      <div className="text-[11px] text-slate-500 flex items-center space-x-1.5 pt-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Resolved by <strong className="text-slate-700">{item.resolvedBy}</strong>: "{item.resolutionNotes}"</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2 shrink-0 self-start md:self-center">
                    {isPending ? (
                      <>
                        <button
                          onClick={() => {
                            setSelectedTicket(item);
                            setResolutionAction('OVERRIDE');
                            setResolutionNotes('Manual verification confirmed valid coverage in policy documentation.');
                          }}
                          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition shadow-xs"
                        >
                          Confirm & Override
                        </button>
                        <button
                          onClick={() => {
                            setSelectedTicket(item);
                            setResolutionAction('REJECT');
                            setResolutionNotes('Discrepancy confirmed. Submitted offer terms were rejected from policyholder review.');
                          }}
                          className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition shadow-xs"
                        >
                          Reject Submission
                        </button>
                      </>
                    ) : (
                      <span className="text-emerald-700 font-bold bg-emerald-100/70 border border-emerald-200 px-3 py-1 rounded-lg text-[11px] flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>TICKET CLOSED</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 text-xs flex flex-col items-center justify-center space-y-1">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 mb-1" />
            <span className="font-semibold text-slate-700">Review Queue Clear</span>
            <span>No pending discrepancies or unverified extractions in this category.</span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. APPEND-ONLY CRYPTOGRAPHIC AUDIT TRAIL TABLE (Section 33)              */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Cryptographically Chained Audit Ledger ({filteredEvents.length} Records)
            </h3>
            <p className="text-xs text-slate-500">
              Every system event, consumer decision, broker revision, and binding handoff is permanently anchored with SHA-256 block hashes.
            </p>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search audit trail..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500 w-44"
              />
            </div>

            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg text-xs">
              <button
                onClick={() => setFilterType('ALL')}
                className={`px-2 py-1 rounded font-medium transition ${filterType === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('CONSUMER')}
                className={`px-2 py-1 rounded font-medium transition ${filterType === 'CONSUMER' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600'}`}
              >
                Consumer
              </button>
              <button
                onClick={() => setFilterType('PROVIDER')}
                className={`px-2 py-1 rounded font-medium transition ${filterType === 'PROVIDER' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600'}`}
              >
                Provider
              </button>
              <button
                onClick={() => setFilterType('ADMIN')}
                className={`px-2 py-1 rounded font-medium transition ${filterType === 'ADMIN' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600'}`}
              >
                Admin
              </button>
              <button
                onClick={() => setFilterType('DISCREPANCY')}
                className={`px-2 py-1 rounded font-medium transition ${filterType === 'DISCREPANCY' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600'}`}
              >
                Discrepancies
              </button>
            </div>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <th className="py-2.5 px-3">Timestamp (UTC)</th>
                <th className="py-2.5 px-3">Event Type</th>
                <th className="py-2.5 px-3">Actor / Role</th>
                <th className="py-2.5 px-3">Transaction Details</th>
                <th className="py-2.5 px-3 font-mono">Block Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredEvents.map((event, idx) => {
                let roleBadge = 'bg-slate-100 text-slate-700';
                if (event.actorRole === 'CONSUMER') roleBadge = 'bg-emerald-100 text-emerald-800';
                if (event.actorRole === 'PROVIDER') roleBadge = 'bg-blue-100 text-blue-800';
                if (event.actorRole === 'ADMIN') roleBadge = 'bg-indigo-100 text-indigo-800';
                if (event.actorRole === 'SYSTEM') roleBadge = 'bg-purple-100 text-purple-800';

                const isTamperedBlock = simulatedTamperIndex !== null && idx === simulatedTamperIndex;

                return (
                  <tr 
                    key={event.id} 
                    className={`hover:bg-slate-50/70 ${isTamperedBlock ? 'bg-rose-50/80 font-semibold' : ''}`}
                  >
                    <td className="py-3 px-3 text-slate-500 font-mono whitespace-nowrap">
                      {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {event.eventType}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${roleBadge}`}>
                        {event.actorRole}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-700 text-xs leading-relaxed max-w-md">
                      {isTamperedBlock ? (
                        <span className="text-rose-700 flex items-center space-x-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          <span>[TAMPERED SIMULATION] Altered transaction payload breaks SHA-256 block hash!</span>
                        </span>
                      ) : (
                        event.details
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        #{event.hash.substring(0, 10)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. TICKET RESOLUTION MODAL (Section 32)                                    */}
      {/* ========================================================================= */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-slate-900 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900">
                  Section 32 Adjudication: {selectedTicket.id}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedTicket(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">{selectedTicket.type}</span>
                <span className="font-mono text-slate-500">{selectedTicket.severity} SEVERITY</span>
              </div>
              <p className="text-slate-700">{selectedTicket.summary}</p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Adjudication Action</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setResolutionAction('OVERRIDE')}
                    className={`py-2 px-3 rounded-lg font-bold border text-center transition ${
                      resolutionAction === 'OVERRIDE'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Confirm & Override
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolutionAction('REJECT')}
                    className={`py-2 px-3 rounded-lg font-bold border text-center transition ${
                      resolutionAction === 'REJECT'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Reject Submission
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Reviewer Identity</label>
                <input
                  type="text"
                  value={reviewerName}
                  onChange={e => setReviewerName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Justification / Audit Rationale</label>
                <textarea
                  rows={3}
                  value={resolutionNotes}
                  onChange={e => setResolutionNotes(e.target.value)}
                  placeholder="Explain regulatory basis for override or rejection..."
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResolveTicket}
                disabled={isSubmittingResolution}
                className={`px-4 py-2 text-white rounded-lg text-xs font-bold transition ${
                  resolutionAction === 'OVERRIDE' ? 'bg-slate-900 hover:bg-slate-800' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isSubmittingResolution ? 'Saving Decision...' : `Submit ${resolutionAction} Decision`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. REGULATORY PROOF CERTIFICATE MODAL (Section 34)                         */}
      {/* ========================================================================= */}
      {showProofModal && proofData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 text-slate-900 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                    Statutory Regulatory Compliance Audit Proof
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    State of {proofData.jurisdiction} Division of Insurance • Section 33/34
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowProofModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Proof Certificate Badge */}
            <div className="bg-slate-900 text-white p-4 rounded-xl space-y-3 font-mono text-xs border border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-indigo-400 font-bold">CERTIFICATE ID: {proofData.proofId}</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
                  {proofData.chainIntegrityVerified ? 'VALIDATED TAMPER-FREE' : 'FLAGGED'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block font-sans">Authority:</span>
                  <span className="text-slate-200 font-sans font-semibold">{proofData.certificationAuthority}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-sans">Scope:</span>
                  <span className="text-slate-200 font-sans font-semibold">{proofData.challengeReference}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-sans">Total Audited Events:</span>
                  <span className="text-slate-200">{proofData.totalAuditedEvents} Chained Blocks</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-sans">Certified Timestamp:</span>
                  <span className="text-slate-200">{new Date(proofData.certifiedAt).toLocaleString()}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 text-[11px] space-y-1">
                <div>
                  <span className="text-slate-400 block font-sans text-[10px]">Merkle Root Seal:</span>
                  <span className="text-emerald-400 break-all">{proofData.merkleRoot}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-sans text-[10px]">Latest Block Hash:</span>
                  <span className="text-indigo-300 break-all">{proofData.latestBlockHash}</span>
                </div>
              </div>
            </div>

            {/* Affidavit Text */}
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 font-mono text-[11px] leading-relaxed text-slate-700 whitespace-pre-line">
              {proofData.statutoryComplianceAffidavit}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
              <div className="flex items-center space-x-1.5 text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Digitally attested by {proofData.signedBy}</span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopyProof}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedProof ? 'Copied!' : 'Copy JSON'}</span>
                </button>
                <button
                  onClick={() => setShowProofModal(false)}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold transition"
                >
                  Close Certificate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
