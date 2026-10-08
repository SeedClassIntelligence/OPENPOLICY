import React, { useState, useEffect } from 'react';
import { 
  Briefcase, 
  ShieldCheck, 
  Send, 
  FileUp, 
  AlertTriangle, 
  CheckCircle2, 
  DollarSign, 
  Car, 
  Calendar,
  Layers,
  ArrowRight,
  Info,
  Building2,
  Users,
  Compass,
  FileText,
  Clock,
  Check,
  X,
  Lock,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  Award,
  Sparkles,
  TrendingDown,
  RotateCcw,
  Zap,
  Radio,
  Plus,
  HelpCircle
} from 'lucide-react';
import { 
  Challenge, 
  Offer, 
  CoverageItem, 
  ProviderOrganization, 
  OpportunityPreview, 
  ProviderLicense, 
  ProviderAppetite, 
  CarrierRelationship, 
  DeclineReason,
  ProviderOfferStatus,
  CompetitionEvaluationSummary,
  BindingHandoff,
  ConsentGrant,
  DisclosureEvent,
  BindingModification,
  ReconciliationReport
} from '../types/insurance';
import { detectQuoteDiscrepancies } from '../domain/policyIntelligence';
import { apiFetch } from '../services/apiClient';

interface ProviderPortalProps {
  challenge: Challenge | null;
  onOfferSubmitted: () => void;
  onNavigateToConsumer: () => void;
}

