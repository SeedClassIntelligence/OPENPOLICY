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
  Layers,
  Globe2,
  Building2,
  DollarSign
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
  const [insuranceLines, setInsuranceLines] = useState<any[]>([]);
  const [jurisdictionLineEntries, setJurisdictionLineEntries] = useState<any[]>([]);
  const [ownerOverview, setOwnerOverview] = useState<any | null>(null);
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

  // Platform financial administration (CE-1 through CE-5). These controls
  // deliberately operate on the canonical commercial stores and never grant
  // providers permission to set prices or finalize their own financial state.
  const [financialOrgId, setFinancialOrgId] = useState('');
  const [financialSummary, setFinancialSummary] = useState<any | null>(null);
  const [additionalSeats, setAdditionalSeats] = useState(0);
  const [additionalJurisdictions, setAdditionalJurisdictions] = useState(0);
  const [implementationAmount, setImplementationAmount] = useState(2500);
  const [executedAgreementReference, setExecutedAgreementReference] = useState('');
  const [implementationSupportingReference, setImplementationSupportingReference] = useState('');
  const [billingPeriodStart, setBillingPeriodStart] = useState(new Date().toISOString().slice(0, 10));
  const [billingPeriodEnd, setBillingPeriodEnd] = useState(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [refundPaymentId, setRefundPaymentId] = useState('');
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundReason, setRefundReason] = useState('Authorized billing correction');
  const [financialBusy, setFinancialBusy] = useState(false);
  const [financialMessage, setFinancialMessage] = useState<string | null>(null);
  const [providerStatusReason, setProviderStatusReason] = useState('');
  const [providerStatusBusy, setProviderStatusBusy] = useState<string | null>(null);
  const [commercialGovernance, setCommercialGovernance] = useState<any | null>(null);
  const [determinationForm, setDeterminationForm] = useState({ jurisdictionCode: 'NV', insuranceLine: 'PERSONAL_AUTO', authorityReference: '', supportingReference: '', determinationSummary: '', effectiveFrom: new Date().toISOString().slice(0, 10) });
  const [priceForm, setPriceForm] = useState({ priceBookId: '', effectiveFrom: '', recurringFeeDollars: 499, engagementDollars: 35 });
  const [premiumServiceReason,setPremiumServiceReason]=useState('');
  const [platformFinancials,setPlatformFinancials]=useState<any|null>(null);
  const [administratorRegistry,setAdministratorRegistry]=useState<any|null>(null);
  const [marketplaceOperations,setMarketplaceOperations]=useState<any|null>(null);
  const [adminForm,setAdminForm]=useState({firebaseUid:'',permissions:['PLATFORM_READ'] as string[],status:'ACTIVE',reason:''});

  const loadData = async () => {
    setLoading(true);
    try {
      const [eventsRes, queueRes, verifyRes, linesRes, rolloutRes, overviewRes, governanceRes, platformFinancialsRes, administratorsRes, operationsRes] = await Promise.all([
        apiFetch('/api/audit-events'),
        apiFetch('/api/admin/review-queue'),
        apiFetch('/api/admin/audit-chain/verify'),
        apiFetch('/api/insurance-lines'),
        apiFetch('/api/rollout/jurisdiction-lines'),
        apiFetch('/api/admin/overview'),
        apiFetch('/api/admin/commercial/governance'),
        apiFetch('/api/admin/commercial/platform-summary'),
        apiFetch('/api/admin/administrators'),
        apiFetch('/api/admin/marketplace-operations')
      ]);

      const eventsData = await eventsRes.json();
      const queueData = await queueRes.json();
      const verifyData = await verifyRes.json();
      const linesData = await linesRes.json();
      const rolloutData = await rolloutRes.json();
      const overviewData = await overviewRes.json();
      const governanceData = await governanceRes.json();
      const platformFinancialsData = await platformFinancialsRes.json();
      const administratorsData = await administratorsRes.json();
      const operationsData = await operationsRes.json();

      setAuditEvents(eventsData);
      setReviewQueue(queueData);
      setVerificationResult(verifyData);
      setInsuranceLines(linesData.insuranceLines || []);
      setJurisdictionLineEntries(rolloutData.entries || []);
      if (overviewRes.ok) setOwnerOverview(overviewData);
      if (governanceRes.ok) setCommercialGovernance(governanceData);
      if (platformFinancialsRes.ok) setPlatformFinancials(platformFinancialsData);
      if (administratorsRes.ok) setAdministratorRegistry(administratorsData);
      if (operationsRes.ok) setMarketplaceOperations(operationsData);
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

  const loadFinancialSummary = async () => {
    if (!financialOrgId.trim()) return;
    setFinancialBusy(true);
    setFinancialMessage(null);
    try {
      const response = await apiFetch(`/api/admin/commercial/organizations/${encodeURIComponent(financialOrgId.trim())}/summary`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Commercial summary could not be loaded.');
      setFinancialSummary(data);
    } catch (error: any) {
      setFinancialMessage(error?.message || 'Commercial summary could not be loaded.');
    } finally {
      setFinancialBusy(false);
    }
  };

  const activatePremiumAgreement = async () => {
    if (!financialOrgId.trim()) return;
    setFinancialBusy(true);
    setFinancialMessage(null);
    try {
      const selectedRecurringAddOns: Record<string, number> = {};
      if (additionalSeats > 0) selectedRecurringAddOns.ADDITIONAL_PRODUCER_SEAT = additionalSeats;
      if (additionalJurisdictions > 0) selectedRecurringAddOns.ADDITIONAL_JURISDICTION = additionalJurisdictions;
      const response = await apiFetch('/api/admin/commercial/agreements/enroll', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerOrganizationId: financialOrgId.trim(), planCode: 'PLAN_OPEN_POLICY_PREMIUM',
          customTerms: { selectedRecurringAddOns }
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Commercial agreement could not be activated.');
      setFinancialMessage('Open Policy Premium agreement activated under platform financial authority.');
      await loadFinancialSummary();
    } catch (error: any) {
      setFinancialMessage(error?.message || 'Commercial agreement could not be activated.');
    } finally {
      setFinancialBusy(false);
    }
  };

  const approveImplementationCharge = async () => {
    if (!financialSummary?.agreement?.id) {
      setFinancialMessage('Inspect an organization with an active commercial agreement first.');
      return;
    }
    setFinancialBusy(true);
    setFinancialMessage(null);
    try {
      const response = await apiFetch('/api/admin/commercial/negotiated-service-charges', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerOrganizationId: financialOrgId.trim(), commercialAgreementId: financialSummary.agreement.id,
          amountCents: Math.round(implementationAmount * 100), executedAgreementReference,
          supportingReference: implementationSupportingReference, effectiveAt: new Date().toISOString(),
          idempotencyKey: `implementation:${financialSummary.agreement.id}:${executedAgreementReference}`
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Implementation charge could not be approved.');
      setFinancialMessage('Negotiated implementation charge approved for the next eligible invoice.');
      await loadFinancialSummary();
    } catch (error: any) {
      setFinancialMessage(error?.message || 'Implementation charge could not be approved.');
    } finally {
      setFinancialBusy(false);
    }
  };

  const runFinancialAction = async (path: string, body: Record<string, unknown>, successMessage: string) => {
    setFinancialBusy(true);
    setFinancialMessage(null);
    try {
      const response = await apiFetch(path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Financial action failed.');
      setFinancialMessage(successMessage);
      await loadFinancialSummary();
    } catch (error: any) {
      setFinancialMessage(error?.message || 'Financial action failed.');
    } finally {
      setFinancialBusy(false);
    }
  };

  const changeProviderStatus = async (organizationId: string, marketplaceStatus: 'ACTIVE' | 'SUSPENDED') => {
    if (!providerStatusReason.trim()) return;
    setProviderStatusBusy(organizationId);
    try {
      const response = await apiFetch(`/api/admin/providers/${encodeURIComponent(organizationId)}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketplaceStatus, reason: providerStatusReason.trim() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Provider status could not be changed.');
      setProviderStatusReason('');
      await loadData();
    } catch (error: any) {
      setFinancialMessage(error?.message || 'Provider status could not be changed.');
    } finally {
      setProviderStatusBusy(null);
    }
  };

  const approveCompensationDetermination = async () => {
    setFinancialBusy(true); setFinancialMessage(null);
    try {
      const response = await apiFetch('/api/admin/commercial/compensation-determinations', {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({
          ...determinationForm, chargeType:'AUTHORIZED_CONNECTION',
          effectiveFrom:`${determinationForm.effectiveFrom}T00:00:00.000Z`,
          idempotencyKey:`comp:${determinationForm.jurisdictionCode}:${determinationForm.insuranceLine}:${determinationForm.authorityReference}`
        })
      });
      const data=await response.json(); if(!response.ok) throw new Error(data.error||'Determination could not be recorded.');
      setFinancialMessage('Compensation determination recorded with immutable audit evidence. Charges remain disabled until separately activated.');
      await loadData();
    } catch(error:any){setFinancialMessage(error?.message||'Determination could not be recorded.');} finally{setFinancialBusy(false);}
  };

  const publishFuturePriceVersion = async () => {
    const plan=commercialGovernance?.plans?.[0]; if(!plan?.latestVersion) return;
    setFinancialBusy(true); setFinancialMessage(null);
    try {
      const response=await apiFetch(`/api/admin/commercial/plans/${encodeURIComponent(plan.id)}/versions`,{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
          priceBookId:priceForm.priceBookId,effectiveFrom:`${priceForm.effectiveFrom}T00:00:00.000Z`,
          recurringFeeCents:Math.round(priceForm.recurringFeeDollars*100),
          qualifiedEngagementUnitPriceCents:Math.round(priceForm.engagementDollars*100),
          authorizedConnectionCentsByInsuranceLine:plan.latestVersion.termsSnapshot.authorizedConnectionCentsByInsuranceLine||{}
        })
      });
      const data=await response.json(); if(!response.ok) throw new Error(data.error||'Price version could not be published.');
      setFinancialMessage(`Immutable price-book version ${data.version.version} published for future effect.`); await loadData();
    } catch(error:any){setFinancialMessage(error?.message||'Price version could not be published.');} finally{setFinancialBusy(false);}
  };

  const changePremiumService=async(serviceCode:string,status:'ENABLED'|'DISABLED')=>{
    if(!premiumServiceReason.trim()) return;
    setFinancialBusy(true);setFinancialMessage(null);
    try{const response=await apiFetch(`/api/admin/commercial/premium-services/${encodeURIComponent(serviceCode)}`,{
      method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status,reason:premiumServiceReason.trim()})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Premium service status could not be changed.');
      setPremiumServiceReason('');setFinancialMessage(`${serviceCode} is now ${status.toLowerCase()}.`);await loadData();
    }catch(error:any){setFinancialMessage(error?.message||'Premium service status could not be changed.');}finally{setFinancialBusy(false);}
  };

  const saveStaffAdministrator=async()=>{setFinancialBusy(true);setFinancialMessage(null);try{const response=await apiFetch(`/api/admin/administrators/${encodeURIComponent(adminForm.firebaseUid.trim())}`,{
    method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({adminType:'STAFF',permissions:adminForm.permissions,status:adminForm.status,reason:adminForm.reason.trim()})});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'Administrator authority could not be saved.');setFinancialMessage('Administrator authority saved with immutable audit evidence.');setAdminForm({firebaseUid:'',permissions:['PLATFORM_READ'],status:'ACTIVE',reason:''});await loadData();
  }catch(error:any){setFinancialMessage(error?.message||'Administrator authority could not be saved.');}finally{setFinancialBusy(false);}};

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
              <span>RESTRICTED OWNER OPERATIONS</span>
            </span>
            <span className="text-[11px] font-mono text-slate-400">Server-authoritative control plane</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">
            Open Policy Owner Control Center
          </h2>
          <p className="text-xs text-slate-400">
            One protected view of marketplace operations, provider organizations, commercial administration, rollout readiness, reviews and immutable audit evidence.
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

      <nav aria-label="Owner console sections" className="sticky top-20 z-20 flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur">
        {[
          ['#owner-overview', 'Overview'], ['#owner-marketplace', 'Marketplace'], ['#owner-providers', 'Providers'],
          ['#owner-commercial', 'Commercial'], ['#owner-security', 'Security'], ['#owner-rollout', 'Markets'],
          ['#owner-reviews', 'Reviews'], ['#owner-audit', 'Audit']
        ].map(([href, label]) => (
          <a key={href} href={href} className="whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-900 hover:text-white">{label}</a>
        ))}
      </nav>

      {/* Owner-wide operational overview. Consumer identity count is intentionally
          not guessed: Firebase identity and PostgreSQL business state remain
          separate authorities until a dedicated administrative identity index exists. */}
      <section id="owner-overview" className="scroll-mt-36 rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700">Platform overview</p>
            <h3 className="text-base font-bold text-slate-950">Current durable operating state</h3>
            <p className="text-xs text-slate-500">Live counts come from PostgreSQL. No dashboard-only business state is created here.</p>
          </div>
          <span className="text-[10px] font-mono text-slate-400">{ownerOverview?.generatedAt ? `Updated ${new Date(ownerOverview.generatedAt).toLocaleString()}` : 'Loading authoritative state…'}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          {[
            ['Providers', ownerOverview?.counts?.activeProviderOrganizations ?? '—', `${ownerOverview?.counts?.providerOrganizations ?? '—'} total`],
            ['Provider users', ownerOverview?.counts?.activeProviderUsers ?? '—', `${ownerOverview?.counts?.providerUsers ?? '—'} total`],
            ['Open opportunities', ownerOverview?.counts?.openCompetitions ?? '—', `${ownerOverview?.counts?.competitions ?? '—'} total`],
            ['Policies', ownerOverview?.counts?.policies ?? '—', 'durable records'],
            ['Baselines', ownerOverview?.counts?.verifiedBaselines ?? '—', 'coverage baselines'],
            ['Handoffs', ownerOverview?.counts?.bindingHandoffs ?? '—', 'authorized lifecycle'],
            ['Vault items', ownerOverview?.counts?.policyVaultItems ?? '—', 'issued evidence'],
            ['Reviews', ownerOverview?.counts?.pendingReviews ?? '—', `${ownerOverview?.counts?.auditEvents ?? '—'} audit events`]
          ].map(([label, value, note]) => (
            <div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
              <strong className="mt-1 block text-xl text-slate-950">{value}</strong>
              <span className="text-[10px] text-slate-500">{note}</span>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-900">
          Consumer account totals are not shown because Firebase Authentication is the identity authority and the current owner API does not maintain a separate, trustworthy consumer directory. Policy and lifecycle totals above are authoritative PostgreSQL counts.
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-xl border border-slate-200 p-4">
          <div><span className="block text-[10px] uppercase text-slate-500">Payment processor</span><strong className="text-sm text-slate-900">Stripe</strong></div>
          <div><span className="block text-[10px] uppercase text-slate-500">Credentials</span><strong className={ownerOverview?.paymentProcessor?.configured ? 'text-emerald-700' : 'text-amber-700'}>{ownerOverview?.paymentProcessor?.configured ? 'Configured' : 'Not configured'}</strong></div>
          <div><span className="block text-[10px] uppercase text-slate-500">Secure return URL</span><strong className={ownerOverview?.paymentProcessor?.secureReturnUrl ? 'text-emerald-700' : 'text-amber-700'}>{ownerOverview?.paymentProcessor?.secureReturnUrl ? 'HTTPS ready' : 'Not ready'}</strong></div>
          <div><span className="block text-[10px] uppercase text-slate-500">Live collections</span><strong className={ownerOverview?.paymentProcessor?.liveCollectionsEnabled ? 'text-rose-700' : 'text-slate-700'}>{ownerOverview?.paymentProcessor?.liveCollectionsEnabled ? 'Enabled' : 'Disabled'}</strong></div>
        </div>
        <div id="owner-marketplace" className="scroll-mt-36 space-y-3 border-t border-slate-200 pt-4">
          <div><h4 className="text-sm font-bold text-slate-950">Marketplace lifecycle operations</h4><p className="text-[11px] text-slate-500">Policy evidence through opportunity, offer, selection and authorized handoff.</p></div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">{[
            ['Policies',marketplaceOperations?.policies?.length],['Opportunities',marketplaceOperations?.opportunities?.length],['Offers',marketplaceOperations?.offers?.length],['Selections',marketplaceOperations?.selections?.length],['Handoffs',marketplaceOperations?.handoffs?.length]
          ].map(([label,value])=><div key={String(label)} className="rounded-lg border bg-slate-50 p-3"><span className="block text-slate-500">{label}</span><strong>{value??'—'}</strong></div>)}</div>
          <div className="overflow-x-auto rounded-lg border"><table className="min-w-full text-left text-[11px]"><thead className="bg-slate-50"><tr><th className="px-3 py-2">Opportunity</th><th className="px-3 py-2">Market</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Offers</th><th className="px-3 py-2">Cohort</th></tr></thead><tbody>
            {(marketplaceOperations?.opportunities||[]).map((item:any)=><tr key={item.id} className="border-t"><td className="px-3 py-2"><strong>{item.referenceNumber}</strong><br/><span className="font-mono text-[10px] text-slate-400">{item.id}</span></td><td className="px-3 py-2">{item.jurisdiction} · {item.insuranceLine}</td><td className="px-3 py-2">{item.status}<br/><span className="text-slate-400">{item.competitionStatus||'No competition'}</span></td><td className="px-3 py-2">{item.offersCount}</td><td className="px-3 py-2">{item.activeOfferCohort||'—'} / {item.maximumActivatedProviders||'—'}</td></tr>)}
            {!marketplaceOperations?.opportunities?.length&&<tr><td colSpan={5} className="px-3 py-4 text-center text-slate-500">No durable opportunities recorded.</td></tr>}
          </tbody></table></div>
        </div>
        <div id="owner-providers" className="scroll-mt-36 space-y-3 pt-2">
          <div>
            <h4 className="text-sm font-bold text-slate-950">Provider organization registry</h4>
            <p className="text-[11px] text-slate-500">Authoritative marketplace organizations and their current operating status.</p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr>
                <th className="px-3 py-2">Organization</th><th className="px-3 py-2">Verification</th><th className="px-3 py-2">Marketplace</th><th className="px-3 py-2">Users</th><th className="px-3 py-2">Jurisdictions</th><th className="px-3 py-2">Lines</th><th className="px-3 py-2">Action</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {(ownerOverview?.organizations || []).map((organization: any) => (
                  <tr key={organization.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2"><strong className="block text-slate-900">{organization.displayName}</strong><span className="font-mono text-[10px] text-slate-400">{organization.id}</span></td>
                    <td className="px-3 py-2 text-slate-700">{organization.verificationStatus}</td>
                    <td className="px-3 py-2 text-slate-700">{organization.marketplaceStatus}</td>
                    <td className="px-3 py-2 text-slate-700">{organization.userCount}</td>
                    <td className="px-3 py-2 text-slate-700">{organization.states?.join(', ') || '—'}</td>
                    <td className="px-3 py-2 text-slate-700">{organization.linesOfBusiness?.join(', ') || '—'}</td>
                    <td className="px-3 py-2">
                      {organization.marketplaceStatus === 'ACTIVE' ? (
                        <button disabled={!providerStatusReason.trim() || providerStatusBusy === organization.id} onClick={() => changeProviderStatus(organization.id, 'SUSPENDED')} className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800 disabled:opacity-40">Suspend</button>
                      ) : (
                        <button disabled={!providerStatusReason.trim() || providerStatusBusy === organization.id} onClick={() => changeProviderStatus(organization.id, 'ACTIVE')} className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800 disabled:opacity-40">Activate</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="block text-xs font-semibold text-slate-700">Required reason for provider status change
            <input value={providerStatusReason} onChange={event => setProviderStatusReason(event.target.value)} placeholder="Document the operational or compliance reason" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" />
          </label>
          <p className="text-[10px] text-slate-500">Suspension immediately removes marketplace eligibility. Every change is committed with immutable administrator audit evidence.</p>
        </div>
      </section>

      {/* Owner financial control plane */}
      <section id="owner-commercial" className="scroll-mt-36 rounded-xl border border-emerald-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              <DollarSign className="h-4 w-4" /> Platform Financial Administration
            </div>
            <h3 className="mt-1 text-base font-bold text-slate-950">Commercial agreement and revenue oversight</h3>
            <p className="text-xs text-slate-500">Authorized administrators control paid activation. Providers can view terms, invoices and balances, and initiate secure payment only.</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <select value={financialOrgId} onChange={event => { setFinancialOrgId(event.target.value); setFinancialSummary(null); }}
              className="min-w-0 flex-1 md:w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs">
              <option value="">Select a provider organization</option>
              {(ownerOverview?.organizations || []).map((organization: any) => (
                <option key={organization.id} value={organization.id}>
                  {organization.displayName} · {organization.marketplaceStatus} · {organization.id}
                </option>
              ))}
            </select>
            <button type="button" onClick={loadFinancialSummary} disabled={financialBusy || !financialOrgId.trim()}
              className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Inspect</button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <div><h4 className="text-sm font-bold text-slate-950">Future price-book version</h4><p className="text-[11px] text-slate-500">Publishes a new immutable version. Existing agreements retain their historical version.</p></div>
            <div className="grid grid-cols-2 gap-2">
              <input value={priceForm.priceBookId} onChange={e=>setPriceForm({...priceForm,priceBookId:e.target.value})} placeholder="Price book ID" className="rounded-lg border px-3 py-2 text-xs" />
              <input type="date" value={priceForm.effectiveFrom} onChange={e=>setPriceForm({...priceForm,effectiveFrom:e.target.value})} className="rounded-lg border px-3 py-2 text-xs" />
              <label className="text-[11px] text-slate-600">Membership USD<input type="number" min={0} value={priceForm.recurringFeeDollars} onChange={e=>setPriceForm({...priceForm,recurringFeeDollars:Number(e.target.value)})} className="mt-1 w-full rounded-lg border px-3 py-2 text-xs" /></label>
              <label className="text-[11px] text-slate-600">Qualified engagement USD<input type="number" min={0} value={priceForm.engagementDollars} onChange={e=>setPriceForm({...priceForm,engagementDollars:Number(e.target.value)})} className="mt-1 w-full rounded-lg border px-3 py-2 text-xs" /></label>
            </div>
            <button onClick={publishFuturePriceVersion} disabled={financialBusy||!priceForm.priceBookId||!priceForm.effectiveFrom} className="w-full rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Publish immutable future version</button>
            <p className="text-[10px] text-slate-500">Latest: v{commercialGovernance?.plans?.[0]?.latestVersion?.version||'—'} · Compensation activation is never inferred from a price change.</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
            <div><h4 className="text-sm font-bold text-slate-950">Compensation determination registry</h4><p className="text-[11px] text-slate-500">Records scoped legal/compliance authority. It does not silently activate a charge.</p></div>
            <div className="grid grid-cols-2 gap-2">
              <input value={determinationForm.jurisdictionCode} onChange={e=>setDeterminationForm({...determinationForm,jurisdictionCode:e.target.value.toUpperCase()})} placeholder="Jurisdiction" className="rounded-lg border px-3 py-2 text-xs" />
              <select value={determinationForm.insuranceLine} onChange={e=>setDeterminationForm({...determinationForm,insuranceLine:e.target.value})} className="rounded-lg border px-3 py-2 text-xs">{insuranceLines.map((line:any)=><option key={line.code} value={line.code}>{line.displayName||line.code}</option>)}</select>
              <input value={determinationForm.authorityReference} onChange={e=>setDeterminationForm({...determinationForm,authorityReference:e.target.value})} placeholder="Authority/counsel reference" className="rounded-lg border px-3 py-2 text-xs" />
              <input type="date" value={determinationForm.effectiveFrom} onChange={e=>setDeterminationForm({...determinationForm,effectiveFrom:e.target.value})} className="rounded-lg border px-3 py-2 text-xs" />
              <input value={determinationForm.supportingReference} onChange={e=>setDeterminationForm({...determinationForm,supportingReference:e.target.value})} placeholder="Immutable supporting record" className="col-span-2 rounded-lg border px-3 py-2 text-xs" />
              <textarea value={determinationForm.determinationSummary} onChange={e=>setDeterminationForm({...determinationForm,determinationSummary:e.target.value})} placeholder="Scope, conditions and conclusion" className="col-span-2 rounded-lg border px-3 py-2 text-xs" />
            </div>
            <button onClick={approveCompensationDetermination} disabled={financialBusy||!determinationForm.authorityReference||!determinationForm.supportingReference||!determinationForm.determinationSummary} className="w-full rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Record approved determination</button>
            <div className="max-h-32 space-y-1 overflow-auto">
              {(commercialGovernance?.compensationDeterminations||[]).map((item:any)=><div key={item.id} className="rounded border bg-white px-2 py-1.5 text-[10px] text-slate-600"><strong className={item.status==='APPROVED'?'text-emerald-700':'text-rose-700'}>{item.status}</strong> · {item.jurisdictionCode} · {item.insuranceLine}<br/><span className="font-mono">{item.authorityReference}</span></div>)}
              {!commercialGovernance?.compensationDeterminations?.length&&<p className="text-[10px] text-slate-500">No compensation determinations recorded.</p>}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 space-y-3">
          <div><h4 className="text-sm font-bold text-slate-950">Premium service availability</h4><p className="text-[11px] text-slate-500">A global disable blocks new purchase and current use; provider entitlements remain separate and tenant-scoped.</p></div>
          <input value={premiumServiceReason} onChange={e=>setPremiumServiceReason(e.target.value)} placeholder="Required operational or acceptance reason" className="w-full rounded-lg border bg-white px-3 py-2 text-xs" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
            {(commercialGovernance?.premiumServices||[]).map((service:any)=><div key={service.serviceCode} className="rounded-lg border bg-white p-3 text-xs">
              <div className="font-bold text-slate-900">{service.serviceCode.replace(/_/g,' ')}</div>
              <div className="mt-1 text-[10px] text-slate-500">Acceptance: {service.acceptanceReference}</div>
              <div className={`mt-2 font-bold ${service.status==='ENABLED'?'text-emerald-700':'text-rose-700'}`}>{service.status}</div>
              <button disabled={financialBusy||!premiumServiceReason.trim()} onClick={()=>changePremiumService(service.serviceCode,service.status==='ENABLED'?'DISABLED':'ENABLED')} className="mt-2 w-full rounded border px-2 py-1.5 text-[10px] font-bold disabled:opacity-50">{service.status==='ENABLED'?'Disable service':'Enable accepted service'}</button>
            </div>)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-4 space-y-3">
          <div><h4 className="text-sm font-bold text-slate-950">Platform revenue and payment operations</h4><p className="text-[11px] text-slate-500">Aggregated directly from invoices, processor-backed payment records, refunds and the immutable commercial event ledger.</p></div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
            {[
              ['Invoiced',platformFinancials?.totals?.invoicedCents],['Collected',platformFinancials?.totals?.collectedCents],
              ['Outstanding',platformFinancials?.totals?.outstandingCents],['Refunded',platformFinancials?.totals?.refundedCents]
            ].map(([label,value])=><div key={String(label)} className="rounded-lg border bg-slate-50 p-3"><span className="block text-slate-500">{label}</span><strong>${((Number(value)||0)/100).toFixed(2)}</strong></div>)}
            <div className="rounded-lg border bg-slate-50 p-3"><span className="block text-slate-500">Payment exceptions</span><strong>{platformFinancials?.totals?.failedPaymentCount||0} failed · {platformFinancials?.totals?.pendingPaymentCount||0} pending</strong></div>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full text-left text-[11px]"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2">Revenue event</th><th className="px-3 py-2">Recorded</th><th className="px-3 py-2">Rated value</th></tr></thead><tbody>
              {(platformFinancials?.revenueEvents||[]).map((item:any)=><tr key={item.eventType} className="border-t"><td className="px-3 py-2 font-mono">{item.eventType}</td><td className="px-3 py-2">{item.eventCount}</td><td className="px-3 py-2">${((item.ratedCents||0)/100).toFixed(2)}</td></tr>)}
              {!platformFinancials?.revenueEvents?.length&&<tr><td colSpan={3} className="px-3 py-4 text-center text-slate-500">No commercial events recorded yet.</td></tr>}
            </tbody></table>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-xl bg-slate-50 p-4 border border-slate-200">
          <label className="text-xs font-semibold text-slate-700">Additional producer seats
            <input type="number" min={0} value={additionalSeats} onChange={event => setAdditionalSeats(Math.max(0, Number(event.target.value) || 0))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
          </label>
          <label className="text-xs font-semibold text-slate-700">Additional jurisdictions
            <input type="number" min={0} value={additionalJurisdictions} onChange={event => setAdditionalJurisdictions(Math.max(0, Number(event.target.value) || 0))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
          </label>
          <div className="md:col-span-2 flex items-end">
            <button type="button" onClick={activatePremiumAgreement} disabled={financialBusy || !financialOrgId.trim()}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
              Activate Open Policy Premium under admin authority
            </button>
          </div>
        </div>

        {financialMessage && <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">{financialMessage}</div>}
        {financialSummary && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-xs">
            <div className="rounded-lg border p-3"><span className="block text-slate-500">Agreement</span><strong>{financialSummary.agreement?.status || 'NONE'}</strong></div>
            <div className="rounded-lg border p-3"><span className="block text-slate-500">Entitlements</span><strong>{financialSummary.entitlements?.length || 0}</strong></div>
            <div className="rounded-lg border p-3"><span className="block text-slate-500">Rated events</span><strong>{financialSummary.billableEvents?.length || 0}</strong></div>
            <div className="rounded-lg border p-3"><span className="block text-slate-500">Invoices</span><strong>{financialSummary.invoices?.length || 0}</strong></div>
            <div className="rounded-lg border p-3"><span className="block text-slate-500">Paid</span><strong>${((financialSummary.balance?.totalPaidCents || 0) / 100).toFixed(2)}</strong></div>
            <div className="rounded-lg border p-3"><span className="block text-slate-500">Outstanding</span><strong>${((financialSummary.balance?.outstandingBalanceCents || 0) / 100).toFixed(2)}</strong></div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-xl border border-slate-200 p-4">
          <label className="text-xs font-semibold text-slate-700">Implementation amount (USD)
            <input type="number" min={2500} max={10000} value={implementationAmount}
              onChange={event => setImplementationAmount(Number(event.target.value) || 2500)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-xs font-semibold text-slate-700">Executed agreement reference
            <input value={executedAgreementReference} onChange={event => setExecutedAgreementReference(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-xs font-semibold text-slate-700">Supporting document/reference
            <input value={implementationSupportingReference} onChange={event => setImplementationSupportingReference(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <div className="flex items-end">
            <button type="button" onClick={approveImplementationCharge}
              disabled={financialBusy || !financialSummary?.agreement?.id || !executedAgreementReference.trim() || !implementationSupportingReference.trim()}
              className="w-full rounded-lg bg-indigo-600 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50">
              Approve one-time implementation charge
            </button>
          </div>
        </div>
        {financialSummary?.agreement && (
          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-700">Agreement, rating and invoice lifecycle</div>
            <div className="flex flex-wrap gap-2">
              {financialSummary.agreement.status === 'ACTIVE' && (
                <button type="button" disabled={financialBusy} onClick={() => runFinancialAction(
                  `/api/admin/commercial/agreements/${financialSummary.agreement.id}/transition`,
                  { targetStatus: 'SUSPENDED', reason: 'Platform financial administration suspension' }, 'Agreement suspended.'
                )} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Suspend</button>
              )}
              {financialSummary.agreement.status === 'SUSPENDED' && (
                <button type="button" disabled={financialBusy} onClick={() => runFinancialAction(
                  `/api/admin/commercial/agreements/${financialSummary.agreement.id}/transition`,
                  { targetStatus: 'ACTIVE', reason: 'Platform financial administration reactivation' }, 'Agreement reactivated.'
                )} className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">Reactivate</button>
              )}
              {!['TERMINATED', 'EXPIRED'].includes(financialSummary.agreement.status) && (
                <button type="button" disabled={financialBusy} onClick={() => runFinancialAction(
                  `/api/admin/commercial/agreements/${financialSummary.agreement.id}/transition`,
                  { targetStatus: 'TERMINATED', reason: 'Platform financial administration termination' }, 'Agreement terminated.'
                )} className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800">Terminate</button>
              )}
              <button type="button" disabled={financialBusy} onClick={() => runFinancialAction(
                '/api/commercial/rating/run', {}, 'Commercial event rating completed.'
              )} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white">Run rating</button>
              <button type="button" disabled={financialBusy} onClick={() => runFinancialAction(
                '/api/commercial/events/reconcile', {}, 'Commercial event reconciliation completed.'
              )} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white">Reconcile events</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <label className="text-xs font-semibold text-slate-700">Period start
                <input type="date" value={billingPeriodStart} onChange={event => setBillingPeriodStart(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
              </label>
              <label className="text-xs font-semibold text-slate-700">Period end
                <input type="date" value={billingPeriodEnd} onChange={event => setBillingPeriodEnd(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
              </label>
              <div className="flex items-end">
                <button type="button" disabled={financialBusy || !financialSummary.planVersion?.id} onClick={() => runFinancialAction(
                  '/api/commercial/billing-periods', {
                    providerOrganizationId: financialOrgId.trim(), commercialAgreementId: financialSummary.agreement.id,
                    commercialPlanVersionId: financialSummary.planVersion.id,
                    periodStart: `${billingPeriodStart}T00:00:00.000Z`, periodEnd: `${billingPeriodEnd}T00:00:00.000Z`
                  }, 'Billing period created.'
                )} className="w-full rounded-lg bg-indigo-600 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50">Create billing period</button>
              </div>
              <div className="flex items-end gap-2">
                {financialSummary.billingPeriods?.find((period: any) => period.status === 'OPEN') && (
                  <button type="button" disabled={financialBusy} onClick={() => {
                    const period = financialSummary.billingPeriods.find((candidate: any) => candidate.status === 'OPEN');
                    return runFinancialAction(`/api/commercial/billing-periods/${period.id}/close`, {}, 'Billing period closed.');
                  }} className="w-full rounded-lg border border-indigo-300 px-3 py-2.5 text-xs font-bold text-indigo-800">Close open period</button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {financialSummary.billingPeriods?.find((period: any) => period.status === 'CLOSED' && !financialSummary.invoices?.some((invoice: any) => invoice.billingPeriodId === period.id)) && (
                <button type="button" disabled={financialBusy} onClick={() => {
                  const period = financialSummary.billingPeriods.find((candidate: any) => candidate.status === 'CLOSED' && !financialSummary.invoices?.some((invoice: any) => invoice.billingPeriodId === candidate.id));
                  return runFinancialAction('/api/commercial/invoices/generate-draft', { billingPeriodId: period.id, idempotencyKey: `invoice:${period.id}` }, 'Draft invoice generated.');
                }} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white">Generate draft invoice</button>
              )}
              {financialSummary.invoices?.find((invoice: any) => invoice.status === 'DRAFT') && (
                <button type="button" disabled={financialBusy} onClick={() => {
                  const invoice = financialSummary.invoices.find((candidate: any) => candidate.status === 'DRAFT');
                  return runFinancialAction(`/api/commercial/invoices/${invoice.id}/finalize`, {}, 'Invoice finalized and ready for provider payment.');
                }} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Finalize draft invoice</button>
              )}
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-xl border border-rose-200 bg-rose-50/30 p-4">
          <label className="text-xs font-semibold text-slate-700">Processor payment record ID
            <input value={refundPaymentId} onChange={event => setRefundPaymentId(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="text-xs font-semibold text-slate-700">Refund amount (USD)
            <input type="number" min={0.01} step={0.01} value={refundAmount} onChange={event => setRefundAmount(Number(event.target.value) || 0)} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="text-xs font-semibold text-slate-700">Refund reason
            <input value={refundReason} onChange={event => setRefundReason(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <div className="flex items-end">
            <button type="button" disabled={financialBusy || !refundPaymentId.trim() || refundAmount <= 0 || !refundReason.trim()}
              onClick={() => runFinancialAction('/api/commercial/refunds', {
                paymentId: refundPaymentId.trim(), amountCents: Math.round(refundAmount * 100), reason: refundReason,
                idempotencyKey: `admin-refund:${refundPaymentId.trim()}:${Math.round(refundAmount * 100)}`
              }, 'Processor-confirmed refund recorded and reconciled.')}
              className="w-full rounded-lg bg-rose-600 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50">Execute processor-first refund</button>
          </div>
        </div>
        <p className="text-[10px] text-emerald-700">Workflow automation, enterprise reporting, API integration and multi-location administration are delivered through tenant-scoped, entitlement-enforced provider services.</p>
      </section>

      <section id="owner-security" className="scroll-mt-36 rounded-xl border border-slate-300 bg-white p-5 shadow-xs space-y-4">
        <div><p className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-700">Security governance</p><h3 className="text-base font-bold text-slate-950">Platform administrator authority</h3><p className="text-xs text-slate-500">Firebase authenticates the person. PostgreSQL determines their current administrative permissions on every request.</p></div>
        {administratorRegistry?<>
          <div className="overflow-x-auto rounded-lg border"><table className="min-w-full text-left text-[11px]"><thead className="bg-slate-50"><tr><th className="px-3 py-2">Firebase UID</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Permissions</th></tr></thead><tbody>{administratorRegistry.administrators.map((item:any)=><tr key={item.firebaseUid} className="border-t"><td className="px-3 py-2 font-mono">{item.firebaseUid}</td><td className="px-3 py-2">{item.adminType}</td><td className="px-3 py-2">{item.status}</td><td className="px-3 py-2">{item.permissions.join(', ')}</td></tr>)}</tbody></table></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-xl bg-slate-50 p-4">
            <input value={adminForm.firebaseUid} onChange={e=>setAdminForm({...adminForm,firebaseUid:e.target.value})} placeholder="Existing Firebase UID" className="rounded-lg border px-3 py-2 text-xs" />
            <select value={adminForm.status} onChange={e=>setAdminForm({...adminForm,status:e.target.value})} className="rounded-lg border px-3 py-2 text-xs"><option>ACTIVE</option><option>DISABLED</option></select>
            <input value={adminForm.reason} onChange={e=>setAdminForm({...adminForm,reason:e.target.value})} placeholder="Required authority-change reason" className="rounded-lg border px-3 py-2 text-xs" />
            <div className="md:col-span-3 flex flex-wrap gap-3">{['PLATFORM_READ','PROVIDER_ADMIN','COMMERCIAL_ADMIN','COMPLIANCE_ADMIN','SECURITY_ADMIN'].map(permission=><label key={permission} className="text-[10px] font-bold text-slate-600"><input type="checkbox" checked={adminForm.permissions.includes(permission)} onChange={e=>setAdminForm({...adminForm,permissions:e.target.checked?[...adminForm.permissions,permission]:adminForm.permissions.filter(item=>item!==permission)})} className="mr-1"/>{permission}</label>)}</div>
            <button onClick={saveStaffAdministrator} disabled={financialBusy||!adminForm.firebaseUid.trim()||!adminForm.reason.trim()} className="md:col-span-3 rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Save bounded staff authority</button>
          </div>
        </>:<p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Your current administrator session does not include security-administration authority.</p>}
      </section>

      {/* Owner operations: insurance-line and regional rollout oversight. */}
      <div id="owner-rollout" className="scroll-mt-36 bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-slate-900 text-emerald-400"><Globe2 className="w-5 h-5" /></div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-700">Owner operations</p>
              <h3 className="text-base font-bold text-slate-900">Insurance Lines & Regional Rollout</h3>
              <p className="text-xs text-slate-500 mt-1">Product availability is shown separately from state production authorization.</p>
            </div>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold">{insuranceLines.length} lines</span>
            <span className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold">{new Set(jurisdictionLineEntries.map(entry => entry.jurisdictionCode)).size} jurisdictions</span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {insuranceLines.map(line => (
            <div key={line.code} className="rounded-xl border border-slate-200 p-3 bg-slate-50/60">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="text-xs font-bold text-slate-900 truncate">{line.displayName}</span>
                </div>
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                  line.implementationStatus === 'ACCEPTANCE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  line.implementationStatus === 'DEVELOPMENT' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  'bg-slate-100 text-slate-600 border-slate-200'
                }`}>{line.implementationStatus}</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 font-mono">{line.code}</p>
              <p className="text-[10px] text-slate-500 mt-1">
                {jurisdictionLineEntries.filter(entry => entry.insuranceLine === line.code && entry.rolloutAvailable).length} rollout-visible jurisdictions · 0 statically authorized
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
          This console does not activate markets. Production authority remains a separate durable governance decision requiring verified rules, provider authority, and activation gates.
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
      <div id="owner-reviews" className="scroll-mt-36 bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
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
      <div id="owner-audit" className="scroll-mt-36 bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
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
