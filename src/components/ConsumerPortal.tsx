import React, { useState, useEffect } from 'react';
import { 
  UploadCloud, 
  FileCheck2, 
  Shield, 
  ShieldCheck,
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Sparkles, 
  Car, 
  Calendar, 
  DollarSign, 
  Layers, 
  Info, 
  Lock, 
  Check, 
  X, 
  SlidersHorizontal, 
  ChevronRight,
  RefreshCw,
  ExternalLink,
  HelpCircle,
  FileSearch,
  Eye,
  Edit3,
  Archive,
  Download,
  Plus,
  ShieldAlert,
  Award,
  Clock,
  History,
  Radio,
  CheckCircle
} from 'lucide-react';
import { 
  Policy, 
  CoverageBaseline, 
  Challenge, 
  Offer, 
  OfferComparison, 
  FieldComparison,
  BindingHandoff,
  Selection,
  ConsentGrant,
  BindingModification,
  ReconciliationReport,
  PolicyVaultItem,
  CoverageItem,
  VaultDocument,
  BindingHandoffDossier,
  DetailedPostBindReconciliation,
  CompetitionActivityEvent,
  RoundDeadlineStatus,
  CompetitionEvaluationSummary
  ,PolicyNormalizationResult
  ,NormalizedPolicyFieldPath
} from '../types/insurance';
import { SAMPLE_DECLARATIONS_PAGES } from '../domain/policyIntelligence';
import { compareOfferAgainstBaseline, formatClassification } from '../domain/comparisonEngine';
import { useAuth } from '../context/AuthContext';
import { AccountDashboard } from './AccountDashboard';
import { apiFetch } from '../services/apiClient';

interface ConsumerPortalProps {
  challenge: Challenge | null;
  offers: Offer[];
  onRefreshData: () => void;
  onNavigateToProvider: () => void;
  initialStep?: ConsumerStep;
}

type ConsumerStep = 
  | 'ACCOUNT_DASHBOARD'
  | 'UPLOAD_EXTRACT' 
  | 'VERIFY_POLICY' 
  | 'SET_REQUIREMENTS' 
  | 'COMPETITION_ROOM' 
  | 'COMPARISON_DEEP_DIVE' 
  | 'BINDING_HANDOFF' 
  | 'RECONCILIATION_VAULT'
  | 'PRIVATE_VAULT';

