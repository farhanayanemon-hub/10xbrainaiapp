import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { voiceChanges } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { storageService } from '$lib/server/storage.js';
import { isDemoModeRestricted, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js';

// Get voice change by ID (secure with authentication and authorization)
// Returns metadata and URLs for both original and transformed audio
export const GET: RequestHandler = async ({ params, locals, url }) => {
	try {
		// Check authentication
		const session = await locals.auth();
		if (!session?.user?.id) {
			throw error(401, 'Authentication required');
		}

		const voiceChangeId = params.id;

		if (!voiceChangeId) {
			throw error(400, 'Voice change ID is required');
		}

		// Validate ID format (UUID format for database IDs)
		if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(voiceChangeId)) {
			throw error(400, 'Invalid voice change ID format');
		}

		// Query database to get voice change metadata and verify ownership
		const [voiceChangeRecord] = await db
			.select()
			.from(voiceChanges)
			.where(eq(voiceChanges.id, voiceChangeId));

		if (!voiceChangeRecord) {
			throw error(404, 'Voice change not found');
		}

		// Check authorization - user can only access their own voice changes
		if (voiceChangeRecord.userId !== session.user.id) {
			throw error(403, 'Access denied - you can only access your own voice changes');
		}

		// Check if requesting audio stream directly
		const audioType = url.searchParams.get('audio');

		if (audioType === 'original' || audioType === 'transformed') {
			// Return audio stream
			const cloudPath = audioType === 'original'
				? voiceChangeRecord.originalCloudPath
				: voiceChangeRecord.cloudPath;
			const mimeType = audioType === 'original'
				? voiceChangeRecord.originalMimeType
				: voiceChangeRecord.mimeType;
			const storageLocation = audioType === 'original'
				? voiceChangeRecord.originalStorageLocation
				: voiceChangeRecord.storageLocation;

			if (!cloudPath) {
				throw error(404, `${audioType} audio file path not found`);
			}

			// Handle cloud storage files with presigned URLs
			if (storageLocation === 'r2') {
				const presignedUrl = await storageService.getUrl(cloudPath);

				return new Response(null, {
					status: 302,
					headers: {
						'Location': presignedUrl,
						'Cache-Control': 'private, max-age=300'
					}
				});
			}

			// Handle local files
			try {
				const audioData = await storageService.download(cloudPath);

				return new Response(new Uint8Array(audioData), {
					headers: {
						'Content-Type': mimeType,
						'Cache-Control': 'private, max-age=3600',
						'Content-Length': audioData.length.toString()
					}
				});
			} catch (storageError) {
				console.error('Storage retrieval error:', storageError);
				throw error(404, `${audioType} audio file not found in storage`);
			}
		}

		// Return metadata with URLs
		return json({
			id: voiceChangeRecord.id,
			// Transformed audio info
			mimeType: voiceChangeRecord.mimeType,
			fileSize: voiceChangeRecord.fileSize,
			transformedUrl: `/api/voice-changes/${voiceChangeRecord.id}?audio=transformed`,
			// Original audio info
			originalFilename: voiceChangeRecord.originalFilename,
			originalMimeType: voiceChangeRecord.originalMimeType,
			originalFileSize: voiceChangeRecord.originalFileSize,
			originalUrl: `/api/voice-changes/${voiceChangeRecord.id}?audio=original`,
			// Metadata
			targetVoiceId: voiceChangeRecord.targetVoiceId,
			model: voiceChangeRecord.model,
			duration: voiceChangeRecord.duration,
			createdAt: voiceChangeRecord.createdAt
		});
	} catch (err) {
		console.error('Voice change retrieval error:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Failed to retrieve voice change');
	}
};

// Delete voice change by ID (secure with authentication and authorization)
export const DELETE: RequestHandler = async ({ params, locals }) => {
	try {
		// Check authentication
		const session = await locals.auth();
		if (!session?.user?.id) {
			throw error(401, 'Authentication required');
		}

		// Check demo mode restrictions
		if (isDemoModeRestricted(!!session?.user?.id)) {
			throw error(403, DEMO_MODE_MESSAGES.GENERAL_RESTRICTION);
		}

		const voiceChangeId = params.id;

		if (!voiceChangeId) {
			throw error(400, 'Voice change ID is required');
		}

		// Validate ID format (UUID format for database IDs)
		if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(voiceChangeId)) {
			throw error(400, 'Invalid voice change ID format');
		}

		// Query database to get voice change metadata and verify ownership
		const [voiceChangeRecord] = await db
			.select()
			.from(voiceChanges)
			.where(eq(voiceChanges.id, voiceChangeId));

		if (!voiceChangeRecord) {
			throw error(404, 'Voice change not found');
		}

		// Check authorization - user can only delete their own voice changes
		if (voiceChangeRecord.userId !== session.user.id) {
			throw error(403, 'Access denied - you can only delete your own voice changes');
		}

		// Delete transformed audio from storage
		if (voiceChangeRecord.cloudPath) {
			try {
				await storageService.delete(voiceChangeRecord.cloudPath);
			} catch (storageError) {
				console.error('Storage deletion error (transformed):', storageError);
				// Continue with other deletions even if this fails
			}
		}

		// Delete original audio from storage
		if (voiceChangeRecord.originalCloudPath) {
			try {
				await storageService.delete(voiceChangeRecord.originalCloudPath);
			} catch (storageError) {
				console.error('Storage deletion error (original):', storageError);
				// Continue with database deletion even if storage deletion fails
			}
		}

		// Delete from database
		await db.delete(voiceChanges).where(eq(voiceChanges.id, voiceChangeId));

		return json({ success: true, message: 'Voice change deleted successfully' });
	} catch (err) {
		console.error('Voice change deletion error:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Failed to delete voice change');
	}
};
