import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { generateSoundEffect } from '$lib/ai/providers/elevenlabs.js';
import { UsageTrackingService, UsageLimitError } from '$lib/server/usage-tracking.js';
import { saveSoundEffectAndGetId } from '$lib/ai/utils.js';
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
			text,
			durationSeconds, // Optional - if not provided, auto mode
			promptInfluence = 0.3,
			outputFormat = 'mp3_44100_128'
		} = body;

		// Validate required fields
		if (!text || typeof text !== 'string' || text.trim().length === 0) {
			return json({ error: 'Text description is required and must be a non-empty string' }, { status: 400 });
		}

		// Validate text length
		if (text.length > 4100) {
			return json({ error: 'Text description exceeds maximum length of 4100 characters' }, { status: 400 });
		}

		// Validate duration range if provided (0.5 to 22 seconds)
		// null/undefined = auto mode, skip validation
		if (durationSeconds != null) {
			const duration = Number(durationSeconds);
			if (isNaN(duration) || duration < 0.5 || duration > 22) {
				return json({ error: 'Sound effect duration must be between 0.5 and 22 seconds' }, { status: 400 });
			}
		}

		// Validate prompt influence (0.0 to 1.0)
		if (typeof promptInfluence !== 'number' || promptInfluence < 0 || promptInfluence > 1) {
			return json({ error: 'Prompt influence must be a number between 0.0 and 1.0' }, { status: 400 });
		}

		// Check usage limits for sound effect generation
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

		// Generate sound effect using ElevenLabs
		const response = await generateSoundEffect({
			text: text.trim(),
			durationSeconds: durationSeconds != null ? Number(durationSeconds) : undefined,
			promptInfluence: Number(promptInfluence),
			outputFormat
		});

		// Save sound effect to storage and database
		const soundEffectId = await saveSoundEffectAndGetId(
			response.audioData,
			response.mimeType,
			session.user.id,
			response.text,
			response.durationSeconds,
			response.promptInfluence,
			'sound_effects_v1' // Model ID
		);

		// Track usage for successful sound effect generation
		UsageTrackingService.trackUsage(session.user.id, 'audio').catch(console.error);

		// Return the sound effect response with the database ID
		return json({
			...response,
			soundEffectId
		});

	} catch (error) {
		console.error('Sound effect generation API error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 }
		);
	}
};
