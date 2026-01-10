import type {
	AIProvider,
	AIModelConfig,
	AIResponse,
	AIStreamChunk,
	AIMessage,
	AudioGenerationParams,
	AIAudioResponse,
	AudioTranscriptionParams,
	AITranscriptionResponse,
	VoiceChangeParams,
	AIVoiceChangeResponse,
	MusicGenerationParams,
	AIMusicResponse,
	SoundEffectGenerationParams,
	AISoundEffectResponse
} from '../types.js';
import { env } from '$env/dynamic/private';
import { getElevenLabsApiKey } from '$lib/server/settings-store.js';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

// Re-export client-safe constants from shared constants file
// This allows server code to import from this file while maintaining a single source of truth
export { ELEVENLABS_VOICES, ELEVENLABS_TTS_MODELS, ELEVENLABS_STT_MODELS, ELEVENLABS_STS_MODELS, ELEVENLABS_MUSIC_MODELS, ELEVENLABS_SOUND_EFFECTS_MODELS } from '$lib/constants/elevenlabs.js';
import { ELEVENLABS_TTS_MODELS as TTS_MODELS_BASE, ELEVENLABS_STT_MODELS as STT_MODELS_BASE, ELEVENLABS_STS_MODELS as STS_MODELS_BASE, ELEVENLABS_MUSIC_MODELS as MUSIC_MODELS_BASE, ELEVENLABS_SOUND_EFFECTS_MODELS as SOUND_EFFECTS_MODELS_BASE } from '$lib/constants/elevenlabs.js';

// Cache for ElevenLabs client instances (invalidated when API key changes)
let cachedClient: ElevenLabsClient | null = null;
let cachedApiKey: string | null = null;

// Get API key from database or fallback to environment variable
async function getApiKey(): Promise<string> {
	try {
		const dbKey = await getElevenLabsApiKey();
		return dbKey || env.ELEVENLABS_API_KEY || '';
	} catch (error) {
		console.warn('Failed to get ElevenLabs API key from database, using environment variable:', error);
		return env.ELEVENLABS_API_KEY || '';
	}
}

// Get or create ElevenLabs client with caching
async function getClient(): Promise<ElevenLabsClient> {
	const apiKey = await getApiKey();

	if (!apiKey) {
		throw new Error('ElevenLabs API key not configured');
	}

	// Return cached client if API key hasn't changed
	if (cachedClient && cachedApiKey === apiKey) {
		return cachedClient;
	}

	// Create new client and cache it
	cachedClient = new ElevenLabsClient({ apiKey });
	cachedApiKey = apiKey;
	return cachedClient;
}

// ElevenLabs TTS Models Configuration - built from client-safe constants
const ELEVENLABS_TTS_MODELS_CONFIG: AIModelConfig[] = TTS_MODELS_BASE.map((model) => ({
	name: model.id,
	displayName: model.name,
	provider: 'ElevenLabs',
	maxTokens: 5000, // Character limit for text
	supportsTextInput: true,
	supportsAudioGeneration: true,
	supportsStreaming: true,
}));

// Helper to convert ReadableStream to base64
async function streamToBase64(stream: ReadableStream<Uint8Array>): Promise<string> {
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		if (value) chunks.push(value);
	}

	// Combine all chunks into a single Uint8Array
	const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
	const combined = new Uint8Array(totalLength);
	let offset = 0;
	for (const chunk of chunks) {
		combined.set(chunk, offset);
		offset += chunk.length;
	}

	// Convert to base64
	// In Node.js environment, use Buffer
	if (typeof Buffer !== 'undefined') {
		return Buffer.from(combined).toString('base64');
	}

	// Fallback for other environments
	let binary = '';
	for (let i = 0; i < combined.length; i++) {
		binary += String.fromCharCode(combined[i]);
	}
	return btoa(binary);
}

