import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isValidPriceId, getPlanByPriceId } from '$lib/server/pricing-plans-seeder.js';
import { PaymentRouter } from '$lib/server/payment-router.js';

export const POST: RequestHandler = async ({ request, locals, url }) => {
	try {
		const session = await locals.auth();

		if (!session?.user?.id) {
			return error(401, 'Unauthorized');
		}

		const { priceId } = await request.json();

		if (!priceId || typeof priceId !== 'string') {
			return error(400, 'Price ID is required');
		}

		// Validate that the price ID exists in our pricing plans database
		// This prevents users from passing arbitrary Stripe price IDs and supports both monthly and yearly plans
		const isValid = await isValidPriceId(priceId);
		if (!isValid) {
			return error(400, 'Invalid price ID');
		}

		// Get the plan details for the price ID (needed for Opaybd)
		const plan = await getPlanByPriceId(priceId);
		if (!plan) {
			return error(400, 'Plan not found for price ID');
		}

		const origin = url.origin;

		// Use PaymentRouter to create checkout session with the active provider
		const result = await PaymentRouter.createCheckoutSession({
			userId: session.user.id,
			priceId,
			planId: plan.id,
			// Stripe uses template for session ID, Opaybd uses callback endpoint
			successUrl: `${origin}/settings/billing?session_id={CHECKOUT_SESSION_ID}`,
			cancelUrl: `${origin}/settings/billing?canceled=true`,
		});

		// Return provider-specific response
		if (result.provider === 'opaybd') {
			return json({
				provider: 'opaybd',
				redirectUrl: result.paymentUrl,
			});
		}

		// Default Stripe response
		return json({
			provider: 'stripe',
			clientSecret: result.clientSecret,
			sessionId: result.sessionId,
		});

	} catch (err) {
		console.error('Error creating checkout session:', err);
		return error(500, 'Failed to create checkout session');
	}
};