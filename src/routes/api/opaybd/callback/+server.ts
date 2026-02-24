import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { OpayService } from '$lib/server/opaybd.js';

/**
 * Opaybd Payment Callback Handler
 *
 * This endpoint handles the redirect from Opaybd after a payment attempt.
 * Query parameters provided by Opaybd:
 * - transactionId: Unique transaction identifier
 * - paymentMethod: Payment method used (e.g., 'bKash', 'Nagad', 'Card')
 * - paymentAmount: Amount paid
 * - paymentFee: Gateway fee charged
 * - status: Payment status ('pending', 'success', 'failed')
 */
export const GET: RequestHandler = async ({ url }) => {
	const transactionId = url.searchParams.get('transactionId');
	const paymentMethod = url.searchParams.get('paymentMethod') || 'unknown';
	const paymentAmount = parseFloat(url.searchParams.get('paymentAmount') || '0');
	const paymentFee = parseFloat(url.searchParams.get('paymentFee') || '0');
	const rawStatus = url.searchParams.get('status');
	const status = rawStatus === 'pending' || rawStatus === 'success' || rawStatus === 'failed'
		? rawStatus
		: null;

	const pendingRedirect = transactionId
		? `/settings/billing?opay_pending=true&transaction_id=${encodeURIComponent(transactionId)}`
		: '/settings/billing?opay_pending=true';
	const failedRedirect = transactionId
		? `/settings/billing?opay_failed=true&transaction_id=${encodeURIComponent(transactionId)}`
		: '/settings/billing?opay_failed=true';

	console.log('Opaybd callback received:', {
		transactionId,
		paymentMethod,
		paymentAmount,
		paymentFee,
		status
	});

	// Validate required parameters
	if (!transactionId) {
		console.error('Opaybd callback missing transactionId');
		throw redirect(302, '/settings/billing?error=missing_transaction&provider=opaybd');
	}

	let redirectUrl = pendingRedirect;

	try {
		const verification = await OpayService.verifyPayment(transactionId);
		const planTier = verification.metadata?.planTier || '';

		if (verification.status === 'COMPLETED') {
			// Process successful payment with already-verified payload
			const processed = await OpayService.handlePaymentSuccess({
				transactionId,
				paymentMethod: verification.payment_method || paymentMethod,
				paymentAmount: parseFloat(verification.amount || String(paymentAmount)) || paymentAmount,
				paymentFee,
				status: 'success',
			}, verification);

			console.log('Opaybd payment processed successfully:', {
				transactionId,
				alreadyProcessed: processed.alreadyProcessed,
			});
			redirectUrl = `/settings/billing?opay_success=true&plan_tier=${encodeURIComponent(processed.planTier || planTier)}`;
		} else if (verification.status === 'PENDING') {
			console.log('Opaybd payment still pending after callback verification:', transactionId);
			redirectUrl = pendingRedirect;
		} else {
			// Verification is ERROR. If callback explicitly says failed, show failed.
			// Otherwise treat as pending to avoid false negatives from transient states.
			console.warn('Opaybd verification returned non-completed status:', {
				transactionId,
				callbackStatus: status,
				verificationStatus: verification.status,
			});
			redirectUrl = status === 'failed' ? failedRedirect : pendingRedirect;
		}
	} catch (error) {
		console.error('Error processing Opaybd callback:', error);
		// If verification/processing fails unexpectedly, do not mark payment as failed
		// unless callback explicitly says failed.
		redirectUrl = status === 'failed' ? failedRedirect : pendingRedirect;
	}

	throw redirect(302, redirectUrl);
};