export const ProviderPortal: React.FC<ProviderPortalProps> = ({
  challenge,
  onOfferSubmitted,
  onNavigateToConsumer
}) => {
  // Navigation tabs in Provider Experience
  const [activeTab, setActiveTab] = useState<'OPPORTUNITIES' | 'MY_COMPETITIONS' | 'WORKSPACE' | 'PROFILE' | 'ACCOUNT'>('OPPORTUNITIES');
  
  // Commercial Economics State (CE-1 through CE-4)
  const [commercialAccount, setCommercialAccount] = useState<any | null>(null);
  const [commercialAgreement, setCommercialAgreement] = useState<any | null>(null);
  const [commercialPlanVersion, setCommercialPlanVersion] = useState<any | null>(null);
  const [commercialPlan, setCommercialPlan] = useState<any | null>(null);
  const [commercialEntitlements, setCommercialEntitlements] = useState<any[]>([]);
  const [commercialEvents, setCommercialEvents] = useState<any[]>([]);
  const [valueSummary, setValueSummary] = useState<any | null>(null);
  const [billableEvents, setBillableEvents] = useState<any[]>([]);
  const [ratingAdjustments, setRatingAdjustments] = useState<any[]>([]);
  const [activitySummary, setActivitySummary] = useState<any | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [billingPeriods, setBillingPeriods] = useState<any[]>([]);
  const [accountBalance, setAccountBalance] = useState<any | null>(null);
  const [commercialLoading, setCommercialLoading] = useState<boolean>(false);
  
  // Multi-Tenant Provider User & Organization state (Blocker 2 & 3 Fix)
  // Identity derives from authenticated ProviderUser session:
  // Session -> ProviderUser -> ProviderUser.organizationId -> ProviderOrganization
  const DEMO_PROVIDER_USERS = [
    { userId: 'user_sierra_1', userName: 'Alex Morgan', userRole: 'AGENT', orgId: 'org_sierra', orgName: 'Sierra Brokerage Group (NV Auto)' },
    { userId: 'user_apex_1', userName: 'Sarah Jenkins', userRole: 'AGENT', orgId: 'org_apex', orgName: 'Apex Insurance Services (NV Auto)' },
    { userId: 'user_buckeye_1', userName: 'Dave Miller', userRole: 'AGENT', orgId: 'org_buckeye', orgName: 'Buckeye State Insurance (OH Auto)' }
  ];

  const [authenticatedUserId, setAuthenticatedUserId] = useState<string>('user_sierra_1');
  const [activeOrg, setActiveOrg] = useState<ProviderOrganization | null>(null);
  const [activeUser, setActiveUser] = useState<any | null>(null);
  const [licenses, setLicenses] = useState<ProviderLicense[]>([]);
  const [appetite, setAppetite] = useState<ProviderAppetite | null>(null);
  const [carriers, setCarriers] = useState<CarrierRelationship[]>([]);
  
  // Opportunities & Competitions state
  const [opportunities, setOpportunities] = useState<OpportunityPreview[]>([]);
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [selectedChallengeId, setSelectedChallengeId] = useState<string>('CHAL-NV-49281');
  const [workspaceData, setWorkspaceData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Decline Dialog state
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [decliningInvitationId, setDecliningInvitationId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState<DeclineReason>('OUTSIDE_APPETITE');
  const [declineNotes, setDeclineNotes] = useState('');

  // Provider Form State for Quoting Workbench
  const [carrier, setCarrier] = useState('Travelers Property Casualty');
  const [quoteNumber, setQuoteNumber] = useState('TRV-QUOTE-2026-91');
  const [annualPremium, setAnnualPremium] = useState<number>(2380);
  const [collisionDeductible, setCollisionDeductible] = useState<number>(500);
  const [compDeductible, setCompDeductible] = useState<number>(250);
  const [propertyLimit, setPropertyLimit] = useState<number>(100000);
  const [bodilyPerson, setBodilyPerson] = useState<number>(100000);
  const [bodilyAccident, setBodilyAccident] = useState<number>(300000);
  const [rentalIncluded, setRentalIncluded] = useState<boolean>(true);
  const [roadsideIncluded, setRoadsideIncluded] = useState<boolean>(true);
  const [quoteFileName, setQuoteFileName] = useState('Travelers_Official_Rate_91.pdf');

  // Discrepancy simulation toggle
  const [simulateQuoteDiscrepancy, setSimulateQuoteDiscrepancy] = useState<boolean>(false);
  const [discrepancyWarning, setDiscrepancyWarning] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  // PM-2: Multi-Carrier & Competition State
  const [tierLabel, setTierLabel] = useState<string>('Primary Baseline Match');
  const [offerStatus, setOfferStatus] = useState<ProviderOfferStatus | null>(null);
  const [competitionEvaluation, setCompetitionEvaluation] = useState<CompetitionEvaluationSummary | null>(null);
  
  // PM-2: Revision Modal State
  const [reviseModalOpen, setReviseModalOpen] = useState(false);
  const [revisingOffer, setRevisingOffer] = useState<Offer | null>(null);
  const [revisedPremium, setRevisedPremium] = useState<number>(2300);
  const [revisionReason, setRevisionReason] = useState<'DATA_CORRECTION' | 'DOCUMENT_UPDATED' | 'PROVIDER_UPDATED_QUOTE'>('PROVIDER_UPDATED_QUOTE');
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const [revisionLoading, setRevisionLoading] = useState(false);

  // PM-4 Binding & Disclosure State
  const [bindingHandoff, setBindingHandoff] = useState<BindingHandoff | null>(null);
  const [bindingConsent, setBindingConsent] = useState<ConsentGrant | null>(null);
  const [disclosureEvent, setDisclosureEvent] = useState<DisclosureEvent | null>(null);
  const [disclosedData, setDisclosedData] = useState<Record<string, any> | null>(null);
  const [bindingModifications, setBindingModifications] = useState<BindingModification[]>([]);
  const [isExecutingDisclosure, setIsExecutingDisclosure] = useState<boolean>(false);
  const [showProposeModModal, setShowProposeModModal] = useState<boolean>(false);
  const [modPremium, setModPremium] = useState<string>('');
  const [modReason, setModReason] = useState<string>('');
  const [showBoundModal, setShowBoundModal] = useState<boolean>(false);
  const [boundPolicyNumber, setBoundPolicyNumber] = useState<string>('');
  const [bindingActionError, setBindingActionError] = useState<string | null>(null);

  // PM-5: Issued Policy Reconciliation State
  const [pm5Report, setPm5Report] = useState<ReconciliationReport | null>(null);
  const [showUploadIssuedModal, setShowUploadIssuedModal] = useState<boolean>(false);
  const [issuedDocFileName, setIssuedDocFileName] = useState<string>('Declarations_Page_Issued.pdf');
  const [issuedPolicyNum, setIssuedPolicyNum] = useState<string>('');
  const [issuedAnnualPremium, setIssuedAnnualPremium] = useState<string>('');
  const [issuedDocRawContent, setIssuedDocRawContent] = useState<string>('CARRIER-ISSUED-DECLARATIONS-DOCUMENT-EVIDENCE-STREAM');
  const [isReconciling, setIsReconciling] = useState<boolean>(false);

  // PM-3: Multi-Dimensional Revision State
  const [revisedCollisionDed, setRevisedCollisionDed] = useState<number>(500);
  const [revisedCompDed, setRevisedCompDed] = useState<number>(250);
  const [revisedRental, setRevisedRental] = useState<boolean>(true);
  const [revisedRoadside, setRevisedRoadside] = useState<boolean>(true);

  // PM-3: Withdrawal Modal State
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState<string>('OUTSIDE_APPETITE');
  const [withdrawNotes, setWithdrawNotes] = useState<string>('');

  // PM-2: Information Requests & Reusable Supplemental Facts
  const [infoRequests, setInfoRequests] = useState<any[]>([]);
  const [supplementalFacts, setSupplementalFacts] = useState<any[]>([]);
  const [showInfoRequestModal, setShowInfoRequestModal] = useState<boolean>(false);
  const [requestedField, setRequestedField] = useState<string>('ANNUAL_MILEAGE');
  const [customFieldName, setCustomFieldName] = useState<string>('');
  const [requestPurpose, setRequestPurpose] = useState<string>('RATING_DISCOUNT');
  const [requestExplanation, setRequestExplanation] = useState<string>('Verifying annual commute distance to apply tier rating discounts.');
  const [infoRequestSubmitting, setInfoRequestSubmitting] = useState<boolean>(false);
  const [infoRequestToast, setInfoRequestToast] = useState<string | null>(null);

  const handleCreateInformationRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChallengeId) return;
    setInfoRequestSubmitting(true);
    try {
      const res = await apiFetch(`/api/marketplace/challenges/${selectedChallengeId}/information-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-provider-user-id': authenticatedUserId
        },
        body: JSON.stringify({
          requestedField,
          customFieldName: requestedField === 'CUSTOM' ? customFieldName : undefined,
          purpose: requestPurpose,
          purposeExplanation: requestExplanation
        })
      });
      if (res.ok) {
        setShowInfoRequestModal(false);
        setInfoRequestToast('Information request submitted to consumer. Notification delivered.');
        setTimeout(() => setInfoRequestToast(null), 3500);
        await loadWorkspace(selectedChallengeId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setInfoRequestSubmitting(false);
    }
  };

  // Load Marketplace state using authenticated provider user session
  const loadMarketplaceData = async (targetUserId?: string) => {
    setLoading(true);
    const userIdToUse = targetUserId || authenticatedUserId;
    const authHeaders = { 'x-provider-user-id': userIdToUse };
    try {
      // 1. Fetch authenticated provider info derived server-side
      const activeRes = await apiFetch('/api/marketplace/my-provider', {
        headers: authHeaders
      });
      if (activeRes.ok) {
        const activeData = await activeRes.json();
        setActiveOrg(activeData.org);
        setActiveUser(activeData.user || null);
        setLicenses(activeData.licenses || []);
        setAppetite(activeData.appetite || null);
        setCarriers(activeData.carriers || []);
      }

      // 2. Fetch opportunities for authenticated provider organization
      const oppRes = await apiFetch('/api/marketplace/opportunities', {
        headers: authHeaders
      });
      if (oppRes.ok) {
        const oppData = await oppRes.json();
        setOpportunities(Array.isArray(oppData) ? oppData : []);
      }

      // 3. Fetch competitions for authenticated provider organization
      const compRes = await apiFetch('/api/marketplace/competitions', {
        headers: authHeaders
      });
      if (compRes.ok) {
        const compData = await compRes.json();
        setCompetitions(Array.isArray(compData) ? compData : []);

        // If org has active competitions, load workspace
        if (compData && compData.length > 0) {
          const targetChalId = compData[0].challenge.id;
          setSelectedChallengeId(targetChalId);
          loadWorkspace(targetChalId, userIdToUse);
        } else {
          setWorkspaceData(null);
        }
      }
      // 4. Fetch commercial economics data for authenticated organization
      await loadCommercialData(userIdToUse);
    } catch (e) {
      console.error('Failed loading provider marketplace data:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadCommercialData = async (targetUserId?: string) => {
    setCommercialLoading(true);
    const userIdToUse = targetUserId || authenticatedUserId;
    const authHeaders = { 'x-provider-user-id': userIdToUse };
    try {
      const [accRes, agrRes, entRes, evtRes, valRes, bilRes, adjRes, sumRes, invRes, bpRes, balRes] = await Promise.all([
        apiFetch('/api/commercial/account', { headers: authHeaders }),
        apiFetch('/api/commercial/agreement', { headers: authHeaders }),
        apiFetch('/api/commercial/entitlements', { headers: authHeaders }),
        apiFetch('/api/commercial/events', { headers: authHeaders }),
        apiFetch('/api/commercial/value-summary', { headers: authHeaders }),
        apiFetch('/api/commercial/billable-events', { headers: authHeaders }),
        apiFetch('/api/commercial/adjustments', { headers: authHeaders }),
        apiFetch('/api/commercial/billable-events/summary', { headers: authHeaders }),
        apiFetch('/api/commercial/invoices', { headers: authHeaders }),
        apiFetch('/api/commercial/billing-periods', { headers: authHeaders }),
        apiFetch('/api/commercial/statements/balance', { headers: authHeaders })
      ]);

      if (accRes.ok) {
        const d = await accRes.json();
        setCommercialAccount(d.account);
      }
      if (agrRes.ok) {
        const d = await agrRes.json();
        setCommercialAgreement(d.agreement);
        setCommercialPlanVersion(d.planVersion);
        setCommercialPlan(d.plan);
      }
      if (entRes.ok) {
        const d = await entRes.json();
        setCommercialEntitlements(d.entitlements || []);
      }
      if (evtRes.ok) {
        const d = await evtRes.json();
        setCommercialEvents(d.events || []);
      }
      if (valRes.ok) {
        const d = await valRes.json();
        setValueSummary(d.valueSummary);
      }
      if (bilRes.ok) {
        const d = await bilRes.json();
        setBillableEvents(d.billableEvents || []);
      }
      if (adjRes.ok) {
        const d = await adjRes.json();
        setRatingAdjustments(d.adjustments || []);
      }
      if (sumRes.ok) {
        const d = await sumRes.json();
        setActivitySummary(d.summary || null);
      }
      if (invRes.ok) {
        const d = await invRes.json();
        setInvoices(d.invoices || []);
      }
      if (bpRes.ok) {
        const d = await bpRes.json();
        setBillingPeriods(d.billingPeriods || []);
      }
      if (balRes.ok) {
        const d = await balRes.json();
        setAccountBalance(d.balance || null);
      }
    } catch (err) {
      console.warn('Commercial data load error:', err);
    } finally {
      setCommercialLoading(false);
    }
  };

  const loadWorkspace = async (challengeId: string, targetUserId?: string) => {
    const userIdToUse = targetUserId || authenticatedUserId;
    const authHeaders = { 'x-provider-user-id': userIdToUse };
    try {
      const res = await apiFetch(`/api/marketplace/workspace/${challengeId}`, {
        headers: authHeaders
      });
      if (res.ok) {
        const data = await res.json();
        setWorkspaceData(data);
        if (data.informationRequests) {
          setInfoRequests(data.informationRequests);
        }
        if (data.supplementalFacts) {
          setSupplementalFacts(data.supplementalFacts);
        }
        if (data.carriers && data.carriers.length > 0) {
          setCarriers(data.carriers);
        }
      } else {
        setWorkspaceData(null);
      }

      // Fetch the provider's own offer status and the authorized workspace evaluation
      try {
        const [signalsRes, evalRes] = await Promise.all([
          apiFetch(`/api/marketplace/competition/${challengeId}/offer-status`, {
            headers: authHeaders
          }),
          apiFetch(`/api/marketplace/competition/${challengeId}/status`)
        ]);
        if (signalsRes.ok) {
          const sig = await signalsRes.json();
          setOfferStatus(sig);
        }
        if (evalRes.ok) {
          const ev = await evalRes.json();
          setCompetitionEvaluation(ev);
        }
      } catch (err) {
        // non-blocking
      }

      // Fetch PM-4 selection and binding data
      try {
        const bindRes = await apiFetch(`/api/marketplace/challenges/${challengeId}/selection-binding`);
        if (bindRes.ok) {
          const bindData = await bindRes.json();
          if (bindData.handoff) {
            setBindingHandoff(bindData.handoff);
            setBindingConsent(bindData.consentGrants?.[0] || null);
            setDisclosureEvent(bindData.disclosureEvents?.[0] || null);
            setBindingModifications(bindData.modifications || []);
            // PM-5 Reconciliation Fetch
            try {
              const recRes = await apiFetch(`/api/marketplace/binding/${bindData.handoff.id}/reconciliation`);
              if (recRes.ok) {
                const recData = await recRes.json();
                setPm5Report(recData.latestReport || null);
              }
            } catch {
              // non-blocking
            }
          } else {
            setBindingHandoff(null);
            setBindingConsent(null);
            setDisclosureEvent(null);
            setBindingModifications([]);
            setPm5Report(null);
          }
        }
      } catch (err) {
        console.error('Failed fetching binding data:', err);
      }
    } catch (e) {
      console.error('Failed loading workspace:', e);
      setWorkspaceData(null);
    }
  };

  // PM-4 Binding Handlers
  const handleExecuteDisclosure = async () => {
    if (!bindingHandoff || !bindingConsent) return;
    setIsExecutingDisclosure(true);
    setBindingActionError(null);
    try {
      const res = await apiFetch(`/api/marketplace/binding/${bindingHandoff.id}/execute-disclosure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-provider-user-id': authenticatedUserId
        },
        body: JSON.stringify({
          consentGrantId: bindingConsent.id,
          recipientAgentName: activeUser?.name || 'Authorized Producer'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDisclosureEvent(data.disclosureEvent);
        setDisclosedData(data.disclosedData);
        setBindingHandoff(data.handoff);
      } else {
        setBindingActionError(data.error || 'Failed to execute controlled disclosure');
      }
    } catch (e: any) {
      setBindingActionError(e.message || 'Error executing disclosure');
    } finally {
      setIsExecutingDisclosure(false);
    }
  };

  const handleProposeModification = async () => {
    if (!bindingHandoff) return;
    if (!modPremium || isNaN(Number(modPremium))) {
      setBindingActionError('Valid annual premium is required');
      return;
    }
    if (!modReason.trim()) {
      setBindingActionError('Underwriting reason is required');
      return;
    }
    setActionLoading('propose_mod');
    setBindingActionError(null);
    try {
      const res = await apiFetch(`/api/marketplace/binding/${bindingHandoff.id}/propose-modification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-provider-user-id': authenticatedUserId
        },
        body: JSON.stringify({
          modifiedAnnualPremium: Number(modPremium),
          underwritingReason: modReason
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBindingHandoff(data.handoff);
        setBindingModifications(prev => [data.modification, ...prev]);
        setShowProposeModModal(false);
        setModPremium('');
        setModReason('');
      } else {
        setBindingActionError(data.error || 'Failed to propose modification');
      }
    } catch (e: any) {
      setBindingActionError(e.message || 'Error proposing modification');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateBindingStatus = async (newStatus: any, policyNum?: string) => {
    if (!bindingHandoff) return;
    setActionLoading(`status_${newStatus}`);
    setBindingActionError(null);
    try {
      const res = await apiFetch(`/api/marketplace/binding/${bindingHandoff.id}/update-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-provider-user-id': authenticatedUserId
        },
        body: JSON.stringify({
          newStatus,
          policyNumber: policyNum
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBindingHandoff(data.handoff);
        setShowBoundModal(false);
        setBoundPolicyNumber('');
      } else {
        setBindingActionError(data.error || `Failed to transition status to ${newStatus}`);
      }
    } catch (e: any) {
      setBindingActionError(e.message || `Error updating status to ${newStatus}`);
    } finally {
      setActionLoading(null);
    }
  };

  // PM-5: Upload Issued Declarations & Execute Reconciliation
  const handleUploadAndReconcile = async () => {
    if (!bindingHandoff) return;
    setIsReconciling(true);
    setBindingActionError(null);
    try {
      // 1. Upload Document Evidence
      const uploadRes = await apiFetch(`/api/marketplace/binding/${bindingHandoff.id}/upload-issued-policy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-provider-user-id': authenticatedUserId
        },
        body: JSON.stringify({
          fileName: issuedDocFileName,
          rawContent: issuedDocRawContent,
          extractedTerms: {
            carrier: bindingHandoff.carrier,
            policyNumber: issuedPolicyNum || bindingHandoff.policyNumber || 'POL-ISSUED-8829',
            annualPremium: Number(issuedAnnualPremium) || (workspaceData?.offers?.[0]?.annualPremium ?? 2400),
            effectiveDate: '2026-10-01',
            expirationDate: '2027-10-01',
            coverages: workspaceData?.offers?.[0]?.coverages || []
          }
        })
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadData.error || 'Failed to upload issued policy declarations document');
      }

      // 2. Deterministic Reconciliation
      const recRes = await apiFetch(`/api/marketplace/binding/${bindingHandoff.id}/reconcile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-provider-user-id': authenticatedUserId
        },
        body: JSON.stringify({})
      });
      const recData = await recRes.json();
      if (!recRes.ok) {
        throw new Error(recData.error || 'Reconciliation failed');
      }

      setPm5Report(recData.report);
      setShowUploadIssuedModal(false);
    } catch (e: any) {
      setBindingActionError(e.message || 'Error executing issued policy reconciliation');
    } finally {
      setIsReconciling(false);
    }
  };

  // Open Revision Modal with Multi-Dimensional Coverage Defaults
  const handleOpenReviseModal = (offer: Offer) => {
    setRevisingOffer(offer);
    setRevisedPremium(offer.annualPremium - 50);
    const colCov = offer.coverages?.find(c => c.code === 'COLLISION');
    const compCov = offer.coverages?.find(c => c.code === 'COMPREHENSIVE');
    const rentalCov = offer.coverages?.find(c => c.code === 'RENTAL_REIMBURSEMENT');
    const roadCov = offer.coverages?.find(c => c.code === 'ROADSIDE_ASSISTANCE');
    setRevisedCollisionDed(colCov?.deductible !== undefined ? colCov.deductible : 500);
    setRevisedCompDed(compCov?.deductible !== undefined ? compCov.deductible : 250);
    setRevisedRental(rentalCov?.isIncluded ?? true);
    setRevisedRoadside(roadCov?.isIncluded ?? true);
    setRevisionReason('PROVIDER_UPDATED_QUOTE');
    setRevisionError(null);
    setReviseModalOpen(true);
  };

  // Submit Revised Offer (PM-3 Section 40 Multi-Dimensional Improvement)
  const handleConfirmRevise = async () => {
    if (!revisingOffer || !workspaceData?.challenge?.id) return;
    if (revisedPremium <= 0) {
      setRevisionError('Revised annual premium must be greater than zero.');
      return;
    }
    setRevisionLoading(true);
    setRevisionError(null);
    try {
      const updatedCoverages = revisingOffer.coverages?.map(c => {
        if (c.code === 'COLLISION') return { ...c, deductible: revisedCollisionDed };
        if (c.code === 'COMPREHENSIVE') return { ...c, deductible: revisedCompDed };
        if (c.code === 'RENTAL_REIMBURSEMENT') return { ...c, isIncluded: revisedRental };
        if (c.code === 'ROADSIDE_ASSISTANCE') return { ...c, isIncluded: revisedRoadside };
        return c;
      }) || [];

      const res = await apiFetch(`/api/marketplace/competition/${workspaceData.challenge.id}/revise-offer/${revisingOffer.id}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-provider-user-id': authenticatedUserId
        },
        body: JSON.stringify({
          revisedData: {
            carrier: revisingOffer.carrier,
            annualPremium: Number(revisedPremium),
            monthlyPremium: Math.round(Number(revisedPremium) / 12),
            tierLabel: `${revisingOffer.tierLabel || 'Offer'} (Updated)`,
            coverages: updatedCoverages,
            revisionReason
          }
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setRevisionError(data.error || 'Failed to submit revision');
      } else {
        setReviseModalOpen(false);
        setRevisingOffer(null);
        await loadWorkspace(workspaceData.challenge.id);
        await loadMarketplaceData();
        onOfferSubmitted();
      }
    } catch (e: any) {
      setRevisionError(e.message || 'Network error submitting revision');
    } finally {
      setRevisionLoading(false);
    }
  };

  // Keep Current Offer (PM-3)
  const handleKeepCurrentOffer = async (offerId: string) => {
    if (!workspaceData?.challenge?.id) return;
    setActionLoading(`keep-${offerId}`);
    try {
      const res = await apiFetch(`/api/marketplace/competition/${workspaceData.challenge.id}/keep-current-offer/${offerId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-provider-user-id': authenticatedUserId
        }
      });
      if (res.ok) {
        await loadWorkspace(workspaceData.challenge.id);
        await loadMarketplaceData();
      }
    } catch (e) {
      console.error('Failed keeping current offer:', e);
    } finally {
      setActionLoading(null);
    }
  };

  // Provider Withdrawal (PM-3)
  const handleConfirmWithdraw = async () => {
    if (!workspaceData?.challenge?.id) return;
    setActionLoading('withdraw');
    try {
      const res = await apiFetch(`/api/marketplace/competition/${workspaceData.challenge.id}/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-provider-user-id': authenticatedUserId
        },
        body: JSON.stringify({
          reason: withdrawReason,
          notes: withdrawNotes
        })
      });
      if (res.ok) {
        setWithdrawModalOpen(false);
        await loadMarketplaceData();
      }
    } catch (e) {
      console.error('Failed withdrawing from competition:', e);
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    loadMarketplaceData();
  }, []);

  // Switch Authenticated Provider User Persona
  const handleSwitchUser = async (newUserId: string) => {
    setActionLoading('switch');
    try {
      setAuthenticatedUserId(newUserId);
      await loadMarketplaceData(newUserId);
    } catch (e) {
      console.error('Failed switching provider user:', e);
    } finally {
      setActionLoading(null);
    }
  };

  // Accept Opportunity
  const handleAcceptOpportunity = async (invitationId: string) => {
    setActionLoading(invitationId);
    try {
      const res = await apiFetch(`/api/marketplace/invitations/${invitationId}/accept`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-provider-user-id': authenticatedUserId
        }
      });
      if (res.ok) {
        await loadMarketplaceData();
        setActiveTab('MY_COMPETITIONS');
      }
    } catch (e) {
      console.error('Failed accepting opportunity:', e);
    } finally {
      setActionLoading(null);
    }
  };

  // Open Decline Modal
  const openDeclineModal = (invitationId: string) => {
    setDecliningInvitationId(invitationId);
    setDeclineModalOpen(true);
  };

  // Submit Decline
  const handleConfirmDecline = async () => {
    if (!decliningInvitationId) return;
    setActionLoading(decliningInvitationId);
    try {
      await apiFetch(`/api/marketplace/invitations/${decliningInvitationId}/decline`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-provider-user-id': authenticatedUserId
        },
        body: JSON.stringify({
          reason: declineReason,
          notes: declineNotes
        })
      });
      setDeclineModalOpen(false);
      setDecliningInvitationId(null);
      setDeclineNotes('');
      await loadMarketplaceData();
    } catch (e) {
      console.error('Failed declining opportunity:', e);
    } finally {
      setActionLoading(null);
    }
  };

  // Validate discrepancies against quote document
  const handleValidateDiscrepancy = () => {
    const docData = simulateQuoteDiscrepancy ? {
      extractedCollisionDeductible: 1000,
      extractedCompDeductible: 500,
      extractedAnnualPremium: annualPremium,
      extractedRentalIncluded: false
    } : {
      extractedCollisionDeductible: collisionDeductible,
      extractedCompDeductible: compDeductible,
      extractedAnnualPremium: annualPremium,
      extractedRentalIncluded: rentalIncluded
    };

    const result = detectQuoteDiscrepancies(
      {
        carrier,
        annualPremium,
        collisionDeductible,
        compDeductible,
        rentalIncluded
      },
      docData
    );

    setDiscrepancyWarning(result.discrepancies);
    return result;
  };

  // Submit Offer
  const handleSubmitOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceData?.challenge) return;

    setIsSubmitting(true);
    const discResult = handleValidateDiscrepancy();

    const offerCoverages: CoverageItem[] = [
      {
        id: `COV-OFR-1`,
        code: 'BODILY_INJURY',
        name: 'Bodily Injury Liability',
        category: 'LIABILITY',
        perPersonLimit: bodilyPerson,
        perAccidentLimit: bodilyAccident,
        isIncluded: true
      },
      {
        id: `COV-OFR-2`,
        code: 'PROPERTY_DAMAGE',
        name: 'Property Damage Liability',
        category: 'LIABILITY',
        propertyLimit,
        isIncluded: true
      },
      {
        id: `COV-OFR-3`,
        code: 'UM_UIM',
        name: 'Uninsured/Underinsured Motorist',
        category: 'LIABILITY',
        perPersonLimit: bodilyPerson,
        perAccidentLimit: bodilyAccident,
        isIncluded: true
      },
      {
        id: `COV-OFR-4`,
        code: 'COLLISION',
        name: 'Collision Coverage',
        category: 'PHYSICAL_DAMAGE',
        deductible: collisionDeductible,
        isIncluded: true
      },
      {
        id: `COV-OFR-5`,
        code: 'COMPREHENSIVE',
        name: 'Comprehensive Coverage',
        category: 'PHYSICAL_DAMAGE',
        deductible: compDeductible,
        isIncluded: true
      },
      {
        id: `COV-OFR-6`,
        code: 'RENTAL_REIMBURSEMENT',
        name: 'Rental Reimbursement',
        category: 'ADDITIONAL',
        isIncluded: rentalIncluded
      },
      {
        id: `COV-OFR-7`,
        code: 'ROADSIDE_ASSISTANCE',
        name: 'Roadside Assistance',
        category: 'ADDITIONAL',
        isIncluded: roadsideIncluded
      }
    ];

    const activeLicNumber = licenses[0]?.licenseNumber || 'NV-LIC-902188';

    const newOffer: Offer = {
      id: `OFFER-${Date.now()}`,
      challengeId: workspaceData.challenge.id,
      providerId: activeOrg?.id || '',
      providerName: activeOrg?.displayName || '',
      providerLicense: activeLicNumber,
      carrier,
      quoteNumber,
      annualPremium: Number(annualPremium),
      monthlyPremium: Math.round(Number(annualPremium) / 12),
      termMonths: 12,
      effectiveDate: workspaceData.baseline?.effectiveDate || '2026-11-18',
      expirationDate: workspaceData.baseline?.expirationDate || '2027-11-18',
      supportingQuoteDocName: quoteFileName,
      submittedAt: new Date().toISOString(),
      discrepanciesDetected: discResult.hasDiscrepancy,
      discrepancyDetails: discResult.discrepancies,
      status: discResult.hasDiscrepancy ? 'DISCREPANCY_FLAGGED' : 'VALIDATED',
      round: workspaceData.competition?.currentRound || 'ROUND_1_OPEN',
      version: 1,
      isLatestRevision: true,
      tierLabel: tierLabel || 'Primary Baseline Match',
      carrierAppointmentId: carriers.find(c => c.carrierName.toLowerCase().includes(carrier.toLowerCase()))?.id,
      coverages: offerCoverages
    };

    try {
      const response = await apiFetch('/api/offers/submit', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-provider-user-id': authenticatedUserId
        },
        body: JSON.stringify(newOffer)
      });

      if (response.ok) {
        setSubmissionSuccess(true);
        onOfferSubmitted();
        await loadWorkspace(workspaceData.challenge.id);
        setTimeout(() => setSubmissionSuccess(false), 5000);
      }
    } catch (error) {
      console.error('Failed to submit offer:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const monthlyCalc = Math.round(annualPremium / 12);
  const baselinePremium = workspaceData?.baseline?.baselineAnnualPremium || 2964;
  const annualSavings = baselinePremium - annualPremium;

  return (
    <div className="space-y-6">
      {/* 1. Multi-Tenant Provider Organization Switcher Bar */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="h-11 w-11 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono uppercase tracking-wider text-blue-400 font-semibold">
                  Provider Organization Persona
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium">
                  Multi-Tenant Routing
                </span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight mt-0.5">
                {activeOrg?.displayName || 'Loading Provider...'}
              </h2>
              <p className="text-xs text-slate-400">
                {activeOrg?.legalName || 'Licensed Provider'} • {activeOrg?.organizationType ? activeOrg.organizationType.replace('_', ' ') : 'INDEPENDENT AGENCY'} • ID: {activeOrg?.id || 'org_sierra'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-1.5 flex items-center space-x-1.5">
              <span className="text-xs text-slate-400 pl-2 pr-1 font-medium">Authenticated User:</span>
              <select
                aria-label="Switch Authenticated Provider User"
                value={authenticatedUserId}
                onChange={(e) => handleSwitchUser(e.target.value)}
                disabled={actionLoading === 'switch'}
                className="bg-slate-950 text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 focus:outline-hidden focus:border-blue-500"
              >
                {DEMO_PROVIDER_USERS.map(u => (
                  <option key={u.userId} value={u.userId}>
                    {u.userName} ({u.orgName})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => loadMarketplaceData()}
              disabled={loading}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700/60 text-xs flex items-center gap-1.5 transition-colors"
              title="Refresh Provider Account"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Status badges */}
        <div className="mt-4 pt-3 border-t border-slate-800/70 flex flex-wrap items-center justify-between text-xs gap-3">
          <div className="flex items-center space-x-4">
            <span className="text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Account status: <strong className="text-slate-200">{activeOrg?.marketplaceStatus}</strong>
            </span>
            <span className="text-slate-400 flex items-center gap-1.5">
              <Compass className="h-4 w-4 text-blue-400" />
              Licensed States: <strong className="text-slate-200">{activeOrg?.states.join(', ') || 'None'}</strong>
            </span>
            <span className="text-slate-400 flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-purple-400" />
              Appetite LOB: <strong className="text-slate-200">{appetite?.linesOfBusiness.join(', ') || 'PERSONAL_AUTO'}</strong>
            </span>
          </div>

          <span className="text-slate-500 text-[11px]">
            Zero Consumer PII Disclosed Prior to Binding
          </span>
        </div>
      </div>

      {/* 2. Provider Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('OPPORTUNITIES')}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'OPPORTUNITIES'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Briefcase className="h-4 w-4" />
          Opportunities
          {opportunities.length > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 font-bold">
              {opportunities.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('MY_COMPETITIONS')}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'MY_COMPETITIONS'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="h-4 w-4" />
          My Offer Reviews
          {competitions.length > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-700 font-bold">
              {competitions.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('WORKSPACE')}
          disabled={!workspaceData}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            !workspaceData
              ? 'border-transparent text-slate-300 cursor-not-allowed'
              : activeTab === 'WORKSPACE'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="h-4 w-4" />
          Provider Offer Workspace
          {workspaceData && (
            <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700 font-bold">
              Active
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('PROFILE')}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'PROFILE'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="h-4 w-4" />
          Appetite & Licensing
        </button>

        <button
          onClick={() => {
            setActiveTab('ACCOUNT');
            loadCommercialData();
          }}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'ACCOUNT'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <DollarSign className="h-4 w-4" />
          Commercial & Membership
        </button>
      </div>

      {/* 3. Tab Contents */}

      {/* TAB 1: OPPORTUNITIES (Section 12: Opportunity Distribution & Preview) */}
      {activeTab === 'OPPORTUNITIES' && (
        <div className="space-y-4">
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-4 flex items-start space-x-3 text-xs text-blue-900">
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold block text-sm mb-0.5">
                Stage 0 & 1: Privacy-Preserving Opportunity Distribution
              </strong>
              Opportunities are shared policies made available to this provider based on
              matching jurisdiction licensing, active appetite, and line of business. Prior to acceptance,
              zero consumer direct contact information is revealed.
            </div>
          </div>

          {opportunities.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Briefcase className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                No Pending Opportunities for {activeOrg?.displayName}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {activeOrg?.id === 'org_buckeye'
                  ? 'Buckeye State Insurance is configured for Ohio only. Shared policy #NV-49281 is from Nevada, so it was not made available to this provider.'
                  : 'You have reviewed or accepted all open opportunities matching your configured appetite.'}
              </p>
              {activeOrg?.id === 'org_buckeye' && (
                <div className="inline-block bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-medium">
                  Eligibility Filter: JURISDICTION_MISMATCH (NV vs OH)
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {opportunities.map((opp) => (
                <div 
                  key={opp.invitationId}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all p-6 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-xs font-bold bg-blue-100 text-blue-800 px-2.5 py-1 rounded-md border border-blue-200">
                        {opp.referenceNumber}
                      </span>
                      <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md">
                        {opp.market}
                      </span>
                      <span className="text-xs text-slate-500">
                        Renewal in <strong className="text-slate-800">{opp.renewalDaysRemaining} days</strong>
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-xs text-slate-500">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span>Initial offer window closes in 48 hours</span>
                    </div>
                  </div>

                  {/* Stage 1 Anonymized Ratings Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl text-xs">
                    <div>
                      <span className="text-slate-400 uppercase block font-semibold text-[10px]">Current Annual Premium</span>
                      <span className="text-base font-bold text-slate-900">
                        ${opp.currentAnnualPremium.toLocaleString()}/yr
                      </span>
                      <span className="text-slate-500 block">(${opp.currentMonthlyPremium}/mo)</span>
                    </div>

                    <div>
                      <span className="text-slate-400 uppercase block font-semibold text-[10px]">Risk Vehicle</span>
                      <span className="font-bold text-slate-800 block text-xs">
                        {opp.vehicleSummary}
                      </span>
                      <span className="text-slate-500 text-[11px]">Primary Commute</span>
                    </div>

                    <div>
                      <span className="text-slate-400 uppercase block font-semibold text-[10px]">Protection Baseline</span>
                      <span className="font-semibold text-slate-800 block text-xs">
                        100k/300k BI • $100k PD
                      </span>
                      <span className="text-slate-500 text-[11px]">$500 Coll • $250 Comp</span>
                    </div>

                    <div>
                      <span className="text-slate-400 uppercase block font-semibold text-[10px]">Provider Interest</span>
                      <span className="font-bold text-blue-700 block text-xs">
                        {opp.invitedProvidersCount} Invited • {opp.participatingProvidersCount} Active
                      </span>
                      <span className="text-slate-500 text-[11px]">Sealed Blind Quoting</span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 bg-emerald-50/60 border border-emerald-200/60 p-3 rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>
                      <strong>Consumer Objective:</strong> {opp.consumerRequirementsSummary}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <div className="flex items-center space-x-2 text-xs text-slate-400">
                      <Lock className="h-3.5 w-3.5 text-slate-400" />
                      <span>Invitation Status: <strong className="text-slate-700">{opp.invitationStatus}</strong></span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => openDeclineModal(opp.invitationId)}
                        disabled={actionLoading === opp.invitationId}
                        className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                      >
                        <X className="h-3.5 w-3.5 text-slate-500" />
                        Decline Opportunity
                      </button>

                      <button
                        onClick={() => handleAcceptOpportunity(opp.invitationId)}
                        disabled={actionLoading === opp.invitationId}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
                      >
                        {actionLoading === opp.invitationId ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Accept & Review Policy
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MY COMPETITIONS (Section 13) */}
      {activeTab === 'MY_COMPETITIONS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Active Policy Reviews for {activeOrg?.displayName}
            </h3>
            <span className="text-xs text-slate-500">
              {competitions.length} Active Reviews
            </span>
          </div>

          {competitions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Clock className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">No Active Policy Reviews</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Accept an opportunity to review shared policy details and decide whether to submit an offer.
              </p>
              <button
                onClick={() => setActiveTab('OPPORTUNITIES')}
                className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
              >
                View Pending Opportunities <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {competitions.map((c) => (
                <div
                  key={c.participation.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 hover:border-blue-300 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                          {c.challenge.referenceNumber}
                        </span>
                        <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-semibold">
                          STAGE: {c.competition.currentRound.replace(/ROUND_[0-9]_?/g, '').replace(/_/g, ' ')}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-slate-900 mt-1">
                        {c.challenge.baseline?.vehicle ? `${c.challenge.baseline.vehicle.year} ${c.challenge.baseline.vehicle.make} ${c.challenge.baseline.vehicle.model}` : 'Personal Auto Policy'}
                      </h4>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <span className="text-xs text-slate-400 block font-medium">Your Quotes</span>
                        <strong className="text-sm text-slate-900 font-bold">{c.offersCount} Submitted</strong>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedChallengeId(c.challenge.id);
                          loadWorkspace(c.challenge.id);
                          setActiveTab('WORKSPACE');
                        }}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        Enter Workspace <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Current Annual Premium</span>
                      <span className="font-bold text-slate-800">${c.challenge.baseline?.baselineAnnualPremium}/yr</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Territory</span>
                      <span className="font-semibold text-slate-800">{c.challenge.jurisdiction} (NV-89101)</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Participation Started</span>
                      <span className="text-slate-700">{new Date(c.participation.acceptedAt).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Provider Interest</span>
                      <span className="text-slate-700">Independent sealed submissions</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CHALLENGE RATING WORKSPACE (Section 16: Authorized Rating Info + Submission) */}
      {activeTab === 'WORKSPACE' && (
        <div className="space-y-6">
          {!workspaceData ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-xs">
              No policy review selected. Choose an accepted opportunity from "My Offer Reviews".
            </div>
          ) : (
            <>
              {/* PM-4: Policy Binding & Progressive Disclosure Console */}
              {bindingHandoff && bindingHandoff.providerOrganizationId === activeOrg?.id && (
                <div className="bg-emerald-50/60 rounded-2xl border-2 border-emerald-300 p-6 shadow-xs space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-emerald-200">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] font-bold text-white bg-emerald-700 px-2.5 py-0.5 rounded-full">
                          CONSUMER SELECTED THIS OFFER
                        </span>
                        <span className="text-xs font-mono font-bold text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded border border-emerald-300">
                          {bindingHandoff.bindingReference}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mt-1">
                        Policy Binding & Progressive Disclosure Console
                      </h3>
                      <p className="text-xs text-slate-600">
                        Consumer selected your {bindingHandoff.carrier} quote. Manage Stage C disclosure execution, underwriting adjustments, and policy binding.
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-emerald-800 bg-white border border-emerald-300 px-3 py-1.5 rounded-lg shadow-xs">
                        STATUS: {bindingHandoff.status}
                      </span>
                    </div>
                  </div>

                  {/* Stage C Disclosure Section */}
                  {!disclosureEvent ? (
                    <div className="bg-white rounded-xl p-4 border border-emerald-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <span className="font-bold text-slate-900 text-xs">Stage C Direct Insured Identity & PII</span>
                        </div>
                        {bindingConsent ? (
                          <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded border border-blue-200">
                            CONSUMER CONSENT GRANTED
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded border border-amber-200">
                            AWAITING CONSUMER CONSENT
                          </span>
                        )}
                      </div>

                      {bindingConsent ? (
                        <div className="space-y-3">
                          <p className="text-xs text-slate-600">
                            The consumer authorized Stage C progressive disclosure of fields: <strong className="text-slate-800">{bindingConsent.authorizedFieldNames.join(', ')}</strong>. Click below to execute disclosure and retrieve rating dossier credentials.
                          </p>
                          <button
                            onClick={handleExecuteDisclosure}
                            disabled={isExecutingDisclosure}
                            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-4 py-2 rounded-lg transition disabled:opacity-50"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>{isExecutingDisclosure ? 'Executing Disclosure...' : 'Execute Controlled Stage C Disclosure'}</span>
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic">
                          Stage C direct PII (Full Legal Name, Street Address, Full VIN, License #) is strictly sealed until the consumer authorizes Section 40 progressive disclosure.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl p-4 border border-emerald-200 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span className="font-bold text-slate-900 text-xs">Stage C Authorized PII Disclosed</span>
                        </div>
                        <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                          PAYLOAD HASH: {disclosureEvent.eventPayloadHash.substring(0, 16)}...
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Named Insured</span>
                          <span className="font-bold text-slate-800">{disclosedData?.namedInsured || 'Jane Doe'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Full VIN</span>
                          <span className="font-mono font-bold text-slate-800">{disclosedData?.vin || '4T1B11HK5RU123498'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Garaging Address</span>
                          <span className="font-medium text-slate-700">{disclosedData?.garagingAddress || '812 Horizon Ridge Pkwy, Henderson, NV'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Driver License</span>
                          <span className="font-mono font-bold text-slate-800">{disclosedData?.driverLicenseNumber || 'NV-DL-8912781'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Binding Lifecycle Controls */}
                  <div className="bg-white rounded-xl p-4 border border-emerald-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs">Underwriting & Binding Lifecycle Controls</span>
                      {bindingModifications.some(m => m.status === 'PENDING_CONSUMER_REVIEW') && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded border border-amber-200">
                          MODIFICATION PENDING REVIEW (BOUND BLOCKED)
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleUpdateBindingStatus('APPLICATION_SUBMITTED')}
                        disabled={bindingHandoff.status === 'APPLICATION_SUBMITTED' || bindingHandoff.status === 'BOUND'}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs px-3 py-2 rounded-lg transition disabled:opacity-40"
                      >
                        1. Mark Application Submitted
                      </button>

                      <button
                        onClick={() => handleUpdateBindingStatus('UNDERWRITING')}
                        disabled={bindingHandoff.status === 'UNDERWRITING' || bindingHandoff.status === 'BOUND'}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs px-3 py-2 rounded-lg transition disabled:opacity-40"
                      >
                        2. Move to Underwriting
                      </button>

                      <button
                        onClick={() => setShowProposeModModal(true)}
                        disabled={bindingHandoff.status === 'BOUND' || bindingHandoff.status === 'DECLINED'}
                        className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-medium text-xs px-3 py-2 rounded-lg transition disabled:opacity-40"
                      >
                        Propose Underwriting Modification
                      </button>

                      <button
                        onClick={() => setShowBoundModal(true)}
                        disabled={
                          bindingHandoff.status === 'BOUND' ||
                          bindingHandoff.status === 'DECLINED' ||
                          bindingModifications.some(m => m.status === 'PENDING_CONSUMER_REVIEW')
                        }
                        title={
                          bindingModifications.some(m => m.status === 'PENDING_CONSUMER_REVIEW')
                            ? 'Cannot bind: Underwriting modification pending consumer review'
                            : 'Mark policy as bound'
                        }
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-3.5 py-2 rounded-lg transition disabled:opacity-40 flex items-center space-x-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>3. Mark Policy BOUND</span>
                      </button>

                      {bindingHandoff.status === 'BOUND' && (
                        <button
                          onClick={() => {
                            setIssuedPolicyNum(bindingHandoff.policyNumber || '');
                            setShowUploadIssuedModal(true);
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs px-3.5 py-2 rounded-lg transition flex items-center space-x-1"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>4. Upload Issued Dec Page (Reconcile)</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleUpdateBindingStatus('DECLINED')}
                        disabled={bindingHandoff.status === 'BOUND' || bindingHandoff.status === 'DECLINED'}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-medium text-xs px-3 py-2 rounded-lg transition disabled:opacity-40"
                      >
                        Decline Risk
                      </button>
                    </div>

                    {/* PM-5: Issued Policy Reconciliation Card */}
                    {pm5Report && (
                      <div className={`p-4 rounded-xl border text-xs space-y-2 ${
                        pm5Report.verdict === 'MATCH'
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                          : pm5Report.verdict === 'AUTHORIZED_VARIANCE'
                          ? 'bg-blue-50/70 border-blue-200 text-blue-950'
                          : 'bg-amber-50/70 border-amber-200 text-amber-950'
                      }`}>
                        <div className="flex items-center justify-between pb-1.5 border-b border-current/10">
                          <div className="flex items-center space-x-1.5 font-bold">
                            <ShieldCheck className="w-4 h-4" />
                            <span>
                              Issued Policy Reconciliation: {pm5Report.verdict} ({pm5Report.status})
                            </span>
                          </div>
                          <span className="text-[10px] font-mono opacity-80">
                            Reconciled: {new Date(pm5Report.reconciledAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-[11px] opacity-90 leading-relaxed">
                          Policy #{pm5Report.issuedTermsSummary?.policyNumber || 'N/A'} issued at ${pm5Report.issuedTermsSummary?.annualPremium ?? 0}/yr 
                          reconciled against expected terms (${pm5Report.expectedTermsSummary?.annualPremium ?? 0}/yr).
                        </p>
                        {pm5Report.discrepancies.length > 0 && (
                          <div className="space-y-1 pt-1">
                            <span className="font-semibold block text-[11px]">Identified Discrepancies ({pm5Report.discrepancies.length}):</span>
                            {pm5Report.discrepancies.map((d, idx) => (
                              <div key={idx} className="bg-white/80 p-2 rounded border border-current/10 text-[11px] flex justify-between items-center">
                                <div>
                                  <span className="font-bold">{d.category}:</span> {d.fieldName}
                                  <span className="block text-[10px] opacity-75">{d.explanation}</span>
                                </div>
                                <span className="font-mono font-semibold">{d.actualIssuedValue}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {bindingActionError && (
                      <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded border border-rose-200">
                        {bindingActionError}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Workspace Top Header: Stage B Authorized Rating Information */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                        {workspaceData.challenge.referenceNumber}
                      </span>
                      <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-semibold">
                        Authorized Rating Information (Stage B)
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mt-1">
                      Carrier Rating Workbench
                    </h3>
                  </div>

                  <div className="flex items-center space-x-2 text-xs">
                    <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-1 rounded">Independent, sealed submissions</span>
                  </div>
                </div>

                {/* Privacy Safeguard Notice */}
                <div className="bg-slate-50 rounded-xl p-3.5 text-xs text-slate-600 border border-slate-200/70 flex items-start gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-800 font-semibold">Privacy-Preserved Rating Profile:</strong> The consumer's
                    direct identity (legal name, phone number, email, and exact street address) is sealed under
                    Open Policy progressive disclosure. Use the authorized vehicle characteristics and territory demographics below to rate via your carrier portals.
                  </div>
                </div>

                {/* Rating Factors Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50/80 p-4 rounded-xl text-xs">
                  <div>
                    <span className="text-slate-400 uppercase block font-semibold text-[10px]">Current Annual Premium</span>
                    <span className="text-base font-bold text-slate-900">
                      ${workspaceData.baseline.baselineAnnualPremium.toLocaleString()}/yr
                    </span>
                    <span className="text-slate-500 block">(${workspaceData.baseline.baselineMonthlyPremium}/mo)</span>
                  </div>

                  <div>
                    <span className="text-slate-400 uppercase block font-semibold text-[10px]">Vehicle Specs</span>
                    <span className="font-bold text-slate-800 block">
                      {workspaceData.authorizedRatingInfo.vehicle.year} {workspaceData.authorizedRatingInfo.vehicle.make} {workspaceData.authorizedRatingInfo.vehicle.model}
                    </span>
                    <span className="text-slate-500">Garaged: {workspaceData.authorizedRatingInfo.vehicle.garagingZip} (NV)</span>
                  </div>

                  <div>
                    <span className="text-slate-400 uppercase block font-semibold text-[10px]">Primary Driver Info</span>
                    <span className="font-semibold text-slate-800 block">
                      Age Bracket: {workspaceData.authorizedRatingInfo.driverInfo.primaryDriverAgeBracket}
                    </span>
                    <span className="text-slate-500">Licensed in {workspaceData.authorizedRatingInfo.driverInfo.licenseState} ({workspaceData.authorizedRatingInfo.driverInfo.yearsLicensed} yrs)</span>
                  </div>

                  <div>
                    <span className="text-slate-400 uppercase block font-semibold text-[10px]">Annual Usage</span>
                    <span className="font-semibold text-slate-800 block">
                      {workspaceData.authorizedRatingInfo.vehicle.annualMileage?.toLocaleString()} miles/yr
                    </span>
                    <span className="text-slate-500">{workspaceData.authorizedRatingInfo.vehicle.usage}</span>
                  </div>
                </div>

                {/* Baseline Coverages Reference */}
                <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 text-xs">
                  <span className="font-bold text-blue-900 block mb-2">
                    Required Baseline Terms (Must Meet or Exceed to Qualify as Valid Alternative):
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700">
                    <span className="bg-white p-2 rounded border border-blue-200/60 font-medium">
                      BI: 100k/300k
                    </span>
                    <span className="bg-white p-2 rounded border border-blue-200/60 font-medium">
                      PD: $100,000
                    </span>
                    <span className="bg-white p-2 rounded border border-blue-200/60 font-medium">
                      Collision: $500 Deductible
                    </span>
                    <span className="bg-white p-2 rounded border border-blue-200/60 font-medium">
                      Comprehensive: $250 Deductible
                    </span>
                  </div>
                </div>
              </div>

              {/* PM-2: Competition Engine & Sealed Market Telemetry Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-200">
                      <Radio className="h-5 w-5 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Offer Submission Status
                        </span>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${workspaceData.competition.currentRound === 'OPEN' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
                          {workspaceData.competition.currentRound === 'OPEN' && 'Submission Window Open'}
                          {workspaceData.competition.currentRound === 'CLOSED' && 'Offer Window Closed'}
                          {(workspaceData.competition.currentRound === 'CONSUMER_REVIEW' || workspaceData.competition.currentRound === 'CLOSED_PENDING_SELECTION') && 'In Consumer Review'}
                        </span>
                        {workspaceData.deadlineStatus?.formattedRemaining && (
                          <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1 border border-slate-200">
                            <Clock className="h-3 w-3 text-slate-500" />
                            {workspaceData.deadlineStatus.formattedRemaining}
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-bold text-slate-900 mt-0.5">
                        Your Offer Submission Status
                      </h4>
                    </div>
                  </div>

                  {/* Operator & Provider Round Progression Controls */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setWithdrawModalOpen(true)}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      title="Withdraw from this policy review"
                    >
                      <X className="h-3.5 w-3.5" />
                      Withdraw
                    </button>

                  </div>
                </div>

                {/* Provider-owned offer and submission-window status */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Provider Offer Status */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Your Offer Verification Status
                    </span>
                    <div className="mt-1 flex items-center space-x-2">
                      {workspaceData.myOffers && workspaceData.myOffers.length > 0 ? (
                        workspaceData.myOffers.some((o: any) => o.status === 'VALIDATED') ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-300">
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            Offer Validated & Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold border border-amber-300">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                            Requires Verification
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-200 text-slate-800 rounded-lg text-xs font-bold">
                          Awaiting Quote Submission
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 mt-2 block">
                      Quotes are verified against policy declarations and consumer requirements.
                    </span>
                  </div>

                  {/* Provider-owned submission count */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Your Submitted Offers
                    </span>
                    <div className="mt-1 flex items-baseline space-x-2">
                      <span className="text-xl font-bold text-slate-900">
                        {workspaceData.myOffers?.length || 0}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 mt-2 block">
                      <Lock className="h-3 w-3 inline mr-1 text-slate-400" />
                      Independent review: You cannot see other providers’ identities, prices, or offers.
                    </span>
                  </div>

                  {/* Submission-window status */}
                  <div className="p-4 bg-blue-50/70 rounded-xl border border-blue-200">
                    <span className="text-[10px] uppercase font-bold text-blue-700 block tracking-wider">
                      Offer Stage
                    </span>
                    <p className="text-xs text-blue-900 mt-1 font-medium leading-relaxed">
                      {offerStatus?.windowOpen ? `Submission window open until ${new Date(offerStatus.windowClosesAt).toLocaleString()}.` : 'Submission window closed.'}
                    </p>
                    {offerStatus?.windowOpen && (
                      <span className="text-[10px] text-blue-600 font-bold mt-2 block uppercase tracking-wide">Your agency may independently update its own offers while this window remains open.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Previously Submitted Offers by This Provider */}
              {workspaceData.myOffers && workspaceData.myOffers.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span>Your Submitted Carrier Quotes</span>
                        <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-full">
                          {workspaceData.myOffers.length} {workspaceData.myOffers.length === 1 ? 'Carrier Option' : 'Carrier Options'}
                        </span>
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        An authorized provider may submit offers for its applicable carrier relationships.
                      </p>
                    </div>

                    <span className="text-xs text-slate-400 font-normal">
                      (Other providers’ offers are not visible)
                    </span>
                  </div>

                  <div className="space-y-3">
                    {workspaceData.myOffers.map((o: any) => (
                      <div key={o.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <strong className="text-slate-900 font-bold text-sm">{o.carrier}</strong>
                            {o.tierLabel && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold text-[11px]">
                                {o.tierLabel}
                              </span>
                            )}
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded font-mono text-[10px]">
                              v{o.version || 1}
                            </span>
                            <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[10px] font-semibold">
                              {o.round || 'ROUND_1_OPEN'}
                            </span>
                            {o.isQualified ? (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px] flex items-center gap-1 border border-emerald-300">
                                <ShieldCheck className="h-3 w-3 text-emerald-600" />
                                Qualified Offer
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-medium text-[10px] border border-amber-300">
                                Pending Qualification
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-3 text-slate-500">
                            <span className="font-mono">Quote #{o.quoteNumber}</span>
                            <span>•</span>
                            <span>Submitted: {new Date(o.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span>•</span>
                            <span className={o.status === 'VALIDATED' ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>
                              {o.status}
                            </span>
                          </div>

                          {o.isDuplicateCarrier && (
                            <div className="mt-1 p-2 bg-amber-50 rounded text-amber-900 border border-amber-200 text-[11px] flex items-start gap-1">
                              <Info className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                              <span>{o.duplicateCarrierNotice || 'Multiple participating providers quoted this carrier.'}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center space-x-3 sm:space-x-4">
                          <div className="text-right">
                            <span className="font-bold text-slate-900 text-base">${o.annualPremium}/yr</span>
                            <span className="text-slate-500 ml-1 text-xs">(${o.monthlyPremium}/mo)</span>
                            <span className="block text-[11px] text-emerald-600 font-medium">
                              Saves ${(workspaceData.baseline.baselineAnnualPremium - o.annualPremium).toLocaleString()}/yr
                            </span>
                          </div>

                          {/* PM-3: Multi-Dimensional Revision & Keep Current Offer Actions */}
                          {offerStatus?.windowOpen && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleKeepCurrentOffer(o.id)}
                                disabled={actionLoading === `keep-${o.id}`}
                                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 border border-slate-300"
                                title="Confirm existing offer terms remain in effect for this round without price concession"
                              >
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                {actionLoading === `keep-${o.id}` ? 'Confirming...' : 'Keep Current'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenReviseModal(o)}
                                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Update Offer
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PM-2: Supplemental Underwriting Facts & Rating Questions (Sections 17 & 18) */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>Supplemental Underwriting Facts & Rating Questions</span>
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                        Sections 17 & 18
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Answered rating facts are shared transparently with all participating providers so consumers never answer twice.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowInfoRequestModal(true)}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors self-start sm:self-auto"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Ask Rating Question
                  </button>
                </div>

                {infoRequestToast && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>{infoRequestToast}</span>
                  </div>
                )}

                {/* Available Reusable Facts */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Verified Consumer Supplemental Facts (Reusable for Carrier Rating)
                  </span>
                  {supplementalFacts && supplementalFacts.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {supplementalFacts.map((fact: any) => (
                        <div key={fact.id} className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/80 text-xs flex items-start gap-2.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold text-slate-900 block">{fact.fieldName}</span>
                            <span className="text-emerald-800 font-bold text-sm">{fact.formattedValue}</span>
                            <span className="block text-[10px] text-slate-500 mt-0.5 font-mono">
                              Attested: {new Date(fact.createdAt).toLocaleDateString()} • State: {fact.verificationState}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500 border border-slate-200">
                      No supplemental facts submitted yet. Ask a structured question below if needed for carrier rating discounts.
                    </div>
                  )}
                </div>

                {/* Pending & Answered Requests Table */}
                {infoRequests && infoRequests.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Information Requests for this Policy Review
                    </span>
                    <div className="space-y-2">
                      {infoRequests.map((req: any) => (
                        <div key={req.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <strong className="text-slate-900 font-semibold">{req.customFieldName || req.requestedField}</strong>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                req.status === 'ANSWERED'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}>
                                {req.status}
                              </span>
                              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                                {req.purpose}
                              </span>
                            </div>
                            <p className="text-slate-600 text-[11px] mt-0.5">{req.purposeExplanation}</p>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">
                            {new Date(req.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* PM-3: Sealed Competition Activity Timeline */}
              {workspaceData?.activityFeed && workspaceData.activityFeed.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-slate-500" />
                      <h4 className="text-sm font-bold text-slate-900">
                        Offer Activity Timeline
                      </h4>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
                        Sealed Provider View
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      Anti-collusion masking active
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {workspaceData.activityFeed.map((evt: any) => (
                      <div key={evt.id} className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 flex items-start justify-between gap-3 text-xs">
                        <div className="flex items-start space-x-2.5">
                          <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                          <div>
                            <div className="flex items-center space-x-2">
                              <strong className="text-slate-900 font-semibold">{evt.actorName || 'Participant'}</strong>
                              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-mono">
                                {evt.round}
                              </span>
                            </div>
                            <p className="text-slate-600 text-[11px] mt-0.5">{evt.summary}</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quote Entry & Discrepancy Submission Form */}
              <form onSubmit={handleSubmitOffer} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <h4 className="text-base font-bold text-slate-900">
                    Enter Carrier Quote Proposal
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select an appointed carrier, enter the binding rate, and attach supporting documentation.
                  </p>
                </div>

                {submissionSuccess && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-xl text-xs flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    <div>
                      <strong>Your offer was submitted.</strong> The policyholder can now compare it with the current policy.
                    </div>
                  </div>
                )}

                {/* Carrier & Rate */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Appointed Carrier
                    </label>
                    <select
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    >
                      {carriers.map(c => (
                        <option key={c.id} value={c.carrierName}>{c.carrierName}</option>
                      ))}
                      <option value="Progressive Northern Insurance">Progressive Northern</option>
                      <option value="Travelers Property Casualty">Travelers Property Casualty</option>
                      <option value="Safeco Insurance">Safeco Insurance</option>
                      <option value="Nationwide Mutual">Nationwide Mutual</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Quote Tier / Option
                    </label>
                    <input
                      type="text"
                      value={tierLabel}
                      onChange={(e) => setTierLabel(e.target.value)}
                      placeholder="e.g. Primary Match, Max Savings"
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Official Quote #
                    </label>
                    <input
                      type="text"
                      value={quoteNumber}
                      onChange={(e) => setQuoteNumber(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Annual Premium ($)
                    </label>
                    <div className="relative">
                      <DollarSign className="h-4 w-4 absolute left-2.5 top-2.5 text-slate-400" />
                      <input
                        type="number"
                        value={annualPremium}
                        onChange={(e) => setAnnualPremium(Number(e.target.value))}
                        className="w-full text-xs border border-slate-300 rounded-lg pl-8 pr-3 py-2 font-bold text-slate-900"
                        required
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                      <span>${monthlyCalc}/mo</span>
                      <span className={annualSavings >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                        {annualSavings >= 0 ? `Saves $${annualSavings}/yr` : `+$${Math.abs(annualSavings)}/yr`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Coverage Terms */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Coverage Terms & Deductibles
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Collision Deductible</label>
                      <select
                        value={collisionDeductible}
                        onChange={(e) => setCollisionDeductible(Number(e.target.value))}
                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                      >
                        <option value={250}>$250 Deductible</option>
                        <option value={500}>$500 Deductible (Baseline)</option>
                        <option value={1000}>$1,000 Deductible</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Comp Deductible</label>
                      <select
                        value={compDeductible}
                        onChange={(e) => setCompDeductible(Number(e.target.value))}
                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                      >
                        <option value={100}>$100 Deductible</option>
                        <option value={250}>$250 Deductible (Baseline)</option>
                        <option value={500}>$500 Deductible</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Property Damage Limit</label>
                      <select
                        value={propertyLimit}
                        onChange={(e) => setPropertyLimit(Number(e.target.value))}
                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                      >
                        <option value={50000}>$50,000 PD</option>
                        <option value={100000}>$100,000 PD (Baseline)</option>
                        <option value={250000}>$250,000 PD (Upgrade)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 pt-2">
                    <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rentalIncluded}
                        onChange={(e) => setRentalIncluded(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span>Include Rental Reimbursement ($50/day)</span>
                    </label>

                    <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={roadsideIncluded}
                        onChange={(e) => setRoadsideIncluded(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span>Include Roadside Assistance (24/7 Towing)</span>
                    </label>
                  </div>
                </div>

                {/* OCR Discrepancy Simulator (Section 19: Discrepancy Prevention) */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <FileUp className="h-4 w-4 text-blue-600" />
                      Supporting Quote Document
                    </span>
                    <span className="font-mono text-slate-500 text-[11px]">{quoteFileName}</span>
                  </div>

                  <label className="flex items-center space-x-2 text-xs text-amber-900 bg-amber-50/80 border border-amber-200 p-2.5 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={simulateQuoteDiscrepancy}
                      onChange={(e) => {
                        setSimulateQuoteDiscrepancy(e.target.checked);
                        if (e.target.checked) {
                          setDiscrepancyWarning([
                            'Collision Deductible entered as $500, but official quote document reflects $1,000.',
                            'Rental Reimbursement checked as included, but official quote document excludes rental coverage.'
                          ]);
                        } else {
                          setDiscrepancyWarning([]);
                        }
                      }}
                      className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                    />
                    <span>
                      <strong>Demonstrate Document Discrepancy Interception:</strong> Simulate quote sheet having higher deductible than entered form fields
                    </span>
                  </label>

                  {discrepancyWarning.length > 0 && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg space-y-1">
                      <div className="font-bold flex items-center gap-1 text-rose-900">
                        <AlertTriangle className="h-4 w-4" />
                        Discrepancy Intercepted by Document Intelligence:
                      </div>
                      {discrepancyWarning.map((w, idx) => (
                        <div key={idx} className="text-[11px] pl-5">• {w}</div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Submit Action */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleValidateDiscrepancy}
                    className="text-xs text-slate-600 hover:text-slate-900 underline font-medium"
                  >
                    Run Pre-Submission Document Check
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Submit Offer
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}

      {/* TAB 4: APPETITE & LICENSING INSPECTOR */}
      {activeTab === 'PROFILE' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Provider Organization Profile: {activeOrg?.displayName}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl">
                <span className="text-slate-400 block font-medium">Legal Entity Name</span>
                <strong className="text-slate-800 block mt-0.5">{activeOrg?.legalName}</strong>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl">
                <span className="text-slate-400 block font-medium">Entity Type</span>
                <strong className="text-slate-800 block mt-0.5">{activeOrg?.organizationType}</strong>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl">
                <span className="text-slate-400 block font-medium">Verification Status</span>
                <strong className="text-emerald-700 block mt-0.5 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {activeOrg?.verificationStatus}
                </strong>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl">
                <span className="text-slate-400 block font-medium">Platform Onboarding</span>
                <strong className="text-slate-800 block mt-0.5">
                  {activeOrg?.verifiedAt ? new Date(activeOrg.verifiedAt).toLocaleDateString() : 'Active'}
                </strong>
              </div>
            </div>
          </div>

          {/* Active Verified Licenses */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
            <h4 className="text-sm font-bold text-slate-900">Active State Insurance Licenses</h4>
            <div className="divide-y divide-slate-100">
              {licenses.map(lic => (
                <div key={lic.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800 mr-2">State of {lic.jurisdiction}</span>
                    <span className="font-mono text-slate-500">#{lic.licenseNumber}</span>
                    <span className="text-slate-400 ml-2">({lic.licenseType})</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-slate-500 text-[11px]">Valid thru {lic.expirationDate}</span>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-semibold text-[10px]">
                      {lic.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Configured Underwriting Appetite */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h4 className="text-sm font-bold text-slate-900">Underwriting Appetite Criteria</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="border border-slate-200 p-3.5 rounded-xl">
                <span className="text-slate-400 block uppercase text-[10px] font-bold">Target Jurisdictions</span>
                <strong className="text-slate-800 text-sm block mt-1">
                  {appetite?.jurisdictions.join(', ') || 'NV'}
                </strong>
              </div>
              <div className="border border-slate-200 p-3.5 rounded-xl">
                <span className="text-slate-400 block uppercase text-[10px] font-bold">Risk Markets</span>
                <strong className="text-slate-800 text-sm block mt-1">
                  {appetite?.riskMarkets.join(', ') || 'PREFERRED, STANDARD'}
                </strong>
              </div>
              <div className="border border-slate-200 p-3.5 rounded-xl">
                <span className="text-slate-400 block uppercase text-[10px] font-bold">Renewal Target Window</span>
                <strong className="text-slate-800 text-sm block mt-1">
                  {appetite?.renewalWindowDays ? `${appetite.renewalWindowDays.min} to ${appetite.renewalWindowDays.max} days` : '14 to 90 days'}
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: COMMERCIAL ACCOUNT, ENTITLEMENTS & VALUE FUNNEL (CE-1) */}
      {activeTab === 'ACCOUNT' && (
        <div className="space-y-6">
          {/* 1. Neutrality Invariant Banner */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Commercial Neutrality Invariant</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  ENFORCED
                </span>
              </div>
              <p className="text-xs text-slate-300 max-w-2xl">
                Commercial membership grants policy-review capacity and operational scale. Under no circumstances
                can commercial tier, subscription fees, or spend influence opportunity distribution, consumer ranking,
                or how offers are displayed.
              </p>
            </div>
            <div className="flex items-center space-x-3 shrink-0">
              <button
                onClick={() => loadCommercialData()}
                disabled={commercialLoading}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 border border-slate-700 transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${commercialLoading ? 'animate-spin' : ''}`} />
                Refresh Account
              </button>
            </div>
          </div>

          {/* 2. Membership & Commercial Agreement Card */}
          {/* 2. Membership & Commercial Agreement Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Commercial Plan & Membership</span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {commercialAgreement
                    ? (commercialPlan?.displayName || commercialPlan?.name || commercialPlan?.code || 'Active Commercial Agreement')
                    : 'No active commercial plan'}
                </h3>
                <p className="text-xs text-slate-500">
                  {commercialAgreement
                    ? (commercialPlan?.description || 'Active commercial agreement governing policy-review capacity.')
                    : 'This provider organization is currently unconfigured. Commercial capacity must be provisioned through explicit enrollment.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                  commercialAgreement?.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : commercialAgreement?.status === 'SUSPENDED'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {commercialAgreement?.status || 'UNCONFIGURED'}
                </span>
                {commercialPlan?.providerSegment && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    {commercialPlan.providerSegment}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <span className="text-slate-400 block font-medium">Recurring Fee</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <strong className="text-slate-900 text-base font-bold">
                    {commercialPlanVersion && commercialPlanVersion.recurringFeeCents > 0
                      ? `$${(commercialPlanVersion.recurringFeeCents / 100).toFixed(0)}`
                      : commercialAgreement
                      ? 'Configurable Terms'
                      : '—'}
                  </strong>
                  {commercialPlanVersion && commercialPlanVersion.recurringFeeCents > 0 && (
                    <span className="text-slate-500 text-xs">/ {commercialPlanVersion?.billingInterval?.toLowerCase() || 'month'}</span>
                  )}
                </div>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <span className="text-slate-400 block font-medium">Billing Account Reference</span>
                <strong className="text-slate-800 block mt-0.5 font-mono text-[11px]">
                  {commercialAccount?.externalBillingCustomerRef || commercialAccount?.billingCustomerReference || (commercialAccount ? `cust_${commercialAccount.id}` : 'None')}
                </strong>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <span className="text-slate-400 block font-medium">Agreement Lifecycle</span>
                <strong className="text-slate-800 block mt-0.5 font-mono text-[11px]">
                  {commercialAgreement ? `${commercialAgreement.status} (v${commercialPlanVersion?.version || 1})` : 'Unenrolled'}
                </strong>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <span className="text-slate-400 block font-medium">Currency & Settlement</span>
                <strong className="text-slate-800 block mt-0.5">
                  {commercialAccount?.currency || 'USD'} • Decoupled from PM-5
                </strong>
              </div>
            </div>
          </div>

          {/* 3. Marketplace Capacity & Entitlements */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Provider Account Capacity</h3>
              <p className="text-xs text-slate-500">
                Capacity limits derived from active commercial agreement. Entitlements gate volume and access without modifying evaluation neutrality.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {commercialEntitlements.length > 0 ? (
                commercialEntitlements.map((ent: any) => {
                  const limitVal = ent.limit ?? ent.limitVal ?? ent.maxQuantity;
                  const isUnlimited = limitVal === undefined || limitVal === null || limitVal === -1;
                  const currentUsage = ent.currentUsage || 0;
                  const pct = isUnlimited ? 0 : Math.min(100, Math.round((currentUsage / limitVal) * 100));
                  return (
                    <div key={ent.id} className="border border-slate-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">
                          {ent.entitlementType.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                          {ent.enforcementPolicy || 'HARD_BLOCK'}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-baseline justify-between text-xs mb-1">
                          <span className="text-slate-500 font-medium">Usage</span>
                          <span className="font-bold text-slate-800">
                            {currentUsage} / {isUnlimited ? '∞ Unlimited' : limitVal}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              pct > 90 ? 'bg-rose-500' : pct > 75 ? 'bg-amber-500' : 'bg-blue-600'
                            }`}
                            style={{ width: `${isUnlimited ? 15 : pct}%` }}
                          />
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {ent.entitlementType === 'VPO_CAPACITY' && 'Maximum verified opportunities that can be engaged concurrently.'}
                        {ent.entitlementType === 'PRODUCER_SEATS' && 'Licensed producers authorized to draft and submit binding quotes.'}
                        {ent.entitlementType === 'ACTIVE_JURISDICTIONS' && 'States where policy-review access is enabled.'}
                        {ent.entitlementType === 'CONCURRENT_COMPETITIONS' && 'Simultaneous active policy reviews.'}
                        {ent.entitlementType === 'AUTHORIZED_CONNECTION_INCLUDED' && 'Included PM-4 authorized disclosures before usage overage.'}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full py-8 text-center text-slate-400 text-xs">
                  Loading active entitlements...
                </div>
              )}
            </div>
          </div>

          {/* 4. Governed Commercial Value Funnel */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Governed Acquisition & Value Funnel</h3>
                <p className="text-xs text-slate-500">
                  Full lifecycle visibility across verified transactional milestones. Value is recognized at authentic customer actions.
                </p>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                AUDITED COMMERCIAL METRICS
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">1. Available</span>
                <strong className="text-lg font-bold text-slate-900 block mt-1">
                  {valueSummary?.vposAvailable ?? 0}
                </strong>
                <span className="text-[10px] text-slate-500">Opportunities</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">2. Viewed</span>
                <strong className="text-lg font-bold text-indigo-700 block mt-1">
                  {valueSummary?.vposViewed ?? 0}
                </strong>
                <span className="text-[10px] text-slate-500">Viewed</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">3. Engaged</span>
                <strong className="text-lg font-bold text-blue-700 block mt-1">
                  {valueSummary?.vposEngaged ?? 0}
                </strong>
                <span className="text-[10px] text-slate-500">Accepted</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">4. Submitted</span>
                <strong className="text-lg font-bold text-purple-700 block mt-1">
                  {valueSummary?.propositionsSubmitted ?? 0}
                </strong>
                <span className="text-[10px] text-slate-500">Propositions</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">5. Selected</span>
                <strong className="text-lg font-bold text-amber-700 block mt-1">
                  {valueSummary?.consumerSelections ?? 0}
                </strong>
                <span className="text-[10px] text-slate-500">By Consumer</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">6. Authorized</span>
                <strong className="text-lg font-bold text-emerald-700 block mt-1">
                  {valueSummary?.authorizedConnections ?? 0}
                </strong>
                <span className="text-[10px] text-slate-500">Connections (PM-4)</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">7. Bound</span>
                <strong className="text-lg font-bold text-cyan-700 block mt-1">
                  {valueSummary?.boundAcquisitions ?? 0}
                </strong>
                <span className="text-[10px] text-slate-500">Acquisitions</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">8. Verified</span>
                <strong className="text-lg font-bold text-emerald-800 block mt-1">
                  {valueSummary?.verifiedBoundOutcomes ?? 0}
                </strong>
                <span className="text-[10px] text-emerald-600">Reconciled (PM-5)</span>
              </div>
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-center">
                <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider block">9. Baseline</span>
                <strong className="text-lg font-bold text-teal-900 block mt-1">
                  {valueSummary?.baselinesActivated ?? 0}
                </strong>
                <span className="text-[10px] text-teal-700">Activated (Vault)</span>
              </div>
            </div>

            {/* Governed Conversion Ratios */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-slate-100 text-xs">
              <div className="p-2 bg-slate-50 rounded-lg">
                <span className="text-[10px] text-slate-500 block">Engagement Rate</span>
                <span className="font-semibold text-slate-800">
                  {((valueSummary?.conversionRatios?.engagementRate ?? 0) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg">
                <span className="text-[10px] text-slate-500 block">Selection Rate</span>
                <span className="font-semibold text-slate-800">
                  {((valueSummary?.conversionRatios?.selectionRate ?? 0) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg">
                <span className="text-[10px] text-slate-500 block">Authorization Rate</span>
                <span className="font-semibold text-slate-800">
                  {((valueSummary?.conversionRatios?.authorizationRate ?? 0) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg">
                <span className="text-[10px] text-slate-500 block">Bind Rate</span>
                <span className="font-semibold text-slate-800">
                  {((valueSummary?.conversionRatios?.bindRate ?? 0) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg">
                <span className="text-[10px] text-slate-500 block">Verification Rate</span>
                <span className="font-semibold text-slate-800">
                  {((valueSummary?.conversionRatios?.verificationRate ?? 0) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg">
                <span className="text-[10px] text-slate-500 block">Activation Rate</span>
                <span className="font-semibold text-slate-800">
                  {((valueSummary?.conversionRatios?.activationRate ?? 0) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* 5. Commercial Event Ledger */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Commercial Event Ledger</h3>
                <p className="text-xs text-slate-500">
                  Immutable cryptographic ledger of economically significant transaction events.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {commercialEvents.length} Recorded Events
              </span>
            </div>

            {commercialEvents.length > 0 ? (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Event Type</th>
                      <th className="py-2.5 px-4">Source Entity</th>
                      <th className="py-2.5 px-4">Timestamp</th>
                      <th className="py-2.5 px-4">Cryptographic Hash</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {commercialEvents.map((evt: any) => (
                      <tr key={evt.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4">
                          <span className="font-semibold text-slate-800">
                            {evt.eventType}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-500">
                          {evt.sourceEntityType} • <span className="font-mono text-[11px]">{evt.sourceEntityId}</span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-500">
                          {new Date(evt.occurredAt).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[10px] text-slate-400">
                          {evt.eventHash ? `${evt.eventHash.slice(0, 16)}...` : 'sha256:verified'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs">
                No commercial events recorded yet for this organization.
              </div>
            )}
          </div>

          {/* 6. Rated Commercial Activity (CE-4) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CE-4 Rating Engine</span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">Rated Commercial Activity</h3>
                <p className="text-xs text-slate-500">
                  Transactional charges and auditable adjustments rated under historical plan agreements. Flat fees only (integer cents).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 font-mono">
                  {billableEvents.length} Billable Items
                </span>
                {ratingAdjustments.length > 0 && (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 font-mono">
                    {ratingAdjustments.length} Adjustments
                  </span>
                )}
              </div>
            </div>

            {/* Financial Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <span className="text-slate-400 block font-medium">Gross Rated Charges</span>
                <strong className="text-slate-900 text-lg font-bold block mt-1">
                  ${((activitySummary?.grossRatedCents ?? billableEvents.reduce((s, b) => s + b.amountCents, 0)) / 100).toFixed(2)}
                </strong>
                <span className="text-slate-500 text-[10px]">Pre-adjustment fee total</span>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <span className="text-slate-400 block font-medium">Rating Adjustments</span>
                <strong className="text-amber-700 text-lg font-bold block mt-1">
                  -${(Math.abs(activitySummary?.adjustmentCents ?? ratingAdjustments.reduce((s, a) => s + a.amountCents, 0)) / 100).toFixed(2)}
                </strong>
                <span className="text-slate-500 text-[10px]">Credit memos & reversals</span>
              </div>
              <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-100">
                <span className="text-emerald-700 block font-medium">Net Rated Balance</span>
                <strong className="text-emerald-900 text-lg font-bold block mt-1">
                  ${((activitySummary?.netRatedCents ?? Math.max(0, billableEvents.reduce((s, b) => s + b.amountCents, 0) + ratingAdjustments.reduce((s, a) => s + a.amountCents, 0))) / 100).toFixed(2)}
                </strong>
                <span className="text-emerald-600 text-[10px]">Current billable total</span>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <span className="text-slate-400 block font-medium">Rating Invariant</span>
                <strong className="text-slate-800 text-sm font-semibold block mt-1">
                  Provider Fees
                </strong>
                <span className="text-slate-500 text-[10px]">Fees as set in your provider agreement</span>
              </div>
            </div>

            {/* Billable Events Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 mb-2 uppercase tracking-wide">Rated Billable Line Items</h4>
              {billableEvents.length > 0 ? (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Charge Code</th>
                        <th className="py-2.5 px-3">Commercial Event</th>
                        <th className="py-2.5 px-3">Plan Version</th>
                        <th className="py-2.5 px-3 text-right">Unit Fee</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3">Rated At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {billableEvents.map((b: any) => (
                        <tr key={b.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {b.chargeCode}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                            {b.commercialEventId}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                            {b.commercialPlanVersionId || 'v1'}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-700">
                            ${(b.unitPriceCents / 100).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            ${(b.amountCents / 100).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              {b.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            {new Date(b.ratedAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="border border-dashed border-slate-200 rounded-xl p-6 text-center text-slate-400 text-xs">
                  No rated billable events for this provider organization yet.
                </div>
              )}
            </div>

            {/* Rating Adjustments Table (if any) */}
            {ratingAdjustments.length > 0 && (
              <div className="pt-2">
                <h4 className="text-xs font-bold text-slate-800 mb-2 uppercase tracking-wide">Rating Adjustments & Credit Memos</h4>
                <div className="overflow-x-auto border border-amber-200 bg-amber-50/20 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-amber-50 border-b border-amber-200 text-amber-900 font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Adjustment Type</th>
                        <th className="py-2.5 px-3">Original Event</th>
                        <th className="py-2.5 px-3 text-right">Adjustment Amount</th>
                        <th className="py-2.5 px-3">Reason</th>
                        <th className="py-2.5 px-3">Authorized By</th>
                        <th className="py-2.5 px-3">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100">
                      {ratingAdjustments.map((a: any) => (
                        <tr key={a.id} className="hover:bg-amber-50/50">
                          <td className="py-2.5 px-3 font-semibold text-amber-800">
                            {a.adjustmentType}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                            {a.originalBillableEventId}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-rose-600 font-mono">
                            -${(Math.abs(a.amountCents) / 100).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            {a.reason}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                            {a.authorizedBy}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            {new Date(a.authorizedAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* 7. Invoicing, Billing Periods & Settlement (CE-5) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CE-5 Billing & Settlement</span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">Invoices & Settlement Ledger</h3>
                <p className="text-xs text-slate-500">
                  Contractual billing periods, finalized snapshot invoices, and authoritative settlement balance.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 font-mono">
                  {invoices.length} Invoices
                </span>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
                  {billingPeriods.length} Periods
                </span>
              </div>
            </div>

            {/* Authoritative Account Balance Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <span className="text-slate-400 block font-medium">Total Invoiced</span>
                <strong className="text-base font-bold text-slate-900 font-mono block mt-0.5">
                  ${((accountBalance?.totalInvoicedCents ?? 0) / 100).toFixed(2)}
                </strong>
                <span className="text-slate-500 text-[10px]">Finalized claims</span>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <span className="text-slate-400 block font-medium">Total Paid</span>
                <strong className="text-base font-bold text-emerald-700 font-mono block mt-0.5">
                  ${((accountBalance?.totalPaidCents ?? 0) / 100).toFixed(2)}
                </strong>
                <span className="text-slate-500 text-[10px]">Settled funds</span>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <span className="text-slate-400 block font-medium">Adjustments / Credits</span>
                <strong className="text-base font-bold text-rose-600 font-mono block mt-0.5">
                  -${(Math.abs(accountBalance?.totalAdjustmentsCents ?? 0) / 100).toFixed(2)}
                </strong>
                <span className="text-slate-500 text-[10px]">Credit memos</span>
              </div>
              <div className={`p-3.5 rounded-xl border ${((accountBalance?.outstandingBalanceCents ?? 0) > 0) ? 'bg-amber-50/50 border-amber-200' : 'bg-emerald-50/50 border-emerald-200'}`}>
                <span className="text-slate-500 block font-medium">Outstanding Balance</span>
                <strong className={`text-base font-bold font-mono block mt-0.5 ${((accountBalance?.outstandingBalanceCents ?? 0) > 0) ? 'text-amber-800' : 'text-emerald-800'}`}>
                  ${((accountBalance?.outstandingBalanceCents ?? 0) / 100).toFixed(2)}
                </strong>
                <span className="text-[10px] text-slate-500">
                  {((accountBalance?.outstandingBalanceCents ?? 0) > 0) ? 'Payment Due' : 'Account Current'}
                </span>
              </div>
            </div>

            {/* Invoices List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Finalized Invoices & Statements</h4>
              {invoices.length > 0 ? (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Invoice Number</th>
                        <th className="py-2.5 px-3">Billing Period</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Subtotal</th>
                        <th className="py-2.5 px-3 text-right">Total Due</th>
                        <th className="py-2.5 px-3 text-right">Balance Due</th>
                        <th className="py-2.5 px-3">Finalized Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoices.map((inv: any) => (
                        <tr key={inv.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-mono font-semibold text-indigo-700">
                            {inv.invoiceNumber}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                            {inv.billingPeriodId}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                              inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                              inv.status === 'PARTIALLY_PAID' ? 'bg-amber-100 text-amber-800' :
                              inv.status === 'FINALIZED' ? 'bg-blue-100 text-blue-800' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                            ${(inv.subtotalCents / 100).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            ${(inv.totalDueCents / 100).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">
                            ${(inv.balanceDueCents / 100).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            {inv.finalizedAt ? new Date(inv.finalizedAt).toLocaleDateString() : 'Draft'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="border border-dashed border-slate-200 rounded-xl p-6 text-center text-slate-400 text-xs">
                  No invoices generated for this provider organization yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Decline Reason Modal */}
      {declineModalOpen && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-900">
                Decline Opportunity Invitation
              </h4>
              <button
                onClick={() => setDeclineModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Select a reason for declining this policy review opportunity. This provides
              operational information without exposing policyholder identity.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Decline Reason</label>
                <select
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value as DeclineReason)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white"
                >
                  <option value="OUTSIDE_APPETITE">Out of Appetite / Risk Tier Unfavorable</option>
                  <option value="NO_COMPETITIVE_MARKET">Cannot offer a lower premium than $2,964/year</option>
                  <option value="CAPACITY">Broker Capacity Temporarily Full</option>
                  <option value="CARRIER_RESTRICTION">Carrier Rating Restriction in Territory</option>
                  <option value="INSUFFICIENT_INFORMATION">Insufficient Information to Underwrite</option>
                  <option value="OTHER">Other Reason</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Optional Notes</label>
                <textarea
                  value={declineNotes}
                  onChange={(e) => setDeclineNotes(e.target.value)}
                  placeholder="e.g. Current filed rates in 89101 do not support an offer for this policy."
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 h-20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setDeclineModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmDecline}
                disabled={actionLoading !== null}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs"
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PM-2: Provider-initiated offer update while the submission window is open */}
      {reviseModalOpen && revisingOffer && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <RotateCcw className="h-4 w-4 text-blue-600" />
                <h4 className="text-sm font-bold text-slate-900">
                  Update Provider Offer
                </h4>
              </div>
              <button
                onClick={() => setReviseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-900 space-y-1">
              <strong className="font-semibold block">{revisingOffer.carrier}</strong>
              <div className="flex justify-between text-slate-600">
                <span>Quote #{revisingOffer.quoteNumber} (Version {revisingOffer.version || 1})</span>
                <span className="font-bold text-slate-900">Current: ${revisingOffer.annualPremium}/yr</span>
              </div>
            </div>

            {revisionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{revisionError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Annual Premium ($)
                </label>
                <div className="relative">
                  <DollarSign className="h-4 w-4 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="number"
                    value={revisedPremium}
                    onChange={(e) => setRevisedPremium(Number(e.target.value))}
                    className="w-full text-xs border border-slate-300 rounded-lg pl-8 pr-3 py-2 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                  <span>${Math.round(revisedPremium / 12)}/month</span>
                  <span className={revisedPremium < revisingOffer.annualPremium ? 'text-emerald-600 font-bold' : 'text-slate-600'}>
                    {revisedPremium < revisingOffer.annualPremium ? `Additional savings: $${revisingOffer.annualPremium - revisedPremium}/yr` : 'Premium retained / coverage improved'}
                  </span>
                </div>
              </div>

              {/* PM-3 Multi-Dimensional Coverage Adjustments */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <span className="font-semibold text-slate-800 block text-[11px] uppercase tracking-wider">
                  Coverage Terms & Deductibles (Multi-Dimensional Improvement)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-0.5">Collision Deductible</label>
                    <select
                      value={revisedCollisionDed}
                      onChange={(e) => setRevisedCollisionDed(Number(e.target.value))}
                      className="w-full text-xs border border-slate-300 rounded-lg p-1.5 bg-white"
                    >
                      <option value={250}>$250 (Improved)</option>
                      <option value={500}>$500</option>
                      <option value={1000}>$1,000</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-0.5">Comp Deductible</label>
                    <select
                      value={revisedCompDed}
                      onChange={(e) => setRevisedCompDed(Number(e.target.value))}
                      className="w-full text-xs border border-slate-300 rounded-lg p-1.5 bg-white"
                    >
                      <option value={100}>$100 (Improved)</option>
                      <option value={250}>$250</option>
                      <option value={500}>$500</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center space-x-1.5 cursor-pointer text-[11px] text-slate-700">
                    <input
                      type="checkbox"
                      checked={revisedRental}
                      onChange={(e) => setRevisedRental(e.target.checked)}
                      className="rounded text-blue-600 h-3.5 w-3.5"
                    />
                    <span>Rental Reimbursement</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer text-[11px] text-slate-700">
                    <input
                      type="checkbox"
                      checked={revisedRoadside}
                      onChange={(e) => setRevisedRoadside(e.target.checked)}
                      className="rounded text-blue-600 h-3.5 w-3.5"
                    />
                    <span>Roadside Assistance</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Revision Reason / Audit Justification
                </label>
                <select
                  value={revisionReason}
                  onChange={(e) => setRevisionReason(e.target.value as typeof revisionReason)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="DATA_CORRECTION">Data correction</option>
                  <option value="DOCUMENT_UPDATED">Supporting document updated</option>
                  <option value="PROVIDER_UPDATED_QUOTE">Provider updated quote</option>
                </select>
              </div>

              <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-200 text-[11px] text-blue-700 flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                <span>
                  Updates are independently initiated by your organization and remain versioned for policyholder review.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setReviseModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmRevise}
                disabled={revisionLoading || revisedPremium <= 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-1.5"
              >
                {revisionLoading ? 'Submitting...' : 'Submit Improved Offer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PM-3: Withdrawal Reason Modal */}
      {withdrawModalOpen && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                <h4 className="text-sm font-bold text-slate-900">
                Withdraw Offer
                </h4>
              </div>
              <button
                onClick={() => setWithdrawModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Withdraw from this policy review. Your active unselected offers will no longer be shown to the policyholder.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Withdrawal Reason</label>
                <select
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white"
                >
                  <option value="UNABLE_TO_MEET_TARGET">Unable to offer the requested pricing or terms</option>
                  <option value="CAPACITY_CONSTRAINT">Underwriting Capacity Limit Reached</option>
                  <option value="CARRIER_DECLINED">Carrier Declined Risk in Territory</option>
                  <option value="OUTSIDE_APPETITE">Outside Preferred Risk Appetite</option>
                  <option value="OTHER">Other Reason</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Optional Notes</label>
                <textarea
                  value={withdrawNotes}
                  onChange={(e) => setWithdrawNotes(e.target.value)}
                  placeholder="e.g. Rating tier adjustments filed by carrier in territory."
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 h-20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setWithdrawModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmWithdraw}
                disabled={actionLoading !== null}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs"
              >
                {actionLoading === 'withdraw' ? 'Withdrawing...' : 'Confirm Withdrawal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PM-2: Ask Rating Question Modal (Section 17) */}
      {showInfoRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Request Underwriting Info
                </h3>
              </div>
              <button
                onClick={() => setShowInfoRequestModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInformationRequest} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Requested Information Field
                </label>
                <select
                  value={requestedField}
                  onChange={(e) => setRequestedField(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-medium focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ANNUAL_MILEAGE">Annual Commute Mileage</option>
                  <option value="GARAGING_ZIP">Garaging Zip Code</option>
                  <option value="COMMUTE_DISTANCE">One-Way Commute Distance</option>
                  <option value="VEHICLE_PRIMARY_USE">Vehicle Primary Use (Pleasure/Commute/Business)</option>
                  <option value="DRIVER_TRAINING_COURSE">Defensive Driver Course Completion</option>
                  <option value="SECURITY_SYSTEM_TYPE">Anti-Theft / Telematics Device</option>
                  <option value="PRIOR_INSURANCE_MONTHS">Months of Continuous Prior Coverage</option>
                  <option value="CUSTOM">Custom Underwriting Question</option>
                </select>
              </div>

              {requestedField === 'CUSTOM' && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Custom Question Label
                  </label>
                  <input
                    type="text"
                    value={customFieldName}
                    onChange={(e) => setCustomFieldName(e.target.value)}
                    placeholder="e.g. Commercial garage storage"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Purpose Classification (Section 17)
                </label>
                <select
                  value={requestPurpose}
                  onChange={(e) => setRequestPurpose(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-medium focus:ring-1 focus:ring-blue-500"
                >
                  <option value="RATING_DISCOUNT">Rating Discount (Savings for Consumer)</option>
                  <option value="UNDERWRITING_ELIGIBILITY">Underwriting Eligibility (Market Fit)</option>
                  <option value="TIER_DETERMINATION">Tier Determination (Preferred Rate Placement)</option>
                  <option value="BINDING_REQUIREMENT">Binding Requirement (Carrier Mandate)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Explanation to Consumer (Why is this needed?)
                </label>
                <textarea
                  rows={3}
                  value={requestExplanation}
                  onChange={(e) => setRequestExplanation(e.target.value)}
                  placeholder="Explain why this question helps reduce premium or complete rating..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 text-blue-900 text-[11px] leading-relaxed">
                <strong>Reusable response:</strong> Once answered, the policyholder’s response can be made available to authorized providers reviewing the same policy so the policyholder is not asked twice.
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowInfoRequestModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={infoRequestSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  {infoRequestSubmitting ? 'Submitting...' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PM-4: Propose Underwriting Modification Modal */}
      {showProposeModModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Propose Underwriting Modification
                </h3>
              </div>
              <button
                onClick={() => setShowProposeModModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Underwriting review identified rate factor adjustments or vehicle/driver discrepancies. 
              The original selected offer version remains immutable. Proposing a modification requires explicit consumer acceptance before the policy can be bound.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Adjusted Annual Premium ($)
                </label>
                <div className="relative">
                  <DollarSign className="h-4 w-4 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="number"
                    value={modPremium}
                    onChange={(e) => setModPremium(e.target.value)}
                    placeholder="e.g. 2100"
                    className="w-full text-xs border border-slate-300 rounded-lg pl-8 pr-3 py-2 font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Underwriting Reason / Discrepancy Note
                </label>
                <textarea
                  rows={3}
                  value={modReason}
                  onChange={(e) => setModReason(e.target.value)}
                  placeholder="e.g. Minor moving violation discovered during MVR run; rate tier adjusted from Preferred to Standard."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-amber-500"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowProposeModModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!modPremium || !modReason || actionLoading !== null}
                onClick={handleProposeModification}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                {actionLoading === 'propose_mod' ? 'Submitting...' : 'Submit Modification'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PM-4: Confirm Bound Modal */}
      {showBoundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Issue Policy & Confirm Bound
                </h3>
              </div>
              <button
                onClick={() => setShowBoundModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Confirm that underwriting is complete and the carrier policy has been officially bound. 
              Enter the confirmed policy number to transition to BOUND status.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Carrier Policy Number
                </label>
                <input
                  type="text"
                  value={boundPolicyNumber}
                  onChange={(e) => setBoundPolicyNumber(e.target.value)}
                  placeholder="e.g. POL-TRV-9938102"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-mono font-bold text-slate-900 focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBoundModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!boundPolicyNumber.trim() || actionLoading !== null}
                onClick={() => handleUpdateBindingStatus('BOUND', boundPolicyNumber.trim())}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                {actionLoading === 'status_BOUND' ? 'Confirming...' : 'Confirm Policy Bound'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PM-5: Upload Issued Declarations Page Modal */}
      {showUploadIssuedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Upload Issued Declarations Page
                </h3>
              </div>
              <button
                onClick={() => setShowUploadIssuedModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Upload the carrier declarations document evidence. The engine will extract the issued terms and execute a deterministic reconciliation check against the agreed bound offer.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Document File Name
                </label>
                <input
                  type="text"
                  value={issuedDocFileName}
                  onChange={(e) => setIssuedDocFileName(e.target.value)}
                  placeholder="e.g. Progressive_Auto_DecPage_2026.pdf"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-mono text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Issued Policy Number
                </label>
                <input
                  type="text"
                  value={issuedPolicyNum}
                  onChange={(e) => setIssuedPolicyNum(e.target.value)}
                  placeholder="e.g. POL-PGR-88219"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-mono font-bold text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Issued Annual Premium ($)
                </label>
                <div className="relative">
                  <DollarSign className="h-4 w-4 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="number"
                    value={issuedAnnualPremium}
                    onChange={(e) => setIssuedAnnualPremium(e.target.value)}
                    placeholder="e.g. 2400"
                    className="w-full text-xs border border-slate-300 rounded-lg pl-8 pr-3 py-2 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Raw Declarations Text / Artifact Stream
                </label>
                <textarea
                  rows={3}
                  value={issuedDocRawContent}
                  onChange={(e) => setIssuedDocRawContent(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono text-[11px] text-slate-700"
                  placeholder="Raw dec page OCR text or artifact stream for SHA-256 evidence hashing"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowUploadIssuedModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isReconciling || !issuedDocFileName || !issuedPolicyNum}
                onClick={handleUploadAndReconcile}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                {isReconciling ? 'Reconciling...' : 'Upload & Reconcile Policy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
