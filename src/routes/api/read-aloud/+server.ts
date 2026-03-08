import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { audio } from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getModelProvider } from '$lib/ai/index.js';
import type { AudioGenerationParams } from '$lib/ai/types.js';
import { UsageTrackingService, UsageLimitError } from '$lib/server/usage-tracking.js';
import { saveAudioAndGetId } from '$lib/ai/utils.js';
import { isDemoModeRestricted, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js';
import { storageService } from '$lib/server/storage.js';
import { enforceFileUploadRateLimit } from '$lib/server/file-upload-rate-limiting.js';
import { READ_ALOUD_DEFAULTS } from '$lib/constants/elevenlabs.js';

// UUID v4 format validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Check authentication
		const session = await locals.auth();
		if (!session?.user?.id) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		// Check demo mode restrictions
		if (isDemoModeRestricted(!!session?.user?.id)) {
			return json({
				error: DEMO_MODE_MESSAGES.GENERAL_RESTRICTION,
				type: 'demo_mode_restricted'
			}, { status: 403 });
		}

		// Rate limiting to prevent API abuse
		enforceFileUploadRateLimit('audioGeneration', session.user.id);

		const body = await request.json();
		const { chatId, messageIndex, text } = body;

		// Validate required fields
		if (!chatId || typeof chatId !== 'string') {
			return json({ error: 'chatId is required' }, { status: 400 });
		}

		// Validate chatId is a valid UUID format
		if (!UUID_REGEX.test(chatId)) {
			return json({ error: 'Invalid chatId format' }, { status: 400 });
		}

		if (messageIndex === undefined || typeof messageIndex !== 'number' || messageIndex < 0) {
			return json({ error: 'messageIndex is required and must be a non-negative number' }, { status: 400 });
		}

		if (!text || typeof text !== 'string' || text.trim().length === 0) {
			return json({ error: 'text is required and must be a non-empty string' }, { status: 400 });
		}

		const trimmedText = text.trim().slice(0, READ_ALOUD_DEFAULTS.maxTextLength);

		// Check for cached audio with matching chatId + messageIndex + voiceId + model
		const [existing] = await db
			.select()
			.from(audio)
			.where(
				and(
					eq(audio.chatId, chatId),
					eq(audio.messageIndex, messageIndex),
					eq(audio.voiceId, READ_ALOUD_DEFAULTS.voiceId),
					eq(audio.model, READ_ALOUD_DEFAULTS.model),
					eq(audio.userId, session.user.id)
				)
			)
			.limit(1);

		if (existing) {
			// Check if text matches (message wasn't edited)
			if (existing.text === trimmedText) {
				// Return cached audio - no usage tracking for cache hits
				return json({
					audioId: existing.id,
					audioUrl: `/api/audio/${existing.id}`,
					cached: true
				});
			} else {
				// Message was edited - delete old audio from storage and database
				if (existing.cloudPath) {
					try {
						await storageService.delete(existing.cloudPath);
					} catch (deleteError) {
						console.error('Failed to delete old audio file:', deleteError);
						// Continue anyway - orphaned file is acceptable
					}
				}
				await db.delete(audio).where(eq(audio.id, existing.id));
				// Continue to generate new audio below
			}
		}

		// Check usage limits for new audio generation
		try {
			await UsageTrackingService.checkUsageLimit(session.user.id, 'audio');
		} catch (error) {
			if (error instanceof UsageLimitError) {
				return json({
					error: error.message,
					type: 'usage_limit_exceeded',
					remainingQuota: error.remainingQuota
				}, { status: 429 });
			}
			throw error;
		}

		// Find the provider for this model
		const provider = getModelProvider(READ_ALOUD_DEFAULTS.model);
		if (!provider) {
			return json({ error: `No provider found for model: ${READ_ALOUD_DEFAULTS.model}` }, { status: 500 });
		}

		// Check if the provider supports audio generation
		if (!provider.generateAudio) {
			return json({ error: `Model ${READ_ALOUD_DEFAULTS.model} does not support audio generation` }, { status: 500 });
		}

		// Build params
		const params: AudioGenerationParams = {
			model: READ_ALOUD_DEFAULTS.model,
			text: trimmedText,
			voiceId: READ_ALOUD_DEFAULTS.voiceId,
			voiceSettings: { ...READ_ALOUD_DEFAULTS.voiceSettings },
			outputFormat: 'mp3_44100_128',
			userId: session.user.id,
			chatId
		};

		// Generate audio
		const response = await provider.generateAudio(params);

		// Save audio to storage and database with messageIndex for caching
		const audioId = await saveAudioAndGetId(
			response.audioData,
			response.mimeType,
			session.user.id,
			trimmedText,
			READ_ALOUD_DEFAULTS.model,
			READ_ALOUD_DEFAULTS.voiceId,
			chatId,
			undefined, // duration
			messageIndex // message index for caching
		);

		// Track usage for successful audio generation
		UsageTrackingService.trackUsage(session.user.id, 'audio').catch(console.error);

		// Return the audio response
		return json({
			audioId,
			audioUrl: `/api/audio/${audioId}`,
			cached: false
		});

	} catch (error) {
		console.error('Read aloud API error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 }
		);
	}
};
