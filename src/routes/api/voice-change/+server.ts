import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { elevenlabsProvider } from '$lib/ai/providers/elevenlabs.js';
import { ELEVENLABS_STS_MODELS } from '$lib/constants/elevenlabs.js';
import { UsageTrackingService, UsageLimitError } from '$lib/server/usage-tracking.js';
import { saveVoiceChangeAndGetId } from '$lib/ai/utils.js';
import { isDemoModeRestricted, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js';

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Supported audio formats
const SUPPORTED_MIME_TYPES = [
	'audio/mpeg',
	'audio/mp3',
	'audio/wav',
	'audio/wave',
	'audio/x-wav',
	'audio/ogg',
	'audio/webm',
	'audio/flac',
	'audio/mp4',
	'audio/m4a',
	'audio/x-m4a',
	'video/mp4',
	'video/webm'
];

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

		// Parse multipart form data
		const formData = await request.formData();
		const file = formData.get('file') as File | null;
		const targetVoiceId = formData.get('targetVoiceId') as string | null;
		const modelId = formData.get('modelId') as string | null;
		const removeBackgroundNoise = formData.get('removeBackgroundNoise') === 'true';

		// Parse voice settings JSON if provided
		let voiceSettings: {
			stability?: number;
			similarityBoost?: number;
			style?: number;
			useSpeakerBoost?: boolean;
			speed?: number;
		} | undefined;

		const voiceSettingsJson = formData.get('voiceSettings') as string | null;
		if (voiceSettingsJson) {
			try {
				voiceSettings = JSON.parse(voiceSettingsJson);
			} catch {
				return json({ error: 'Invalid voice settings JSON' }, { status: 400 });
			}
		}

		// Validate required fields
		if (!file) {
			return json({ error: 'Audio file is required' }, { status: 400 });
		}

		if (!targetVoiceId) {
			return json({ error: 'Target voice ID is required' }, { status: 400 });
		}

		// Validate model ID (default to multilingual if not provided)
		const effectiveModelId = modelId || 'eleven_multilingual_sts_v2';
		const validModel = ELEVENLABS_STS_MODELS.find(m => m.id === effectiveModelId);
		if (!validModel) {
			return json({
				error: `Invalid STS model: ${effectiveModelId}. Valid models: ${ELEVENLABS_STS_MODELS.map(m => m.id).join(', ')}`
			}, { status: 400 });
		}

		// Validate file size
		if (file.size > MAX_FILE_SIZE) {
			return json({
				error: `File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`
			}, { status: 400 });
		}

		// Validate file type
		if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
			return json({
				error: `Unsupported audio format. Supported formats: MP3, WAV, OGG, WebM, FLAC, M4A, MP4`
			}, { status: 400 });
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

		// Check usage limits for voice change
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

		// Check if the provider supports speech-to-speech
		if (!elevenlabsProvider.speechToSpeech) {
			return json({ error: 'Voice change is not available' }, { status: 500 });
		}

		// Convert File to ArrayBuffer (reuse for both processing and storage)
		const audioArrayBuffer = await file.arrayBuffer();
		const audioBlob = new Blob([audioArrayBuffer], { type: file.type });

		// Perform voice change
		const response = await elevenlabsProvider.speechToSpeech({
			audio: audioBlob,
			targetVoiceId,
			modelId: effectiveModelId,
			voiceSettings,
			removeBackgroundNoise
		});

		// Save to storage and database
		const audioBuffer = Buffer.from(audioArrayBuffer);
		const voiceChangeId = await saveVoiceChangeAndGetId(
			response.audioData,
			response.mimeType,
			audioBuffer,
			file.type,
			session.user.id,
			targetVoiceId,
			effectiveModelId,
			file.name,
			undefined, // chatId (optional)
			undefined  // duration (optional)
		);

		// Track usage for successful voice change
		UsageTrackingService.trackUsage(session.user.id, 'audio').catch(console.error);

		// Return the response with database ID
		return json({
			...response,
			voiceChangeId
		});

	} catch (error) {
		console.error('Voice change API error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 }
		);
	}
};
