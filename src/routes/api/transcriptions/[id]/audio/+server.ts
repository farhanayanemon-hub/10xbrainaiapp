import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { transcriptions } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { storageService } from '$lib/server/storage.js';

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

	// Authorization check
	if (record.userId !== session.user.id) {
		throw error(403, 'Access denied');
	}

	// For R2 storage, redirect to presigned URL
	if (record.storageLocation === 'r2' && record.cloudPath) {
		const presignedUrl = await storageService.getUrl(record.cloudPath);
		return new Response(null, {
			status: 302,
			headers: {
				'Location': presignedUrl,
				'Cache-Control': 'private, max-age=300' // 5 minutes
			}
		});
	}

	// For local storage, download and stream the file
	if (!record.cloudPath) {
		throw error(500, 'Audio file path not found');
	}

	const audioData = await storageService.download(record.cloudPath);

	return new Response(new Uint8Array(audioData), {
		headers: {
			'Content-Type': record.mimeType,
			'Cache-Control': 'private, max-age=3600', // 1 hour
			'Content-Length': audioData.length.toString()
		}
	});
};