// Generate audio from text using ElevenLabs TTS
async function generateAudio(params: AudioGenerationParams): Promise<AIAudioResponse> {
	const {
		model,
		text,
		voiceId,
		voiceSettings,
		outputFormat = 'mp3_44100_128'
	} = params;

	if (!text || text.trim().length === 0) {
		throw new Error('Text is required for audio generation');
	}

	if (!voiceId) {
		throw new Error('Voice ID is required for audio generation');
	}

	const client = await getClient();

	try {
		console.log(`Generating audio with ElevenLabs model: ${model}, voice: ${voiceId}`);

		// Build request options - use 'as const' for outputFormat to match SDK's expected type
		const requestOptions = {
			text: text.trim(),
			modelId: model,
			outputFormat: outputFormat as 'mp3_44100_128' | 'mp3_44100_192' | 'pcm_16000' | 'pcm_22050' | 'pcm_24000' | 'pcm_44100',
			voiceSettings: undefined as {
				stability?: number;
				similarityBoost?: number;
				style?: number;
				useSpeakerBoost?: boolean;
				speed?: number;
			} | undefined
		};

		// Add optional parameters
		if (voiceSettings) {
			requestOptions.voiceSettings = {
				stability: voiceSettings.stability ?? 0.5,
				similarityBoost: voiceSettings.similarityBoost ?? 0.75,
				style: voiceSettings.style ?? 0,
				useSpeakerBoost: voiceSettings.useSpeakerBoost ?? false,
				speed: voiceSettings.speed ?? 1
			};
		}

		// Call ElevenLabs API
		const audioStream = await client.textToSpeech.convert(voiceId, requestOptions);

		// Convert the stream to base64
		const audioBase64 = await streamToBase64(audioStream as unknown as ReadableStream<Uint8Array>);

		// Determine MIME type from output format
		let mimeType = 'audio/mpeg';
		if (outputFormat.startsWith('pcm_')) {
			mimeType = 'audio/pcm';
		} else if (outputFormat.startsWith('ulaw_')) {
			mimeType = 'audio/basic';
		} else if (outputFormat.includes('mp3')) {
			mimeType = 'audio/mpeg';
		}

		console.log(`Audio generated successfully, size: ${audioBase64.length} bytes (base64)`);

		return {
			audioData: audioBase64,
			mimeType,
			text: text.trim(),
			model,
			voiceId
		};

	} catch (error) {
		console.error('ElevenLabs audio generation error:', error);

		if (error instanceof Error) {
			// Handle specific ElevenLabs errors
			if (error.message.includes('quota') || error.message.includes('limit')) {
				throw new Error('ElevenLabs character quota exceeded. Please check your subscription.');
			}
			if (error.message.includes('invalid_api_key') || error.message.includes('unauthorized')) {
				throw new Error('Invalid ElevenLabs API key. Please check your configuration.');
			}
			if (error.message.includes('voice_not_found')) {
				throw new Error(`Voice ID "${voiceId}" not found. Please select a valid voice.`);
			}
			throw error;
		}

		throw new Error('Failed to generate audio with ElevenLabs');
	}
}

// Transcribe audio using ElevenLabs STT
async function transcribeAudio(params: AudioTranscriptionParams): Promise<AITranscriptionResponse> {
	const {
		file,
		modelId,
		tagAudioEvents = true,
		diarize = false
	} = params;

	if (!file) {
		throw new Error('Audio file is required for transcription');
	}

	// Validate model ID
	const validModel = STT_MODELS_BASE.find(m => m.id === modelId);
	if (!validModel) {
		throw new Error(`Invalid STT model: ${modelId}. Valid models: ${STT_MODELS_BASE.map(m => m.id).join(', ')}`);
	}

	const client = await getClient();

	try {
		console.log(`Transcribing audio with ElevenLabs model: ${modelId}, tagAudioEvents: ${tagAudioEvents}, diarize: ${diarize}`);

		// Call ElevenLabs Speech-to-Text API
		const transcription = await client.speechToText.convert({
			file,
			modelId,
			tagAudioEvents,
			diarize,
			timestampsGranularity: 'word'
		});

		// The SDK returns a union type - extract text and words from the response
		// Standard response has 'text' and 'words' properties
		const response = transcription as { text?: string; words?: Array<{ text?: string; start?: number; end?: number }> };

		console.log(`Transcription completed successfully, text length: ${response.text?.length || 0} characters`);

		return {
			text: response.text || '',
			words: response.words?.map(w => ({
				text: w.text || '',
				start: w.start || 0,
				end: w.end || 0
			})),
			model: modelId
		};

	} catch (error) {
		console.error('ElevenLabs transcription error:', error);

		if (error instanceof Error) {
			// Handle specific ElevenLabs errors
			if (error.message.includes('quota') || error.message.includes('limit')) {
				throw new Error('ElevenLabs usage quota exceeded. Please check your subscription.');
			}
			if (error.message.includes('invalid_api_key') || error.message.includes('unauthorized')) {
				throw new Error('Invalid ElevenLabs API key. Please check your configuration.');
			}
			if (error.message.includes('unsupported') || error.message.includes('format')) {
				throw new Error('Unsupported audio format. Please use MP3, WAV, or other supported formats.');
			}
			throw error;
		}

		throw new Error('Failed to transcribe audio with ElevenLabs');
	}
}

