/**
 * Canonical Domain Types for Policy Challenge
 * Strict adherence to the canonical insurance competition model
 */

export type DocumentType = 
  | 'DECLARATIONS_PAGE' 
  | 'COMPLETE_POLICY' 
  | 'INSURANCE_CARD' 
  | 'ENDORSEMENT' 
  | 'RENEWAL_NOTICE' 
  | 'COMPETING_QUOTE' 
  | 'REPLACEMENT_POLICY';

export type ProcessingStatus = 
  | 'UPLOADED' 
  | 'PROCESSING' 
  | 'EXTRACTED' 
  | 'REVIEW_REQUIRED' 
  | 'VERIFIED' 
  | 'FAILED';

export interface SourceEvidence {
  documentId: string;
  documentName: string;
  pageNumber: number;
  extractedSnippet: string;
  confidence: number; // 0.0 to 1.0
  verifiedByConsumer: boolean;
}

export interface ExtractedField<T> {
  value: T;
  rawString?: string;
  evidence?: SourceEvidence;
  isModifiedByUser?: boolean;
}

export type PolicyDocumentStatus =
  | 'UPLOAD_PENDING'
  | 'UPLOADED'
  | 'VALIDATING'
  | 'REJECTED'
  | 'EXTRACTION_PENDING'
  | 'EXTRACTING'
  | 'REVIEW_REQUIRED'
  | 'READY_FOR_CONSUMER'
  | 'CONSUMER_CORRECTED'
  | 'CONSUMER_VERIFIED'
  | 'BASELINE_CREATED';

export interface PolicyDocumentRecord {
  id: string;
  ownerId: string;
  idempotencyKey: string;
  originalFileName: string;
  mimeType: 'application/pdf';
  byteLength: number;
  sha256: string;
  storageBucket: string;
  objectName: string;
  objectGeneration: string;
  status: PolicyDocumentStatus;
  malwareStatus: 'PENDING_SCAN' | 'CLEAN' | 'REJECTED_MALICIOUS' | 'SCAN_FAILED';
  malwareScanner?: string;
  malwareScannerVersion?: string;
  malwareScannedAt?: string;
  createdAt: string;
  updatedAt: string;
  rejectionCode?: string;
}

export type InsuranceDocumentClassification =
  | 'DECLARATIONS_PAGE'
  | 'FULL_POLICY'
  | 'INSURANCE_CARD'
  | 'ENDORSEMENT'
  | 'UNSUPPORTED_NON_POLICY'
  | 'UNCERTAIN';

export interface PolicyDocumentClassificationResult {
  id: string;
  documentId: string;
  documentGeneration: string;
  sourceSha256: string;
  classification: InsuranceDocumentClassification;
  confidence: number;
  classifier: string;
  classifierVersion: string;
  evidencePageNumbers: number[];
  evidenceReferences: string[];
  requiresReview: boolean;
  classifiedAt: string;
}

export interface PolicyExtractionRun {
  id: string;
  documentId: string;
  documentGeneration: string;
  extractor: string;
  extractorVersion: string;
  status: 'PENDING' | 'RUNNING' | 'REVIEW_REQUIRED' | 'READY_FOR_CONSUMER' | 'FAILED';
  normalizedPolicy?: Policy;
  criticalIssues: string[];
  createdAt: string;
  completedAt?: string;
}

export type NormalizedPolicyFieldPath =
  | 'policyNumber' | 'carrier' | 'namedInsured' | 'jurisdiction'
  | 'effectiveDate' | 'expirationDate' | 'annualPremium'
  | 'vehicle.vin' | 'vehicle.year' | 'vehicle.make' | 'vehicle.model'
  | 'vehicle.usage' | 'vehicle.annualMileage' | 'vehicle.garagingZip' | 'vehicle.ownership'
  | 'coverage.bodilyInjury.perPersonLimit' | 'coverage.bodilyInjury.perAccidentLimit'
  | 'coverage.propertyDamage.propertyLimit';

export interface NormalizedPolicyFieldCandidate {
  fieldPath: NormalizedPolicyFieldPath;
  value: string | number;
  confidence: number;
  evidence: SourceEvidence;
}

export interface PolicyNormalizationResult {
  extractionRunId: string;
  documentId: string;
  documentGeneration: string;
  sourceSha256: string;
  normalizer: string;
  normalizerVersion: string;
  fields: NormalizedPolicyFieldCandidate[];
  criticalIssues: string[];
  status: 'REVIEW_REQUIRED' | 'READY_FOR_CONSUMER';
  normalizedAt: string;
}

export interface PolicyFieldCorrection {
  id: string;
  documentId: string;
  extractionRunId: string;
  ownerId: string;
  fieldPath: string;
  beforeValue: unknown;
  afterValue: unknown;
  source: 'CONSUMER';
  correctedAt: string;
}

export interface Vehicle {
  vin: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  usage: 'COMMUTE' | 'PLEASURE' | 'BUSINESS';
  annualMileage: number;
  garagingZip: string;
  ownership: 'OWNED' | 'FINANCED' | 'LEASED';
}

export interface Driver {
  id: string;
  name: string;
  isPrimary: boolean;
  licenseState: string;
  licenseNumberMasked: string;
  age: number;
}

export interface CoverageItem {
  id: string;
  code: 'BODILY_INJURY' | 'PROPERTY_DAMAGE' | 'COLLISION' | 'COMPREHENSIVE' | 'UM_UIM' | 'MEDICAL_PAYMENTS' | 'RENTAL_REIMBURSEMENT' | 'ROADSIDE_ASSISTANCE';
  name: string;
  category: 'LIABILITY' | 'PHYSICAL_DAMAGE' | 'MEDICAL' | 'ADDITIONAL';
  perPersonLimit?: number; // e.g. 100000
  perAccidentLimit?: number; // e.g. 300000
  propertyLimit?: number; // e.g. 100000
  deductible?: number; // e.g. 500
  isIncluded: boolean;
  notes?: string;
  evidence?: SourceEvidence;
}

export interface Policy {
  id: string;
  policyNumber: string;
  carrier: string;
  jurisdiction: string; // state e.g. NV, CA, TX
  effectiveDate: string;
  expirationDate: string;
  termMonths: number;
  annualPremium: number;
  monthlyPremium: number;
  status: ProcessingStatus;
  namedInsured: string;
  drivers: Driver[];
  vehicles: Vehicle[];
  coverages: CoverageItem[];
  sourceDocumentId: string;
  sourceDocumentName: string;
}

