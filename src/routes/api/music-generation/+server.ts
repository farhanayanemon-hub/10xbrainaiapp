import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { generateMusic } from '$lib/ai/providers/elevenlabs.js';
import { UsageTrackingService, UsageLimitError } from '$lib/server/usage-tracking.js';
import { saveMusicAndGetId } from '$lib/ai/utils.js';
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
			prompt,
			musicLengthMs, // Optional - if not provided, model chooses duration based on prompt
			modelId = 'music_v1',
			forceInstrumental = false,
			outputFormat = 'mp3_44100_128'
		} = body;

		// Validate required fields
		if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
			return json({ error: 'Prompt is required and must be a non-empty string' }, { status: 400 });
		}

		// Validate prompt length (ElevenLabs Music API limit)
		if (prompt.length > 4100) {
			return json({ error: 'Prompt exceeds maximum length of 4100 characters' }, { status: 400 });
		}

		// Validate duration range if provided (3 seconds to 5 minutes)
		// null/undefined = auto mode, skip validation
		if (musicLengthMs != null) {
			const durationMs = Number(musicLengthMs);
			if (isNaN(durationMs) || durationMs < 3000 || durationMs > 300000) {
				return json({ error: 'Music duration must be between 3 seconds (3000ms) and 5 minutes (300000ms)' }, { status: 400 });
			}
		}

		// Validate model ID
		if (modelId !== 'music_v1') {
			return json({ error: `Invalid music model: ${modelId}. Valid models: music_v1` }, { status: 400 });
		}

		// Check usage limits for music generation
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

		// Generate music using ElevenLabs
		// Always include musicLengthMs - null/undefined = auto mode (model chooses duration based on prompt)
		const response = await generateMusic({
			prompt: prompt.trim(),
			modelId,
			forceInstrumental: Boolean(forceInstrumental),
			outputFormat,
			musicLengthMs: musicLengthMs != null ? Number(musicLengthMs) : undefined
		});

		// Save music to storage and database
		const musicId = await saveMusicAndGetId(
			response.audioData,
			response.mimeType,
			session.user.id,
			response.prompt,
			response.model,
			response.durationMs,
			response.isInstrumental
		);

		// Track usage for successful music generation
		UsageTrackingService.trackUsage(session.user.id, 'audio').catch(console.error);

		// Return the music response with the database ID
		return json({
			...response,
			musicId
		});

	} catch (error) {
		console.error('Music generation API error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 }
		);
	}
};