// Speech-to-Speech (Voice Changer) using ElevenLabs STS
async function speechToSpeech(params: VoiceChangeParams): Promise<AIVoiceChangeResponse> {
	const {
		audio,
		targetVoiceId,
		modelId = 'eleven_multilingual_sts_v2',
		voiceSettings,
		removeBackgroundNoise = false,
		outputFormat = 'mp3_44100_128'
	} = params;

	if (!audio) {
		throw new Error('Audio file is required for voice change');
	}

	if (!targetVoiceId) {
		throw new Error('Target voice ID is required for voice change');
	}

	// Validate model ID
	const validModel = STS_MODELS_BASE.find(m => m.id === modelId);
	if (!validModel) {
		throw new Error(`Invalid STS model: ${modelId}. Valid models: ${STS_MODELS_BASE.map(m => m.id).join(', ')}`);
	}

	const client = await getClient();

	try {
		console.log(`Voice change with ElevenLabs model: ${modelId}, target voice: ${targetVoiceId}, removeBackgroundNoise: ${removeBackgroundNoise}`);

		// Build voice settings string if provided (ElevenLabs STS API expects JSON string)
		let voiceSettingsStr: string | undefined;
		if (voiceSettings) {
			voiceSettingsStr = JSON.stringify({
				stability: voiceSettings.stability ?? 0.5,
				similarity_boost: voiceSettings.similarityBoost ?? 0.75,
				style: voiceSettings.style ?? 0,
				use_speaker_boost: voiceSettings.useSpeakerBoost ?? false,
				speed: voiceSettings.speed ?? 1
			});
		}

		// Build request options - use type assertion for outputFormat to match SDK's expected type
		const requestOptions = {
			audio,
			modelId,
			outputFormat: outputFormat as 'mp3_44100_128' | 'mp3_44100_192' | 'pcm_16000' | 'pcm_22050' | 'pcm_24000' | 'pcm_44100',
			removeBackgroundNoise,
			voiceSettings: voiceSettingsStr
		};

		// Call ElevenLabs Speech-to-Speech API
		const audioStream = await client.speechToSpeech.convert(targetVoiceId, requestOptions);

		// Convert the stream to base64
		const audioBase64 = await streamToBase64(audioStream as unknown as ReadableStream<Uint8Array>);

		// Determine MIME type from output format
		let mimeType = 'audio/mpeg';
		if (outputFormat.startsWith('pcm_')) {
			mimeType = 'audio/pcm';
		} else if (outputFormat.startsWith('ulaw_')) {
			mimeType = 'audio/basic';
		} else if (outputFormat.includes('mp3')) {
			mimeType = 'audio/mpeg';
		}

		console.log(`Voice change completed successfully, size: ${audioBase64.length} bytes (base64)`);

		return {
			audioData: audioBase64,
			mimeType,
			model: modelId,
			targetVoiceId
		};

	} catch (error) {
		console.error('ElevenLabs voice change error:', error);

		if (error instanceof Error) {
			// Handle specific ElevenLabs errors
			if (error.message.includes('quota') || error.message.includes('limit')) {
				throw new Error('ElevenLabs usage quota exceeded. Please check your subscription.');
			}
			if (error.message.includes('invalid_api_key') || error.message.includes('unauthorized')) {
				throw new Error('Invalid ElevenLabs API key. Please check your configuration.');
			}
			if (error.message.includes('voice_not_found')) {
				throw new Error(`Voice ID "${targetVoiceId}" not found. Please select a valid voice.`);
			}
			if (error.message.includes('unsupported') || error.message.includes('format')) {
				throw new Error('Unsupported audio format. Please use MP3, WAV, or other supported formats.');
			}
			throw error;
		}

		throw new Error('Failed to change voice with ElevenLabs');
	}
}

