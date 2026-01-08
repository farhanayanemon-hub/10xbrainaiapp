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
	const status = url.searchParams.get('status') as 'pending' | 'success' | 'failed' | null;

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
		redirect(302, '/settings/billing?error=missing_transaction&provider=opaybd');
	}

	try {
		if (status === 'success') {
			// Verify payment to get plan tier from metadata
			const verification = await OpayService.verifyPayment(transactionId);
			const planTier = verification.metadata?.planTier || '';

			// Process successful payment
			await OpayService.handlePaymentSuccess({
				transactionId,
				paymentMethod,
				paymentAmount,
				paymentFee,
				status: 'success',
			});

			console.log('Opaybd payment processed successfully:', transactionId);
			redirect(302, `/settings/billing?opay_success=true&plan_tier=${encodeURIComponent(planTier)}`);
		} else if (status === 'failed') {
			// Payment failed
			console.log('Opaybd payment failed:', transactionId);
			redirect(302, '/settings/billing?opay_failed=true');
		} else {
			// Payment is pending - verify status with Opaybd
			console.log('Opaybd payment pending, verifying with API:', transactionId);

			try {
				const verification = await OpayService.verifyPayment(transactionId);
				const planTier = verification.metadata?.planTier || '';

				if (verification.status === 'COMPLETED') {
					// Payment actually completed - process it
					await OpayService.handlePaymentSuccess({
						transactionId,
						paymentMethod: verification.payment_method || paymentMethod,
						paymentAmount: parseFloat(verification.amount) || paymentAmount,
						paymentFee,
						status: 'success',
					});

					console.log('Opaybd payment verified and processed:', transactionId);
					redirect(302, `/settings/billing?opay_success=true&plan_tier=${encodeURIComponent(planTier)}`);
				} else if (verification.status === 'ERROR') {
					console.log('Opaybd payment verification returned error:', transactionId);
					redirect(302, '/settings/billing?opay_failed=true');
				} else {
					// Still pending - redirect with pending status for user to check later
					console.log('Opaybd payment still pending:', transactionId);
					redirect(302, `/settings/billing?opay_pending=true&transaction_id=${encodeURIComponent(transactionId)}`);
				}
			} catch (verifyError) {
				console.error('Error verifying Opaybd payment:', verifyError);
				// If verification fails, show pending status and let user retry
				redirect(302, `/settings/billing?opay_pending=true&transaction_id=${encodeURIComponent(transactionId)}`);
			}
		}
	} catch (error) {
		console.error('Error processing Opaybd callback:', error);
		redirect(302, '/settings/billing?opay_failed=true');
	}

	// Fallback redirect (should not reach here due to redirects above)
	redirect(302, '/settings/billing');
};
