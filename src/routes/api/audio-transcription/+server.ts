import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { elevenlabsProvider } from '$lib/ai/providers/elevenlabs.js';
import { ELEVENLABS_STT_MODELS } from '$lib/constants/elevenlabs.js';
import { UsageTrackingService, UsageLimitError } from '$lib/server/usage-tracking.js';
import { saveTranscriptionAndGetId } from '$lib/ai/utils.js';
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
		const modelId = formData.get('modelId') as string | null;
		const tagAudioEvents = formData.get('tagAudioEvents') === 'true';
		const diarize = formData.get('diarize') === 'true';

		// Validate required fields
		if (!file) {
			return json({ error: 'Audio file is required' }, { status: 400 });
		}

		if (!modelId) {
			return json({ error: 'Model ID is required' }, { status: 400 });
		}

		// Validate model ID
		const validModel = ELEVENLABS_STT_MODELS.find(m => m.id === modelId);
		if (!validModel) {
			return json({
				error: `Invalid STT model: ${modelId}. Valid models: ${ELEVENLABS_STT_MODELS.map(m => m.id).join(', ')}`
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

		// Check usage limits for audio transcription
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

		// Check if the provider supports transcription
		if (!elevenlabsProvider.transcribeAudio) {
			return json({ error: 'Transcription is not available' }, { status: 500 });
		}

		// Convert File to ArrayBuffer (reuse for both transcription and storage)
		const audioArrayBuffer = await file.arrayBuffer();
		const audioBlob = new Blob([audioArrayBuffer], { type: file.type });

		// Transcribe audio
		const response = await elevenlabsProvider.transcribeAudio({
			file: audioBlob,
			modelId,
			tagAudioEvents,
			diarize
		});

		// Save transcription to database and storage
		const audioBuffer = Buffer.from(audioArrayBuffer);
		const transcriptionId = await saveTranscriptionAndGetId(
			audioBuffer,
			file.type,
			session.user.id,
			response.text,
			response.words,
			modelId,
			undefined, // chatId (optional)
			undefined  // duration (optional)
		);

		// Track usage for successful transcription
		UsageTrackingService.trackUsage(session.user.id, 'audio').catch(console.error);

		// Return the transcription response with database ID
		return json({
			...response,
			transcriptionId
		});

	} catch (error) {
		console.error('Audio transcription API error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 }
		);
	}
};