// Generate music using ElevenLabs Music API
async function generateMusic(params: MusicGenerationParams): Promise<AIMusicResponse> {
	const {
		prompt,
		musicLengthMs, // Optional - if not provided, model chooses duration based on prompt
		modelId = 'music_v1',
		forceInstrumental = false,
		outputFormat = 'mp3_44100_128'
	} = params;

	if (!prompt || prompt.trim().length === 0) {
		throw new Error('Prompt is required for music generation');
	}

	if (prompt.length > 4100) {
		throw new Error('Prompt exceeds maximum length of 4100 characters');
	}

	// Validate duration range if provided (3 seconds to 5 minutes)
	// null/undefined = auto mode, skip validation
	if (musicLengthMs != null) {
		const durationMs = Number(musicLengthMs);
		if (isNaN(durationMs) || durationMs < 3000 || durationMs > 300000) {
			throw new Error('Music duration must be between 3 seconds (3000ms) and 5 minutes (300000ms)');
		}
	}

	// Validate model ID
	const validModel = MUSIC_MODELS_BASE.find(m => m.id === modelId);
	if (!validModel) {
		throw new Error(`Invalid music model: ${modelId}. Valid models: ${MUSIC_MODELS_BASE.map(m => m.id).join(', ')}`);
	}

	const client = await getClient();

	try {
		console.log(`Generating music with ElevenLabs model: ${modelId}, duration: ${musicLengthMs != null ? musicLengthMs + 'ms' : 'auto'}, instrumental: ${forceInstrumental}`);

		// Build request options - musicLengthMs is always passed (null/undefined = auto, model chooses based on prompt)
		const requestOptions: any = {
			prompt: prompt.trim(),
			modelId: modelId as 'music_v1',
			forceInstrumental,
			outputFormat: outputFormat as 'mp3_44100_128' | 'mp3_44100_192' | 'pcm_16000' | 'pcm_22050' | 'pcm_24000' | 'pcm_44100',
			musicLengthMs: musicLengthMs != null ? Number(musicLengthMs) : undefined
		};

		// Call ElevenLabs Music API
		const audioStream = await client.music.compose(requestOptions);

		// Convert the stream to base64
		const audioBase64 = await streamToBase64(audioStream as unknown as ReadableStream<Uint8Array>);

		// Determine MIME type from output format
		let mimeType = 'audio/mpeg';
		if (outputFormat.startsWith('pcm_')) {
			mimeType = 'audio/pcm';
		} else if (outputFormat.includes('mp3')) {
			mimeType = 'audio/mpeg';
		}

		console.log(`Music generated successfully, size: ${audioBase64.length} bytes (base64)`);

		return {
			audioData: audioBase64,
			mimeType,
			prompt: prompt.trim(),
			model: modelId,
			durationMs: musicLengthMs !== undefined ? Number(musicLengthMs) : 0, // 0 indicates auto-generated duration
			isInstrumental: forceInstrumental
		};

	} catch (error) {
		console.error('ElevenLabs music generation error:', error);

		if (error instanceof Error) {
			// Handle specific ElevenLabs errors
			if (error.message.includes('quota') || error.message.includes('limit')) {
				throw new Error('ElevenLabs usage quota exceeded. Please check your subscription.');
			}
			if (error.message.includes('invalid_api_key') || error.message.includes('unauthorized')) {
				throw new Error('Invalid ElevenLabs API key. Please check your configuration.');
			}
			throw error;
		}

		throw new Error('Failed to generate music with ElevenLabs');
	}
}

