import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { images } from '$lib/server/db/schema.js';
import { storageService } from '$lib/server/storage.js';
import { isDemoModeRestricted, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js';

// Upload/save image
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const session = await locals.auth();
		if (!session?.user?.id) {
			throw error(401, 'Unauthorized');
		}

		// Check demo mode restrictions
		if (isDemoModeRestricted(!!session?.user?.id)) {
			throw error(403, DEMO_MODE_MESSAGES.GENERAL_RESTRICTION);
		}

		const { imageData, mimeType, filename, chatId } = await request.json();

		if (!imageData || !mimeType) {
			throw error(400, 'Image data and MIME type are required');
		}

		// Validate MIME type
		const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
		if (!allowedTypes.includes(mimeType)) {
			throw error(400, 'Unsupported image type');
		}

		// Convert base64 to buffer
		const imageBuffer = Buffer.from(imageData, 'base64');
		
		// Check file size (max 10MB)
		if (imageBuffer.length > 10 * 1024 * 1024) {
			throw error(400, 'Image too large (max 10MB)');
		}

		// Generate unique filename
		const extension = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
		const generatedFilename = storageService.generateFilename(`file.${extension}`);
		
		// Upload to storage (R2 or local)
		const storageResult = await storageService.upload(
			{
				buffer: imageBuffer,
				mimeType,
				filename: generatedFilename
			},
			session.user.id,
			'images',
			'generated'
		);

		// Create database record with user association
		// Wrap in try-catch to cleanup orphaned files if DB insert fails
		let imageRecord;
		try {
			[imageRecord] = await db
				.insert(images)
				.values({
					filename: generatedFilename,
					userId: session.user.id,
					chatId: chatId || null,
					mimeType,
					fileSize: imageBuffer.length,
					storageLocation: storageResult.storageLocation,
					cloudPath: storageResult.path
				})
				.returning();
		} catch (dbError) {
			// Clean up the orphaned file from storage
			console.error('DB insert failed, cleaning up orphaned file:', storageResult.path);
			try {
				await storageService.delete(storageResult.path);
				console.log('Successfully cleaned up orphaned file:', storageResult.path);
			} catch (cleanupError) {
				console.error('Failed to cleanup orphaned file:', cleanupError);
			}
			throw dbError;
		}

		// Get the public URL for the uploaded image
		const imageUrl = await storageService.getUrl(storageResult.path);

		return json({
			imageId: imageRecord.id,
			imageUrl: imageUrl,
			mimeType: imageRecord.mimeType,
			size: imageRecord.fileSize
		});
	} catch (err) {
		console.error('Image upload error:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Failed to upload image');
	}
};