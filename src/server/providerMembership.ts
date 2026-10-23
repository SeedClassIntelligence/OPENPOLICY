import { buildBillingPeriod } from '../domain/commercialEconomicsEngine';
import type { CommercialStore } from './db/commercialStore';
import type { PostgresStore, ProviderApplication } from './db/postgresStore';

export interface ProviderMembershipState {
  application: ProviderApplication;
  agreementId?: string;
  invoice?: {
    id: string;
    invoiceNumber: string;
    status: string;
    totalDueCents: number;
    balanceDueCents: number;
    currency: string;
  };
  paymentRequired: boolean;
  paymentComplete: boolean;
  marketplaceAccessGranted: boolean;
}

function addOneUtcMonth(value: string): string {
  const start = new Date(value);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return end.toISOString();
}

async function requireApplication(
  postgresStore: PostgresStore,
  applicationId: string
): Promise<ProviderApplication> {
  const application = (await postgresStore.listProviderApplications()).find(item => item.id === applicationId);
  if (!application) throw Object.assign(new Error('Provider application not found.'), { statusCode: 404 });
  return application;
}

export async function getProviderMembershipState(input: {
  application: ProviderApplication;
  commercialStore: CommercialStore;
}): Promise<ProviderMembershipState> {
  const { application, commercialStore } = input;
  const organizationId = application.providerOrganizationId;
  if (!organizationId) {
    return { application, paymentRequired: false, paymentComplete: false, marketplaceAccessGranted: false };
  }
  const agreement = await commercialStore.getActiveCommercialAgreement(organizationId);
  const invoices = agreement
    ? (await commercialStore.getInvoicesForOrg(organizationId)).filter(invoice =>
        invoice.commercialAgreementId === agreement.id &&
        invoice.lineItems?.some(item => item.lineType === 'SUBSCRIPTION' && item.amountCents > 0))
    : [];
  const invoice = invoices[0];
  const paymentComplete = Boolean(invoice && invoice.status === 'PAID' && invoice.balanceDueCents === 0);
  return {
    application,
    agreementId: agreement?.id,
    invoice: invoice ? {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      totalDueCents: invoice.totalDueCents,
      balanceDueCents: invoice.balanceDueCents,
      currency: invoice.currency
    } : undefined,
    paymentRequired: Boolean(invoice && !paymentComplete && invoice.balanceDueCents > 0),
    paymentComplete,
    marketplaceAccessGranted: false
  };
}

/**
 * Creates the approved provider's immutable V2 agreement and first membership
 * invoice. This is an administrator-controlled preparation step; it never
 * activates marketplace access and is safe to retry.
 */
export async function prepareProviderMembership(input: {
  applicationId: string;
  postgresStore: PostgresStore;
  commercialStore: CommercialStore;
  now?: string;
}): Promise<ProviderMembershipState> {
  const { postgresStore, commercialStore } = input;
  const application = await requireApplication(postgresStore, input.applicationId);
  if (application.status !== 'APPROVED' || !application.providerOrganizationId) {
    throw Object.assign(new Error('Provider authority must be approved before membership billing is prepared.'), { statusCode: 409 });
  }

  const organizationId = application.providerOrganizationId;
  let agreement = await commercialStore.getActiveCommercialAgreement(organizationId);
  if (agreement) {
    const version = await commercialStore.getCommercialPlanVersion(agreement.planVersionId);
    const plan = version ? await commercialStore.getCommercialPlanById(version.planId) : undefined;
    if (!version || version.termsSnapshot.priceBookId !== 'OPEN_POLICY_COMMERCIAL_V2' || plan?.code !== application.requestedPlanCode) {
      throw Object.assign(new Error('The active commercial agreement does not match the approved V2 membership request.'), { statusCode: 409 });
    }
  } else {
    const enrollment = await commercialStore.enrollCommercialAgreement({
      providerOrgId: organizationId,
      planId: application.requestedPlanCode,
      actorRole: 'ADMIN'
    });
    agreement = enrollment.agreement;
  }

  const existing = await getProviderMembershipState({ application, commercialStore });
  if (existing.invoice) return existing;

  const periodStart = input.now || new Date().toISOString();
  const period = buildBillingPeriod({
    id: `bp_membership_${application.id}`,
    providerOrganizationId: organizationId,
    commercialAgreementId: agreement.id,
    commercialPlanVersionId: agreement.planVersionId,
    periodStart,
    periodEnd: addOneUtcMonth(periodStart),
    createdAt: periodStart
  });
  await commercialStore.saveBillingPeriod(period);
  await commercialStore.closeBillingPeriod(period.id);
  const draft = await commercialStore.generateDraftInvoice({
    providerOrganizationId: organizationId,
    billingPeriodId: period.id,
    idempotencyKey: `provider-membership:${application.id}`
  });
  if (draft.invoice.totalDueCents <= 0 || !draft.lineItems.some(item => item.lineType === 'SUBSCRIPTION')) {
    throw Object.assign(new Error('The approved membership did not produce a valid subscription invoice.'), { statusCode: 409 });
  }
  await commercialStore.finalizeInvoiceById(draft.invoice.id);
  return getProviderMembershipState({ application, commercialStore });
}
