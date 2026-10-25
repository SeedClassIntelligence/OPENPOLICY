import { OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2 } from '../domain/commercialPriceBook';
import type { CommercialStore } from './db/commercialStore';
import type { PostgresStore, ProviderApplication } from './db/postgresStore';
import { hasCurrentProviderMembershipAccess } from './providerMembership';

export async function activateApprovedProviderApplication(input: {
  applicationId: string;
  actorId: string;
  reason: string;
  postgresStore: PostgresStore;
  commercialStore: CommercialStore;
  synchronizeIdentity?: (application: ProviderApplication) => Promise<void>;
}) {
  const application = (await input.postgresStore.listProviderApplications()).find(item => item.id === input.applicationId);
  if (!application) throw Object.assign(new Error('Provider application not found.'), { statusCode: 404 });
  if (application.status !== 'APPROVED' || !application.providerOrganizationId || !application.providerUserId) {
    throw Object.assign(new Error('Provider application must be approved and authoritatively mapped before activation.'), { statusCode: 409 });
  }
  const licenses = await input.postgresStore.getProviderLicenses(application.providerOrganizationId);
  const evidence = await input.postgresStore.getProviderAuthorityEvidence(application.providerOrganizationId);
  const authorityNumber = application.organizationType === 'DIRECT_CARRIER'
    ? application.carrierAuthorityReference
    : application.producerLicenseNumber;
  const authorityLicense = licenses.find(item =>
    item.licenseNumber === authorityNumber && item.jurisdiction === application.jurisdictionCode &&
    item.status === 'ACTIVE' && item.verificationStatus === 'VERIFIED' && !!item.authorityEvidenceId
  );
  const authorityEvidence = authorityLicense && evidence.find(item =>
    item.id === authorityLicense.authorityEvidenceId && item.authorityNumber === authorityNumber &&
    item.jurisdiction === application.jurisdictionCode && item.status === 'VERIFIED'
  );
  const today = new Date().toISOString().slice(0, 10);
  const evidenceIsCurrent = (item: typeof evidence[number] | undefined) => !!item &&
    item.submittedBy !== item.verifiedBy && !!item.sourceUrl && !!item.evidenceSha256 &&
    item.nextReviewAt.slice(0, 10) >= today && (!item.expirationDate || item.expirationDate.slice(0, 10) > today);
  if (!authorityEvidence || authorityEvidence.submittedBy === authorityEvidence.verifiedBy ||
      !authorityEvidence.sourceUrl || !authorityEvidence.evidenceSha256 ||
      authorityEvidence.nextReviewAt.slice(0, 10) < today ||
      (!!authorityEvidence.expirationDate && authorityEvidence.expirationDate.slice(0, 10) <= today)) {
    throw Object.assign(new Error('Current, independently reviewed authoritative evidence is required before provider activation.'), { statusCode: 409 });
  }
  if (application.organizationType !== 'DIRECT_CARRIER') {
    const organizationEvidence = evidence.find(item => item.subjectType === 'ORGANIZATION_LICENSE' &&
      item.authorityNumber === application.organizationLicenseNumber && item.jurisdiction === application.jurisdictionCode && item.status === 'VERIFIED');
    if (!evidenceIsCurrent(organizationEvidence)) {
      throw Object.assign(new Error('Current authoritative organization-license evidence is required before activation.'), { statusCode: 409 });
    }
  }
  if (application.transactionRole === 'AGENT') {
    const relationshipEvidence = evidence.find(item => item.subjectType === 'CARRIER_RELATIONSHIP' &&
      item.jurisdiction === application.jurisdictionCode && item.status === 'VERIFIED' &&
      item.insuranceLine === application.insuranceLines[0]);
    if (!evidenceIsCurrent(relationshipEvidence)) {
      throw Object.assign(new Error('Current carrier-appointment evidence for the requested line is required before agent activation.'), { statusCode: 409 });
    }
  }
  if (application.organizationType === 'DIRECT_CARRIER') {
    const certificate = licenses.find(item =>
      !item.providerUserId && item.jurisdiction === application.jurisdictionCode &&
      item.licenseType === 'CARRIER_CERTIFICATE_OF_AUTHORITY' && item.status === 'ACTIVE' &&
      item.verificationStatus === 'VERIFIED' && item.licenseNumber === application.carrierAuthorityReference &&
      !!item.verificationSource && !!item.verifiedBy && item.authorityEvidenceId === authorityEvidence.id &&
      (!item.expirationDate || item.expirationDate.slice(0, 10) > new Date().toISOString().slice(0, 10))
    );
    if (!certificate) {
      throw Object.assign(new Error('A current, independently verified carrier certificate-of-authority record is required before activation.'), { statusCode: 409 });
    }
  }
  const agreement = await input.commercialStore.getActiveAgreementForOrg(application.providerOrganizationId);
  if (!agreement) throw Object.assign(new Error('An active V2 commercial agreement is required before provider activation.'), { statusCode: 409 });
  const version = await input.commercialStore.getCommercialPlanVersion(agreement.planVersionId);
  const plan = version ? await input.commercialStore.getCommercialPlanById(version.planId) : undefined;
  if (!version || !plan || version.termsSnapshot.priceBookId !== OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.id || plan.code !== application.requestedPlanCode) {
    throw Object.assign(new Error('The active agreement does not match the application requested OPEN_POLICY_COMMERCIAL_V2 membership.'), { statusCode: 409 });
  }
  if (!(await hasCurrentProviderMembershipAccess({
    providerOrganizationId: application.providerOrganizationId,
    agreementId: agreement.id,
    membershipTrialStatus: agreement.membershipTrialStatus,
    membershipTrialStartedAt: agreement.membershipTrialStartedAt,
    membershipTrialEndsAt: agreement.membershipTrialEndsAt,
    commercialStore: input.commercialStore
  }))) {
    throw Object.assign(new Error('A valid 30-day membership trial or fully settled V2 membership invoice is required before provider activation.'), { statusCode: 409 });
  }
  if (input.synchronizeIdentity) await input.synchronizeIdentity(application);
  const organization = await input.postgresStore.changeProviderOrganizationStatus({
    organizationId: application.providerOrganizationId,
    marketplaceStatus: 'ACTIVE',
    actorId: input.actorId,
    reason: input.reason || 'Verified authority, matching V2 agreement, and settled membership invoice confirmed.'
  });
  return { application, agreement, organization };
}
