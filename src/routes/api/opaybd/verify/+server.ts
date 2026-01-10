import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { OpayService } from '$lib/server/opaybd.js';

/**
 * Opaybd Payment Verification Endpoint
 *
 * This endpoint allows users to manually verify the status of a pending payment.
 * Useful when the callback status was 'pending' and the user wants to check later.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	// Require authentication
	const session = await locals.auth();
	if (!session?.user?.id) {
		error(401, 'Unauthorized');
	}

	try {
		const body = await request.json();
		const { transactionId } = body;

		if (!transactionId) {
			error(400, 'Transaction ID is required');
		}

		console.log('Verifying Opaybd payment:', transactionId);

		// Verify payment with Opaybd
		const verification = await OpayService.verifyPayment(transactionId);

		// If payment is completed and hasn't been processed yet, process it now
		if (verification.status === 'COMPLETED') {
			// Check if payment was for this user (via metadata)
			if (verification.metadata?.userId !== session.user.id) {
				console.warn('Payment verification userId mismatch:', {
					paymentUserId: verification.metadata?.userId,
					sessionUserId: session.user.id
				});
				error(403, 'This payment does not belong to your account');
			}

			// Process the payment
			await OpayService.handlePaymentSuccess({
				transactionId,
				paymentMethod: verification.payment_method || 'unknown',
				paymentAmount: parseFloat(verification.amount) || 0,
				paymentFee: 0, // Fee info not available in verification response
				status: 'success',
			});

			return json({
				status: 'success',
				message: 'Payment verified and processed successfully',
				planTier: verification.metadata?.planTier
			});
		} else if (verification.status === 'PENDING') {
			return json({
				status: 'pending',
				message: 'Payment is still pending. Please try again later.'
			});
		} else {
			return json({
				status: 'failed',
				message: 'Payment verification failed or was rejected.'
			});
		}
	} catch (err) {
		console.error('Error verifying Opaybd payment:', err);
		error(500, 'Failed to verify payment. Please try again later.');
	}
};
