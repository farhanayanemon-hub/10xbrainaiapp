// For AI Models via OpenRouter
export interface ArchitectureObject {
	input_modalities: string[]; // e.g., ["text", "image", "file"]
	output_modalities: string[]; // e.g., ["text"]
	tokenizer: string; // e.g., "Claude" or "GPT"
	instruct_type: string | null; // Instruction format type, can be null
}

// Tool calling interfaces (AI SDK v6)
// Tools are now defined using AI SDK v6's tool() helper with inputSchema
// See src/lib/ai/tools/* for actual tool implementations

export interface AIToolCall {
	id: string;
	type: 'function';
	function: {
		name: string;
		arguments: string; // JSON string
	};
}

export interface AIToolResult {
	role: 'tool';
	tool_call_id: string;
	name: string;
	content: string;
}

export interface AIMessage {
	role: 'user' | 'assistant' | 'system' | 'tool';
	content: string | null;
	model?: string; // Store which model generated this message (for assistant messages)
	imageId?: string; // Reference to images database table (single image, for backwards compatibility)
	imageUrl?: string; // URL to the generated image file (deprecated, for backwards compatibility)
	imageData?: string; // Base64 image data (deprecated, for backwards compatibility)
	videoId?: string; // Reference to videos database table
	mimeType?: string; // MIME type for image/video data
	type?: 'text' | 'image' | 'video'; // Message type
	// Multiple image support
	imageIds?: string[]; // Array of image IDs from database
	images?: Array<{
		imageId?: string;
		imageData?: string;
		mimeType: string;
	}>; // Array of image objects with data or IDs
	// Tool calling support
	tool_calls?: AIToolCall[];
	tool_call_id?: string; // For tool result messages
	name?: string; // Tool name for tool result messages
	// Tool invocations for UI display (persisted after streaming)
	toolInvocations?: Array<{
		toolCallId: string;
		toolName: string;
		args: Record<string, unknown>;
		state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error';
		result?: unknown;
		error?: string;
	}>;
}

export interface AIModelConfig {
	name: string;
	displayName: string;
	provider: string;
	maxTokens: number;
	supportsStreaming: boolean;
	supportsFunctions?: boolean;
	supportsTextInput?: boolean; // Default, all models support text input
	supportsImageInput?: boolean; // Vision models that can analyze uploaded images
	supportsVideoInput?: boolean;
	supportsAudioInput?: boolean; // Transcribe models
	supportsTextGeneration?: boolean;
	supportsImageGeneration?: boolean;
	supportsImageStreaming?: boolean; // Streaming image generation
	supportsVideoGeneration?: boolean;
	supportsAudioGeneration?: boolean;
	architecture?: ArchitectureObject; // OpenRouter architecture data when available
	isGuestAllowed?: boolean; // Whether guest users can use this model
	isDemoAllowed?: boolean; // Whether this model is allowed in demo mode
	isLocked?: boolean; // Whether this model is locked for the current user
	isDemoMode?: boolean; // Whether the platform is currently in demo mode
}

export interface AIResponse {
	content: string;
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
	model: string;
	finishReason?: 'stop' | 'length' | 'content_filter' | 'function_call' | 'tool_calls';
	tool_calls?: AIToolCall[]; // Support tool calls in response
}

export interface AIStreamChunk {
	content: string;
	done: boolean;
	usage?: AIResponse['usage'];
	// Tool support for streaming
	type?: 'text' | 'tool-call' | 'tool-result' | 'finish' | 'error';
	toolCall?: {
		toolCallId: string;
		toolName: string;
		args: Record<string, unknown>;
	};
	toolResult?: {
		toolCallId: string;
		toolName: string;
		result: unknown;
	};
	finishReason?: string;
}

