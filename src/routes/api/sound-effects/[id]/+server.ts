import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { soundEffects } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { storageService } from '$lib/server/storage.js';
import { isDemoModeRestricted, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js';

// Get sound effect by ID (secure with authentication and authorization)
export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		// Check authentication
		const session = await locals.auth();
		if (!session?.user?.id) {
			throw error(401, 'Authentication required');
		}

		const soundEffectId = params.id;

		if (!soundEffectId) {
			throw error(400, 'Sound effect ID is required');
		}

		// Validate sound effect ID format (UUID format for database IDs)
		if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(soundEffectId)) {
			throw error(400, 'Invalid sound effect ID format');
		}

		// Query database to get sound effect metadata and verify ownership
		const [soundEffectRecord] = await db
			.select()
			.from(soundEffects)
			.where(eq(soundEffects.id, soundEffectId));

		if (!soundEffectRecord) {
			throw error(404, 'Sound effect not found');
		}

		// Check authorization - user can only access their own sound effects
		if (soundEffectRecord.userId !== session.user.id) {
			throw error(403, 'Access denied - you can only access your own sound effects');
		}

		// Handle cloud storage files with presigned URLs
		if (soundEffectRecord.storageLocation === 'r2' && soundEffectRecord.cloudPath) {
			const presignedUrl = await storageService.getUrl(soundEffectRecord.cloudPath);

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
		if (!soundEffectRecord.cloudPath) {
			throw error(404, 'Sound effect file path not found');
		}

		const storagePath = soundEffectRecord.cloudPath;

		try {
			const soundEffectData = await storageService.download(storagePath);

			return new Response(new Uint8Array(soundEffectData), {
				headers: {
					'Content-Type': soundEffectRecord.mimeType,
					'Cache-Control': 'private, max-age=3600', // Private cache for 1 hour
					'Content-Length': soundEffectData.length.toString()
				}
			});
		} catch (storageError) {
			console.error('Storage retrieval error:', storageError);
			throw error(404, 'Sound effect file not found in storage');
		}
	} catch (err) {
		console.error('Sound effect retrieval error:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Failed to retrieve sound effect');
	}
};

// Delete sound effect by ID (secure with authentication and authorization)
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

		const soundEffectId = params.id;

		if (!soundEffectId) {
			throw error(400, 'Sound effect ID is required');
		}

		// Validate sound effect ID format (UUID format for database IDs)
		if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(soundEffectId)) {
			throw error(400, 'Invalid sound effect ID format');
		}

		// Query database to get sound effect metadata and verify ownership
		const [soundEffectRecord] = await db
			.select()
			.from(soundEffects)
			.where(eq(soundEffects.id, soundEffectId));

		if (!soundEffectRecord) {
			throw error(404, 'Sound effect not found');
		}

		// Check authorization - user can only delete their own sound effects
		if (soundEffectRecord.userId !== session.user.id) {
			throw error(403, 'Access denied - you can only delete your own sound effects');
		}

		// Delete from storage if cloudPath exists
		if (soundEffectRecord.cloudPath) {
			try {
				await storageService.delete(soundEffectRecord.cloudPath);
			} catch (storageError) {
				console.error('Storage deletion error:', storageError);
				// Continue with database deletion even if storage deletion fails
			}
		}

		// Delete from database
		await db.delete(soundEffects).where(eq(soundEffects.id, soundEffectId));

		return new Response(JSON.stringify({ success: true, message: 'Sound effect deleted successfully' }), {
			status: 200,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	} catch (err) {
		console.error('Sound effect deletion error:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Failed to delete sound effect');
	}
};
