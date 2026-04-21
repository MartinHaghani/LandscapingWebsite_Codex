import Stripe from 'stripe';

export type QuotePaymentMode = 'seasonal_payment' | 'per_session_subscription';

export interface CreateStripeCheckoutSessionInput {
  paymentLinkId: string;
  quoteId: string;
  approvedVersionNumber: number;
  mode: QuotePaymentMode;
  customerEmail: string | null;
  amountCents: number;
  currency: string;
  productName: string;
  productDescription: string;
  successUrl: string;
  cancelUrl: string;
  deferredStartUnix?: number | null;
  maxBillableVisits?: number | null;
  seasonEndUnix?: number | null;
}

export interface StripeCheckoutSessionResult {
  id: string;
  url: string;
  expiresAt: number | null;
  customerId: string | null;
  paymentIntentId: string | null;
  subscriptionId: string | null;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: unknown;
  };
}

export interface StripePaymentProvider {
  createCheckoutSession(input: CreateStripeCheckoutSessionInput): Promise<StripeCheckoutSessionResult>;
  constructWebhookEvent(payload: Buffer, signature: string | undefined): StripeWebhookEvent;
  updateSubscriptionCancelAt(subscriptionId: string, cancelAtUnix: number): Promise<void>;
  cancelSubscription(subscriptionId: string): Promise<void>;
}

export class StripePaymentConfigurationError extends Error {}

const normalizeCurrency = (currency: string) => currency.trim().toLowerCase() || 'cad';

const getStripeObjectId = (value: unknown) => {
  if (typeof value === 'string') {
    return value;
  }

  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
    return value.id;
  }

  return null;
};

export const createStripePaymentProvider = (config?: {
  secretKey?: string | null;
  webhookSecret?: string | null;
}): StripePaymentProvider => {
  const secretKey = config?.secretKey?.trim() || process.env.STRIPE_SECRET_KEY?.trim() || '';
  const webhookSecret = config?.webhookSecret?.trim() || process.env.STRIPE_WEBHOOK_SECRET?.trim() || '';

  const getClient = () => {
    if (!secretKey) {
      throw new StripePaymentConfigurationError('STRIPE_SECRET_KEY is not configured.');
    }

    return new Stripe(secretKey);
  };

  return {
    async createCheckoutSession(input) {
      const stripe = getClient();
      const metadata: Record<string, string> = {
        quoteId: input.quoteId,
        paymentLinkId: input.paymentLinkId,
        approvedVersionNumber: String(input.approvedVersionNumber),
        paymentMode: input.mode,
        maxBillableVisits: String(input.maxBillableVisits ?? ''),
        deferredStartUnix: String(input.deferredStartUnix ?? ''),
        seasonEndUnix: String(input.seasonEndUnix ?? '')
      };

      const params: Stripe.Checkout.SessionCreateParams = {
        mode: input.mode === 'seasonal_payment' ? 'payment' : 'subscription',
        client_reference_id: input.quoteId,
        customer_email: input.customerEmail ?? undefined,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: normalizeCurrency(input.currency),
              unit_amount: input.amountCents,
              product_data: {
                name: input.productName,
                description: input.productDescription
              },
              recurring:
                input.mode === 'per_session_subscription'
                  ? {
                      interval: 'week',
                      interval_count: 1
                    }
                  : undefined
            }
          }
        ]
      };

      if (input.mode === 'seasonal_payment') {
        params.payment_intent_data = {
          metadata
        };
      } else {
        params.subscription_data = {
          metadata,
          billing_cycle_anchor: input.deferredStartUnix ?? undefined,
          proration_behavior: input.deferredStartUnix ? 'none' : undefined
        };
      }

      const session = await stripe.checkout.sessions.create(params);
      if (!session.url) {
        throw new StripePaymentConfigurationError('Stripe did not return a Checkout URL.');
      }

      return {
        id: session.id,
        url: session.url,
        expiresAt: session.expires_at ?? null,
        customerId: getStripeObjectId(session.customer),
        paymentIntentId: getStripeObjectId(session.payment_intent),
        subscriptionId: getStripeObjectId(session.subscription)
      };
    },

    constructWebhookEvent(payload, signature) {
      if (!webhookSecret) {
        throw new StripePaymentConfigurationError('STRIPE_WEBHOOK_SECRET is not configured.');
      }

      if (!signature) {
        throw new StripePaymentConfigurationError('Missing Stripe-Signature header.');
      }

      return getClient().webhooks.constructEvent(payload, signature, webhookSecret) as StripeWebhookEvent;
    },

    async updateSubscriptionCancelAt(subscriptionId, cancelAtUnix) {
      await getClient().subscriptions.update(subscriptionId, {
        cancel_at: cancelAtUnix
      });
    },

    async cancelSubscription(subscriptionId) {
      const subscriptions = getClient().subscriptions as unknown as {
        cancel?: (id: string) => Promise<unknown>;
        del?: (id: string) => Promise<unknown>;
      };

      if (typeof subscriptions.cancel === 'function') {
        await subscriptions.cancel(subscriptionId);
        return;
      }

      if (typeof subscriptions.del === 'function') {
        await subscriptions.del(subscriptionId);
      }
    }
  };
};
