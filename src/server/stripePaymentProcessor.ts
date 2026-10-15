import Stripe from 'stripe';
import type { PaymentMethod, PaymentStatus } from '../types/insurance';

export interface StripeProcessorConfig {
  secretKey: string;
  webhookSecret: string;
  publicAppUrl: string;
}

export function stripeProcessorConfig(env: NodeJS.ProcessEnv = process.env): StripeProcessorConfig {
  const secretKey = env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim();
  const publicAppUrl = env.APP_URL?.trim();
  if (!secretKey || !webhookSecret || !publicAppUrl) {
    throw Object.assign(new Error('Stripe requires STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and APP_URL.'), {
      statusCode: 503, code: 'PAYMENT_PROCESSOR_NOT_CONFIGURED'
    });
  }
  const parsed = new URL(publicAppUrl);
  if (env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
    throw Object.assign(new Error('Stripe production return URLs require HTTPS.'), {
      statusCode: 503, code: 'PAYMENT_PROCESSOR_RETURN_URL_INSECURE'
    });
  }
  return { secretKey, webhookSecret, publicAppUrl: parsed.origin };
}

export function mapStripeIntentStatus(status: Stripe.PaymentIntent.Status): PaymentStatus {
  if (status === 'succeeded') return 'SUCCEEDED';
  if (status === 'canceled' || status === 'requires_payment_method') return 'FAILED';
  return 'PENDING';
}

/** Processor delivery is not ordered. A terminal success is monotonic and must
 * never be downgraded by a delayed pending/failure event for the same intent. */
export function shouldApplyStripePaymentStatus(previous: PaymentStatus | undefined, next: PaymentStatus): boolean {
  if (previous === 'SUCCEEDED') return next === 'SUCCEEDED';
  if (previous === 'FAILED') return next === 'SUCCEEDED' || next === 'FAILED';
  return true;
}

export function stripeRefundLedgerKey(processorRefundId: string): string {
  if (!processorRefundId.trim()) throw new Error('Stripe refund identity is required.');
  return `stripe-refund:${processorRefundId}`;
}

export function stripePaymentMethod(intent: Stripe.PaymentIntent): PaymentMethod {
  return intent.payment_method_types.includes('us_bank_account') ? 'ACH_TRANSFER' : 'CREDIT_CARD';
}

export class StripePaymentProcessor {
  readonly stripe: Stripe;
  constructor(readonly config: StripeProcessorConfig, stripe?: Stripe) {
    this.stripe = stripe || new Stripe(config.secretKey, { maxNetworkRetries: 2 });
  }

  async createCustomer(params: { providerOrganizationId: string; name: string; email?: string }) {
    return this.stripe.customers.create({
      name: params.name, email: params.email,
      metadata: { openPolicyProviderOrganizationId: params.providerOrganizationId }
    }, { idempotencyKey: `openpolicy-customer-${params.providerOrganizationId}` });
  }

  async createInvoicePaymentSession(params: {
    customerId: string; invoiceId: string; invoiceNumber: string;
    providerOrganizationId: string; amountCents: number;
  }) {
    const metadata = {
      openPolicyInvoiceId: params.invoiceId,
      openPolicyProviderOrganizationId: params.providerOrganizationId
    };
    return this.stripe.checkout.sessions.create({
      mode: 'payment', customer: params.customerId,
      payment_method_types: ['card', 'us_bank_account'],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd', unit_amount: params.amountCents,
          product_data: { name: `Open Policy invoice ${params.invoiceNumber}` }
        }
      }],
      payment_intent_data: { metadata }, metadata,
      success_url: `${this.config.publicAppUrl}/?payment=complete&invoice=${encodeURIComponent(params.invoiceId)}`,
      cancel_url: `${this.config.publicAppUrl}/?payment=cancelled&invoice=${encodeURIComponent(params.invoiceId)}`
    }, { idempotencyKey: `openpolicy-checkout-${params.invoiceId}-${params.amountCents}` });
  }

  constructWebhookEvent(rawBody: Buffer, signature: string) {
    return this.stripe.webhooks.constructEvent(rawBody, signature, this.config.webhookSecret);
  }

  async refund(params: { paymentIntentId: string; amountCents: number; paymentRecordId: string; reason: string }) {
    return this.stripe.refunds.create({
      payment_intent: params.paymentIntentId, amount: params.amountCents,
      metadata: { openPolicyPaymentRecordId: params.paymentRecordId, openPolicyReason: params.reason }
    }, { idempotencyKey: `openpolicy-refund-${params.paymentRecordId}-${params.amountCents}-${params.reason}` });
  }
}

