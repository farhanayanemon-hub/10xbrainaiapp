import { getActivePaymentProvider } from './settings-store.js';
import { StripeService } from './stripe.js';
import { OpayService } from './opaybd.js';

export type PaymentProvider = 'stripe' | 'opaybd';

export interface CheckoutResult {
	provider: PaymentProvider;
	// Stripe-specific fields
	clientSecret?: string;
	sessionId?: string;
	// Opaybd-specific fields
	paymentUrl?: string;
}

export interface CreateCheckoutParams {
	userId: string;
	priceId: string;
	planId: string;
	successUrl: string;
	cancelUrl: string;
}

/**
 * Payment Router - Abstracts payment provider selection
 * Routes checkout requests to either Stripe or Opaybd based on admin settings
 */
export class PaymentRouter {
	/**
	 * Get the currently active payment provider from settings
	 */
	static async getActiveProvider(): Promise<PaymentProvider> {
		return await getActivePaymentProvider();
	}

	/**
	 * Create a checkout session with the active payment provider
	 * Returns provider-specific data for the frontend to handle
	 */
	static async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutResult> {
		const provider = await this.getActiveProvider();

		console.log(`Creating checkout session with provider: ${provider}`);

		if (provider === 'opaybd') {
			// Check if Opaybd is configured
			const isConfigured = await OpayService.isConfigured();
			if (!isConfigured) {
				throw new Error('Opaybd is selected but not configured. Please configure Opaybd credentials in Admin > Payment Methods.');
			}

			// For Opaybd, we need to use the callback endpoint as success URL
			// Extract origin from successUrl (which contains the Stripe template)
			const origin = params.successUrl.split('/settings/billing')[0];
			const opaySuccessUrl = `${origin}/api/opaybd/callback`;
			const opayCancelUrl = `${origin}/settings/billing?canceled=true&provider=opaybd`;

			// Create Opaybd payment
			const result = await OpayService.createPayment({
				userId: params.userId,
				planId: params.planId,
				priceId: params.priceId,
				successUrl: opaySuccessUrl,
				cancelUrl: opayCancelUrl,
			});

			return {
				provider: 'opaybd',
				paymentUrl: result.payment_url,
			};
		}

		// Default to Stripe
		const session = await StripeService.createCheckoutSession({
			userId: params.userId,
			priceId: params.priceId,
			successUrl: params.successUrl,
			cancelUrl: params.cancelUrl,
		});

		return {
			provider: 'stripe',
			clientSecret: session.client_secret || undefined,
			sessionId: session.id,
		};
	}

	/**
	 * Get active subscription for a user across all providers
	 */
	static async getActiveSubscription(userId: string) {
		// First check Stripe (more common)
		const stripeSubscription = await StripeService.getActiveSubscription(userId);
		if (stripeSubscription) {
			return {
				...stripeSubscription,
				provider: 'stripe' as PaymentProvider,
			};
		}

		// Then check Opaybd
		const opaySubscription = await OpayService.getActiveSubscription(userId);
		if (opaySubscription) {
			return {
				...opaySubscription,
				provider: 'opaybd' as PaymentProvider,
			};
		}

		return null;
	}

	/**
	 * Check if user needs to renew their Opaybd subscription
	 * Returns enriched renewal info with computed fields
	 */
	static async checkRenewalRequired(userId: string): Promise<{
		planTier: string;
		daysRemaining: number;
		expiresAt: Date;
	} | null> {
		const subscription = await OpayService.getSubscriptionNeedingRenewal(userId);

		if (!subscription) {
			return null;
		}

		// Compute days remaining
		const now = new Date();
		const expiresAt = subscription.currentPeriodEnd;
		const diffTime = expiresAt.getTime() - now.getTime();
		const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

		return {
			planTier: subscription.planTier || 'unknown',
			daysRemaining,
			expiresAt,
		};
	}
}
