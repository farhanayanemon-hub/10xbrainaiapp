import { json, error, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PaymentRouter } from '$lib/server/payment-router.js';
import { isValidPriceId, getPlanByPriceId } from '$lib/server/pricing-plans-seeder.js';

export const POST: RequestHandler = async ({ request, locals, url }) => {
        try {
                const session = await locals.auth();
                
                if (!session?.user?.id) {
                        throw error(401, 'Unauthorized');
                }

                const { priceId } = await request.json();

                if (!priceId || typeof priceId !== 'string') {
                        throw error(400, 'Price ID is required');
                }

                const isValid = await isValidPriceId(priceId);
                if (!isValid) {
                        throw error(400, 'Invalid price ID');
                }

                const plan = await getPlanByPriceId(priceId);
                if (!plan) {
                        throw error(400, 'Plan not found for price ID');
                }

                const origin = url.origin;
                const successUrl = `${origin}/settings/billing?session_id={CHECKOUT_SESSION_ID}`;
                const cancelUrl = `${origin}/settings/billing?canceled=true`;

                const result = await PaymentRouter.createCheckoutSession({
                        userId: session.user.id,
                        priceId,
                        planId: plan.id,
                        successUrl,
                        cancelUrl,
                });

                if (result.provider === 'opaybd') {
                        return json({
                                provider: 'opaybd',
                                paymentUrl: result.paymentUrl,
                        });
                }

                return json({
                        provider: 'stripe',
                        clientSecret: result.clientSecret,
                        sessionId: result.sessionId,
                });

        } catch (err) {
                if (isHttpError(err)) {
                        throw err;
                }
                console.error('Error creating checkout session:', err);
                throw error(500, 'Failed to create checkout session');
        }
};