export interface AIProvider {
	name: string;
	models: AIModelConfig[];
	chat(params: {
		model: string;
		messages: AIMessage[];
		maxTokens?: number;
		temperature?: number;
		stream?: boolean;
		userId?: string;
		chatId?: string;
		/** Tool names to enable for this request */
		toolNames?: string[];
		/** Maximum steps for multi-step tool execution (default: 1) */
		maxSteps?: number;
	}): Promise<AIResponse | AsyncIterableIterator<AIStreamChunk>>;
	generateImage?(params: ImageGenerationParams): Promise<AIImageResponse | AsyncIterableIterator<AIImageStreamChunk>>;
	generateVideo?(params: VideoGenerationParams): Promise<AIVideoResponse>;
	generateAudio?(params: AudioGenerationParams): Promise<AIAudioResponse>;
	transcribeAudio?(params: AudioTranscriptionParams): Promise<AITranscriptionResponse>;
	speechToSpeech?(params: VoiceChangeParams): Promise<AIVoiceChangeResponse>;
	chatMultimodal?(params: {
		model: string;
		messages: AIMessage[];
		maxTokens?: number;
		temperature?: number;
		userId?: string;
		chatId?: string;
		/** Tool names to enable for this request */
		toolNames?: string[];
		/** Maximum steps for multi-step tool execution (default: 1) */
		maxSteps?: number;
		stream?: boolean;
	}): Promise<AIResponse | AIImageResponse | AIVideoResponse | AsyncIterableIterator<AIStreamChunk>>;
}

export interface ChatCompletionParams {
	model: string;
	messages: AIMessage[];
	maxTokens?: number;
	temperature?: number;
	stream?: boolean;
	userId?: string;
	chatId?: string;
	/** Tool names to enable for this request */
	toolNames?: string[];
	/** Maximum steps for multi-step tool execution (default: 1) */
	maxSteps?: number;
}

export interface AIImageResponse {
	imageId: string; // Reference to images database table
	imageUrl?: string; // URL to the generated image file (deprecated, for backwards compatibility)
	imageData?: string; // Base64 encoded image (deprecated, for backwards compatibility)
	mimeType: string; // e.g., 'image/png', 'image/jpeg'
	prompt: string;
	model: string;
	usage?: {
		promptTokens: number;
		imageTokens?: number;
		totalTokens: number;
	};
}

export interface ImageGenerationParams {
	model: string;
	prompt: string;
	quality?: string; // Model-specific quality options (e.g., 'low', 'medium', 'high' or '720p', '1080p', '4K')
	size?: string;
	style?: string; // Model-specific style options (e.g., 'anime', 'photorealistic', 'digital-art')
	numberOfImages?: number; // Number of images to generate
	userId?: string;
	chatId?: string;
	stream?: boolean; // Support for streaming image generation
	partial_images?: number; // Number of partial images to generate during streaming
	imageUrl?: string; // Reference image URL for image-to-image generation (single image, backward compatible)
	imageUrls?: string[]; // Multiple reference image URLs for models that support multiple inputs
	seed?: number; // Random seed for reproducible generation
	upscaleFactor?: string; // Upscale factor for upscaler models (e.g., 'x2', 'x4')
	compressionQuality?: number; // Compression quality for upscaler models (e.g., 1-100)
}

export interface AIImageStreamChunk {
	type: 'image_generation.partial_image' | 'image_generation.complete';
	partial_image_index?: number;
	b64_json?: string;
	imageId?: string; // Reference to database when complete
	done: boolean;
}

export interface AIVideoResponse {
	videoId: string; // Reference to videos database table
	mimeType: string; // e.g., 'video/mp4'
	prompt: string;
	model: string;
	duration?: number; // Duration in seconds
	resolution?: string; // e.g., '720p'
	fps?: number; // Frames per second
	hasAudio?: boolean; // Whether video includes audio
	usage?: {
		promptTokens: number;
		videoTokens?: number;
		totalTokens: number;
	};
}

export interface VideoGenerationParams {
	model: string;
	prompt: string;
	duration?: number; // Duration in seconds (default 8 for Veo 3)
	resolution?: string; // e.g., '720p'
	fps?: number; // Frames per second (default 24 for Veo 3)
	quality?: string; // Model-specific quality options (e.g., 'low', 'medium', 'high' or '720p', '1080p', '4K')
	style?: string; // Model-specific style options
	imageUrl?: string; // Image URL for image-to-video models (i2v) - legacy param for backwards compatibility
	imageStartUrl?: string; // Image URL for the first frame of the video
	imageEndUrl?: string; // Image URL for the last frame of the video
	userId?: string;
	chatId?: string;
	seed?: number; // Random seed for reproducible generation
}