export interface CoverageBaseline {
  id: string;
  policyId: string;
  version: number;
  carrier: string;
  effectiveDate: string;
  expirationDate: string;
  baselineAnnualPremium: number;
  baselineMonthlyPremium: number;
  jurisdiction?: string;
  vehicle: Vehicle;
  coverages: CoverageItem[];
  verifiedAt: string;
  verifiedBy: string;
}

/** @deprecated Historical evidence only. New challenges cannot accept consumer-authored terms. */
export interface LegacyConsumerRequirements {
  id: string;
  ruleSummary: string; // Default: "Offers should cost less and not reduce my coverage."
  minAnnualSavings: number; // e.g. 100
  maxCollisionDeductible: number; // e.g. 500
  maxCompDeductible: number; // e.g. 250
  mustIncludeRental: boolean;
  mustIncludeRoadside: boolean;
  allowHigherDeductibleIfSavingsExceed?: number; // Advanced rule
  notes?: string;
}

export interface QualificationStandard {
  version: string;
}

export type ChallengeStatus = 
  | 'DRAFT'
  | 'READY'
  | 'OPEN'
  | 'OFFERS_RECEIVED'
  | 'FINAL_ROUND'
  | 'CONSUMER_REVIEW'
  | 'INCUMBENT_DEFENDED'
  | 'SELECTED'
  | 'BINDING_HANDOFF'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface Challenge {
  id: string;
  referenceNumber: string; // e.g. CHALLENGE #NV-49281
  consumerId: string;
  coverageBaselineId: string;
  baseline: CoverageBaseline;
  qualificationStandardVersion?: string;
  legacyRequirements?: LegacyConsumerRequirements;
  jurisdiction: string;
  openingTimestamp: string;
  closingTimestamp: string;
  status: ChallengeStatus;
  disclosureLevel: 'MARKETPLACE_ANONYMOUS' | 'RATING_ELIGIBLE' | 'SELECTION_REVEALED';
  offersCount: number;
  isFinalRound?: boolean;
  incumbentDefended?: boolean;
  // PR-0A (additive): regulatory anchoring for historical reconstruction.
  jurisdictionDeterminationId?: string;
  ruleSetId?: string;
  ruleSetContentSha256?: string;
  regulatoryEvaluationDate?: string;
}

export type CompetitionRound = 
  | 'OPEN'
  | 'ROUND_1_OPEN' 
  | 'IMPROVEMENT'
  | 'ROUND_2_IMPROVEMENT' 
  | 'BEST_AND_FINAL'
  | 'ROUND_3_BAFO' 
  | 'CLOSED'
  | 'CONSUMER_REVIEW'
  | 'CLOSED_PENDING_SELECTION';

export interface Offer {
  id: string;
  challengeId: string;
  providerId: string;
  providerName: string;
  providerLicense: string;
  carrier: string;
  carrierAppointmentId?: string;
  quoteNumber: string;
  annualPremium: number;
  monthlyPremium: number;
  termMonths: number;
  effectiveDate: string;
  expirationDate: string;
  coverages: CoverageItem[];
  supportingQuoteDocName: string;
  submittedAt: string;
  discrepanciesDetected: boolean;
  discrepancyDetails?: string[];
  status: 'PENDING_VALIDATION' | 'VALIDATED' | 'DISCREPANCY_FLAGGED' | 'SELECTED' | 'REJECTED' | 'WITHDRAWN';
  // PM-2 Multi-Carrier & Multi-Round extensions
  round?: CompetitionRound;
  version?: number;
  previousOfferId?: string;
  revisionReason?: string;
  isLatestRevision?: boolean;
  tierLabel?: string; // e.g. "Primary Alternative", "Coverage Upgrade", "Max Savings"
  bindingAuthorityLevel?: 'AUTOMATIC' | 'BIND_WITH_BROKER' | 'MANUAL_UNDERWRITING';
  isQualified?: boolean;
  qualifiedAt?: string;
  qualificationReasons?: string[];
  disqualificationReasons?: string[];
  isDuplicateCarrier?: boolean;
  duplicateWithOfferIds?: string[];
  duplicateCarrierNotice?: string;
  verificationId?: string;
}

export type FieldComparisonResult = 'BETTER' | 'EQUIVALENT' | 'WORSE' | 'DIFFERENT' | 'UNKNOWN';

export interface FieldComparison {
  fieldCode: string;
  fieldName: string;
  category: string;
  baselineValueFormatted: string;
  offerValueFormatted: string;
  result: FieldComparisonResult;
  explanation: string;
  isMaterialReduction: boolean;
  isMaterialImprovement: boolean;
}

export type WholeOfferClassification = 
  | 'BASELINE_MATCH' 
  | 'BASELINE_PLUS' 
  | 'COVERAGE_CHANGED' 
  | 'REVIEW_REQUIRED';

export interface OfferComparison {
  offerId: string;
  challengeId: string;
  carrier: string;
  providerName: string;
  currentAnnualPremium: number;
  offerAnnualPremium: number;
  annualPremiumDifference: number; // baseline minus offer; factual, not a qualification score
  monthlyPremiumDifference: number;
  classification: WholeOfferClassification;
  summaryHeadline: string;
  materialReductions: FieldComparison[];
  materialImprovements: FieldComparison[];
  fieldComparisons: FieldComparison[];
  matchingFieldsCount: number;
  betterFieldsCount: number;
  worseFieldsCount: number;
  differentFieldsCount: number;
  unknownFieldsCount: number;
  totalFieldsCount: number;
}

export interface OfferStandardResult {
  standardVersion: string;
  coverageRelation: WholeOfferClassification;
  annualPremiumDifference: number;
  differences: FieldComparison[];
}

export type BindingHandoffStatus = 
  | 'SELECTED'
  | 'DISCLOSURE_AUTHORIZED'
  | 'APPLICATION_SUBMITTED'
  | 'UNDERWRITING'
  | 'MODIFICATION_PENDING'
  | 'BOUND'
  | 'DECLINED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface Selection {
  id: string;
  challengeId: string;
  consumerId: string;
  offerId: string;
  offerVersionId: string;
  versionNumber: number;
  providerOrganizationId: string;
  carrier: string;
  annualPremium: number;
  monthlyPremium: number;
  selectedAt: string;
  status: 'ACTIVE' | 'SUPERSEDED' | 'CANCELLED';
}

export interface ConsentGrant {
  id: string;
  challengeId: string;
  consumerId: string;
  recipientOrganizationId: string;
  recipientUserId?: string;
  purpose: string;
  purposeExplanation: string;
  authorizedFieldNames: string[];
  acknowledgedVariations: string[];
  grantedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  ipAddressHash: string;
  termsVersion: string;
}

