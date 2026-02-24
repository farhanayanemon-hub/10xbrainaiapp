import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getModelProvider } from '$lib/ai/index.js';
import type { AudioGenerationParams } from '$lib/ai/types.js';
import { UsageTrackingService, UsageLimitError } from '$lib/server/usage-tracking.js';
import { saveAudioAndGetId } from '$lib/ai/utils.js';
import { isDemoModeRestricted, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js';

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

		const body = await request.json();
		const {
			model,
			text,
			voiceId,
			voiceSettings,
			outputFormat = 'mp3_44100_128'
		} = body;

		// Validate required fields
		if (!model) {
			return json({ error: 'Model is required' }, { status: 400 });
		}

		if (!text || typeof text !== 'string' || text.trim().length === 0) {
			return json({ error: 'Text is required and must be a non-empty string' }, { status: 400 });
		}

		if (!voiceId || typeof voiceId !== 'string') {
			return json({ error: 'Voice ID is required' }, { status: 400 });
		}

		// Validate text length (ElevenLabs has a character limit)
		if (text.length > 5000) {
			return json({ error: 'Text exceeds maximum length of 5000 characters' }, { status: 400 });
		}

		// Validate voice settings if provided
		if (voiceSettings) {
			if (voiceSettings.stability !== undefined && (voiceSettings.stability < 0 || voiceSettings.stability > 1)) {
				return json({ error: 'Stability must be between 0 and 1' }, { status: 400 });
			}
			if (voiceSettings.similarityBoost !== undefined && (voiceSettings.similarityBoost < 0 || voiceSettings.similarityBoost > 1)) {
				return json({ error: 'Similarity boost must be between 0 and 1' }, { status: 400 });
			}
			if (voiceSettings.style !== undefined && (voiceSettings.style < 0 || voiceSettings.style > 1)) {
				return json({ error: 'Style must be between 0 and 1' }, { status: 400 });
			}
			if (voiceSettings.speed !== undefined && (voiceSettings.speed < 0.7 || voiceSettings.speed > 1.2)) {
				return json({ error: 'Speed must be between 0.7 and 1.2' }, { status: 400 });
			}
		}

		// Check usage limits for audio generation
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
		const provider = getModelProvider(model);
		if (!provider) {
			return json({ error: `No provider found for model: ${model}` }, { status: 400 });
		}

		// Check if the provider supports audio generation
		if (!provider.generateAudio) {
			return json({ error: `Model ${model} does not support audio generation` }, { status: 400 });
		}

		// Build params
		const params: AudioGenerationParams = {
			model,
			text: text.trim(),
			voiceId,
			voiceSettings,
			outputFormat,
			userId: session.user.id
		};

		// Generate audio
		const response = await provider.generateAudio(params);

		// Save audio to storage and database
		const audioId = await saveAudioAndGetId(
			response.audioData,
			response.mimeType,
			session.user.id,
			text.trim(),
			model,
			voiceId
		);

		// Track usage for successful audio generation
		UsageTrackingService.trackUsage(session.user.id, 'audio').catch(console.error);

		// Return the audio response with the database ID
		return json({
			...response,
			audioId
		});

	} catch (error) {
		console.error('Audio generation API error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 }
		);
	}
};
