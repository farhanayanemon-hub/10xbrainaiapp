import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { OpayService } from '$lib/server/opaybd.js';

type CallbackStatus = 'pending' | 'success' | 'failed' | 'unknown';

function normalizeStatus(rawStatus: unknown): CallbackStatus {
	if (rawStatus === 'pending' || rawStatus === 'success' || rawStatus === 'failed') {
		return rawStatus;
	}

	if (typeof rawStatus === 'string') {
		const normalized = rawStatus.toLowerCase();
		if (normalized === 'completed') {
			return 'success';
		}
		if (normalized === 'error') {
			return 'failed';
		}
	}

	return 'unknown';
}

function parseNumber(value: unknown): number {
	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : 0;
	}

	if (typeof value === 'string') {
		const parsed = parseFloat(value);
		return Number.isFinite(parsed) ? parsed : 0;
	}

	return 0;
}

async function processWebhookPayment({
	transactionId,
	fallbackStatus,
	paymentMethod,
	paymentAmount,
	paymentFee,
}: {
	transactionId: string;
	fallbackStatus: CallbackStatus;
	paymentMethod: string;
	paymentAmount: number;
	paymentFee: number;
}) {
	try {
		const verification = await OpayService.verifyPayment(transactionId);

		if (verification.status === 'COMPLETED') {
			const processed = await OpayService.handlePaymentSuccess({
				transactionId,
				paymentMethod: verification.payment_method || paymentMethod,
				paymentAmount: parseFloat(verification.amount ?? String(paymentAmount)) || paymentAmount,
				paymentFee,
				status: 'success',
			}, verification);

			return json({
				success: true,
				status: 'processed',
				transactionId,
				planTier: processed.planTier,
				alreadyProcessed: processed.alreadyProcessed,
			});
		}

		if (verification.status === 'PENDING') {
			return json({
				success: true,
				status: 'pending',
				transactionId,
			});
		}

		return json({
			success: true,
			status: fallbackStatus === 'failed' ? 'failed' : 'pending',
			transactionId,
			verificationStatus: verification.status,
			message: verification.message || null,
		});
	} catch (error) {
		console.error('Error handling Opaybd webhook:', error);

		return json({
			success: true,
			status: fallbackStatus === 'failed' ? 'failed' : 'pending',
			transactionId,
		});
	}
}

export const POST: RequestHandler = async ({ request }) => {
	let payload: Record<string, unknown> = {};

	try {
		const rawBody = await request.text();

		if (rawBody) {
			try {
				payload = JSON.parse(rawBody) as Record<string, unknown>;
			} catch {
				const searchParams = new URLSearchParams(rawBody);
				payload = Object.fromEntries(searchParams.entries());
			}
		}
	} catch {
		payload = {};
	}

	const transactionId =
		(String(payload.transactionId || payload.transaction_id || payload.txnId || payload.txn_id || '')).trim();

	if (!transactionId) {
		return json({ success: false, message: 'Missing transactionId' }, { status: 400 });
	}

	return processWebhookPayment({
		transactionId,
		fallbackStatus: normalizeStatus(payload.status),
		paymentMethod: String(payload.paymentMethod || payload.payment_method || 'unknown'),
		paymentAmount: parseNumber(payload.paymentAmount ?? payload.amount),
		paymentFee: parseNumber(payload.paymentFee ?? payload.payment_fee ?? payload.fee),
	});
};

export const GET: RequestHandler = async ({ url }) => {
	const transactionId = (url.searchParams.get('transactionId') || url.searchParams.get('transaction_id') || '').trim();

	if (!transactionId) {
		return json({ success: false, message: 'Missing transactionId' }, { status: 400 });
	}

	return processWebhookPayment({
		transactionId,
		fallbackStatus: normalizeStatus(url.searchParams.get('status')),
		paymentMethod: url.searchParams.get('paymentMethod') || url.searchParams.get('payment_method') || 'unknown',
		paymentAmount: parseNumber(url.searchParams.get('paymentAmount') || url.searchParams.get('amount')),
		paymentFee: parseNumber(url.searchParams.get('paymentFee') || url.searchParams.get('payment_fee') || url.searchParams.get('fee')),
	});
};