export interface DisclosureEvent {
  id: string;
  challengeId: string;
  bindingHandoffId: string;
  consentGrantId: string;
  recipientProviderOrganizationId: string;
  recipientProviderUserId?: string;
  disclosedAt: string;
  disclosedFieldNames: string[];
  metadata?: {
    recipientAgentName?: string;
    recipientEmail?: string;
  };
  eventPayloadHash: string;
}

export interface BindingHandoff {
  id: string;
  bindingReference: string;
  challengeId: string;
  selectionId?: string;
  offerId?: string;
  offerVersionId?: string;
  consumerId?: string;
  providerOrganizationId?: string;
  carrier: string;
  status: BindingHandoffStatus;
  createdAt?: string;
  updatedAt?: string;
  consentGrantId?: string;
  consentGrantIds?: string[];
  disclosureEventId?: string;
  disclosureEventIds?: string[];
  activeModificationId?: string;
  annualPremium?: number;
  policyNumber?: string;
  finalPremium?: number;
  boundAt?: string;
  declinedAt?: string;
  declineReason?: string;
  // Legacy compatibility fields
  consumerName?: string;
  consumerEmail?: string;
  consumerPhone?: string;
  providerName?: string;
  selectedOfferId?: string;
  handoffTimestamp?: string;
}

export interface BindingModification {
  id: string;
  bindingHandoffId: string;
  challengeId: string;
  providerOrganizationId: string;
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
  proposedAt: string;
  status: 'PENDING_CONSUMER_REVIEW' | 'ACCEPTED' | 'REJECTED';
  decidedAt?: string;
  rejectionReason?: string;
}

// PM-5: Issued Policy Document Evidence
export interface IssuedPolicyDocument {
  id: string;
  bindingHandoffId: string;
  challengeId: string;
  providerOrganizationId: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  documentSha256: string;
  storageRef: string;
  uploadedAt: string;
}

// PM-5: Extracted & Normalized Snapshot
export interface IssuedPolicySnapshot {
  id: string;
  issuedPolicyDocumentId: string;
  bindingHandoffId: string;
  carrier: string;
  policyNumber: string;
  annualPremium: number;
  monthlyPremium?: number;
  effectiveDate: string;
  expirationDate: string;
  coverages: CoverageItem[];
  extractionConfidence: number; // 0.0 - 1.0
  isAmbiguous: boolean;
  snapshotSha256: string;
  extractedAt: string;
}

// PM-5: Derived Expected Terms (Derived dynamically, never stored over OfferVersion)
export interface ExpectedBoundTerms {
  offerVersionId: string;
  versionNumber: number;
  carrier: string;
  expectedAnnualPremium: number;
  expectedMonthlyPremium?: number;
  expectedEffectiveDate: string;
  expectedCoverages: CoverageItem[];
  acceptedModificationIds: string[];
}

// PM-5: Factual Discrepancy Taxonomy
export type DiscrepancyCategory =
  | 'PREMIUM_INCREASE'
  | 'DEDUCTIBLE_INCREASE'
  | 'LIMIT_REDUCTION'
  | 'COVERAGE_MISSING'
  | 'ENDORSEMENT_MISSING'
  | 'OTHER_TERM_VARIANCE';

export interface ReconciliationDiscrepancy {
  category: DiscrepancyCategory;
  fieldCode: string;
  fieldName: string;
  expectedValue: string;
  actualIssuedValue: string;
  financialImpactAnnual?: number;
  explanation: string;
  isMaterial: boolean;
}

// PM-5: Factual Reconciliation Verdict & Status
export type ReconciliationVerdict =
  | 'MATCH'
  | 'AUTHORIZED_VARIANCE'
  | 'UNAUTHORIZED_VARIANCE'
  | 'REVIEW_REQUIRED';

export type ReconciliationStatus =
  | 'PENDING_EXTRACTION'
  | 'COMPLETED_MATCH'
  | 'COMPLETED_AUTHORIZED_VARIANCE'
  | 'PENDING_CONSUMER_REVIEW'
  | 'CONSUMER_ACCEPTED_VARIANCE'
  | 'CONSUMER_DISPUTED';

export interface ReconciliationReport {
  id: string;
  bindingHandoffId?: string;
  handoffId?: string;
  challengeId?: string;
  issuedPolicyDocumentId?: string;
  issuedPolicySnapshotId?: string;
  verdict: ReconciliationVerdict;
  status: ReconciliationStatus;
  discrepancies: ReconciliationDiscrepancy[];
  totalAnnualPremiumVariance: number;
  expectedTermsSummary?: {
    annualPremium: number;
    carrier: string;
    acceptedModificationCount: number;
  };
  issuedTermsSummary?: {
    policyNumber: string;
    annualPremium: number;
    carrier: string;
  };
  reconciledAt: string;
  reconciledBy?: 'SYSTEM_DETERMINISTIC_ENGINE' | 'HUMAN_AUDITOR';
  consumerReviewedAt?: string;
  consumerDecision?: 'ACCEPT_VARIANCE' | 'DISPUTE_REMEDIATION_REQUESTED';
  consumerDisputeNotes?: string;

  // Backward compatibility with legacy stubs
  selectedOfferId?: string;
  issuedPolicyNumber?: string;
  isIdentical?: boolean;
  discrepancyCount?: number;
  notes?: string;
  differences?: Array<{
    field: string;
    agreedOffer: string;
    actualIssued: string;
    isSeverityHigh: boolean;
  }>;
}