// Generate sound effects using ElevenLabs Text-to-Sound-Effects API
async function generateSoundEffect(params: SoundEffectGenerationParams): Promise<AISoundEffectResponse> {
	const {
		text,
		durationSeconds,
		promptInfluence = 0.3,
		outputFormat = 'mp3_44100_128'
	} = params;

	if (!text || text.trim().length === 0) {
		throw new Error('Text description is required for sound effect generation');
	}

	if (text.length > 4100) {
		throw new Error('Text description exceeds maximum length of 4100 characters');
	}

	// Validate duration range if provided (0.5 to 22 seconds)
	if (durationSeconds != null) {
		const duration = Number(durationSeconds);
		if (isNaN(duration) || duration < 0.5 || duration > 22) {
			throw new Error('Sound effect duration must be between 0.5 and 22 seconds');
		}
	}

	// Validate prompt influence (0.0 to 1.0)
	if (promptInfluence < 0 || promptInfluence > 1) {
		throw new Error('Prompt influence must be between 0.0 and 1.0');
	}

	// Validate model ID
	const validModel = SOUND_EFFECTS_MODELS_BASE.find(m => m.id === 'sound_effects_v1');
	if (!validModel) {
		throw new Error('Sound effects model not found');
	}

	const client = await getClient();

	try {
		console.log(`Generating sound effect with ElevenLabs, duration: ${durationSeconds != null ? durationSeconds + 's' : 'auto'}, promptInfluence: ${promptInfluence}`);

		// Build request options
		const requestOptions: {
			text: string;
			durationSeconds?: number;
			promptInfluence?: number;
		} = {
			text: text.trim(),
			promptInfluence
		};

		// Only include durationSeconds if provided (null/undefined = auto mode)
		if (durationSeconds != null) {
			requestOptions.durationSeconds = Number(durationSeconds);
		}

		// Call ElevenLabs Text-to-Sound-Effects API
		const audioStream = await client.textToSoundEffects.convert(requestOptions);

		// Convert the stream to base64
		const audioBase64 = await streamToBase64(audioStream as unknown as ReadableStream<Uint8Array>);

		// Determine MIME type from output format
		let mimeType = 'audio/mpeg';
		if (outputFormat.startsWith('pcm_')) {
			mimeType = 'audio/pcm';
		} else if (outputFormat.includes('mp3')) {
			mimeType = 'audio/mpeg';
		}

		console.log(`Sound effect generated successfully, size: ${audioBase64.length} bytes (base64)`);

		return {
			audioData: audioBase64,
			mimeType,
			text: text.trim(),
			durationSeconds: durationSeconds != null ? Number(durationSeconds) : 0, // 0 indicates auto-generated duration
			promptInfluence
		};

	} catch (error) {
		console.error('ElevenLabs sound effect generation error:', error);

		if (error instanceof Error) {
			// Handle specific ElevenLabs errors
			if (error.message.includes('quota') || error.message.includes('limit')) {
				throw new Error('ElevenLabs usage quota exceeded. Please check your subscription.');
			}
			if (error.message.includes('invalid_api_key') || error.message.includes('unauthorized')) {
				throw new Error('Invalid ElevenLabs API key. Please check your configuration.');
			}
			throw error;
		}

		throw new Error('Failed to generate sound effect with ElevenLabs');
	}
}

// Placeholder chat function (ElevenLabs doesn't support chat, but required by AIProvider interface)
async function chat(): Promise<AIResponse> {
	throw new Error('ElevenLabs provider does not support chat. Use generateAudio for text-to-speech.');
}

// Export the ElevenLabs provider
export const elevenlabsProvider: AIProvider = {
	name: 'ElevenLabs',
	models: ELEVENLABS_TTS_MODELS_CONFIG,
	chat,
	generateAudio,
	transcribeAudio,
	speechToSpeech
};

// Export helper functions and constants
export { getApiKey as getElevenLabsApiKey, getClient as getElevenLabsClient, generateMusic, generateSoundEffect };
