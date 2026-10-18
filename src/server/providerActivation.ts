import { OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2 } from '../domain/commercialPriceBook';
import type { CommercialStore } from './db/commercialStore';
import type { PostgresStore, ProviderApplication } from './db/postgresStore';

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
  if (application.organizationType === 'DIRECT_CARRIER') {
    const licenses = await input.postgresStore.getProviderLicenses(application.providerOrganizationId);
    const certificate = licenses.find(item =>
      !item.providerUserId && item.jurisdiction === application.jurisdictionCode &&
      item.licenseType === 'CARRIER_CERTIFICATE_OF_AUTHORITY' && item.status === 'ACTIVE' &&
      item.verificationStatus === 'VERIFIED' && item.licenseNumber === application.carrierAuthorityReference &&
      !!item.verificationSource && !!item.verifiedBy &&
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
  if (!(await input.commercialStore.hasPaidSubscriptionInvoice(application.providerOrganizationId, agreement.id))) {
    throw Object.assign(new Error('A fully settled V2 membership subscription invoice is required before provider activation.'), { statusCode: 409 });
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