// PM-5: Private Policy Vault Item with Complete Provenance
export interface PolicyVaultItem {
  id: string;
  consumerId: string;
  challengeId: string;
  selectionId: string;
  bindingHandoffId: string;
  selectedOfferVersionId: string;
  acceptedBindingModificationIds: string[];
  issuedPolicyDocumentId: string;
  issuedPolicySnapshotId: string;
  reconciliationReportId: string;
  futureCoverageBaselineId?: string;
  carrier: string;
  policyNumber: string;
  annualPremium: number;
  effectiveDate: string;
  expirationDate: string;
  coverages: CoverageItem[];
  provenanceHash: string;
  status: 'ACTIVE' | 'ARCHIVED';
  filedAt: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  eventType: 
    | 'POLICY_UPLOADED'
    | 'POLICY_DOCUMENT_INGESTION_STARTED'
    | 'POLICY_DOCUMENT_UPLOADED'
    | 'POLICY_DOCUMENT_SCAN_CLEAN'
    | 'POLICY_DOCUMENT_REJECTED_MALICIOUS'
    | 'POLICY_DOCUMENT_SCAN_FAILED'
    | 'POLICY_DOCUMENT_CLASSIFIED'
    | 'POLICY_DOCUMENT_EXTRACTED'
    | 'DOCUMENT_PROCESSED'
    | 'FIELD_EXTRACTED'
    | 'CONSUMER_CORRECTED_FIELD'
    | 'POLICY_VERIFIED'
    | 'BASELINE_CREATED'
    | 'CHALLENGE_OPENED'
    | 'PROVIDER_VIEWED_CHALLENGE'
    | 'OFFER_SUBMITTED'
    | 'QUOTE_DISCREPANCY_DETECTED'
    | 'COMPARISON_GENERATED'
    | 'CONSUMER_SELECTED_OFFER'
    | 'DATA_DISCLOSURE_AUTHORIZED'
    | 'BINDING_HANDOFF_CREATED'
    | 'POLICY_BOUND'
    | 'ISSUED_POLICY_RECONCILED'
    | 'RENEWAL_DETECTED'
    | 'FINAL_ROUND_INITIATED'
    | 'INCUMBENT_DEFENSE_INVITED'
    | 'VAULT_DOCUMENT_ADDED'
    | 'PROVIDER_REGISTERED'
    | 'PROVIDER_VERIFIED'
    | 'PROVIDER_STATUS_CHANGED'
    | 'PROVIDER_MATCH_EVALUATED'
    | 'COMPETITION_CREATED'
    | 'COMPETITION_OPENED'
    | 'INVITATION_CREATED'
    | 'INVITATION_VIEWED'
    | 'INVITATION_ACCEPTED'
    | 'INVITATION_DECLINED'
    | 'INVITATION_EXPIRED'
    | 'PROVIDER_WITHDREW'
    | 'OFFER_CONFIRMED_CURRENT'
    | 'INCUMBENT_POLICY_DEFENDED'
    | 'COMPETITION_ROUND_ADVANCED'
    | 'PARTICIPATION_CREATED'
    | 'OFFER_VERSION_SELECTED'
    | 'CONSENT_GRANTED'
    | 'CONSENT_REVOKED'
    | 'PII_DISCLOSED'
    | 'BINDING_MODIFICATION_PROPOSED'
    | 'BINDING_MODIFICATION_ACCEPTED'
    | 'BINDING_MODIFICATION_REJECTED'
    | 'BINDING_STATUS_CHANGED'
    | 'ISSUED_POLICY_UPLOADED'
    | 'RECONCILIATION_VARIANCE_RESOLVED'
    | 'POLICY_VAULT_FILED'
    | 'FUTURE_BASELINE_ACTIVATED'
    | 'COMMERCIAL_ACCOUNT_CREATED'
    | 'COMMERCIAL_PLAN_CREATED'
    | 'COMMERCIAL_AGREEMENT_ACTIVATED'
    | 'COMMERCIAL_EVENT_RECORDED'
    | 'BILLABLE_EVENT_RATED';
  actorId: string;
  actorRole: 'CONSUMER' | 'PROVIDER' | 'SYSTEM' | 'ADMIN';
  details: string;
  hash: string;
}

export interface SystemMetrics {
  activeChallenges: number;
  totalPoliciesIngested: number;
  redisCacheHitRate: number; // percentage e.g. 96.4
  p95ComparisonLatencyMs: number; // e.g. 14.2
  workerQueueJobsProcessed: number;
  discrepanciesIntercepted: number;
  averageConsumerSavings: number;
}

export interface VaultDocument {
  documentId: string;
  ownerId: string;
  documentType: 'POLICY' | 'DECLARATIONS_PAGE' | 'INSURANCE_CARD' | 'ENDORSEMENT' | 'RENEWAL_NOTICE' | 'QUOTE' | 'REPLACEMENT_POLICY';
  source: 'UPLOAD' | 'CARRIER_DIRECT' | 'AGENT_HANDOFF' | 'SYSTEM_RECONCILED';
  uploadTimestamp: string;
  effectiveDate: string;
  expirationDate: string;
  processingStatus: 'UPLOADED' | 'EXTRACTED' | 'VERIFIED' | 'SUPERSEDED' | 'FLAGGED';
  extractionVersion: string;
  documentHash: string;
  fileName: string;
  fileSize: string;
  carrier?: string;
  policyNumber?: string;
  notes?: string;
  isImmutable: boolean;
}

export interface PlatformNotification {
  id: string;
  type: 
    | 'POLICY_PROCESSED'
    | 'POLICY_VERIFICATION_REQUIRED'
    | 'CHALLENGE_OPENED'
    | 'OFFER_RECEIVED'
    | 'OFFER_IMPROVED'
    | 'FINAL_ROUND_OPENED'
    | 'INCUMBENT_DEFENSE'
    | 'PROVIDER_INFO_REQUEST'
    | 'POLICY_BOUND'
    | 'RENEWAL_APPROACHING'
    | 'RENEWAL_INCREASE_DETECTED'
    | 'OPPORTUNITY_RECEIVED'
    | 'COMPETITION_UPDATE';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  readAt?: string;
  recipientType: 'CONSUMER' | 'PROVIDER_USER' | 'PROVIDER_ORGANIZATION' | 'PLATFORM_OPERATOR';
  recipientConsumerId?: string;
  recipientProviderUserId?: string;
  recipientProviderOrganizationId?: string;
  recipientOperatorId?: string;
  createdFromEvent: string;
  actionTarget?: string;
}

// ==========================================
// PM-1: Provider Marketplace & Competition Domain
// ==========================================

export type OrganizationType = 
  | 'INDEPENDENT_AGENCY' 
  | 'BROKERAGE' 
  | 'DIRECT_CARRIER' 
  | 'CAPTIVE_AGENCY' 
  | 'OTHER_AUTHORIZED_PROVIDER';

export type ProviderVerificationStatus = 
  | 'REGISTERED' 
  | 'IDENTITY_VERIFIED' 
  | 'LICENSE_REVIEW' 
  | 'MARKETPLACE_APPROVED' 
  | 'ACTIVE' 
  | 'SUSPENDED' 
  | 'REVOKED';

export type MarketplaceStatus = 
  | 'ACTIVE' 
  | 'PENDING' 
  | 'SUSPENDED' 
  | 'INACTIVE';

export interface ProviderOrganization {
  id: string;
  legalName: string;
  displayName: string;
  organizationType: OrganizationType;
  verificationStatus: ProviderVerificationStatus;
  marketplaceStatus: MarketplaceStatus;
  states: string[]; // e.g. ['NV', 'CA', 'AZ']
  linesOfBusiness: string[]; // e.g. ['PERSONAL_AUTO', 'HOMEOWNERS']
  createdAt: string;
  verifiedAt?: string;
}

