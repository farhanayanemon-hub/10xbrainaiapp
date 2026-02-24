import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { transcriptions } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { storageService } from '$lib/server/storage.js';
import { isDemoModeRestricted, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js';

// GET - Retrieve transcription data
export const GET: RequestHandler = async ({ params, locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) {
		throw error(401, 'Authentication required');
	}

	const transcriptionId = params.id;

	// Validate UUID format
	if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(transcriptionId)) {
		throw error(400, 'Invalid transcription ID format');
	}

	// Query database
	const [record] = await db
		.select()
		.from(transcriptions)
		.where(eq(transcriptions.id, transcriptionId));

	if (!record) {
		throw error(404, 'Transcription not found');
	}

	// Authorization check - user can only access their own transcriptions
	if (record.userId !== session.user.id) {
		throw error(403, 'Access denied');
	}

	// Generate audio URL
	let audioUrl: string;

	if (record.storageLocation === 'r2' && record.cloudPath) {
		audioUrl = await storageService.getUrl(record.cloudPath);
	} else if (record.cloudPath) {
		// For local storage, stream via dedicated audio endpoint
		audioUrl = `/api/transcriptions/${transcriptionId}/audio`;
	} else {
		throw error(500, 'Audio file not found');
	}

	return json({
		id: record.id,
		text: record.text,
		words: record.words,
		model: record.model,
		mimeType: record.mimeType,
		fileSize: record.fileSize,
		duration: record.duration,
		createdAt: record.createdAt,
		audioUrl
	});
};

// DELETE - Remove transcription
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) {
		throw error(401, 'Authentication required');
	}

	// Check demo mode restrictions
	if (isDemoModeRestricted(!!session?.user?.id)) {
		throw error(403, DEMO_MODE_MESSAGES.GENERAL_RESTRICTION);
	}

	const transcriptionId = params.id;

	// Validate UUID format
	if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(transcriptionId)) {
		throw error(400, 'Invalid transcription ID format');
	}

	// Query and verify ownership
	const [record] = await db
		.select()
		.from(transcriptions)
		.where(eq(transcriptions.id, transcriptionId));

	if (!record) {
		throw error(404, 'Transcription not found');
	}

	// Authorization check
	if (record.userId !== session.user.id) {
		throw error(403, 'Access denied');
	}

	// Delete from storage first
	if (record.cloudPath) {
		try {
			await storageService.delete(record.cloudPath);
		} catch (storageError) {
			console.error('Storage deletion error:', storageError);
			// Continue with database deletion even if storage fails
		}
	}

	// Delete from database
	await db.delete(transcriptions).where(eq(transcriptions.id, transcriptionId));

	return json({ success: true });
};