export const ConsumerPortal: React.FC<ConsumerPortalProps> = ({
  challenge,
  offers,
  onRefreshData,
  onNavigateToProvider,
  initialStep
}) => {
  const { userProfile, isDemoUser, openAuthModal } = useAuth();

  // Step state - default to UPLOAD_EXTRACT when entering challenge flow
  const [currentStep, setCurrentStep] = useState<ConsumerStep>(initialStep || 'UPLOAD_EXTRACT');

  useEffect(() => {
    if (initialStep) {
      setCurrentStep(initialStep);
    }
  }, [initialStep]);

  // Vault state (Section 4)
  const [vaultDocs, setVaultDocs] = useState<VaultDocument[]>([]);
  const [showAddDocModal, setShowAddDocModal] = useState<boolean>(false);
  const [newDocName, setNewDocName] = useState<string>('Endorsement_NV_PolicyChange.pdf');
  const [newDocType, setNewDocType] = useState<VaultDocument['documentType']>('ENDORSEMENT');
  const [newDocNotes, setNewDocNotes] = useState<string>('Added towing endorsement');
  const [triggeringFinalRound, setTriggeringFinalRound] = useState<boolean>(false);
  const [triggeringIncumbent, setTriggeringIncumbent] = useState<boolean>(false);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [realDocumentId, setRealDocumentId] = useState<string | null>(null);
  const [realNormalization, setRealNormalization] = useState<PolicyNormalizationResult | null>(null);
  const [documentProcessing, setDocumentProcessing] = useState<string | null>(null);
  const [documentProcessingError, setDocumentProcessingError] = useState<string | null>(null);
  const [policyReviewValues, setPolicyReviewValues] = useState<Record<string, string>>({});
  const [policyEvidenceAttested, setPolicyEvidenceAttested] = useState(false);
  const [verifiedBaseline, setVerifiedBaseline] = useState<{ policyId:string; baselineId:string } | null>(null);

  const reviewFieldPaths: NormalizedPolicyFieldPath[] = [
    'policyNumber','carrier','namedInsured','jurisdiction','effectiveDate','expirationDate','annualPremium',
    'vehicle.vin','vehicle.year','vehicle.make','vehicle.model','vehicle.usage','vehicle.annualMileage',
    'vehicle.garagingZip','vehicle.ownership','coverage.bodilyInjury.perPersonLimit',
    'coverage.bodilyInjury.perAccidentLimit','coverage.propertyDamage.propertyLimit'
  ];
  const numericReviewFields = new Set<NormalizedPolicyFieldPath>([
    'annualPremium','vehicle.year','vehicle.annualMileage','coverage.bodilyInjury.perPersonLimit',
    'coverage.bodilyInjury.perAccidentLimit','coverage.propertyDamage.propertyLimit'
  ]);

  const fetchVaultDocs = async () => {
    try {
      const res = await apiFetch('/api/vault/documents');
      if (res.ok) {
        const docs = await res.json();
        setVaultDocs(docs);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // PM-2: Information Requests state
  const [consumerInfoRequests, setConsumerInfoRequests] = useState<any[]>([]);
  const [answeringRequestId, setAnsweringRequestId] = useState<string | null>(null);
  const [answerInputValue, setAnswerInputValue] = useState<string>('');

  const fetchConsumerInfoRequests = async () => {
    if (!challenge?.id) return;
    try {
      const res = await apiFetch(`/api/marketplace/challenges/${challenge.id}/information-requests`);
      if (res.ok) {
        const data = await res.json();
        setConsumerInfoRequests(data.requests || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // PM-3: Competition Lifecycle, Rounds & Activity Feed state
  const [deadlineStatus, setDeadlineStatus] = useState<RoundDeadlineStatus | null>(null);
  const [competitionEvaluation, setCompetitionEvaluation] = useState<CompetitionEvaluationSummary | null>(null);
  const [activityFeed, setActivityFeed] = useState<CompetitionActivityEvent[]>([]);
  const [retainingCurrentPolicy, setRetainingCurrentPolicy] = useState<boolean>(false);
  const [beginningReview, setBeginningReview] = useState(false);
  const [showActivityFeed, setShowActivityFeed] = useState<boolean>(true);

  const fetchCompetitionDetails = async () => {
    if (!challenge?.id) return;
    try {
      const [deadRes, evalRes, feedRes] = await Promise.all([
        apiFetch(`/api/marketplace/competition/${challenge.id}/deadline-status`),
        apiFetch(`/api/marketplace/competition/${challenge.id}/status`),
        apiFetch(`/api/marketplace/competition/${challenge.id}/activity-feed`)
      ]);
      if (deadRes.ok) {
        const deadData = await deadRes.json();
        setDeadlineStatus(deadData.status);
      }
      if (evalRes.ok) {
        const evalData = await evalRes.json();
        setCompetitionEvaluation(evalData);
      }
      if (feedRes.ok) {
        const feedData = await feedRes.json();
        setActivityFeed(feedData.events || []);
      }
    } catch (err) {
      console.error('Failed fetching competition details:', err);
    }
  };

  const handleBeginReview = async () => {
    if (!challenge?.id) return;
    setBeginningReview(true);
    try {
      const res = await apiFetch(`/api/marketplace/competition/${challenge.id}/begin-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        setActionToast('The submission window is closed. You can now review every submitted offer.');
        setTimeout(() => setActionToast(null), 3500);
        await fetchCompetitionDetails();
        onRefreshData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBeginningReview(false);
    }
  };

  const handleKeepCurrentPolicy = async () => {
    if (!challenge?.id) return;
    setRetainingCurrentPolicy(true);
    try {
      const res = await apiFetch(`/api/marketplace/competition/${challenge.id}/keep-current-policy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'Consumer elected to retain incumbent policy coverage without forced concession.'
        })
      });
      if (res.ok) {
        setActionToast('Your current policy was retained and the offer review was closed.');
        setTimeout(() => setActionToast(null), 4000);
        await fetchCompetitionDetails();
        onRefreshData();
      }
    } catch (e) {
      console.error('Failed to keep current policy:', e);
    } finally {
      setRetainingCurrentPolicy(false);
    }
  };

  const normalizeCanonicalRound = (r?: string): 'OPEN' | 'CONSUMER_REVIEW' => {
    if (!r) return 'OPEN';
    return r === 'OPEN' || r === 'ROUND_1_OPEN' ? 'OPEN' : 'CONSUMER_REVIEW';
  };

  const currentCanonicalRound = normalizeCanonicalRound(
    competitionEvaluation?.currentRound || (challenge?.status === 'CONSUMER_REVIEW' ? 'CONSUMER_REVIEW' : 'OPEN')
  );

  useEffect(() => {
    fetchVaultDocs();
    if (challenge?.id) {
      fetchConsumerInfoRequests();
      fetchCompetitionDetails();
    }
  }, [challenge?.id]);

  const handleAnswerInfoRequest = async (requestId: string, val: any) => {
    try {
      const res = await apiFetch(`/api/marketplace/information-requests/${requestId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answerValue: val })
      });
      if (res.ok) {
        setActionToast('Answer attested and shared as a reusable verified fact across all participating brokers.');
        setAnsweringRequestId(null);
        setAnswerInputValue('');
        await fetchConsumerInfoRequests();
        onRefreshData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUploadVaultDoc = async () => {
    try {
      const res = await apiFetch('/api/vault/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: newDocName,
          documentType: newDocType,
          notes: newDocNotes,
          carrier: activeBaseline?.carrier || 'Carrier',
          policyNumber: activePolicy?.policyNumber || 'POL-NV-49281'
        })
      });
      if (res.ok) {
        await fetchVaultDocs();
        setShowAddDocModal(false);
        setActionToast('Document registered in Private Policy Vault with SHA-256 hash');
        setTimeout(() => setActionToast(null), 3500);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTriggerFinalRound = async () => {
    if (!challenge) return;
    setTriggeringFinalRound(true);
    try {
      const res = await apiFetch(`/api/challenges/${challenge.id}/final-round`, { method: 'POST' });
      if (res.ok) {
        onRefreshData();
        setActionToast('Final offer window opened. Providers may submit a final revision.');
        setTimeout(() => setActionToast(null), 4000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTriggeringFinalRound(false);
    }
  };

  const handleTriggerIncumbentDefense = async () => {
    if (!challenge) return;
    setTriggeringIncumbent(true);
    try {
      const res = await apiFetch(`/api/challenges/${challenge.id}/incumbent-defense`, { method: 'POST' });
      if (res.ok) {
        onRefreshData();
        setActionToast('Your current provider was invited to send a retention offer.');
        setTimeout(() => setActionToast(null), 4000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTriggeringIncumbent(false);
    }
  };

  // Policy & Baseline state
  const [activePolicy, setActivePolicy] = useState<Policy | null>(challenge ? {
    id: challenge.baseline.policyId,
    policyNumber: '4928-1029-41-01',
    carrier: challenge.baseline.carrier,
    jurisdiction: 'NV',
    namedInsured: 'Jane Doe',
    effectiveDate: challenge.baseline.effectiveDate,
    expirationDate: challenge.baseline.expirationDate,
    termMonths: 12,
    annualPremium: challenge.baseline.baselineAnnualPremium,
    monthlyPremium: challenge.baseline.baselineMonthlyPremium,
    status: 'VERIFIED',
    drivers: [{
      id: 'DRV-1',
      name: 'Jane Doe',
      isPrimary: true,
      licenseState: 'NV',
      licenseNumberMasked: 'NV•••••8912',
      age: 38
    }],
    vehicles: [challenge.baseline.vehicle],
    coverages: challenge.baseline.coverages,
    sourceDocumentId: 'DOC-NV-49281',
    sourceDocumentName: 'GEICO_Auto_Dec_Page_NV49281.pdf'
  } : null);

  const [activeBaseline, setActiveBaseline] = useState<CoverageBaseline | null>(challenge ? challenge.baseline : null);
  // Selected Offer for detail view & handoff
  const [selectedOfferId, setSelectedOfferId] = useState<string>('OFFER-B');
  const [handoffResult, setHandoffResult] = useState<BindingHandoff | null>(null);
  const [reconciliationReport, setReconciliationReport] = useState<ReconciliationReport | null>(null);

  // PM-3 Binding Dossier & Informed Consent states
  const [bindingDossier, setBindingDossier] = useState<BindingHandoffDossier | null>(null);
  const [detailedReconciliation, setDetailedReconciliation] = useState<DetailedPostBindReconciliation | null>(null);
  const [showInformedConsentModal, setShowInformedConsentModal] = useState<boolean>(false);
  const [pendingSelectionOfferId, setPendingSelectionOfferId] = useState<string | null>(null);
  const [acknowledgedVariations, setAcknowledgedVariations] = useState<string[]>([]);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [isSubmittingHandoff, setIsSubmittingHandoff] = useState<boolean>(false);

  // PM-4 Binding & Controlled Disclosure States
  const [activeConsentGrant, setActiveConsentGrant] = useState<ConsentGrant | null>(null);
  const [activeModification, setActiveModification] = useState<BindingModification | null>(null);
  const [authorizedFields, setAuthorizedFields] = useState<string[]>([
    'namedInsured',
    'addressLine1',
    'garagingAddress',
    'vin',
    'driverLicenseNumber',
    'email',
    'phone'
  ]);
  const [isGrantingConsent, setIsGrantingConsent] = useState<boolean>(false);
  const [isResolvingMod, setIsResolvingMod] = useState<boolean>(false);

  // PM-5 Issued Policy Reconciliation & Policy Vault States
  const [pm5Report, setPm5Report] = useState<ReconciliationReport | null>(null);
  const [policyVaultItems, setPolicyVaultItems] = useState<PolicyVaultItem[]>([]);
  const [disputeNotes, setDisputeNotes] = useState<string>('');
  const [isVerifyingReconciliation, setIsVerifyingReconciliation] = useState<boolean>(false);

  // Evidence inspection drawer
  const [inspectingEvidence, setInspectingEvidence] = useState<{
    fieldName: string;
    snippet: string;
    docName: string;
    page: number;
    confidence: number;
  } | null>(null);

  // Plain-language AI explanation
  const [aiExplanation, setAiExplanation] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState<boolean>(false);

  // Filter for detailed comparison
  const [comparisonFilter, setComparisonFilter] = useState<'ALL' | 'DIFFERENCES' | 'REDUCTIONS' | 'IMPROVEMENTS'>('ALL');

  // Compute live comparisons against active baseline
  const activeComparisons: OfferComparison[] = React.useMemo(() => {
    if (!activeBaseline) return [];
    return offers.map(o => compareOfferAgainstBaseline(activeBaseline, o));
  }, [activeBaseline, offers]);

  const selectedComparison = activeComparisons.find(c => c.offerId === selectedOfferId) || activeComparisons[0];

  // Request AI explanation when selected offer changes
  useEffect(() => {
    let isCancelled = false;
    if (selectedComparison) {
      setLoadingAi(true);
      apiFetch('/api/explain-comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comparison: selectedComparison })
      })
        .then(res => {
          if (!res.ok) throw new Error(`HTTP error ${res.status}`);
          return res.json();
        })
        .then(data => {
          if (!isCancelled) {
            setAiExplanation(data.explanation || selectedComparison.summaryHeadline);
            setLoadingAi(false);
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setAiExplanation(selectedComparison.summaryHeadline);
            setLoadingAi(false);
          }
        });
    }
    return () => {
      isCancelled = true;
    };
  }, [selectedOfferId, selectedComparison?.offerId]);

  // Handle sample upload
  const handleSelectSample = async (sampleId: string) => {
    const res = await apiFetch('/api/documents/upload-sample', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sampleId })
    });
    const data = await res.json();
    if (data.success) {
      setActivePolicy(data.policy);
      setCurrentStep('VERIFY_POLICY');
    }
  };

  const handleRealPolicyUpload = async (file?: File) => {
    if (!file) return;
    setDocumentProcessingError(null);
    setRealNormalization(null);
    try {
      setDocumentProcessing('Uploading immutable policy evidence…');
      const ingest = await apiFetch('/api/policy-documents/ingest', {
        method:'POST', headers:{'Content-Type':'application/pdf','X-Document-Filename':file.name,
          'Idempotency-Key':crypto.randomUUID()}, body:file
      });
      const ingested = await ingest.json();
      if (!ingest.ok) throw new Error(ingested.message || ingested.error || 'Upload failed');
      const documentId = ingested.document.id;
      setRealDocumentId(documentId);
      setDocumentProcessing('Scanning policy evidence for malware…');
      const scan = await apiFetch(`/api/policy-documents/${documentId}/scan`, {method:'POST'});
      const scanned = await scan.json();
      if (!scan.ok || scanned.malwareStatus !== 'CLEAN') throw new Error(scanned.message || 'Document did not receive a CLEAN scan disposition');
      setDocumentProcessing('Extracting policy evidence with Document AI…');
      const extract = await apiFetch(`/api/policy-documents/${documentId}/extract`, {method:'POST'});
      const extracted = await extract.json();
      if (!extract.ok) throw new Error(extracted.message || extracted.error || 'Extraction failed');
      setRealNormalization(extracted.normalization);
      setPolicyReviewValues(Object.fromEntries(
        reviewFieldPaths.map(fieldPath => [fieldPath,
          String(extracted.normalization.fields.find((field: any) => field.fieldPath === fieldPath)?.value ?? '')])
      ));
      setPolicyEvidenceAttested(false);
      setVerifiedBaseline(null);
      setDocumentProcessing(null);
    } catch (error:any) {
      setDocumentProcessing(null);
      setDocumentProcessingError(error?.message || 'Document processing failed');
    }
  };

  const handleVerifyRealPolicy = async () => {
    if (!realDocumentId || !realNormalization || !policyEvidenceAttested) return;
    setDocumentProcessingError(null);
    setDocumentProcessing('Saving your confirmed policy facts…');
    try {
      for (const fieldPath of reviewFieldPaths) {
        const raw = (policyReviewValues[fieldPath] || '').trim();
        if (!raw) throw new Error(`Please complete ${fieldPath}.`);
        const afterValue = numericReviewFields.has(fieldPath) ? Number(raw) : raw;
        if (numericReviewFields.has(fieldPath) && !Number.isFinite(afterValue as number)) {
          throw new Error(`${fieldPath} must be a valid number.`);
        }
        const correction = await apiFetch(`/api/policy-documents/${realDocumentId}/corrections`, {
          method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({fieldPath, afterValue})
        });
        const correctionBody = await correction.json();
        if (!correction.ok) throw new Error(correctionBody.message || correctionBody.error || `Could not save ${fieldPath}`);
      }
      setDocumentProcessing('Creating your immutable verified coverage baseline…');
      const verification = await apiFetch(`/api/policy-documents/${realDocumentId}/verify`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({attested:true})
      });
      const result = await verification.json();
      if (!verification.ok) throw new Error(result.message || result.error || 'Policy verification failed');
      setVerifiedBaseline({policyId:result.policy.id, baselineId:result.baseline.id});
      setActivePolicy(result.policy);
      setDocumentProcessing(null);
      onRefreshData();
    } catch (error:any) {
      setDocumentProcessing(null);
      setDocumentProcessingError(error?.message || 'Policy verification failed');
    }
  };

  // Confirm extracted policy and create baseline
  const handleConfirmPolicy = async () => {
    if (!activePolicy) return;
    
    // Create baseline
    const res = await apiFetch('/api/baselines/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        policyId: activePolicy.id,
        verifiedBy: activePolicy.namedInsured
      })
    });
    const data = await res.json();
    if (data.success) {
      setActiveBaseline(data.baseline);
      setCurrentStep('SET_REQUIREMENTS');
    }
  };

  // Launch challenge
  const handleLaunchChallenge = async () => {
    if (!activeBaseline) return;
    const res = await apiFetch('/api/challenges/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baselineId: activeBaseline.id
      })
    });
    const data = await res.json();
    if (data.success) {
      onRefreshData();
      setCurrentStep('COMPETITION_ROOM');
    }
  };

  // Select offer & proceed to binding handoff (PM-3 Section 40 Informed Consent)
  const handleInitiateSelectOffer = (offerId: string) => {
    const offer = offers.find(o => o.id === offerId);
    if (!offer) return;
    const comp = activeComparisons.find(c => c.offerId === offerId);

    // If offer has material reductions, open Section 40 Informed Consent sign-off modal
    if (comp && comp.materialReductions.length > 0) {
      setPendingSelectionOfferId(offerId);
      setAcknowledgedVariations([]);
      setConsentError(null);
      setShowInformedConsentModal(true);
      return;
    }

    // Otherwise directly execute binding handoff
    executeBindingHandoff(offerId, true, []);
  };

  const executeBindingHandoff = async (
    offerId: string,
    consumerConsentGiven: boolean,
    acknowledgedReductions: string[]
  ) => {
    if (!challenge) return;
    setIsSubmittingHandoff(true);
    setConsentError(null);

    try {
      const offer = offers.find(o => o.id === offerId);
      const res = await apiFetch(`/api/marketplace/challenges/${challenge.id}/select-version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId,
          versionNumber: offer?.version || 1
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setHandoffResult(data.handoff);
        setShowInformedConsentModal(false);
        setPendingSelectionOfferId(null);
        setCurrentStep('BINDING_HANDOFF');
        onRefreshData();
      } else {
        setConsentError(data.error || 'Failed to select offer version');
      }
    } catch (e: any) {
      setConsentError(e.message || 'Network error selecting offer');
    } finally {
      setIsSubmittingHandoff(false);
    }
  };

  const handleGrantConsent = async () => {
    if (!handoffResult || !challenge) return;
    setIsGrantingConsent(true);
    setConsentError(null);
    try {
      const res = await apiFetch(`/api/marketplace/binding/${handoffResult.id}/grant-consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: challenge.id,
          authorizedFieldNames: authorizedFields,
          purpose: 'STAGE_C_BINDING_DISCLOSURE',
          purposeExplanation: 'Authorization to disclose Stage C PII for policy binding handoff'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActiveConsentGrant(data.consentGrant);
        // Refresh handoff status
        const hRes = await apiFetch(`/api/marketplace/binding/${handoffResult.id}`);
        const hData = await hRes.json();
        if (hRes.ok && hData.handoff) {
          setHandoffResult(hData.handoff);
          if (hData.modifications?.length > 0) {
            setActiveModification(hData.modifications[0]);
          }
        }
      } else {
        setConsentError(data.error || 'Failed to grant consent');
      }
    } catch (e: any) {
      setConsentError(e.message || 'Error granting consent');
    } finally {
      setIsGrantingConsent(false);
    }
  };

  const handleRevokeConsent = async () => {
    if (!handoffResult || !activeConsentGrant) return;
    try {
      const res = await apiFetch(`/api/marketplace/binding/${handoffResult.id}/revoke-consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consentGrantId: activeConsentGrant.id
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActiveConsentGrant(data.consentGrant);
      }
    } catch (e: any) {
      setConsentError(e.message || 'Error revoking consent');
    }
  };

  const handleResolveModification = async (decision: 'ACCEPT' | 'REJECT') => {
    if (!handoffResult || !activeModification) return;
    setIsResolvingMod(true);
    try {
      const endpoint = decision === 'ACCEPT' ? 'accept-modification' : 'reject-modification';
      const res = await apiFetch(`/api/marketplace/binding/${handoffResult.id}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modificationId: activeModification.id
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActiveModification(data.modification);
        setHandoffResult(data.handoff);
      }
    } catch (e: any) {
      setConsentError(e.message || 'Error resolving modification');
    } finally {
      setIsResolvingMod(false);
    }
  };

  // PM-5 Fetch Reconciliation & Policy Vault data
  const fetchPM5Data = async (targetHandoffId?: string) => {
    try {
      const vRes = await apiFetch('/api/marketplace/vault/policies');
      if (vRes.ok) {
        const vData = await vRes.json();
        if (vData.success && Array.isArray(vData.vaultItems)) {
          setPolicyVaultItems(vData.vaultItems);
        }
      }
      const hid = targetHandoffId || handoffResult?.id;
      if (hid) {
        const rRes = await apiFetch(`/api/marketplace/binding/${hid}/reconciliation`);
        if (rRes.ok) {
          const rData = await rRes.json();
          if (rData.success && rData.report) {
            setPm5Report(rData.report);
          }
        }
      }
    } catch (e) {
      console.error('Error fetching PM-5 data:', e);
    }
  };

  // PM-5 Consumer review & dispute / accept variance
  const handleConsumerVerify = async (decision: 'ACCEPT_VARIANCE' | 'DISPUTE_REMEDIATION_REQUESTED') => {
    if (!handoffResult?.id) return;
    setIsVerifyingReconciliation(true);
    try {
      const res = await apiFetch(`/api/marketplace/binding/${handoffResult.id}/consumer-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reconciliationReportId: pm5Report?.id,
          decision,
          disputeNotes: decision === 'DISPUTE_REMEDIATION_REQUESTED' ? disputeNotes : undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPm5Report(data.report);
        await fetchPM5Data(handoffResult.id);
        onRefreshData();
      }
    } catch (e) {
      console.error('Error during consumer verification:', e);
    } finally {
      setIsVerifyingReconciliation(false);
    }
  };

  // Reconcile issued policy (PM-3 Detailed Post-Bind Reconciliation)
  const handleReconcileIssued = async (isDiscrepantSimulation: boolean) => {
    if (!handoffResult) return;
    const selectedOffer = offers.find(o => o.id === handoffResult.selectedOfferId);
    if (!selectedOffer) return;

    const baseCoverages = selectedOffer.coverages.map(c => ({
      code: c.code,
      name: c.name,
      category: c.category,
      perPersonLimit: c.perPersonLimit,
      perAccidentLimit: c.perAccidentLimit,
      propertyLimit: c.propertyLimit,
      deductible: c.deductible,
      isIncluded: c.isIncluded
    }));

    const issuedCoverages = isDiscrepantSimulation
      ? baseCoverages.map(c => {
          if (c.code === 'COLLISION') return { ...c, deductible: 1000 }; // Stealth increase!
          if (c.code === 'RENTAL_REIMBURSEMENT') return { ...c, isIncluded: false }; // Endorsement dropped!
          return c;
        })
      : baseCoverages;

    const issuedData = {
      policyNumber: 'ISSUED-CARRIER-78912',
      annualPremium: isDiscrepantSimulation ? selectedOffer.annualPremium + 180 : selectedOffer.annualPremium,
      collisionDeductible: isDiscrepantSimulation ? 1000 : (selectedOffer.coverages.find(c => c.code === 'COLLISION')?.deductible || 500),
      rentalIncluded: isDiscrepantSimulation ? false : (selectedOffer.coverages.find(c => c.code === 'RENTAL_REIMBURSEMENT')?.isIncluded ?? true),
      coverages: issuedCoverages
    };

    const res = await apiFetch('/api/reconciliation/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handoffId: handoffResult.id,
        dossierId: bindingDossier?.id,
        issuedData
      })
    });
    const data = await res.json();
    if (data.success) {
      if (data.isDetailed) {
        setDetailedReconciliation(data.report);
      }
      setReconciliationReport(data.report);
      setCurrentStep('RECONCILIATION_VAULT');
      onRefreshData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Consumer Account & Session Status Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-emerald-400 font-extrabold text-sm flex items-center justify-center shadow-xs shrink-0">
            {userProfile?.displayName?.charAt(0).toUpperCase() || 'P'}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-slate-900">
                {userProfile?.displayName || 'Jane Doe'}
              </span>
              {isDemoUser ? (
                <span className="text-[10px] font-mono bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                  Demo Session
                </span>
              ) : (
                <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>Cloud Account</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-mono">
              {userProfile?.email} · Deliberate Progressive Disclosure Active
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setCurrentStep('ACCOUNT_DASHBOARD')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 ${
              currentStep === 'ACCOUNT_DASHBOARD'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-emerald-500" />
            <span>My Account & Orders</span>
          </button>

          <button
            type="button"
            onClick={() => openAuthModal()}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer flex items-center space-x-1"
          >
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span>{isDemoUser ? 'Sign In / Register' : 'Switch Account'}</span>
          </button>
        </div>
      </div>

      {/* Transaction Pipeline Breadcrumb / Progress Bar */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4">
        <div className="flex items-center justify-between overflow-x-auto pb-1 text-xs gap-2">
          <button
            onClick={() => setCurrentStep('ACCOUNT_DASHBOARD')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition cursor-pointer ${
              currentStep === 'ACCOUNT_DASHBOARD'
                ? 'bg-slate-900 text-white font-bold shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>My Account & Binders</span>
          </button>

          <span className="text-slate-300 font-bold hidden sm:inline">|</span>

          <button
            onClick={() => setCurrentStep('UPLOAD_EXTRACT')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
              currentStep === 'UPLOAD_EXTRACT'
                ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">1</span>
            <span>Upload Dec Page</span>
          </button>

          <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />

          <button
            onClick={() => setCurrentStep('VERIFY_POLICY')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
              currentStep === 'VERIFY_POLICY'
                ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">2</span>
            <span>Extract & Verify</span>
          </button>

          <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />

          <button
            onClick={() => setCurrentStep('SET_REQUIREMENTS')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
              currentStep === 'SET_REQUIREMENTS'
                ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">3</span>
            <span>Requirements & Baseline</span>
          </button>

          <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />

          <button
            onClick={() => setCurrentStep('COMPETITION_ROOM')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
              currentStep === 'COMPETITION_ROOM'
                ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">4</span>
            <span className="font-semibold text-emerald-800">Offer Review</span>
          </button>

          <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />

          <button
            onClick={() => setCurrentStep('COMPARISON_DEEP_DIVE')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
              currentStep === 'COMPARISON_DEEP_DIVE'
                ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">5</span>
            <span>Field-by-Field Matrix</span>
          </button>

          <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />

          <button
            onClick={() => setCurrentStep('BINDING_HANDOFF')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
              currentStep === 'BINDING_HANDOFF'
                ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">6</span>
            <span>Binding Handoff</span>
          </button>

          <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />

          <button
            onClick={() => { setCurrentStep('RECONCILIATION_VAULT'); fetchPM5Data(); }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
              currentStep === 'RECONCILIATION_VAULT'
                ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">7</span>
            <span>Reconciliation</span>
          </button>

          <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />

          <button
            onClick={() => { setCurrentStep('PRIVATE_VAULT'); fetchVaultDocs(); fetchPM5Data(); }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
              currentStep === 'PRIVATE_VAULT'
                ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">8</span>
            <Archive className="w-3.5 h-3.5" />
            <span>Policy Vault</span>
          </button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionToast && (
        <div className="bg-emerald-900 text-white px-4 py-3 rounded-xl shadow-md border border-emerald-700 flex items-center justify-between text-xs animate-fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{actionToast}</span>
          </div>
          <button onClick={() => setActionToast(null)} className="text-emerald-300 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ACCOUNT HUB: MY CHALLENGES & ORDERS                                      */}
      {/* ========================================================================= */}
      {currentStep === 'ACCOUNT_DASHBOARD' && (
        <AccountDashboard
          onStartNewChallenge={() => setCurrentStep('UPLOAD_EXTRACT')}
          onSelectChallenge={() => setCurrentStep('COMPETITION_ROOM')}
          onViewOrderDossier={() => setCurrentStep('BINDING_HANDOFF')}
        />
      )}

      {/* ========================================================================= */}
      {/* STEP 1: UPLOAD POLICY                                                     */}
      {/* ========================================================================= */}
      {currentStep === 'UPLOAD_EXTRACT' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 md:p-8 space-y-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Share Your Policy Once
            </h2>
            <p className="mt-1 text-slate-600 text-sm leading-relaxed">
              Upload your existing auto insurance declarations page. We extract your current coverage and premium so eligible providers can independently review it and send offers — <strong className="text-slate-900 font-medium">without you filling out repeated forms</strong>.
            </p>
          </div>

          {/* Drag & Drop Box */}
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 hover:bg-slate-100/70 transition">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800">
              Drag and drop your auto declarations page (PDF, PNG, JPEG)
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Supports 1-page Dec Pages, multi-vehicle policies, or renewal notices
            </p>

            <div className="mt-4 flex items-center justify-center space-x-3">
              <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-4 py-2 rounded-lg transition shadow-xs">
                <span>Select File from Computer</span>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={event => handleRealPolicyUpload(event.target.files?.[0])}
                />
              </label>
            </div>
          </div>

          {(documentProcessing || documentProcessingError || realNormalization) && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-3">
              {documentProcessing && <p className="text-sm font-semibold text-blue-700">{documentProcessing}</p>}
              {documentProcessingError && <p className="text-sm font-semibold text-red-700">{documentProcessingError}</p>}
              {realNormalization && (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">Real policy extraction complete</p>
                      <p className="text-xs text-slate-500 font-mono">Evidence {realDocumentId}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${realNormalization.status === 'READY_FOR_CONSUMER' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{realNormalization.status.replace(/_/g,' ')}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {realNormalization.fields.map(field => (
                      <div key={field.fieldPath} className="bg-white border border-slate-200 rounded p-3">
                        <p className="text-[11px] uppercase text-slate-500">{field.fieldPath}</p>
                        <p className="text-sm font-semibold text-slate-900 break-words">{String(field.value)}</p>
                        <p className="text-[11px] text-blue-700">Page {field.evidence.pageNumber} · {Math.round(field.confidence*100)}% confidence</p>
                      </div>
                    ))}
                  </div>
                  {realNormalization.criticalIssues.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-3">
                      <p className="text-xs font-bold text-amber-900">Consumer confirmation required</p>
                      {realNormalization.criticalIssues.map(issue => <p key={issue} className="text-xs text-amber-800">• {issue}</p>)}
                    </div>
                  )}
                  <div className="border-t border-slate-200 pt-4 space-y-4">
                    <div>
                      <p className="text-sm font-bold text-slate-900">Review every fact before creating your baseline</p>
                      <p className="text-xs text-slate-600">These values become the standard carriers must match. Correct OCR mistakes and fill every blank from your policy document.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {reviewFieldPaths.map(fieldPath => (
                        <label key={fieldPath} className="text-xs font-semibold text-slate-700">
                          <span className="block mb-1">{fieldPath}</span>
                          <input
                            aria-label={fieldPath}
                            type={numericReviewFields.has(fieldPath) ? 'number' : fieldPath.endsWith('Date') ? 'date' : 'text'}
                            value={policyReviewValues[fieldPath] || ''}
                            onChange={event => {
                              setPolicyReviewValues(current => ({...current, [fieldPath]:event.target.value}));
                              setPolicyEvidenceAttested(false);
                            }}
                            placeholder={fieldPath === 'vehicle.usage' ? 'COMMUTE, PLEASURE, or BUSINESS' : fieldPath === 'vehicle.ownership' ? 'OWNED, FINANCED, or LEASED' : undefined}
                            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900"
                          />
                        </label>
                      ))}
                    </div>
                    <label className="flex items-start gap-2 rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950">
                      <input
                        type="checkbox"
                        checked={policyEvidenceAttested}
                        onChange={event => setPolicyEvidenceAttested(event.target.checked)}
                        className="mt-0.5"
                      />
                      <span>I reviewed these facts against my policy and attest that they are accurate. I understand they will create my immutable coverage baseline.</span>
                    </label>
                    <button
                      onClick={handleVerifyRealPolicy}
                      disabled={!policyEvidenceAttested || Boolean(documentProcessing) || Boolean(verifiedBaseline)}
                      className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {verifiedBaseline ? 'Verified Baseline Created' : 'Confirm Facts & Create Coverage Baseline'}
                    </button>
                    {verifiedBaseline && (
                      <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                        <p className="font-bold">Your verified coverage baseline is durable and ready.</p>
                        <p className="font-mono break-all">Policy {verifiedBaseline.policyId}</p>
                        <p className="font-mono break-all">Baseline {verifiedBaseline.baselineId}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Sample Policies for Instant Demonstration */}
          <div className="pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Or instantly test with a verified sample declarations page:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SAMPLE_DECLARATIONS_PAGES.map(sample => (
                <div 
                  key={sample.id}
                  onClick={() => handleSelectSample(sample.id)}
                  className="border border-slate-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/30 rounded-lg p-4 cursor-pointer transition flex items-start space-x-3 group"
                >
                  <div className="w-9 h-9 rounded bg-slate-100 text-slate-600 group-hover:bg-emerald-600 group-hover:text-white flex items-center justify-center transition shrink-0">
                    <FileCheck2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{sample.carrier}</h4>
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {sample.jurisdiction}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-mono mt-0.5">
                      ${sample.policyData.annualPremium?.toLocaleString()}/yr (${sample.policyData.monthlyPremium}/mo)
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                      {sample.name} • {sample.fileSize}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: VERIFY EXTRACTED POLICY & SOURCE PROVENANCE                       */}
      {/* ========================================================================= */}
      {currentStep === 'VERIFY_POLICY' && activePolicy && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                OCR & PROVENANCE EXTRACTION COMPLETE
              </span>
              <h2 className="text-2xl font-bold text-slate-900 mt-1">
                Verify Your Policy Baseline
              </h2>
              <p className="text-sm text-slate-600">
                Review the extracted terms from <span className="font-semibold text-slate-800">{activePolicy.sourceDocumentName}</span>. Confirm or correct the information before providers can review it.
              </p>
            </div>

            <div className="flex items-center space-x-3 shrink-0">
              <button
                onClick={handleConfirmPolicy}
                className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-5 py-2.5 rounded-lg transition shadow-xs"
              >
                <Check className="w-4 h-4" />
                <span>CONFIRM POLICY</span>
              </button>
            </div>
          </div>

          {/* Policy Overview Summary Card */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <p className="text-xs text-slate-500 uppercase font-medium">Current Carrier</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{activePolicy.carrier}</p>
              <p className="text-xs text-slate-500 font-mono">Pol #{activePolicy.policyNumber}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-medium">Named Insured</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{activePolicy.namedInsured}</p>
              <p className="text-xs text-slate-500">Jurisdiction: {activePolicy.jurisdiction}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-medium">Current Premium</p>
              <p className="text-lg font-bold text-emerald-700 mt-0.5">
                ${activePolicy.annualPremium.toLocaleString()}/yr
              </p>
              <p className="text-xs text-slate-500">(${activePolicy.monthlyPremium}/month)</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-medium">Insured Vehicle</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">
                {activePolicy.vehicles[0]?.year} {activePolicy.vehicles[0]?.make} {activePolicy.vehicles[0]?.model}
              </p>
              <p className="text-xs text-slate-500 font-mono truncate">VIN: {activePolicy.vehicles[0]?.vin}</p>
            </div>
          </div>

          {/* Extracted Coverages Table with Source Evidence Popover */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="py-2.5 px-3">Coverage Name</th>
                  <th className="py-2.5 px-3">Extracted Limits / Deductible</th>
                  <th className="py-2.5 px-3">Included</th>
                  <th className="py-2.5 px-3">Extraction Provenance</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activePolicy.coverages.map(cov => (
                  <tr key={cov.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900">{cov.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{cov.code}</div>
                    </td>
                    <td className="py-3 px-3">
                      {cov.perPersonLimit && cov.perAccidentLimit ? (
                        <span className="font-semibold text-slate-800">
                          ${(cov.perPersonLimit / 1000)}k / ${(cov.perAccidentLimit / 1000)}k
                        </span>
                      ) : cov.propertyLimit ? (
                        <span className="font-semibold text-slate-800">${cov.propertyLimit.toLocaleString()}</span>
                      ) : cov.deductible !== undefined ? (
                        <span className="font-semibold text-amber-700">${cov.deductible} Deductible</span>
                      ) : (
                        <span className="text-slate-600">{cov.notes || 'Standard'}</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {cov.isIncluded ? (
                        <span className="inline-flex items-center space-x-1 text-emerald-700 font-semibold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Included</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 text-slate-400 text-[11px]">
                          <X className="w-3.5 h-3.5" />
                          <span>Excluded</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {cov.evidence ? (
                        <button
                          onClick={() => setInspectingEvidence({
                            fieldName: cov.name,
                            snippet: cov.evidence!.extractedSnippet,
                            docName: cov.evidence!.documentName,
                            page: cov.evidence!.pageNumber,
                            confidence: cov.evidence!.confidence
                          })}
                          className="inline-flex items-center space-x-1 text-[11px] text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200 transition"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Page {cov.evidence.pageNumber} ({Math.round(cov.evidence.confidence * 100)}% conf)</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">Verified</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="text-[11px] text-slate-400 font-medium">Locked Evidence</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              onClick={() => setCurrentStep('UPLOAD_EXTRACT')}
              className="text-xs text-slate-600 hover:text-slate-900"
            >
              ← Upload a different policy
            </button>
            <button
              onClick={handleConfirmPolicy}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-6 py-2.5 rounded-lg transition shadow-xs"
            >
              <span>CONFIRM POLICY & CREATE BASELINE</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: CONFIRM VERIFIED BASELINE & OPEN OFFER REVIEW                      */}
      {/* ========================================================================= */}
      {currentStep === 'SET_REQUIREMENTS' && activeBaseline && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 md:p-8 space-y-6">
          <div>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              VERIFIED POLICY BASELINE
            </span>
            <h2 className="text-2xl font-bold text-slate-900 mt-1">
              Open Your Policy for Provider Offers
            </h2>
            <p className="text-sm text-slate-600">
              Your verified existing policy is the reference point. Providers independently determine the price, coverage, and terms they are authorized to offer.
            </p>
          </div>

          {/* Core Doctrine Callout */}
          <div className="bg-slate-900 text-white p-5 rounded-xl space-y-2 border border-slate-800">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <Shield className="w-4 h-4" />
              <span>Factual Comparison Standard</span>
            </div>
            <p className="text-base font-semibold text-slate-100">
              Offers are compared with your current policy line by line.
            </p>
            <p className="text-xs text-slate-400">
              Open Policy displays premium and coverage differences. It does not rank, recommend, negotiate, or decide whether an offer is better for you.
            </p>
          </div>

          {/* Launch Action */}
          <div className="pt-4 flex items-center justify-between border-t border-slate-200">
            <button
              onClick={() => setCurrentStep('VERIFY_POLICY')}
              className="text-xs text-slate-600 hover:text-slate-900"
            >
              ← Back to verified policy
            </button>
            <button
              onClick={handleLaunchChallenge}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-8 py-3 rounded-xl transition shadow-md shadow-emerald-900/20"
            >
              <Sparkles className="w-5 h-5" />
              <span>SHARE MY POLICY</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 4: SIGNATURE CONSUMER INTERFACE — THE COMPETITION ROOM               */}
      {/* ========================================================================= */}
      {currentStep === 'COMPETITION_ROOM' && (
        <div className="space-y-6">
          {/* Header of Competition Room */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
                  {challenge?.referenceNumber || 'POLICY REVIEW #NV-49281'}
                </span>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>OFFERS OPEN</span>
                </span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mt-1">
                Your Offers
              </h2>
              <p className="text-xs text-slate-600">
                Providers review the same verified policy information independently. <strong className="text-slate-800 font-semibold">Coverage and price are shown separately</strong> so a lower price cannot conceal a coverage reduction.
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={() => setCurrentStep('COMPARISON_DEEP_DIVE')}
                className="flex items-center space-x-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 px-3.5 py-2 rounded-lg transition"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Deep Field Comparison</span>
              </button>
              <button
                onClick={onNavigateToProvider}
                className="flex items-center space-x-1 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-3.5 py-2 rounded-lg transition"
              >
                <span>Submit as Provider</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Section 11 & 12 Progressive Disclosure & Dynamic Competition Mechanics */}
          <div className="bg-slate-900 text-white rounded-xl p-4 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                    Contact details withheld during provider review
                  </span>
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                    Zero Direct Contact Shared
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Your name, street address, and VIN are strictly masked. Providers rate against an anonymous risk vector (NV-89101, vehicle class, preferred tier).
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-800">
                Other providers’ offers are not visible
              </span>
            </div>
          </div>

          {/* PR-2: one submission window followed by policyholder review */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200">
                  <Radio className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Offer Submission Window
                    </span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                      currentCanonicalRound === 'OPEN'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}>
                      {currentCanonicalRound === 'OPEN' && 'Open for Offers'}
                      {currentCanonicalRound === 'CONSUMER_REVIEW' && 'Policyholder Review'}
                    </span>
                    {deadlineStatus?.formattedRemaining && (
                      <span className="text-[11px] font-semibold text-slate-700 bg-amber-50 px-2.5 py-0.5 rounded-md flex items-center gap-1 border border-amber-200">
                        <Clock className="h-3 w-3 text-amber-600" />
                        {deadlineStatus.formattedRemaining}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">
                    Providers submit offers independently while the window is open
                  </h3>
                </div>
              </div>

              {/* Policyholder controls */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Keep Current Policy (Incumbent Defended) Button */}
                {challenge?.status === 'INCUMBENT_DEFENDED' ? (
                  <div className="flex items-center gap-1.5 bg-emerald-950 text-emerald-300 border border-emerald-700/60 px-3.5 py-2 rounded-lg text-xs font-bold shadow-xs">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>✓ Current Policy Retained</span>
                  </div>
                ) : (
                  <button
                    id="btn-keep-current-policy"
                    onClick={handleKeepCurrentPolicy}
                    disabled={retainingCurrentPolicy}
                    className="flex items-center space-x-1.5 text-xs font-bold px-3.5 py-2 rounded-lg border border-blue-600 bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition"
                    title="Keep your current policy and close this offer review"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-white" />
                    <span>{retainingCurrentPolicy ? 'Retaining Policy...' : 'KEEP CURRENT POLICY'}</span>
                  </button>
                )}

                {currentCanonicalRound === 'OPEN' && (
                  <button
                    id="btn-begin-review"
                    onClick={handleBeginReview}
                    disabled={beginningReview}
                    className="flex items-center space-x-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-xs"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>{beginningReview ? 'Closing Window...' : 'Review Offers Now'}</span>
                  </button>
                )}

                <button
                  id="btn-incumbent-defense"
                  onClick={handleTriggerIncumbentDefense}
                  disabled={triggeringIncumbent || challenge?.incumbentDefended}
                  className={`flex items-center space-x-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition ${
                    challenge?.incumbentDefended
                      ? 'bg-blue-950 text-blue-300 border-blue-700/60 cursor-default'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 shadow-xs'
                  }`}
                  title="Invite your current provider to send an offer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>{challenge?.incumbentDefended ? '✓ Current Provider Offer Received' : 'Invite Current Provider'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {[
                { id: 'OPEN', stepNum: '1', title: 'Submission Window', subtitle: 'Providers may submit or independently update their own offers' },
                { id: 'CONSUMER_REVIEW', stepNum: '2', title: 'Policyholder Review', subtitle: 'Review every valid submitted offer and decide' }
              ].map((st) => {
                const roundKeys = ['OPEN', 'CONSUMER_REVIEW'];
                const curIdx = roundKeys.indexOf(currentCanonicalRound);
                const stepIdx = roundKeys.indexOf(st.id);
                const isPassed = curIdx > stepIdx;
                const isCurrent = curIdx === stepIdx;

                return (
                  <div
                    key={st.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isCurrent
                        ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs'
                        : isPassed
                        ? 'bg-slate-50 border-slate-200 text-slate-700'
                        : 'bg-white border-slate-200/60 opacity-60 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                        isCurrent
                          ? 'bg-emerald-600 text-white'
                          : isPassed
                          ? 'bg-slate-700 text-white'
                          : 'bg-slate-200 text-slate-500'
                      }`}>
                        {isPassed ? '✓' : st.stepNum}
                      </span>
                      {isCurrent && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                          Current Stage
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-xs text-slate-900">{st.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{st.subtitle}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PM-2: Underwriting Information Requests from Participating Brokers (Section 17 & 18) */}
          {consumerInfoRequests && consumerInfoRequests.length > 0 && (
            <div className="bg-white rounded-xl border border-blue-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <HelpCircle className="w-5 h-5 text-blue-600" />
                  <h4 className="text-sm font-bold text-slate-900">
                    Underwriting Questions from Participating Brokers
                  </h4>
                  <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                    Section 17 & 18
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  Shared across all brokers to unlock tier discounts
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {consumerInfoRequests.map((req: any) => (
                  <div key={req.id} className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-900 font-semibold">{req.customFieldName || req.requestedField}</strong>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        req.status === 'ANSWERED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {req.status === 'ANSWERED' ? '✓ Attested' : '● Action Requested'}
                      </span>
                    </div>

                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      {req.purposeExplanation}
                    </p>

                    {req.status === 'ANSWERED' ? (
                      <div className="p-2 bg-emerald-50 rounded text-emerald-900 font-medium text-[11px] border border-emerald-200 flex items-center justify-between">
                        <span>Your attested value: <strong>{String(req.answerValue)}</strong></span>
                        <span className="text-[10px] text-emerald-700 font-mono">Shared with all brokers</span>
                      </div>
                    ) : (
                      <div className="pt-1 flex items-center gap-2">
                        {answeringRequestId === req.id ? (
                          <div className="flex items-center gap-2 w-full">
                            <input
                              type="text"
                              value={answerInputValue}
                              onChange={(e) => setAnswerInputValue(e.target.value)}
                              placeholder="Enter your answer..."
                              className="flex-1 bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                            />
                            <button
                              onClick={() => handleAnswerInfoRequest(req.id, answerInputValue)}
                              className="px-2.5 py-1 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setAnsweringRequestId(null)}
                              className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setAnsweringRequestId(req.id);
                              setAnswerInputValue(req.requestedField === 'ANNUAL_MILEAGE' ? '8500' : 'Passive Immobilizer');
                            }}
                            className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition"
                          >
                            Answer Question
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PM-3: Transparent Consumer Competition Activity Timeline */}
          {activityFeed && activityFeed.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <h4 className="text-sm font-bold text-slate-900">
                    Offer Activity Timeline
                  </h4>
                  <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full font-mono">
                    Transparent Event Ledger
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowActivityFeed(!showActivityFeed)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                >
                  {showActivityFeed ? 'Collapse Activity' : `Show Events (${activityFeed.length})`}
                </button>
              </div>

              {showActivityFeed && (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {activityFeed.map((evt) => (
                    <div key={evt.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start justify-between gap-3 text-xs">
                      <div className="flex items-start space-x-2.5">
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                          evt.type === 'OFFER_SUBMITTED' ? 'bg-emerald-500' :
                          evt.type === 'OFFER_REVISED' ? 'bg-blue-500' :
                          evt.type === 'PROVIDER_KEPT_CURRENT_OFFER' ? 'bg-indigo-500' :
                          evt.type === 'PROVIDER_WITHDREW' ? 'bg-rose-500' :
                          evt.type === 'ROUND_ADVANCED' ? 'bg-purple-500' :
                          evt.type === 'CONSUMER_KEPT_CURRENT_POLICY' ? 'bg-emerald-600' : 'bg-slate-400'
                        }`} />
                        <div>
                          <div className="flex items-center space-x-2">
                            <strong className="text-slate-900 font-semibold">{evt.actorName || evt.actorRole}</strong>
                            <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-mono">
                              {evt.round}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {evt.type.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">{evt.summary}</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            Showing {activeComparisons.length} {activeComparisons.length === 1 ? 'offer' : 'offers'} in the order received. Offers that do not meet your requirements remain visible and are clearly marked. Change your requirements above.
          </div>

          {/* Section 25 Signature Side-by-Side Board */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* CURRENT POLICY BASELINE */}
            <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800 flex flex-col justify-between shadow-md relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-slate-800 text-[10px] font-mono text-slate-400 px-2.5 py-1 rounded-bl">
                CURRENT BASELINE
              </div>

              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Your Existing Policy</p>
                <h3 className="text-lg font-bold text-white mt-1">
                  {challenge?.baseline.carrier || 'GEICO Advantage'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  2024 Toyota Camry XLE
                </p>

                <div className="my-5 p-3 rounded-lg bg-slate-800/80 border border-slate-700/60">
                  <div className="text-3xl font-extrabold text-white">
                    ${challenge?.baseline.baselineMonthlyPremium || 247}
                    <span className="text-xs font-normal text-slate-400">/mo</span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">
                    ${challenge?.baseline.baselineAnnualPremium.toLocaleString() || '2,964'}/year
                  </div>
                </div>

                <div className="space-y-2 text-xs border-t border-slate-800 pt-3">
                  <div className="flex justify-between text-slate-300">
                    <span>Bodily Injury:</span>
                    <span className="font-semibold text-white">100k / 300k</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Property Damage:</span>
                    <span className="font-semibold text-white">$100,000</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Collision Deductible:</span>
                    <span className="font-semibold text-white">$500</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Comp Deductible:</span>
                    <span className="font-semibold text-white">$250</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Rental / Roadside:</span>
                    <span className="font-semibold text-emerald-400">Included</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 text-center font-mono">
                Economic & Protection Benchmark
              </div>
            </div>

            {/* COMPETING OFFERS CARDS (From Canonical Section 25) */}
            {activeComparisons.map((comp, idx) => {
              const offer = offers.find(o => o.id === comp.offerId);
              const isSelected = selectedOfferId === comp.offerId;

              // Color scheme according to classification
              let badgeColor = 'bg-slate-100 text-slate-700 border-slate-300';
              if (comp.classification === 'BASELINE_MATCH') badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-300';
              if (comp.classification === 'BASELINE_PLUS') badgeColor = 'bg-blue-50 text-blue-800 border-blue-300';
              if (comp.classification === 'COVERAGE_CHANGED') badgeColor = 'bg-rose-50 text-rose-800 border-rose-300';

              return (
                <div 
                  key={comp.offerId}
                  className={`bg-white rounded-xl p-5 border flex flex-col justify-between transition-all relative ${
                    isSelected 
                      ? 'border-emerald-600 shadow-md ring-2 ring-emerald-500/20' 
                      : 'border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div>
                    {/* Header: Carrier & Classification */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Offer {String.fromCharCode(65 + idx)}
                          </span>
                          {offer?.version && offer.version > 1 && (
                            <span className="text-[9px] font-mono bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded font-bold">
                              v{offer.version}
                            </span>
                          )}
                          {offer?.isQualified ? (
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 rounded font-bold inline-flex items-center gap-0.5">
                              <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                              Qualified
                            </span>
                          ) : (
                            <span className="text-[9px] bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.2 rounded font-bold">
                              Submitted
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mt-0.5">
                          {comp.carrier}
                        </h3>
                        <p className="text-[11px] text-slate-500 truncate">{comp.providerName}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${badgeColor}`}>
                        {formatClassification(comp.classification)}
                      </span>
                    </div>

                    {offer?.isDuplicateCarrier && (
                      <div className="my-2 p-2 bg-amber-50 rounded border border-amber-200 text-amber-900 text-[10px] leading-tight flex items-start gap-1">
                        <Info className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block font-semibold">Multiple Brokers Quoting {comp.carrier}</strong>
                          <span>{offer.duplicateCarrierNotice || 'Both offers are preserved independently with terms itemized.'}</span>
                        </div>
                      </div>
                    )}

                    {/* Pricing Box */}
                    <div className="my-4 p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex items-baseline space-x-1.5">
                        <span className="text-2xl font-bold text-slate-900">
                          ${Math.round(comp.offerAnnualPremium / 12)}
                        </span>
                        <span className="text-xs text-slate-500">/mo</span>
                      </div>
                      <div className="flex items-center justify-between text-xs mt-1">
                        <span className="text-slate-500 font-mono">${comp.offerAnnualPremium.toLocaleString()}/yr</span>
                        <span className="font-bold text-emerald-700 bg-emerald-100/60 px-1.5 py-0.2 rounded text-[11px]">
                          ${Math.abs(comp.annualPremiumDifference).toLocaleString()}/yr {comp.annualPremiumDifference >= 0 ? 'lower' : 'higher'}
                        </span>
                      </div>
                    </div>

                    {/* Coverage Highlights / Reductions Notice */}
                    <div className="space-y-2 text-xs">
                      {comp.classification === 'BASELINE_MATCH' && (
                        <div className="p-2.5 rounded bg-emerald-50 text-emerald-800 text-[11px] leading-tight flex items-start space-x-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>Exact protection match across all verified coverage categories.</span>
                        </div>
                      )}

                      {comp.classification === 'BASELINE_PLUS' && (
                        <div className="p-2.5 rounded bg-blue-50 text-blue-900 text-[11px] leading-tight space-y-1">
                          <div className="flex items-start space-x-1.5 font-semibold text-blue-800">
                            <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                            <span>Material Protection Upgrade:</span>
                          </div>
                          {comp.materialImprovements.map((m, i) => (
                            <div key={i} className="text-blue-700 pl-5">
                              • {m.fieldName}: {m.baselineValueFormatted} → <strong className="font-semibold text-blue-900">{m.offerValueFormatted}</strong>
                            </div>
                          ))}
                        </div>
                      )}

                      {comp.classification === 'COVERAGE_CHANGED' && (
                        <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-900 text-[11px] leading-tight space-y-1.5">
                          <div className="flex items-start space-x-1.5 font-bold text-rose-700">
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>PROMINENT WARNING: Coverage Cut!</span>
                          </div>
                          <p className="text-[11px] text-rose-800 font-medium">
                            Price is lower, but your protection was significantly reduced:
                          </p>
                          {comp.materialReductions.map((r, i) => (
                            <div key={i} className="text-rose-700 pl-3 font-semibold">
                              ✕ {r.fieldName}: {r.baselineValueFormatted} → <span className="underline">{r.offerValueFormatted}</span>
                            </div>
                          ))}
                        </div>
                      )}

                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setSelectedOfferId(comp.offerId);
                        setCurrentStep('COMPARISON_DEEP_DIVE');
                      }}
                      className="flex-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 py-2 rounded-lg transition text-center"
                    >
                      Compare Details
                    </button>
                    <button
                      onClick={() => handleInitiateSelectOffer(comp.offerId)}
                      className={`text-xs font-bold py-2 px-3.5 rounded-lg transition ${
                        comp.classification === 'COVERAGE_CHANGED'
                          ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                      }`}
                    >
                      {comp.classification === 'COVERAGE_CHANGED' ? 'Review & Select' : 'Select'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Plain-Language AI Explanation Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Plain-Language Transparency Summary for {selectedComparison?.carrier || 'Selected Offer'}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {selectedComparison?.matchingFieldsCount} of {selectedComparison?.totalFieldsCount} fields match baseline
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed font-sans">
              {loadingAi ? 'Analyzing coverage terms with deterministic engine...' : aiExplanation}
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 5: DEEP FIELD-BY-FIELD COMPARISON MATRIX                             */}
      {/* ========================================================================= */}
      {currentStep === 'COMPARISON_DEEP_DIVE' && selectedComparison && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Field-By-Field Audit Matrix
              </span>
              <h2 className="text-2xl font-bold text-slate-900 mt-0.5">
                Current Policy vs. {selectedComparison.carrier}
              </h2>
              <p className="text-xs text-slate-600">
                Compared with the verified baseline, the annual premium is <strong className="text-emerald-700 font-bold">${Math.abs(selectedComparison.annualPremiumDifference).toLocaleString()} {selectedComparison.annualPremiumDifference >= 0 ? 'lower' : 'higher'}</strong>.
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center space-x-1.5 shrink-0 bg-slate-100 p-1 rounded-lg text-xs">
              <button
                onClick={() => setComparisonFilter('ALL')}
                className={`px-2.5 py-1 rounded font-medium transition ${comparisonFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                All Terms ({selectedComparison.totalFieldsCount})
              </button>
              <button
                onClick={() => setComparisonFilter('DIFFERENCES')}
                className={`px-2.5 py-1 rounded font-medium transition ${comparisonFilter === 'DIFFERENCES' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Differences Only
              </button>
              <button
                onClick={() => setComparisonFilter('REDUCTIONS')}
                className={`px-2.5 py-1 rounded font-medium transition ${comparisonFilter === 'REDUCTIONS' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Reductions ({selectedComparison.materialReductions.length})
              </button>
              <button
                onClick={() => setComparisonFilter('IMPROVEMENTS')}
                className={`px-2.5 py-1 rounded font-medium transition ${comparisonFilter === 'IMPROVEMENTS' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Upgrades ({selectedComparison.materialImprovements.length})
              </button>
            </div>
          </div>

          {/* Section 45 Trust Standard Notice */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs flex items-center justify-between text-slate-700">
            <div className="flex items-center space-x-2">
              <Info className="w-4 h-4 text-slate-500" />
              <span>
                <strong>Trust Standard:</strong> We compared {selectedComparison.totalFieldsCount} of {selectedComparison.totalFieldsCount} relevant fields. {selectedComparison.matchingFieldsCount} match identically, {selectedComparison.betterFieldsCount} improved, and {selectedComparison.worseFieldsCount} were reduced.
              </span>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="py-2.5 px-3">Coverage Category</th>
                  <th className="py-2.5 px-3">Your Current Baseline</th>
                  <th className="py-2.5 px-3">{selectedComparison.carrier} Offer</th>
                  <th className="py-2.5 px-3">Comparison Status</th>
                  <th className="py-2.5 px-3">Audit Explanation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedComparison.fieldComparisons
                  .filter(f => {
                    if (comparisonFilter === 'DIFFERENCES') return f.result !== 'EQUIVALENT';
                    if (comparisonFilter === 'REDUCTIONS') return f.isMaterialReduction;
                    if (comparisonFilter === 'IMPROVEMENTS') return f.isMaterialImprovement;
                    return true;
                  })
                  .map((fc, i) => {
                    let badgeBg = 'bg-slate-100 text-slate-700';
                    if (fc.result === 'BETTER') badgeBg = 'bg-emerald-100 text-emerald-800 font-bold';
                    if (fc.result === 'EQUIVALENT') badgeBg = 'bg-slate-100 text-slate-700';
                    if (fc.result === 'WORSE') badgeBg = 'bg-rose-100 text-rose-800 font-bold';
                    if (fc.result === 'DIFFERENT') badgeBg = 'bg-amber-100 text-amber-800 font-medium';

                    return (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-3 px-3">
                          <span className="font-semibold text-slate-900">{fc.fieldName}</span>
                          <span className="block text-[10px] text-slate-400 font-mono">{fc.fieldCode}</span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800">
                          {fc.baselineValueFormatted}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          {fc.offerValueFormatted}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${badgeBg}`}>
                            {fc.result}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 text-[11px] leading-relaxed max-w-xs">
                          {fc.explanation}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              onClick={() => setCurrentStep('COMPETITION_ROOM')}
              className="text-xs text-slate-600 hover:text-slate-900"
            >
              ← Back to Offers
            </button>
            <button
              onClick={() => handleInitiateSelectOffer(selectedComparison.offerId)}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 py-2.5 rounded-lg transition shadow-xs"
            >
              <span>SELECT THIS OFFER & BIND</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 6: BINDING HANDOFF & PROGRESSIVE DISCLOSURE                          */}
      {/* ========================================================================= */}
      {currentStep === 'BINDING_HANDOFF' && handoffResult && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 md:p-8 space-y-6">
          <div className="max-w-2xl">
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              CONSUMER SELECTION CONFIRMED • SECTION 28 PROGRESSIVE DISCLOSURE LEVEL 1
            </span>
            <h2 className="text-2xl font-bold text-slate-900 mt-1">
              Licensed Binding Handoff Dossier
            </h2>
            <p className="text-xs text-slate-600">
              You selected <strong className="text-slate-800">{handoffResult.carrier}</strong> through <strong className="text-slate-800">{handoffResult.providerName}</strong>. 
              Under progressive disclosure rules, only this licensed provider is authorized to receive your contact information to bind the policy.
            </p>
          </div>

          {/* Handoff Details Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium">Binding Reference</p>
                <p className="text-lg font-mono font-bold text-slate-900">{handoffResult.bindingReference}</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded">
                  STATUS: {handoffResult.status}
                </span>
                {bindingDossier && (
                  <span className="text-[10px] font-mono text-slate-600 bg-slate-200 px-2 py-1 rounded">
                    SHA-256: {bindingDossier.dossierHash}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-3 border-t border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block">Named Insured:</span>
                <span className="font-semibold text-slate-800">{handoffResult.consumerName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Authorized Provider:</span>
                <span className="font-semibold text-slate-800">{handoffResult.providerName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Carrier & Quote:</span>
                <span className="font-semibold text-slate-800">{handoffResult.carrier} ({bindingDossier?.selectedOffer.quoteNumber || 'Q-VERIFIED'})</span>
              </div>
              <div>
                <span className="text-slate-500 block">Handoff Timestamp:</span>
                <span className="font-mono text-slate-800">{new Date(handoffResult.handoffTimestamp || handoffResult.createdAt || Date.now()).toLocaleString()}</span>
              </div>
            </div>

            {/* PM-3 Dossier Progressive Disclosure Security Panel */}
            {bindingDossier && (
              <div className="pt-3 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold text-slate-900">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Designated Producer & License Verification</span>
                  </div>
                  <p className="text-slate-600">
                    Provider contact: <span className="font-semibold text-slate-800">{bindingDossier.winningBroker.designatedAgentName}</span>
                  </p>
                  <p className="text-slate-600">
                    Jurisdiction License: <span className="font-mono font-semibold text-slate-800">{bindingDossier.winningBroker.licenseNumber} ({bindingDossier.winningBroker.jurisdiction})</span>
                  </p>
                  <p className="text-slate-500 text-[10px]">
                    Providers you did not choose cannot access your name, email, phone, or VIN.
                  </p>
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold text-slate-900">
                    <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Section 40 Informed Consent Record</span>
                  </div>
                  <p className="text-slate-600">
                    Terms Version: <span className="font-semibold text-slate-800">{bindingDossier.complianceAcknowledgments.termsVersion}</span>
                  </p>
                  <p className="text-slate-600">
                    Annual Price Improvement: <span className="font-bold text-emerald-700">${bindingDossier.complianceAcknowledgments.priceImprovementAnnual.toLocaleString()}/yr</span>
                  </p>
                  <p className="text-slate-500 text-[10px]">
                    Consent Hash: <span className="font-mono">{bindingDossier.complianceAcknowledgments.ipAddressHash}</span>
                  </p>
                </div>
              </div>
            )}

            {/* PM-4 Binding Progression Stepper */}
            <div className="pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between text-xs font-semibold mb-2">
                <span className="text-slate-500 uppercase tracking-wider text-[10px]">Binding Lifecycle Progression</span>
                <span className="text-emerald-700 font-mono font-bold">{handoffResult.status}</span>
              </div>
              <div className="grid grid-cols-5 gap-2 text-center text-[10px]">
                {['SELECTED', 'DISCLOSURE_AUTHORIZED', 'APPLICATION_SUBMITTED', 'UNDERWRITING', 'BOUND'].map((step, idx) => {
                  const currentIdx = ['SELECTED', 'DISCLOSURE_AUTHORIZED', 'APPLICATION_SUBMITTED', 'UNDERWRITING', 'BOUND'].indexOf(handoffResult.status);
                  const isDone = currentIdx >= idx;
                  const isCurrent = handoffResult.status === step;
                  return (
                    <div
                      key={step}
                      className={`p-2 rounded-lg border font-medium transition ${
                        isCurrent
                          ? 'bg-emerald-500 text-white border-emerald-600 font-bold shadow-xs'
                          : isDone
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-slate-100 text-slate-400 border-slate-200'
                      }`}
                    >
                      <div className="text-[9px] text-slate-400 mb-0.5">{idx + 1}</div>
                      {step.replace(/_/g, ' ')}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PM-4 Controlled Stage C Disclosure Card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-slate-900 text-xs">Stage C Controlled Disclosure Authorization</span>
                </div>
                {activeConsentGrant && !activeConsentGrant.revokedAt ? (
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-200">
                    CONSENT ACTIVE
                  </span>
                ) : (
                  <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded border border-amber-200">
                    AWAITING AUTHORIZATION
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600">
                Under Open Policy statutory privacy rules, your Stage C PII is sealed. Selecting an offer does not automatically release your data. Authorize disclosure of only the fields required for binding to <strong className="text-slate-800">{handoffResult.providerName}</strong>.
              </p>

              {(!activeConsentGrant || activeConsentGrant.revokedAt) && (
                <div className="space-y-3 pt-2 border-t border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-700 block">Select Authorized Fields:</span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    {[
                      { key: 'namedInsured', label: 'Full Legal Name' },
                      { key: 'garagingAddress', label: 'Garaging Address' },
                      { key: 'vin', label: 'Vehicle Identification (VIN)' },
                      { key: 'driverLicenseNumber', label: 'Driver License Number' },
                      { key: 'email', label: 'Contact Email' },
                      { key: 'phone', label: 'Contact Phone' }
                    ].map(field => (
                      <label key={field.key} className="flex items-center space-x-2 bg-white p-2 rounded border border-slate-200 cursor-pointer text-[11px]">
                        <input
                          type="checkbox"
                          checked={authorizedFields.includes(field.key)}
                          onChange={e => {
                            if (e.target.checked) {
                              setAuthorizedFields([...authorizedFields, field.key]);
                            } else {
                              setAuthorizedFields(authorizedFields.filter(f => f !== field.key));
                            }
                          }}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-slate-700">{field.label}</span>
                      </label>
                    ))}
                  </div>

                  <button
                    onClick={handleGrantConsent}
                    disabled={isGrantingConsent || authorizedFields.length === 0}
                    className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-4 py-2 rounded-lg transition disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isGrantingConsent ? 'Authorizing...' : `Authorize Controlled Disclosure to ${handoffResult.providerName}`}</span>
                  </button>
                </div>
              )}

              {activeConsentGrant && !activeConsentGrant.revokedAt && (
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <div className="text-[11px] text-slate-600">
                    <span>Authorized Fields: <strong className="text-slate-800">{activeConsentGrant.authorizedFieldNames.join(', ')}</strong></span>
                    <span className="block text-[10px] text-slate-400 font-mono mt-0.5">Audit Hash: {activeConsentGrant.ipAddressHash.substring(0, 16)}...</span>
                  </div>
                  <button
                    onClick={handleRevokeConsent}
                    className="text-[11px] font-medium text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded transition"
                  >
                    Revoke Consent
                  </button>
                </div>
              )}
            </div>

            {/* PM-4 Underwriting Modification Review Card */}
            {(handoffResult.status === 'MODIFICATION_PENDING' || activeModification) && activeModification && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  <span className="font-bold text-amber-900 text-xs">Carrier Underwriting Modification Proposed</span>
                </div>
                <p className="text-xs text-amber-800">
                  The carrier proposed modified terms during underwriting. Your original selected quote remains immutable. You can choose to accept the adjusted terms or reject them. Rejecting halts continuation without automatic platform action.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white p-3 rounded-lg border border-amber-200 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Quoted Premium:</span>
                    <span className="font-semibold text-slate-700 line-through">${activeModification.originalAnnualPremium}/yr</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Modified Premium:</span>
                    <span className="font-bold text-amber-800">${activeModification.modifiedAnnualPremium}/yr</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Underwriting Reason:</span>
                    <span className="font-medium text-slate-800">{activeModification.underwritingReason}</span>
                  </div>
                </div>

                {activeModification.status === 'PENDING_CONSUMER_REVIEW' ? (
                  <div className="flex items-center space-x-3 pt-2">
                    <button
                      onClick={() => handleResolveModification('ACCEPT')}
                      disabled={isResolvingMod}
                      className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-3.5 py-2 rounded-lg transition"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Accept Modified Terms</span>
                    </button>
                    <button
                      onClick={() => handleResolveModification('REJECT')}
                      disabled={isResolvingMod}
                      className="flex items-center space-x-1.5 bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs px-3.5 py-2 rounded-lg transition"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Reject Modification</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-xs font-semibold text-slate-700 pt-1">
                    Status: <span className={activeModification.status === 'ACCEPTED' ? 'text-emerald-700' : 'text-rose-700'}>{activeModification.status}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 30 Next Step Prompt */}
          <div className="border-t border-slate-200 pt-5 space-y-4">
            <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
              <FileSearch className="w-4 h-4 text-emerald-600" />
              <span>Step 7 Preview: Issued Policy Reconciliation & Stealth Creep Audit</span>
            </div>
            <p className="text-xs text-slate-600 max-w-xl">
              Once your licensed agent binds your policy, the carrier will issue the declarations page. Open Policy reconciles the issued document against the agreed offer dossier to ensure no stealth terms, rate creep, or deductible inflation were altered.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => handleReconcileIssued(false)}
                className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-4 py-2.5 rounded-lg transition"
              >
                <Check className="w-4 h-4" />
                <span>Simulate Canonical Issued Dec Page (100% Match)</span>
              </button>

              <button
                onClick={() => handleReconcileIssued(true)}
                className="flex items-center space-x-1.5 bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs px-4 py-2.5 rounded-lg transition"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Simulate Stealth Discrepancy (Rate Creep & Deductible Inflation)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 7: ISSUED POLICY RECONCILIATION & POLICY VAULT                       */}
      {/* ========================================================================= */}
      {currentStep === 'RECONCILIATION_VAULT' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 md:p-8 space-y-6">
          <div>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              POST-BINDING INTEGRITY CHECK • PM-3 RECONCILIATION ENGINE
            </span>
            <h2 className="text-2xl font-bold text-slate-900 mt-1">
              Issued Policy Reconciliation & Private Vault
            </h2>
            <p className="text-xs text-slate-600">
              We independently reconcile the issued policy document against the accepted binding dossier to expose post-bind stealth creep.
            </p>
          </div>

          {pm5Report ? (
            <div className={`p-5 rounded-xl border ${
              pm5Report.verdict === 'MATCH'
                ? 'bg-emerald-50/50 border-emerald-300'
                : pm5Report.verdict === 'AUTHORIZED_VARIANCE'
                ? 'bg-blue-50/50 border-blue-300'
                : 'bg-rose-50/60 border-rose-300'
            } space-y-4`}>
              {/* Header with verdict & status */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div className="flex items-center space-x-2">
                  {pm5Report.verdict === 'MATCH' || pm5Report.verdict === 'AUTHORIZED_VARIANCE' ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" />
                  )}
                  <div>
                    <h3 className={`text-base font-bold ${
                      pm5Report.verdict === 'MATCH' || pm5Report.verdict === 'AUTHORIZED_VARIANCE'
                        ? 'text-emerald-900'
                        : 'text-rose-900'
                    }`}>
                      {pm5Report.verdict === 'MATCH'
                        ? 'Reconciliation Match: Issued Policy Matches Agreed Offer Exactly'
                        : pm5Report.verdict === 'AUTHORIZED_VARIANCE'
                        ? 'Authorized Variance: Differences Reflect Accepted Underwriting Modifications'
                        : pm5Report.verdict === 'REVIEW_REQUIRED'
                        ? 'Review Required: Field Discrepancies or Extraction Variance Detected'
                        : 'Discrepancies Detected: Issued Policy Differs from Agreed Binding Terms'}
                    </h3>
                    <p className="text-xs text-slate-600">
                      Report Status: <span className="font-semibold text-slate-800">{pm5Report.status}</span>
                      {pm5Report.reconciledBy && ` • Reconciled By: ${pm5Report.reconciledBy}`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono text-slate-500 block">
                    Report #{pm5Report.id.substring(0, 16)}...
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    pm5Report.verdict === 'MATCH' || pm5Report.verdict === 'AUTHORIZED_VARIANCE'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    VERDICT: {pm5Report.verdict}
                  </span>
                </div>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-lg border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Expected Annual Premium</span>
                  <span className="font-bold text-slate-800">
                    ${pm5Report.expectedTermsSummary?.annualPremium || 0}/yr
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Issued Annual Premium</span>
                  <span className="font-bold text-slate-800">
                    ${pm5Report.issuedTermsSummary?.annualPremium || 0}/yr
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Annual Variance</span>
                  <span className={`font-bold ${(pm5Report.totalAnnualPremiumVariance || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {(pm5Report.totalAnnualPremiumVariance || 0) > 0 ? `+$${pm5Report.totalAnnualPremiumVariance}/yr` : '$0'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Discrepancy Count</span>
                  <span className="font-bold text-slate-800">
                    {pm5Report.discrepancies?.length || 0} Flagged
                  </span>
                </div>
              </div>

              {/* Discrepancy Breakdown */}
              {(pm5Report.discrepancies?.length || 0) > 0 && (
                <div className="space-y-2 border-t border-rose-200 pt-3">
                  <p className="text-xs font-bold text-slate-800">Contract & Coverage Discrepancies:</p>
                  <div className="space-y-2">
                    {pm5Report.discrepancies.map((disc, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900">{disc.fieldName}:</span>
                            <span className="text-[10px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {disc.category}
                            </span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              disc.isMaterial ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {disc.isMaterial ? 'MATERIAL' : 'INFORMATIONAL'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600">{disc.explanation}</p>
                        </div>
                        <div className="text-right sm:shrink-0">
                          <div className="text-slate-500 text-[11px]">Expected: <span className="font-medium text-slate-700">{disc.expectedValue}</span></div>
                          <div className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded inline-block mt-0.5">
                            Issued: {disc.actualIssuedValue}
                          </div>
                          {disc.financialImpactAnnual && disc.financialImpactAnnual > 0 ? (
                            <div className="text-[10px] text-rose-600 font-bold">
                              Impact: +${disc.financialImpactAnnual}/yr
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Governed Review & Actions */}
              {pm5Report.status === 'CONSUMER_ACCEPTED_VARIANCE' || pm5Report.status === 'COMPLETED_MATCH' || pm5Report.status === 'COMPLETED_AUTHORIZED_VARIANCE' ? (
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <div>
                      <span className="text-xs font-bold text-emerald-900 block">Policy Reconciled & Filed to Private Vault</span>
                      <span className="text-[11px] text-emerald-700">Future renewal baseline has been activated.</span>
                    </div>
                  </div>
                  <button
                    onClick={() => { setCurrentStep('PRIVATE_VAULT'); fetchVaultDocs(); fetchPM5Data(); }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-3.5 py-1.5 rounded-lg transition"
                  >
                    View in Private Vault
                  </button>
                </div>
              ) : pm5Report.status === 'CONSUMER_DISPUTED' ? (
                <div className="p-3 bg-rose-50 rounded-lg border border-rose-200 space-y-1">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                    <span className="text-xs font-bold text-rose-900">Consumer Dispute Filed — Remediation Requested</span>
                  </div>
                  <p className="text-[11px] text-rose-700">
                    Vault activation is halted. The provider has been notified to remediate the discrepancy with the carrier.
                  </p>
                  {pm5Report.consumerDisputeNotes && (
                    <div className="p-2 bg-white rounded border border-rose-200 text-xs text-slate-700 mt-1">
                      <span className="font-semibold text-slate-900">Your dispute notes:</span> {pm5Report.consumerDisputeNotes}
                    </div>
                  )}
                </div>
              ) : (pm5Report.verdict === 'UNAUTHORIZED_VARIANCE' || pm5Report.verdict === 'REVIEW_REQUIRED' || pm5Report.status === 'PENDING_CONSUMER_REVIEW') ? (
                <div className="p-4 bg-white rounded-xl border border-amber-200 space-y-3">
                  <div className="flex items-center space-x-2">
                    <ShieldAlert className="w-5 h-5 text-amber-700" />
                    <span className="text-xs font-bold text-amber-900">Governed Consumer Decision Required</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    The issued policy exhibits variances that were not pre-authorized. You may choose to accept these variances and file the policy to your vault, or dispute them to halt vault activation and request broker remediation.
                  </p>

                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-slate-700 block">Dispute / Remediation Notes (if disputing):</label>
                    <input
                      type="text"
                      placeholder="e.g. Rate was quoted at $1,200 but issued at $1,350 without explanation..."
                      value={disputeNotes}
                      onChange={e => setDisputeNotes(e.target.value)}
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      onClick={() => handleConsumerVerify('ACCEPT_VARIANCE')}
                      disabled={isVerifyingReconciliation}
                      className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-3.5 py-2 rounded-lg transition disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isVerifyingReconciliation ? 'Filing to Vault...' : 'Accept Variances & File to Vault'}</span>
                    </button>

                    <button
                      onClick={() => handleConsumerVerify('DISPUTE_REMEDIATION_REQUESTED')}
                      disabled={isVerifyingReconciliation}
                      className="flex items-center space-x-1.5 bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs px-3.5 py-2 rounded-lg transition disabled:opacity-50"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{isVerifyingReconciliation ? 'Submitting Dispute...' : 'Dispute & Request Broker Remediation'}</span>
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Provenance Trail */}
              <div className="p-3 bg-white rounded-lg border border-slate-200 text-[10px] font-mono text-slate-500 space-y-1">
                <div className="flex items-center justify-between">
                  <span>SNAPSHOT ID: {pm5Report.issuedPolicySnapshotId}</span>
                  <span>HANDOFF ID: {pm5Report.bindingHandoffId}</span>
                </div>
                <div className="truncate">
                  ISSUED DOC ID: {pm5Report.issuedPolicyDocumentId}
                </div>
              </div>
            </div>
          ) : detailedReconciliation ? (
            <div className={`p-5 rounded-xl border ${
              detailedReconciliation.isCompliant 
                ? 'bg-emerald-50/50 border-emerald-300' 
                : 'bg-rose-50/60 border-rose-300'
            } space-y-4`}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div className="flex items-center space-x-2">
                  {detailedReconciliation.isCompliant ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" />
                  )}
                  <div>
                    <h3 className={`text-base font-bold ${
                      detailedReconciliation.isCompliant ? 'text-emerald-900' : 'text-rose-900'
                    }`}>
                      {detailedReconciliation.isCompliant 
                        ? 'Reconciliation Success: Issued Policy Matches Binding Dossier with 100% Fidelity' 
                        : 'ALERT: Stealth Discrepancies Detected In Issued Policy!'}
                    </h3>
                    <p className="text-xs text-slate-600">
                      Audit Verdict: <span className="font-semibold">{detailedReconciliation.reconciliationAuditVerdict}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono text-slate-500 block">
                    Policy #{detailedReconciliation.issuedPolicyNumber}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    detailedReconciliation.isCompliant 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    VERDICT: {detailedReconciliation.reconciliationAuditVerdict}
                  </span>
                </div>
              </div>

              {/* Creep summary stats */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white p-3.5 rounded-lg border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block">Carrier & Status</span>
                  <span className="font-bold text-slate-800">{detailedReconciliation.carrier} ({detailedReconciliation.isCompliant ? 'COMPLIANT' : 'DEVIATION'})</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Annual Rate Creep</span>
                  <span className={`font-bold ${detailedReconciliation.totalAnnualCreepAmount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {detailedReconciliation.totalAnnualCreepAmount > 0 ? `+$${detailedReconciliation.totalAnnualCreepAmount}/yr` : '$0 (0% creep)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Discrepancy Count</span>
                  <span className="font-bold text-slate-800">{detailedReconciliation.discrepancies.length} Discrepancies</span>
                </div>
              </div>

              {/* Detailed Discrepancy Breakdown */}
              {detailedReconciliation.discrepancies.length > 0 && (
                <div className="space-y-2 border-t border-rose-200 pt-3">
                  <p className="text-xs font-bold text-rose-900">Flagged Contract Deviations:</p>
                  <div className="space-y-2">
                    {detailedReconciliation.discrepancies.map((disc, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-lg border border-rose-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900">{disc.fieldName}:</span>
                            <span className="text-[10px] font-semibold text-rose-800 bg-rose-100 px-1.5 py-0.5 rounded">
                              {disc.discrepancyType}
                            </span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              disc.severity === 'HIGH' ? 'bg-rose-600 text-white' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {disc.severity}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600">{disc.explanation}</p>
                        </div>
                        <div className="text-right sm:shrink-0">
                          <div className="text-slate-500 text-[11px]">Agreed: <span className="font-medium text-slate-700">{disc.agreedOfferValue}</span></div>
                          <div className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded inline-block mt-0.5">
                            Issued: {disc.actualIssuedValue}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : reconciliationReport ? (
            <div className={`p-5 rounded-xl border ${
              reconciliationReport.isIdentical 
                ? 'bg-emerald-50/50 border-emerald-300' 
                : 'bg-rose-50/60 border-rose-300'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  {reconciliationReport.isIdentical ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                  )}
                  <h3 className={`text-base font-bold ${
                    reconciliationReport.isIdentical ? 'text-emerald-900' : 'text-rose-900'
                  }`}>
                    {reconciliationReport.isIdentical 
                      ? 'Reconciliation Success: Issued Policy Matches Agreed Quote' 
                      : 'ALERT: The Policy Issued Differs From The Offer You Selected!'}
                  </h3>
                </div>
                <span className="text-xs font-mono text-slate-500">
                  {reconciliationReport.issuedPolicyNumber}
                </span>
              </div>

              <p className="text-xs text-slate-600 mt-2">
                {reconciliationReport.notes}
              </p>

              {(reconciliationReport.differences?.length ?? 0) > 0 && (
                <div className="mt-4 space-y-2 border-t border-rose-200 pt-3">
                  <p className="text-xs font-bold text-rose-900">Identified Discrepancies:</p>
                  {reconciliationReport.differences?.map((diff, idx) => (
                    <div key={idx} className="bg-white p-2.5 rounded border border-rose-200 text-xs flex justify-between items-center">
                      <div>
                        <span className="font-semibold text-slate-900">{diff.field}:</span>
                        <span className="text-slate-500 ml-2">Agreed: {diff.agreedOffer}</span>
                      </div>
                      <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                        Actually Issued: {diff.actualIssued}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 text-xs">
              No issued policy reconciled yet. Run the simulation from Step 6.
            </div>
          )}

          {/* Section 31 Renewal Loop Card */}
          <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                <RefreshCw className="w-4 h-4" />
                <span>Automated Renewal Loop</span>
              </div>
              <span className="text-xs font-mono text-slate-400">Renewal in 58 Days</span>
            </div>
            <p className="text-xs text-slate-300">
              When this policy approaches renewal, the platform notifies you. You can share the policy again for providers to review without retyping the policy information.
            </p>
            <button
              onClick={() => setCurrentStep('SET_REQUIREMENTS')}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>SHARE MY POLICY AGAIN</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 8: PRIVATE POLICY VAULT (SECTION 4)                                  */}
      {/* ========================================================================= */}
      {currentStep === 'PRIVATE_VAULT' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                IMMUTABLE DOCUMENT REPOSITORY • SECTION 4
              </span>
              <h2 className="text-2xl font-bold text-slate-900 mt-1">
                Private Policy Vault
              </h2>
              <p className="text-xs text-slate-600">
                Cryptographic, immutable archive of all policies, declarations pages, state ID cards, endorsements, and renewal notices. You retain absolute ownership of all stored evidence.
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                id="btn-add-vault-doc"
                onClick={() => setShowAddDocModal(true)}
                className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-3.5 py-2 rounded-lg transition shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Document to Vault</span>
              </button>

              <button
                onClick={() => setActionToast('Exported SHA-256 evidence bundle with cryptographic manifest')}
                className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs px-3.5 py-2 rounded-lg transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Sealed Bundle</span>
              </button>
            </div>
          </div>

          {/* Vault Metadata Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block">Stored Documents</span>
              <span className="text-lg font-bold text-slate-900">{vaultDocs.length} Active Records</span>
            </div>
            <div>
              <span className="text-slate-500 block">Integrity State</span>
              <span className="text-lg font-bold text-emerald-700 flex items-center space-x-1">
                <CheckCircle2 className="w-4 h-4 inline" />
                <span>SHA-256 Sealed</span>
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Governing Policy</span>
              <span className="text-lg font-bold text-slate-900 font-mono">
                {policyVaultItems.length > 0 ? policyVaultItems[0].policyNumber : 'POL-NV-49281'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Active Vault Policies</span>
              <span className="text-lg font-bold text-emerald-700">
                {policyVaultItems.length} Governed
              </span>
            </div>
          </div>

          {/* PM-5 Governed Bound Policies & Future Baselines */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Governed Policies & Future Baselines (PM-5)</h3>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                {policyVaultItems.length} Active in Vault
              </span>
            </div>

            {policyVaultItems.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-5 text-center text-xs text-slate-500">
                No bound policies filed to the vault yet. When an issued policy is reconciled and verified in Step 7, it is sealed here with complete provenance and activates your future renewal baseline.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {policyVaultItems.map(item => (
                  <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-slate-900">{item.carrier}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                            {item.status}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-slate-500">Policy #{item.policyNumber}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-bold text-emerald-700">${item.annualPremium}</span>
                        <span className="text-[10px] text-slate-500 block">/year</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-slate-400 block text-[10px]">EFFECTIVE TERM</span>
                        <span className="font-medium text-slate-700">{item.effectiveDate} - {item.expirationDate}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">FUTURE BASELINE</span>
                        <span className="font-mono text-emerald-700 font-semibold truncate block" title={item.futureCoverageBaselineId}>
                          {item.futureCoverageBaselineId || 'ACTIVATED'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1 text-[10px] font-mono text-slate-500 border-t border-slate-100 pt-2">
                      <div className="flex justify-between">
                        <span>HANDOFF:</span>
                        <span className="text-slate-700">{item.bindingHandoffId.substring(0, 14)}...</span>
                      </div>
                      <div className="flex justify-between">
                        <span>RECON REPORT:</span>
                        <span className="text-slate-700">{item.reconciliationReportId.substring(0, 14)}...</span>
                      </div>
                      <div className="flex justify-between">
                        <span>PROVENANCE HASH:</span>
                        <span className="text-emerald-700 font-semibold">{item.provenanceHash.substring(0, 12)}...</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Documents Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Document Details</th>
                  <th className="py-3 px-4">Type & Source</th>
                  <th className="py-3 px-4">Term Validity</th>
                  <th className="py-3 px-4 font-mono">Cryptographic Hash</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vaultDocs.map(doc => (
                  <tr key={doc.documentId} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 flex items-center space-x-1.5">
                        <FileCheck2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{doc.fileName}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{doc.notes}</p>
                      <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-1 font-mono">
                        <span>{doc.documentId}</span>
                        <span>•</span>
                        <span>{doc.fileSize}</span>
                        <span>•</span>
                        <span>{doc.carrier}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <span className="inline-block text-[10px] font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                          {doc.documentType.replace('_', ' ')}
                        </span>
                        <div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Src: {doc.source}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800 font-medium">
                        {doc.effectiveDate} to {doc.expirationDate}
                      </div>
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                        {doc.processingStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[10px] text-slate-500">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200" title={doc.documentHash}>
                        {doc.documentHash.substring(0, 16)}...
                      </span>
                      <div className="text-[9px] text-slate-400 mt-0.5">SHA-256 Immutable</div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setActionToast(`Downloaded copy of ${doc.fileName}`)}
                        className="inline-flex items-center space-x-1 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 px-2.5 py-1 rounded transition text-xs font-medium"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Core Vault Doctrine Note */}
          <div className="p-4 bg-slate-900 text-white rounded-xl text-xs space-y-1 border border-slate-800">
            <div className="flex items-center space-x-1.5 text-emerald-400 font-bold uppercase tracking-wider">
              <Shield className="w-3.5 h-3.5" />
              <span>Section 4: Vault Confidentiality Guarantee</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Documents placed in the Private Policy Vault are encrypted and tamper-evident. Providers reviewing your policy do not receive direct copies of your documents. Only the permitted policy details are shared during offer review.
            </p>
          </div>
        </div>
      )}

      {/* Add Document to Vault Modal */}
      {showAddDocModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-slate-900">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Archive className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Add Document to Vault</h3>
              </div>
              <button onClick={() => setShowAddDocModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">File Name</label>
                <input
                  type="text"
                  value={newDocName}
                  onChange={e => setNewDocName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Document Type</label>
                <select
                  value={newDocType}
                  onChange={e => setNewDocType(e.target.value as any)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white"
                >
                  <option value="ENDORSEMENT">Endorsement / Policy Amendment</option>
                  <option value="INSURANCE_CARD">State Auto Liability Insurance Card</option>
                  <option value="RENEWAL_NOTICE">Upcoming Renewal Notice</option>
                  <option value="DECLARATIONS_PAGE">Replacement Declarations Page</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Description / Notes</label>
                <textarea
                  value={newDocNotes}
                  onChange={e => setNewDocNotes(e.target.value)}
                  rows={2}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                  placeholder="e.g. Endorsement adding roadside dispatch coverage..."
                />
              </div>

              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-800 text-[11px] leading-snug">
                Upon saving, this document will be cryptographically hashed (SHA-256) and archived in your immutable vault.
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                onClick={() => setShowAddDocModal(false)}
                className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadVaultDoc}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-xs"
              >
                Commit to Vault
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Source Evidence Inspection Modal / Popover */}
      {inspectingEvidence && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <FileSearch className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Source Evidence Provenance</h3>
              </div>
              <button 
                onClick={() => setInspectingEvidence(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 block">Field:</span>
                <span className="font-bold text-slate-900 text-sm">{inspectingEvidence.fieldName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Source Document:</span>
                <span className="font-mono text-slate-800">{inspectingEvidence.docName} (Page {inspectingEvidence.page})</span>
              </div>
              <div>
                <span className="text-slate-500 block">Raw Extracted Text Snippet:</span>
                <pre className="mt-1 p-2.5 bg-slate-100 rounded text-slate-800 font-mono text-[11px] whitespace-pre-wrap border border-slate-200">
                  {inspectingEvidence.snippet}
                </pre>
              </div>
              <div className="flex justify-between items-center text-slate-600 pt-1">
                <span>Extraction Confidence Score:</span>
                <span className="font-bold text-emerald-700">{Math.round(inspectingEvidence.confidence * 100)}% Verified</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 text-right">
              <button
                onClick={() => setInspectingEvidence(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-lg"
              >
                Close Provenance Viewer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section 40 Informed Consent Sign-Off Modal (PM-3) */}
      {showInformedConsentModal && pendingSelectionOfferId && (() => {
        const pendingOffer = offers.find(o => o.id === pendingSelectionOfferId);
        const pendingComp = activeComparisons.find(c => c.offerId === pendingSelectionOfferId);
        if (!pendingOffer || !pendingComp) return null;

        const materialReductions = pendingComp.materialReductions;
        const allChecked = materialReductions.every(r => acknowledgedVariations.includes(r.fieldCode));

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-2xl border border-amber-300 space-y-5 animate-in fade-in zoom-in duration-150">
              <div className="flex items-start justify-between pb-3 border-b border-amber-200">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-amber-100 text-amber-800 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-amber-700" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 uppercase">
                      Statutory Informed Consent • Section 40 Parity
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-0.5">
                      Acknowledge Material Coverage Reductions
                    </h3>
                  </div>
                </div>
                <button 
                  onClick={() => setShowInformedConsentModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-700">
                <p className="leading-relaxed">
                  You are selecting <strong className="text-slate-900">{pendingOffer.carrier}</strong> ({pendingOffer.quoteNumber}) 
                  at <strong className="text-emerald-700">${pendingOffer.annualPremium.toLocaleString()}/yr</strong>. 
                  This offer's annual premium is <strong className="text-emerald-700">${Math.abs(pendingComp.annualPremiumDifference).toLocaleString()} {pendingComp.annualPremiumDifference >= 0 ? 'lower' : 'higher'}</strong>, and
                  our comparison engine verified that it <span className="font-semibold text-rose-700 underline">reduces your baseline protection</span> in the following areas:
                </p>

                <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 space-y-2.5">
                  <p className="text-[11px] font-bold text-amber-900 uppercase tracking-wide">
                    Mandatory Line-Item Attestation (Check each to confirm approval):
                  </p>
                  <div className="space-y-2">
                    {materialReductions.map((reduction) => {
                      const isChecked = acknowledgedVariations.includes(reduction.fieldCode);
                      return (
                        <label 
                          key={reduction.fieldCode}
                          className={`flex items-start space-x-2.5 p-2 rounded cursor-pointer transition border ${
                            isChecked ? 'bg-white border-emerald-400 shadow-xs' : 'bg-white/50 border-amber-200 hover:bg-white'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAcknowledgedVariations(prev => [...prev, reduction.fieldCode]);
                              } else {
                                setAcknowledgedVariations(prev => prev.filter(c => c !== reduction.fieldCode));
                              }
                            }}
                            className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <div className="text-xs">
                            <span className="font-bold text-slate-900">{reduction.fieldName}: </span>
                            <span className="text-slate-600">Current baseline has {reduction.baselineValueFormatted}, but this quote offers </span>
                            <span className="font-bold text-rose-700 underline">{reduction.offerValueFormatted}</span>.
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {consentError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs font-medium">
                    ⚠️ {consentError}
                  </div>
                )}

                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-500 leading-snug">
                  By clicking &quot;Authorize Handoff with Reductions&quot;, you certify that you have reviewed each reduction and expressly authorize disclosure of your contact details to {pendingOffer.providerName} for binding.
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowInformedConsentModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel Selection
                </button>
                <button
                  type="button"
                  disabled={!allChecked || isSubmittingHandoff}
                  onClick={() => executeBindingHandoff(pendingSelectionOfferId, true, acknowledgedVariations)}
                  className={`flex items-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-bold transition shadow-xs ${
                    allChecked && !isSubmittingHandoff
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <span>{isSubmittingHandoff ? 'Authorizing Dossier...' : 'Authorize Handoff with Reductions'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