export type ProviderRole = 
  | 'OWNER' 
  | 'ADMIN' 
  | 'AGENT' 
  | 'QUOTER' 
  | 'VIEW_ONLY';

export interface ProviderUser {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: ProviderRole;
  status: 'ACTIVE' | 'SUSPENDED';
}

export interface ProviderLicense {
  id: string;
  providerOrganizationId: string;
  jurisdiction: string; // state e.g. 'NV'
  licenseType: string;
  licenseNumber: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  effectiveDate: string;
  expirationDate: string;
  verificationStatus: 'VERIFIED' | 'PENDING' | 'REJECTED';
  // PR-0A (additive): an individual producer's license; absent = organization (entity) license.
  providerUserId?: string;
  npn?: string;
  verificationSource?: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface CarrierRelationship {
  id: string;
  providerOrganizationId: string;
  carrierId: string;
  carrierName: string;
  jurisdiction: string;
  lineOfBusiness: string;
  relationshipType: 'APPOINTED' | 'AUTHORIZED_BROKER' | 'DIRECT' | 'OTHER';
  status: 'ACTIVE' | 'INACTIVE';
  // PR-0A (additive): calendar dates; effectiveFrom inclusive, effectiveUntil exclusive.
  effectiveFrom?: string;
  effectiveUntil?: string;
  verificationSource?: string;
  verifiedAt?: string;
}

export type RiskMarket = 'PREFERRED' | 'STANDARD' | 'NONSTANDARD';

export interface ProviderAppetite {
  id: string;
  providerOrganizationId: string;
  jurisdictions: string[];
  linesOfBusiness: string[];
  riskMarkets: RiskMarket[];
  renewalWindowDays: { min: number; max: number };
  supportedVehicleCharacteristics?: string[];
  active: boolean;
}

export type CompetitionStatus = 
  | 'PREPARING'
  | 'MATCHING'
  | 'INVITING'
  | 'OPEN'
  | 'IMPROVEMENT'
  | 'BEST_AND_FINAL'
  | 'CLOSED'
  | 'CONSUMER_REVIEW'
  | 'SELECTED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'INSUFFICIENT_COMPETITION';

export interface Competition {
  id: string;
  challengeId: string;
  status: CompetitionStatus;
  currentRound: CompetitionRound;
  openedAt: string;
  closesAt: string; // Default: 48 hours after opening
  participantCount: number;
  improvementRoundEnabled: boolean;
  finalRoundEnabled: boolean;
  completedAt?: string;
  cancellationReason?: string;
  // PM-2 & PM-3 Lifecycle Extensions
  roundDeadlines?: { [key in CompetitionRound]?: string };
  roundDurationsHours?: RoundDeadlineConfig;
  roundOffersCount?: { [key in CompetitionRound]?: number };
  roundHistory?: Array<{
    round: CompetitionRound;
    enteredAt: string;
    completedAt?: string;
    reason?: string;
  }>;
  isBafoTriggered?: boolean;
}

export interface RoundDeadlineConfig {
  [key: string]: number | undefined;
  OPEN?: number;
  ROUND_1_OPEN?: number;
  IMPROVEMENT?: number;
  ROUND_2_IMPROVEMENT?: number;
  BEST_AND_FINAL?: number;
  ROUND_3_BAFO?: number;
  CLOSED?: number;
  CONSUMER_REVIEW?: number;
}

export type CompetitionActivityType = 
  | 'COMPETITION_OPENED'
  | 'ROUND_ADVANCED'
  | 'PROVIDER_JOINED'
  | 'OFFER_SUBMITTED'
  | 'OFFER_REVISED'
  | 'PROVIDER_KEPT_CURRENT_OFFER'
  | 'PROVIDER_WITHDREW'
  | 'INFORMATION_REQUESTED'
  | 'INFORMATION_ANSWERED'
  | 'ROUND_CLOSED'
  | 'CONSUMER_REVIEW_ENTERED'
  | 'CONSUMER_KEPT_CURRENT_POLICY'
  | 'OFFER_SELECTED_FOR_BINDING';

export interface CompetitionActivityEvent {
  id: string;
  competitionId: string;
  challengeId: string;
  timestamp: string;
  type: CompetitionActivityType;
  actorRole: 'CONSUMER' | 'PROVIDER' | 'SYSTEM' | 'ADMIN';
  actorName?: string;
  providerOrganizationId?: string;
  summary: string;
  round: CompetitionRound;
  metadata?: Record<string, any>;
}

export interface RoundDeadlineStatus {
  round: CompetitionRound;
  closesAt: string;
  isExpired: boolean;
  remainingSeconds: number;
  formattedRemaining: string;
  nextRoundSuggested?: CompetitionRound;
}

// Canonical Sealed Provider Telemetry (PM-1 Mandatory Invariant)
export interface ProviderOfferStanding {
  offerId: string;
  carrier: string;
  tierLabel?: string;
  annualPremium: number;
  differenceFromCurrentPolicy: number;
  savingsPercentage: number;
  status: 'VALIDATED' | 'DISCREPANCY_FLAGGED';
  classification: WholeOfferClassification;
  meetsRequirements: boolean;
  isVerified: boolean;
  requiresAdditionalInfo: boolean;
  canRevise: boolean;
}

export interface ProviderMarketSignal {
  competitionId: string;
  challengeId: string;
  currentRound: CompetitionRound;
  roundClosesAt: string;
  roundTimeRemainingMs: number;
  totalInvitedProviders: number;
  totalParticipatingProviders: number;
  totalSubmittedOffersInRound: number;
  yourSubmittedOffersCount: number;
  consumerRequestedImprovement: boolean;
  statusMessage?: string;
  yourOffers: ProviderOfferStanding[];
  guidanceHint?: string;
  nextRoundEligible: boolean;
  // Legacy compatibility accessor (sealed to provider's own offer)
  bestPosition?: {
    offerId: string;
    carrier: string;
    annualSavings: number;
    savingsPercentage: number;
    guidanceHint: string;
    meetsRequirements: boolean;
    isVerified: boolean;
  } | null;
  allYourOffersSignals?: Array<{
    offerId: string;
    carrier: string;
    tierLabel?: string;
    annualPremium: number;
    annualSavings: number;
    savingsPercentage: number;
    totalValidOffers: number;
    status: 'VALIDATED' | 'DISCREPANCY_FLAGGED';
    classification: WholeOfferClassification;
    canRevise: boolean;
  }>;
}

/**
 * PM-2 Factual Offer Comparison (no platform-defined scoring or ranking).
 * Consumers sort and evaluate by their own criteria:
 *   - Premium (low to high)
 *   - Savings (high to low)
 *   - Carrier (A to Z)
 *   - Coverage classification (BASELINE_MATCH / BASELINE_PLUS / COVERAGE_CHANGED / REVIEW_REQUIRED)
 *
 * Platform does NOT assign scores, ranks, or winner labels to offers.
 */
export interface OfferWithComparison {
  offer: Offer;
  comparison: OfferComparison;
}

export interface CompetitionEvaluationSummary {
  competitionId: string;
  challengeId: string;
  currentRound: CompetitionRound;
  totalOffersSubmitted: number;
  validQualifiedOffersCount: number;
  flaggedOffersCount: number;
  disqualifiedCount: number;
  /** Factual per-offer comparisons. Consumer selects how to sort. No platform ranking. */
  offerComparisons: OfferWithComparison[];
  maxAnnualSavings: number;
  averageAnnualSavings: number;
  advancementReadiness: {
    canAdvanceToImprovement: boolean;
    canAdvanceToBafo: boolean;
    canCloseForConsumerReview: boolean;
    reasons: string[];
  };
}

export type InvitationStatus = 
  | 'INVITED' 
  | 'VIEWED' 
  | 'ACCEPTED' 
  | 'DECLINED' 
  | 'EXPIRED' 
  | 'WITHDRAWN' 
  | 'INELIGIBLE';

export type DeclineReason = 
  | 'OUTSIDE_APPETITE' 
  | 'NO_COMPETITIVE_MARKET' 
  | 'INSUFFICIENT_INFORMATION' 
  | 'CARRIER_RESTRICTION' 
  | 'CAPACITY' 
  | 'OTHER';

export interface ChallengeInvitation {
  id: string;
  challengeId: string;
  competitionId: string;
  providerOrganizationId: string;
  eligibilityResult: 'ELIGIBLE' | 'INELIGIBLE';
  eligibilityReasons: string[];
  status: InvitationStatus;
  declineReason?: DeclineReason;
  declineNotes?: string;
  invitedAt: string;
  viewedAt?: string;
  acceptedAt?: string;
  declinedAt?: string;
  expiresAt: string;
}

export interface ChallengeParticipation {
  id: string;
  challengeId: string;
  competitionId: string;
  providerOrganizationId: string;
  acceptedAt: string;
  status: 'ACTIVE' | 'QUOTING' | 'OFFER_SUBMITTED' | 'WITHDRAWN';
  lastActivityAt: string;
}

// Pre-acceptance privacy-preserving Opportunity view (Section 12)
export interface OpportunityPreview {
  invitationId: string;
  challengeId: string;
  competitionId: string;
  referenceNumber: string;
  market: string; // e.g. "Nevada Personal Auto"
  jurisdiction: string;
  lineOfBusiness: string;
  vehicleSummary: string; // e.g. "2024 Toyota Camry" (no VINs)
  currentAnnualPremium: number;
  currentMonthlyPremium: number;
  coverageBaselineStatus: 'VERIFIED';
  renewalDaysRemaining: number;
  consumerRequirementsSummary: string;
  competitionClosesAt: string;
  invitedProvidersCount: number;
  participatingProvidersCount: number;
  invitationStatus: InvitationStatus;
  viewedAt?: string;
}

// ==========================================
// PM-2: Information Requests, Supplemental Facts, Offer Versioning & Qualification
// ==========================================

export type InformationRequestField = 
  | 'ANNUAL_MILEAGE'
  | 'COMMUTE_DISTANCE'
  | 'GARAGING_ZIP'
  | 'VEHICLE_PRIMARY_USE'
  | 'PRIOR_INSURANCE_MONTHS'
  | 'DRIVER_TRAINING_COURSE'
  | 'SECURITY_SYSTEM_TYPE'
  | 'ROOF_AGE_YEARS'
  | 'HOME_HEATING_TYPE'
  | 'ESTIMATED_REPLACEMENT_COST'
  | 'CUSTOM';

export type StandardInformationRequestPurpose = 
  | 'RATING_REQUIRED'
  | 'RATING_DISCOUNT'
  | 'UNDERWRITING_ELIGIBILITY'
  | 'TIER_DETERMINATION'
  | 'BINDING_REQUIREMENT'
  | 'ENDORSEMENT_VERIFICATION'
  | 'CUSTOM';

export type InformationRequestPurpose = StandardInformationRequestPurpose | (string & {});

export type InformationRequestStatus = 
  | 'PENDING'
  | 'ANSWERED'
  | 'DECLINED'
  | 'EXPIRED';

export interface InformationRequest {
  id: string;
  challengeId: string;
  competitionId: string;
  providerOrganizationId: string;
  requestedField: InformationRequestField;
  customFieldName?: string;
  purpose: InformationRequestPurpose;
  purposeExplanation: string;
  status: InformationRequestStatus;
  requestedAt: string;
  answeredAt?: string;
  answerValue?: any;
  reusableFactId?: string;
}

export type FactConsentScope = 
  | 'REQUESTING_PROVIDER_ONLY'
  | 'ALL_ACTIVE_PARTICIPANTS'
  | 'EXPLICIT_PROVIDER_SELECTION';

export interface VerifiedSupplementalFact {
  id: string;
  consumerId: string;
  challengeId: string;
  fieldType: InformationRequestField;
  fieldName: string;
  value: any;
  formattedValue: string;
  verificationState: 'CONSUMER_ATTESTED' | 'DOCUMENT_VERIFIED' | 'THIRD_PARTY_VERIFIED';
  source: string;
  createdAt: string;
  consentScope?: FactConsentScope; // Explicit consumer disclosure/consent state
  sharedWithOrganizationIds: string[]; // Organizations explicitly authorized by consumer consent
}

export interface OfferVersion {
  id: string;
  offerId: string;
  versionNumber: number;
  round: CompetitionRound;
  carrier: string;
  annualPremium: number;
  monthlyPremium: number;
  coverages: CoverageItem[];
  supportingQuoteDocName: string;
  revisionReason: string;
  submittedAt: string;
  supersededAt?: string;
}

export interface OfferVerification {
  id: string;
  offerId: string;
  documentName: string;
  status: 'VERIFIED' | 'DISCREPANCIES_FLAGGED' | 'UNVERIFIED';
  verifiedAt: string;
  discrepancyCount: number;
  discrepancies: string[];
  extractedPremium?: number;
  enteredPremium?: number;
}

export interface QualifiedOffer extends Offer {
  isQualified: boolean;
  qualifiedAt: string;
  qualificationReasons: string[];
}

// PM-3 Export types re-exported from domain engine
export type { 
  BindingHandoffDossier, 
  DetailedPostBindReconciliation, 
  PostBindDiscrepancyItem 
} from '../domain/bindingReconciliationEngine';

// ==========================================
// PM-4: Regulatory Audit Ledger, Review Queue & Governance Types
// ==========================================

export type ReviewQueueItemType = 
  | 'QUOTE_DISCREPANCY'
  | 'AMBIGUOUS_EXTRACTION'
  | 'POST_BIND_BREACH'
  | 'LICENSE_FLAG'
  | 'UNUSUAL_PRICE_VARIANCE'
  | 'COVERAGE_DEGRADATION_ATTEMPT';

export type ReviewQueueStatus = 
  | 'PENDING_REVIEW'
  | 'UNDER_INVESTIGATION'
  | 'RESOLVED_OVERRIDE'
  | 'RESOLVED_REJECTED';

export type ReviewQueueSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ReviewQueueItem {
  id: string;
  type: ReviewQueueItemType;
  source: string;
  summary: string;
  severity: ReviewQueueSeverity;
  status: ReviewQueueStatus;
  createdAt: string;
  challengeId?: string;
  offerId?: string;
  providerId?: string;
  details?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  decision?: 'OVERRIDE' | 'REJECT';
}

export interface ChainVerificationResult {
  isValid: boolean;
  totalEvents: number;
  verifiedBlocks: number;
  tamperedIndex: number | null;
  tamperedEventId?: string;
  error?: string;
  genesisHash: string;
  latestBlockHash: string;
  merkleRoot: string;
  verifiedAt: string;
}

export interface RegulatoryAuditProof {
  proofId: string;
  certificationAuthority: string;
  jurisdiction: string;
  challengeReference: string;
  timeframe: {
    from: string;
    to: string;
  };
  chainIntegrityVerified: boolean;
  merkleRoot: string;
  genesisHash: string;
  latestBlockHash: string;
  totalAuditedEvents: number;
  signedBy: string;
  certifiedAt: string;
  statutoryComplianceAffidavit: string;
}

// ==========================================
// Commercial Economics Domain (CE-1 through CE-5)
// ==========================================

export type CommercialAccountStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'SUSPENDED'
  | 'TERMINATED';

export interface CommercialAccount {
  id: string;
  providerOrganizationId: string;
  status: CommercialAccountStatus;
  currency: 'USD';
  externalBillingCustomerRef?: string;
  createdAt: string;
  updatedAt: string;
}

export type CommercialPlanSegment =
  | 'SOLO'
  | 'AGENCY'
  | 'NETWORK'
  | 'ENTERPRISE';

export interface CommercialPlan {
  id: string;
  code: string;
  displayName: string;
  providerSegment: CommercialPlanSegment;
  status: 'DRAFT' | 'ACTIVE' | 'RETIRED';
  createdAt: string;
}

export type BillingInterval = 'MONTHLY' | 'ANNUAL' | 'CUSTOM';

export interface CommercialPlanTermsSnapshot {
  includedProducerSeats?: number;
  includedJurisdictions?: number;
  includedVpoCapacity?: number;
  includedEngagementCapacity?: number;
  includedAuthorizedConnections?: number;
  authorizedConnectionUnitPriceCents?: number;
  boundAcquisitionUnitPriceCents?: number;
  overageRules?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CommercialPlanVersion {
  id: string;
  planId: string;
  version: number;
  effectiveFrom: string;
  effectiveUntil?: string;
  billingInterval: BillingInterval;
  recurringFeeCents: number;
  currency: 'USD';
  termsSnapshot: CommercialPlanTermsSnapshot;
  createdAt: string;
}

export type CommercialAgreementStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'TERMINATED'
  | 'EXPIRED';

export interface CommercialAgreement {
  id: string;
  commercialAccountId: string;
  providerOrganizationId: string;
  planVersionId: string;
  status: CommercialAgreementStatus;
  startsAt: string;
  endsAt?: string;
  acceptedAt?: string;
  createdAt: string;
}

export type EntitlementType =
  | 'PROVIDER_SEATS'
  | 'JURISDICTION_CAPACITY'
  | 'VPO_VIEW_CAPACITY'
  | 'VPO_ENGAGEMENT_CAPACITY'
  | 'ACTIVE_COMPETITION_CAPACITY'
  | 'API_ACCESS'
  | 'AUTOMATED_APPETITE_MATCHING'
  | 'MULTI_LOCATION_ADMIN'
  | 'ENTERPRISE_REPORTING';

export type CapacityEnforcementPolicy = 'HARD_BLOCK' | 'ALLOW_OVERAGE' | 'NOTIFY_ONLY';

export interface ProviderEntitlement {
  id: string;
  providerOrganizationId: string;
  commercialAgreementId: string;
  entitlementType: EntitlementType;
  limit?: number;
  enforcementPolicy: CapacityEnforcementPolicy;
  scope?: Record<string, unknown>;
  effectiveFrom: string;
  effectiveUntil?: string;
  createdAt: string;
}

export type CommercialUsageType =
  | 'VPO_ENGAGEMENT'
  | 'VPO_VIEW'
  | 'PRODUCER_SEAT'
  | 'JURISDICTION';

export interface CommercialUsageRecord {
  id: string;
  providerOrganizationId: string;
  commercialAgreementId?: string;
  entitlementId?: string;
  usageType: CommercialUsageType;
  quantity: number;
  invitationId?: string;
  challengeId?: string;
  participationId?: string;
  consumedAt: string;
  idempotencyKey: string;
  policyMode: CapacityEnforcementPolicy;
  isOverage: boolean;
  metadata?: Record<string, unknown>;
}

export interface CommercialCapacityResult {
  allowed: boolean;
  code: 'WITHIN_CAPACITY' | 'OVERAGE_PERMITTED' | 'NOTIFY_CAPACITY_EXCEEDED' | 'COMMERCIAL_CAPACITY_REACHED' | 'NO_ACTIVE_AGREEMENT';
  isOverage: boolean;
  currentUsage: number;
  limit?: number;
  enforcementPolicy: CapacityEnforcementPolicy;
  reason?: string;
  usageRecord?: CommercialUsageRecord;
  alreadyConsumed?: boolean;
}

export type CommercialEventType =
  | 'VPO_AVAILABLE'
  | 'VPO_VIEWED'
  | 'VPO_ENGAGED'
  | 'PROPOSITION_SUBMITTED'
  | 'CONSUMER_SELECTED'
  | 'AUTHORIZED_CONNECTION'
  | 'BOUND_ACQUISITION'
  | 'VERIFIED_BOUND_OUTCOME'
  | 'BASELINE_ACTIVATED';

export interface CommercialEvent {
  id: string;
  providerOrganizationId: string;
  eventType: CommercialEventType;
  sourceEntityType: string;
  sourceEntityId: string;
  challengeId?: string;
  competitionId?: string;
  commercialAgreementId?: string;
  commercialPlanVersionId?: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
  idempotencyKey: string;
  eventHash: string;
}

export type RatingDisposition =
  | 'BILLABLE'
  | 'INCLUDED_IN_PLAN'
  | 'NOT_BILLABLE'
  | 'NOT_RATED'
  | 'EXEMPT'
  | 'PREVIOUSLY_RATED';

export type BillableEventStatus =
  | 'RATED'
  | 'INVOICED'
  | 'SETTLED';

export interface BillableEvent {
  id: string;
  commercialEventId: string;
  providerOrganizationId: string;
  commercialAgreementId: string;
  commercialPlanVersionId: string;
  chargeCode: string;
  quantity: number;
  unitPriceCents: number;
  amountCents: number;
  currency: 'USD';
  status: BillableEventStatus;
  ratedAt: string;
  pricingSnapshot: Record<string, unknown>;
  idempotencyKey: string;
}

export type RatingAdjustmentType =
  | 'REVERSAL'
  | 'DISPUTE_CREDIT'
  | 'OVERAGE_FORGIVENESS';

export interface RatingAdjustment {
  id: string;
  originalBillableEventId: string;
  providerOrganizationId: string;
  adjustmentType: RatingAdjustmentType;
  amountCents: number;
  reason: string;
  authorizedBy: string;
  authorizedAt: string;
  idempotencyKey: string;
}

export interface RatingDecision {
  disposition: RatingDisposition;
  billable: boolean;
  commercialEventId: string;
  providerOrganizationId: string;
  commercialAgreementId?: string;
  commercialPlanVersionId?: string;
  chargeCode?: string;
  quantity: number;
  unitPriceCents: number;
  amountCents: number;
  currency: 'USD';
  reason: string;
  ratedAt: string;
  pricingSnapshot?: Record<string, unknown>;
  error?: string;
}

export interface RatingRun {
  id: string;
  startedAt: string;
  completedAt: string;
  eventsEvaluated: number;
  billableEventsCreated: number;
  includedCount: number;
  notRatedCount: number;
  exemptCount: number;
  previouslyRatedCount: number;
  grossRatedCents: number;
  adjustmentCents: number;
  errors: string[];
}

export interface CommercialValueSummary {
  providerOrganizationId: string;
  period: {
    from: string;
    to: string;
  };
  vposAvailable: number;
  vposViewed: number;
  vposEngaged: number;
  propositionsSubmitted: number;
  consumerSelections: number;
  authorizedConnections: number;
  boundAcquisitions: number;
  verifiedBoundOutcomes: number;
  baselinesActivated: number;
  conversionRatios: {
    engagementRate: number; // vposEngaged / vposAvailable
    selectionRate: number; // consumerSelections / vposEngaged
    authorizationRate: number; // authorizedConnections / consumerSelections
    bindRate: number; // boundAcquisitions / authorizedConnections
    verificationRate: number; // verifiedBoundOutcomes / boundAcquisitions
    activationRate: number; // baselinesActivated / verifiedBoundOutcomes
  };
}

// ==========================================
// CE-5: Invoicing, Billing Periods & Settlement
// ==========================================

export type BillingPeriodStatus = 'OPEN' | 'CLOSING' | 'CLOSED';

export interface BillingPeriod {
  id: string;
  providerOrganizationId: string;
  commercialAgreementId: string;
  commercialPlanVersionId: string;
  periodStart: string;
  periodEnd: string;
  status: BillingPeriodStatus;
  closedAt?: string;
  createdAt: string;
}

export type InvoiceStatus =
  | 'DRAFT'
  | 'FINALIZED'
  | 'ISSUED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'PAST_DUE';

export type InvoiceLineType =
  | 'SUBSCRIPTION'
  | 'USAGE_CHARGE'
  | 'OUTCOME_CHARGE'
  | 'ADJUSTMENT_CREDIT';

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  lineType: InvoiceLineType;
  description: string;
  quantity: number;
  unitPriceCents: number;
  amountCents: number;
  billableEventId?: string;
  ratingAdjustmentId?: string;
  billingPeriodId?: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  providerOrganizationId: string;
  commercialAgreementId: string;
  billingPeriodId: string;
  status: InvoiceStatus;
  currency: 'USD';
  subtotalCents: number;
  taxCents: number;
  totalDueCents: number;
  balanceDueCents: number;
  issuedAt?: string;
  dueAt?: string;
  finalizedAt?: string;
  paidAt?: string;
  idempotencyKey: string;
  createdAt: string;
  lineItems?: InvoiceLineItem[];
}

export type PaymentMethod =
  | 'ACH_TRANSFER'
  | 'CREDIT_CARD'
  | 'MANUAL_WIRE'
  | 'INTERNAL_CREDIT';

export type PaymentStatus =
  | 'PENDING'
  | 'SUCCEEDED'
  | 'FAILED';

export interface PaymentRecord {
  id: string;
  providerOrganizationId: string;
  invoiceId?: string;
  amountCents: number;
  currency: 'USD';
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  externalReference?: string;
  failureReason?: string;
  settledAt?: string;
  idempotencyKey: string;
  createdAt: string;
}

export interface RefundRecord {
  id: string;
  originalPaymentRecordId: string;
  providerOrganizationId: string;
  amountCents: number;
  currency: 'USD';
  reason: string;
  refundedAt: string;
  idempotencyKey: string;
}

export interface SettlementAllocation {
  id: string;
  paymentRecordId: string;
  refundRecordId?: string;
  invoiceId: string;
  amountAllocatedCents: number;
  allocatedAt: string;
}

export interface ProviderAccountBalance {
  providerOrganizationId: string;
  totalInvoicedCents: number;
  totalPaidCents: number;
  totalRefundedCents: number;
  totalAdjustmentsCents: number;
  outstandingBalanceCents: number;
  creditBalanceCents: number;
  asOf: string;
}

export interface PaymentProviderAdapter {
  createPaymentIntent(params: {
    invoiceId: string;
    amountCents: number;
    currency: 'USD';
    metadata?: Record<string, unknown>;
  }): Promise<{
    intentId: string;
    status: PaymentStatus;
    clientSecret?: string;
  }>;
  retrievePaymentStatus(intentId: string): Promise<{
    intentId: string;
    status: PaymentStatus;
    amountCents: number;
  }>;
  refundPayment(params: {
    paymentId: string;
    amountCents: number;
    reason: string;
  }): Promise<{
    refundId: string;
    status: 'SUCCEEDED' | 'FAILED';
  }>;
}
