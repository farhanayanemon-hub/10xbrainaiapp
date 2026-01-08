import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { audio } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { storageService } from '$lib/server/storage.js';
import { isDemoModeRestricted, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js';

// Get audio by ID (secure with authentication and authorization)
export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		// Check authentication
		const session = await locals.auth();
		if (!session?.user?.id) {
			throw error(401, 'Authentication required');
		}

		const audioId = params.id;

		if (!audioId) {
			throw error(400, 'Audio ID is required');
		}

		// Validate audio ID format (UUID format for database IDs)
		if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(audioId)) {
			throw error(400, 'Invalid audio ID format');
		}

		// Query database to get audio metadata and verify ownership
		const [audioRecord] = await db
			.select()
			.from(audio)
			.where(eq(audio.id, audioId));

		if (!audioRecord) {
			throw error(404, 'Audio not found');
		}

		// Check authorization - user can only access their own audio
		if (audioRecord.userId !== session.user.id) {
			throw error(403, 'Access denied - you can only access your own audio');
		}

		// Handle cloud storage files with presigned URLs
		if (audioRecord.storageLocation === 'r2' && audioRecord.cloudPath) {
			const presignedUrl = await storageService.getUrl(audioRecord.cloudPath);

			// Redirect to presigned URL for direct R2 access
			return new Response(null, {
				status: 302,
				headers: {
					'Location': presignedUrl,
					'Cache-Control': 'private, max-age=300' // 5 minutes cache for redirect
				}
			});
		}

		// Handle local files - use cloudPath stored in database
		if (!audioRecord.cloudPath) {
			throw error(404, 'Audio file path not found');
		}

		const storagePath = audioRecord.cloudPath;

		try {
			const audioData = await storageService.download(storagePath);

			return new Response(new Uint8Array(audioData), {
				headers: {
					'Content-Type': audioRecord.mimeType,
					'Cache-Control': 'private, max-age=3600', // Private cache for 1 hour
					'Content-Length': audioData.length.toString()
				}
			});
		} catch (storageError) {
			console.error('Storage retrieval error:', storageError);
			throw error(404, 'Audio file not found in storage');
		}
	} catch (err) {
		console.error('Audio retrieval error:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Failed to retrieve audio');
	}
};

// Delete audio by ID (secure with authentication and authorization)
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

		const audioId = params.id;

		if (!audioId) {
			throw error(400, 'Audio ID is required');
		}

		// Validate audio ID format (UUID format for database IDs)
		if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(audioId)) {
			throw error(400, 'Invalid audio ID format');
		}

		// Query database to get audio metadata and verify ownership
		const [audioRecord] = await db
			.select()
			.from(audio)
			.where(eq(audio.id, audioId));

		if (!audioRecord) {
			throw error(404, 'Audio not found');
		}

		// Check authorization - user can only delete their own audio
		if (audioRecord.userId !== session.user.id) {
			throw error(403, 'Access denied - you can only delete your own audio');
		}

		// Delete from storage if cloudPath exists
		if (audioRecord.cloudPath) {
			try {
				await storageService.delete(audioRecord.cloudPath);
			} catch (storageError) {
				console.error('Storage deletion error:', storageError);
				// Continue with database deletion even if storage deletion fails
			}
		}

		// Delete from database
		await db.delete(audio).where(eq(audio.id, audioId));

		return new Response(JSON.stringify({ success: true, message: 'Audio deleted successfully' }), {
			status: 200,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	} catch (err) {
		console.error('Audio deletion error:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Failed to delete audio');
	}
};