// Audio generation types for ElevenLabs TTS
export interface VoiceSettings {
	stability?: number; // 0-1, default 0.5
	similarityBoost?: number; // 0-1, default 0.75
	style?: number; // 0-1, default 0 (recommended to keep at 0)
	useSpeakerBoost?: boolean; // default false
	speed?: number; // 0.7-1.2, default 1 (normal speed)
}

export interface AudioGenerationParams {
	model: string;
	text: string;
	voiceId: string;
	voiceSettings?: VoiceSettings;
	outputFormat?: string; // e.g., 'mp3_44100_128'
	userId?: string;
	chatId?: string;
}

export interface AIAudioResponse {
	audioData: string; // Base64 encoded audio
	mimeType: string; // e.g., 'audio/mpeg'
	text: string; // Original text that was converted
	model: string;
	voiceId: string;
	duration?: number; // Duration in seconds (if available)
}

// Audio transcription types for ElevenLabs STT
export interface AudioTranscriptionParams {
	file: Blob;
	modelId: string;
	tagAudioEvents?: boolean; // default true - tag events like laughter, applause
	diarize?: boolean; // default false - annotate who is speaking
}

export interface AITranscriptionResponse {
	text: string; // Transcribed text
	words?: Array<{
		text: string;
		start: number;
		end: number;
	}>; // Word-level timestamps
	model: string;
}

// Voice Change (Speech-to-Speech) types for ElevenLabs STS
export interface VoiceChangeParams {
	audio: Blob;
	targetVoiceId: string;
	modelId?: string;
	voiceSettings?: VoiceSettings;
	removeBackgroundNoise?: boolean;
	outputFormat?: string; // e.g., 'mp3_44100_128'
}

export interface AIVoiceChangeResponse {
	audioData: string; // Base64 encoded output audio
	mimeType: string; // e.g., 'audio/mpeg'
	model: string;
	targetVoiceId: string;
}

// Music generation types for ElevenLabs Music API
export interface MusicGenerationParams {
	prompt: string; // Text description of the music (max 4100 chars)
	musicLengthMs?: number; // Duration in milliseconds (3000-300000, i.e., 3s-5min)
	modelId?: string; // Model ID (default: 'music_v1')
	forceInstrumental?: boolean; // Guarantee instrumental output (default: false)
	outputFormat?: string; // Output format (default: 'mp3_44100_128')
}

export interface AIMusicResponse {
	audioData: string; // Base64 encoded audio
	mimeType: string; // e.g., 'audio/mpeg'
	prompt: string; // Original prompt used for generation
	model: string; // Model ID used
	durationMs: number; // Duration in milliseconds
	isInstrumental: boolean; // Whether music is instrumental only
}

// Sound effects generation types for ElevenLabs Text-to-Sound-Effects API
export interface SoundEffectGenerationParams {
	text: string; // Text description of the sound effect
	durationSeconds?: number; // Duration in seconds (0.5-22), optional for auto
	promptInfluence?: number; // 0.0-1.0, how literally to interpret the prompt (default: 0.3)
	outputFormat?: string; // Output format (default: 'mp3_44100_128')
}

export interface AISoundEffectResponse {
	audioData: string; // Base64 encoded audio
	mimeType: string; // e.g., 'audio/mpeg'
	text: string; // Original description used for generation
	durationSeconds: number; // Actual duration in seconds
	promptInfluence: number; // Influence level used
}

// Helper function to determine if a model is multimodal (supports 2+ generation types)
export function isMultimodal(model: AIModelConfig): boolean {
	const capabilities = [
		model.supportsTextGeneration,
		model.supportsImageGeneration,
		model.supportsVideoGeneration,
		model.supportsAudioGeneration
	].filter(Boolean);

	return capabilities.length >= 2;
}