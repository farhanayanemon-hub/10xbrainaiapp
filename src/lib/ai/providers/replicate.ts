import type {
	AIProvider,
	AIModelConfig,
	AIResponse,
	AIStreamChunk,
	AIMessage,
	ImageGenerationParams,
	AIImageResponse,
	VideoGenerationParams,
	AIVideoResponse
} from '../types.js';
import { env } from '$env/dynamic/private';
import { saveImageAndGetId, saveVideoAndGetId, createProviderError } from '../utils.js';
import { getReplicateApiKey } from '$lib/server/settings-store.js';
import { db } from '$lib/server/db/index.js';
import { images } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { storageService } from '$lib/server/storage.js';
import Replicate from 'replicate';
import { MODEL_CONFIGS, MODEL_IDENTIFIERS, type ModelParamConfig } from '$lib/constants/replicate-model-configs.js';

// Cache for Replicate client instances (invalidated when API key changes)
let cachedClient: Replicate | null = null;
let cachedApiKey: string | null = null;

// Get API key from database or fallback to environment variable
async function getApiKey(): Promise<string> {
	try {
		const dbKey = await getReplicateApiKey();
		return dbKey || env.REPLICATE_API_TOKEN || '';
	} catch (error) {
		console.warn('Failed to get Replicate API key from database, using environment variable:', error);
		return env.REPLICATE_API_TOKEN || '';
	}
}

// Get or create Replicate client with caching
async function getClient(): Promise<Replicate> {
	const apiKey = await getApiKey();

	if (!apiKey) {
		throw new Error('Replicate API key not configured');
	}

	// Return cached client if API key hasn't changed
	if (cachedClient && cachedApiKey === apiKey) {
		return cachedClient;
	}

	// Create new client and cache it
	cachedClient = new Replicate({ auth: apiKey });
	cachedApiKey = apiKey;
	return cachedClient;
}

// Replicate Image Generation Models Configuration
const REPLICATE_IMAGE_MODELS: AIModelConfig[] = [
	// OpenAI Models
	{
		name: 'gpt-image-1.5',
		displayName: 'GPT Image 1.5',
		provider: 'OpenAI',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	{
		name: 'dall-e-3',
		displayName: 'DALL-E 3',
		provider: 'OpenAI',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	{
		name: 'dall-e-2',
		displayName: 'DALL-E 2',
		provider: 'OpenAI',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	// Google Models
	{
		name: 'nano-banana-pro',
		displayName: 'Nano Banana Pro',
		provider: 'Google',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	{
		name: 'nano-banana',
		displayName: 'Nano Banana',
		provider: 'Google',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	{
		name: 'imagen-4',
		displayName: 'Imagen 4',
		provider: 'Google',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	{
		name: 'imagen-4-ultra',
		displayName: 'Imagen 4 Ultra',
		provider: 'Google',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	{
		name: 'imagen-4-fast',
		displayName: 'Imagen 4 Fast',
		provider: 'Google',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	{
		name: 'imagen-3',
		displayName: 'Imagen 3',
		provider: 'Google',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	{
		name: 'imagen-3-fast',
		displayName: 'Imagen 3 Fast',
		provider: 'Google',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	// Black Forest Labs Models
	{
		name: 'flux-2-max',
		displayName: 'FLUX 2 Max',
		provider: 'BlackForestLabs',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	{
		name: 'flux-2-pro',
		displayName: 'FLUX 2 Pro',
		provider: 'BlackForestLabs',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	{
		name: 'flux-2-flex',
		displayName: 'FLUX 2 Flex',
		provider: 'BlackForestLabs',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	{
		name: 'flux-2-dev',
		displayName: 'FLUX 2 Dev',
		provider: 'BlackForestLabs',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	{
		name: 'flux-krea-dev',
		displayName: 'FLUX Krea Dev',
		provider: 'BlackForestLabs',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	{
		name: 'flux-1.1-pro-ultra',
		displayName: 'FLUX 1.1 Pro Ultra',
		provider: 'BlackForestLabs',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	{
		name: 'flux-kontext-pro',
		displayName: 'FLUX Kontext Pro',
		provider: 'BlackForestLabs',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	{
		name: 'flux-kontext-max',
		displayName: 'FLUX Kontext Max',
		provider: 'BlackForestLabs',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	{
		name: 'flux-schnell',
		displayName: 'FLUX Schnell',
		provider: 'BlackForestLabs',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	// Stability AI Models
	{
		name: 'stable-diffusion-3.5-large',
		displayName: 'Stable Diffusion 3.5 Large',
		provider: 'StabilityAI',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	{
		name: 'stable-diffusion-3.5-large-turbo',
		displayName: 'Stable Diffusion 3.5 Large Turbo',
		provider: 'StabilityAI',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	{
		name: 'stable-diffusion-3.5-medium',
		displayName: 'Stable Diffusion 3.5 Medium',
		provider: 'StabilityAI',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	{
		name: 'stable-diffusion-3',
		displayName: 'Stable Diffusion 3',
		provider: 'StabilityAI',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	// Luma Models
	{
		name: 'photon-1',
		displayName: 'Photon 1',
		provider: 'LumaLabs',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	{
		name: 'photon-flash-1',
		displayName: 'Photon Flash 1',
		provider: 'LumaLabs',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	// Bytedance Models
	{
		name: 'seedream-4.5',
		displayName: 'SeeDream 4.5',
		provider: 'ByteDance',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	{
		name: 'seedream-4',
		displayName: 'SeeDream 4',
		provider: 'ByteDance',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	{
		name: 'seedream-3',
		displayName: 'SeeDream 3',
		provider: 'ByteDance',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	{
		name: 'dreamina-3.1',
		displayName: 'Dreamina 3.1',
		provider: 'ByteDance',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	// Alibaba/Wan Models
	{
		name: 'wan-2.2-image',
		displayName: 'Wan 2.2 Image',
		provider: 'Alibaba',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	// Alibaba/Qwen Models
	{
		name: 'qwen-image-2512',
		displayName: 'Qwen Image',
		provider: 'Alibaba',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	// Tencent Models
	{
		name: 'hunyuan-image-3',
		displayName: 'Hunyuan Image 3',
		provider: 'Tencent',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	{
		name: 'hunyuan-image-2.1',
		displayName: 'Hunyuan Image 2.1',
		provider: 'Tencent',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	// XAI Models
	{
		name: 'grok-2-image',
		displayName: 'Grok 2 Image',
		provider: 'xAI',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	// LeonardoAI Models
	{
		name: 'lucid-origin',
		displayName: 'Lucid Origin',
		provider: 'LeonardoAI',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	{
		name: 'phoenix-1.0',
		displayName: 'Phoenix 1.0',
		provider: 'LeonardoAI',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	// IdeogramAI Models
	{
		name: 'ideogram-v3-quality',
		displayName: 'Ideogram V3 Quality',
		provider: 'Ideogram',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	{
		name: 'ideogram-v3-balanced',
		displayName: 'Ideogram V3 Balanced',
		provider: 'Ideogram',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	{
		name: 'ideogram-v3-turbo',
		displayName: 'Ideogram V3 Turbo',
		provider: 'Ideogram',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	{
		name: 'ideogram-v2',
		displayName: 'Ideogram V2',
		provider: 'Ideogram',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	{
		name: 'ideogram-v2-turbo',
		displayName: 'Ideogram V2 Turbo',
		provider: 'Ideogram',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	},
	// IMAGE UPSCALERS
	{
		name: 'upscaler',
		displayName: 'Google Upscaler',
		provider: 'Google',
		maxTokens: 4096,
		supportsTextInput: false,
		supportsImageInput: true,
		supportsImageGeneration: true,
		supportsImageStreaming: false,
		supportsStreaming: false,
	}
];

// Replicate Video Generation Models Configuration
const REPLICATE_VIDEO_MODELS: AIModelConfig[] = [
	// OpenAI Models
	{
		name: 'sora-2',
		displayName: 'Sora 2',
		provider: 'OpenAI',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	{
		name: 'sora-2-pro',
		displayName: 'Sora 2 Pro',
		provider: 'OpenAI',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	// Google Models
	{
		name: 'veo-3.1',
		displayName: 'Veo 3.1',
		provider: 'Google',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	{
		name: 'veo-3.1-fast',
		displayName: 'Veo 3.1 Fast',
		provider: 'Google',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	{
		name: 'veo-3',
		displayName: 'Veo 3',
		provider: 'Google',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	{
		name: 'veo-3-fast',
		displayName: 'Veo 3 Fast',
		provider: 'Google',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	{
		name: 'veo-2',
		displayName: 'Veo 2',
		provider: 'Google',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	// Luma Models
	{
		name: 'ray-2-720p',
		displayName: 'Ray 2 720p',
		provider: 'LumaLabs',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	{
		name: 'ray-2-540p',
		displayName: 'Ray 2 540p',
		provider: 'LumaLabs',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	{
		name: 'ray-flash-2-720p',
		displayName: 'Ray Flash 2 720p',
		provider: 'LumaLabs',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	{
		name: 'ray-flash-2-540p',
		displayName: 'Ray Flash 2 540p',
		provider: 'LumaLabs',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	{
		name: 'ray',
		displayName: 'Ray',
		provider: 'LumaLabs',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	// Bytedance Models
	{
		name: 'seedance-1.5-pro',
		displayName: 'SeeDance 1.5 Pro',
		provider: 'ByteDance',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	{
		name: 'seedance-1-pro',
		displayName: 'SeeDance 1 Pro',
		provider: 'ByteDance',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	{
		name: 'seedance-1-pro-fast',
		displayName: 'SeeDance 1 Pro Fast',
		provider: 'ByteDance',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	{
		name: 'seedance-1-lite',
		displayName: 'SeeDance 1 Lite',
		provider: 'ByteDance',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	// Alibaba/Wan Models
	{
		name: 'wan-2.6-t2v',
		displayName: 'Wan 2.6 T2V',
		provider: 'Alibaba',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	{
		name: 'wan-2.5-t2v',
		displayName: 'Wan 2.5 T2V',
		provider: 'Alibaba',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	{
		name: 'wan-2.5-t2v-fast',
		displayName: 'Wan 2.5 T2V Fast',
		provider: 'Alibaba',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	{
		name: 'wan-2.6-i2v',
		displayName: 'Wan 2.6 I2V',
		provider: 'Alibaba',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	{
		name: 'wan-2.5-i2v',
		displayName: 'Wan 2.5 I2V',
		provider: 'Alibaba',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	{
		name: 'wan-2.5-i2v-fast',
		displayName: 'Wan 2.5 I2V Fast',
		provider: 'Alibaba',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	{
		name: 'wan-2.2-5b-fast',
		displayName: 'Wan 2.2 5b Fast',
		provider: 'Alibaba',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	// LeonardoAI Models
	{
		name: 'motion-2.0',
		displayName: 'Motion 2.0',
		provider: 'LeonardoAI',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	// MiniMax Models
	{
		name: 'hailuo-2.3',
		displayName: 'Hailuo 2.3',
		provider: 'MiniMax',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	// Pixverse Models
	{
		name: 'pixverse-v5',
		displayName: 'Pixverse v5',
		provider: 'Pixverse',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	{
		name: 'pixverse-v4.5',
		displayName: 'Pixverse v4.5',
		provider: 'Pixverse',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	{
		name: 'pixverse-v4',
		displayName: 'Pixverse v4',
		provider: 'Pixverse',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	// KlingAI Models
	{
		name: 'kling-v2.6',
		displayName: 'Kling 2.6',
		provider: 'KlingAI',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	{
		name: 'kling-v2.5-turbo-pro',
		displayName: 'Kling 2.5 Turbo Pro',
		provider: 'KlingAI',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	{
		name: 'kling-v2.1',
		displayName: 'Kling 2.1',
		provider: 'KlingAI',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	{
		name: 'kling-v2.1-master',
		displayName: 'Kling 2.1 Master',
		provider: 'KlingAI',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	},
	{
		name: 'kling-v2.0',
		displayName: 'Kling 2.0',
		provider: 'KlingAI',
		maxTokens: 4096,
		supportsTextInput: true,
		supportsImageInput: true,
		supportsVideoGeneration: true,
		supportsStreaming: false,
	}
];


/**
 * Infer MIME type from file path extension
 */
function inferMimeTypeFromPath(path: string): string {
	const ext = path.split('.').pop()?.toLowerCase();
	const mimeTypes: Record<string, string> = {
		'jpg': 'image/jpeg',
		'jpeg': 'image/jpeg',
		'png': 'image/png',
		'gif': 'image/gif',
		'webp': 'image/webp'
	};
	return mimeTypes[ext || ''] || 'image/jpeg';
}

/**
 * Fetch image from storage and convert to data URI for Replicate input
 */
async function fetchImageAsDataUri(imageUrl: string): Promise<string> {
	// Case 1: Internal API path (format: /api/images/[id])
	const imageIdMatch = imageUrl.match(/\/api\/images\/([a-f0-9-]+)/i);
	if (imageIdMatch) {
		const imageId = imageIdMatch[1];

		// Fetch image metadata from database
		const [imageRecord] = await db
			.select()
			.from(images)
			.where(eq(images.id, imageId));

		if (!imageRecord || !imageRecord.cloudPath) {
			throw new Error('Image not found');
		}

		// Download image from storage
		const imageBuffer = await storageService.download(imageRecord.cloudPath);

		// Convert to base64
		const base64 = Buffer.from(imageBuffer).toString('base64');
		const mimeType = imageRecord.mimeType || 'image/jpeg';

		// Return data URI
		return `data:${mimeType};base64,${base64}`;
	}

	// Case 2: Local storage path (handles both legacy /static/uploads/ and new /uploads/ formats)
	if (imageUrl.startsWith('/static/') || imageUrl.startsWith('/uploads/')) {
		try {
			// Extract storage path from URL
			// Legacy format: /static/uploads/{userId}/images/generated/{filename}
			// New format: /uploads/{userId}/images/generated/{filename}
			// Storage path: {userId}/images/generated/{filename}
			let storagePath = imageUrl;
			if (storagePath.startsWith('/static/uploads/')) {
				storagePath = storagePath.replace('/static/uploads/', '');
			} else if (storagePath.startsWith('/uploads/')) {
				storagePath = storagePath.replace('/uploads/', '');
			}

			// Download from storage service
			const imageBuffer = await storageService.download(storagePath);

			// Convert to base64
			const base64 = Buffer.from(imageBuffer).toString('base64');

			// Infer MIME type from file extension
			const mimeType = inferMimeTypeFromPath(imageUrl);

			// Return data URI
			return `data:${mimeType};base64,${base64}`;
		} catch (error) {
			throw new Error(`Failed to load local image: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	// Case 3: External URL (presigned R2 URL, https:// URL)
	if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
		try {
			// Fetch the image from the URL
			const response = await fetch(imageUrl);

			if (!response.ok) {
				throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
			}

			// Get the image data as array buffer
			const arrayBuffer = await response.arrayBuffer();

			// Convert to base64
			const base64 = Buffer.from(arrayBuffer).toString('base64');

			// Get MIME type from response headers or default to image/jpeg
			const contentType = response.headers.get('content-type') || 'image/jpeg';

			// Return data URI
			return `data:${contentType};base64,${base64}`;
		} catch (error) {
			throw new Error(`Failed to fetch image from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	// If none of the formats match, throw error
	throw new Error('Invalid image URL format');
}

/**
 * Convert FileOutput or URL to base64 data
 */
async function fileOutputToBase64(output: any): Promise<string> {
	// If it's already a string, it might be base64 or a URL
	if (typeof output === 'string') {
		// If it starts with http, fetch it
		if (output.startsWith('http://') || output.startsWith('https://')) {
			const response = await fetch(output);
			const arrayBuffer = await response.arrayBuffer();
			return Buffer.from(arrayBuffer).toString('base64');
		}
		// Otherwise assume it's already base64
		return output;
	}

	// If it's a FileOutput ReadableStream, read it
	if (output && typeof output === 'object' && 'url' in output) {
		// FileOutput has a url() method
		const url = typeof output.url === 'function' ? output.url() : output.url;
		const response = await fetch(url);
		const arrayBuffer = await response.arrayBuffer();
		return Buffer.from(arrayBuffer).toString('base64');
	}

	// If it's a Blob or has arrayBuffer method
	if (output && typeof output.arrayBuffer === 'function') {
		const arrayBuffer = await output.arrayBuffer();
		return Buffer.from(arrayBuffer).toString('base64');
	}

	throw new Error('Unsupported output format from Replicate');
}

/**
 * Generate image using Replicate
 */
async function generateImage(params: ImageGenerationParams): Promise<AIImageResponse> {
	const client = await getClient();
	const modelIdentifier = MODEL_IDENTIFIERS[params.model]?.path;

	if (!modelIdentifier) {
		throw new Error(`Unknown Replicate model: ${params.model}`);
	}

	if (!params.userId) {
		throw new Error('User ID is required for image generation');
	}

	try {
		// Get model configuration
		const modelConfig = MODEL_CONFIGS[params.model];

		// Prepare input based on model
		const input: Record<string, any> = {
			prompt: params.prompt
		};

		// Add image input if provided and model supports it
		if ((params.imageUrl || params.imageUrls) && modelConfig?.imageInputParam) {
			const { name, isArray, needsDataUri } = modelConfig.imageInputParam;

			try {
				// Determine which URLs to use (prefer imageUrls array, fallback to single imageUrl)
				const urls: string[] = params.imageUrls && params.imageUrls.length > 0
					? params.imageUrls
					: (params.imageUrl ? [params.imageUrl] : []);

				if (urls.length > 0) {
					let imageData: string | string[];

					if (isArray && needsDataUri) {
						// Model supports multiple images as data URIs
						const dataUris: string[] = [];
						for (const url of urls) {
							const isInternalPath = url.startsWith('/api/images/') || url.startsWith('/static/') || url.startsWith('/uploads/');
							if (needsDataUri || isInternalPath) {
								const dataUri = await fetchImageAsDataUri(url);
								dataUris.push(dataUri);
							} else {
								dataUris.push(url);
							}
						}
						imageData = dataUris;
					} else if (isArray && !needsDataUri) {
						// Model supports multiple images as URLs
						imageData = urls;
					} else {
						// Single image mode (use first URL only)
						const url = urls[0];
						const isInternalPath = url.startsWith('/api/images/') || url.startsWith('/static/') || url.startsWith('/uploads/');
						if (needsDataUri || isInternalPath) {
							const dataUri = await fetchImageAsDataUri(url);
							imageData = dataUri;
						} else {
							imageData = url;
						}
					}

					input[name] = imageData;
				}
			} catch (error) {
				console.error('Failed to process image input:', error);
				throw new Error(`Failed to process input image: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}

		// Add aspect ratio if provided and model supports it
		if (params.size && modelConfig?.sizeParam) {
			const { name } = modelConfig.sizeParam;
			input[name] = params.size;
		}

		// Add seed if provided and model supports it
		if (params.seed !== undefined && modelConfig?.seedParam) {
			const { name } = modelConfig.seedParam;
			input[name] = params.seed;
		}

		// Add quality if provided and model supports it
		if (params.quality && modelConfig?.qualityParam) {
			const { name, options } = modelConfig.qualityParam;
			// Validate that the quality value is in the allowed options
			if (options.includes(params.quality)) {
				input[name] = params.quality;
			}
		}

		// Add number of images if provided and model supports it
		if (params.numberOfImages !== undefined && modelConfig?.numberOfImagesParam) {
			const { name, min, max } = modelConfig.numberOfImagesParam;
			// Clamp the value within the allowed range
			const clampedValue = Math.max(min, Math.min(max, params.numberOfImages));
			input[name] = clampedValue;
		}

		// Add style if provided and model supports it
		if (params.style && modelConfig?.styleParam) {
			const { name, options } = modelConfig.styleParam;
			// Validate that the style value is in the allowed options
			if (options.includes(params.style)) {
				input[name] = params.style;
			}
		}

		// Add upscale factor if provided and model supports it
		if (params.upscaleFactor && modelConfig?.upscaleParam) {
			const { name, options } = modelConfig.upscaleParam;
			// Validate that the upscale factor is in the allowed options
			if (options.includes(params.upscaleFactor)) {
				input[name] = params.upscaleFactor;
			}
		}

		// Add compression quality if provided and model supports it
		if (params.compressionQuality !== undefined && modelConfig?.compressionParam) {
			const { name, min, max } = modelConfig.compressionParam;
			// Clamp the value within the allowed range
			const clampedValue = Math.max(min, Math.min(max, params.compressionQuality));
			input[name] = clampedValue;
		}

		// Run the model (assert type as Replicate expects owner/model format)
		const output = await client.run(modelIdentifier as `${string}/${string}`, { input });

		// Handle output (could be array of URLs or FileOutput objects)
		let primaryImageId: string;

		// Determine reference URL(s) for metadata storage
		// Store as JSON array if multiple URLs, single URL otherwise for backward compatibility
		const referenceImageUrlForMetadata = params.imageUrls && params.imageUrls.length > 1
			? JSON.stringify(params.imageUrls)
			: (params.imageUrls?.[0] || params.imageUrl || undefined);

		if (Array.isArray(output) && output.length > 0) {
			// Save all images in the array
			for (let i = 0; i < output.length; i++) {
				const imageData = await fileOutputToBase64(output[i]);
				const imageId = await saveImageAndGetId(
					imageData,
					'image/png', // Replicate typically returns PNG
					params.userId,
					params.chatId,
					{
						prompt: params.prompt,
						model: params.model,
						aspectRatio: params.size,
						seed: params.seed,
						quality: params.quality,
						style: params.style,
						numberOfImages: params.numberOfImages,
						referenceImageUrl: referenceImageUrlForMetadata,
						upscaleFactor: params.upscaleFactor,
						compressionQuality: params.compressionQuality
					}
				);
				// Keep track of the first image ID for the response
				if (i === 0) {
					primaryImageId = imageId;
				}
			}
		} else if (output) {
			const imageData = await fileOutputToBase64(output);
			primaryImageId = await saveImageAndGetId(
				imageData,
				'image/png', // Replicate typically returns PNG
				params.userId,
				params.chatId,
				{
					prompt: params.prompt,
					model: params.model,
					aspectRatio: params.size,
					seed: params.seed,
					quality: params.quality,
					style: params.style,
					numberOfImages: params.numberOfImages,
					referenceImageUrl: referenceImageUrlForMetadata,
					upscaleFactor: params.upscaleFactor,
					compressionQuality: params.compressionQuality
				}
			);
		} else {
			throw new Error('No output received from Replicate');
		}

		return {
			imageId: primaryImageId!,
			mimeType: 'image/png',
			prompt: params.prompt,
			model: params.model,
			usage: {
				promptTokens: Math.ceil(params.prompt.length / 4),
				totalTokens: Math.ceil(params.prompt.length / 4)
			}
		};
	} catch (error) {
		throw createProviderError('Replicate', 'image generation', error);
	}
}

/**
 * Generate video using Replicate
 */
async function generateVideo(params: VideoGenerationParams): Promise<AIVideoResponse> {
	const client = await getClient();
	const modelIdentifier = MODEL_IDENTIFIERS[params.model]?.path;

	if (!modelIdentifier) {
		throw new Error(`Unknown Replicate video model: ${params.model}`);
	}

	if (!params.userId) {
		throw new Error('User ID is required for video generation');
	}

	try {
		// Get model configuration
		const modelConfig = MODEL_CONFIGS[params.model];

		// Prepare input based on model
		const input: Record<string, any> = {
			prompt: params.prompt
		};

		// Add image input if provided and model supports it (for i2v models)
		if (params.imageUrl && modelConfig?.imageInputParam) {
			const { name, isArray, needsDataUri } = modelConfig.imageInputParam;

			try {
				// Fetch/convert image based on model requirements
				let imageData: string | string[];

				// Check if it's an internal path that needs conversion
				const isInternalPath = params.imageUrl.startsWith('/api/images/') ||
					params.imageUrl.startsWith('/static/') ||
					params.imageUrl.startsWith('/uploads/');

				if (needsDataUri || isInternalPath) {
					// Convert to data URI
					// - Always for models that require it
					// - Also for internal paths (e.g., /api/images/[id]) as fallback for backward compatibility
					const dataUri = await fetchImageAsDataUri(params.imageUrl);
					imageData = isArray ? [dataUri] : dataUri;
				} else {
					// Use URL as-is for external URLs (e.g., presigned R2 URLs, https:// URLs)
					imageData = isArray ? [params.imageUrl] : params.imageUrl;
				}

				input[name] = imageData;
			} catch (error) {
				console.error('Failed to process image input for video:', error);
				throw new Error(`Failed to process input image: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}

		// Add duration if provided and model supports it via durationParam config
		if (params.duration !== undefined && modelConfig?.durationParam) {
			const { name, min, max, unit } = modelConfig.durationParam;
			// Clamp the value within the allowed range
			let durationValue = Math.max(min, Math.min(max, params.duration));
			// Convert to frames if model expects frames
			if (unit === 'frames') {
				durationValue = Math.round(durationValue * (params.fps || 24));
			}
			input[name] = durationValue;
		} else if (params.duration) {
			// Fallback for models without durationParam config (backwards compatibility)
			input.duration = params.duration;
		}

		// Add aspect ratio if provided and model supports it
		if (params.resolution && modelConfig?.sizeParam) {
			const { name } = modelConfig.sizeParam;
			input[name] = params.resolution;
		}
		if (params.fps) {
			input.fps = params.fps;
		}

		// Add seed if provided and model supports it
		if (params.seed !== undefined && modelConfig?.seedParam) {
			const { name } = modelConfig.seedParam;
			input[name] = params.seed;
		}

		// Add quality if provided and model supports it
		if (params.quality && modelConfig?.qualityParam) {
			const { name, options } = modelConfig.qualityParam;
			// Validate that the quality value is in the allowed options
			if (options.includes(params.quality)) {
				input[name] = params.quality;
			}
		}

		// Add style if provided and model supports it
		if (params.style && modelConfig?.styleParam) {
			const { name, options } = modelConfig.styleParam;
			// Validate that the style value is in the allowed options
			if (options.includes(params.style)) {
				input[name] = params.style;
			}
		}

		// Add start image if provided and model supports it
		if (params.imageStartUrl && modelConfig?.imageStartParam) {
			const { name, isArray, needsDataUri } = modelConfig.imageStartParam;

			try {
				let imageData: string | string[];

				const isInternalPath = params.imageStartUrl.startsWith('/api/images/') ||
					params.imageStartUrl.startsWith('/static/') ||
					params.imageStartUrl.startsWith('/uploads/');

				if (needsDataUri || isInternalPath) {
					const dataUri = await fetchImageAsDataUri(params.imageStartUrl);
					imageData = isArray ? [dataUri] : dataUri;
				} else {
					imageData = isArray ? [params.imageStartUrl] : params.imageStartUrl;
				}

				input[name] = imageData;
			} catch (error) {
				console.error('Failed to process start image input for video:', error);
				throw new Error(`Failed to process start image: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}

		// Add end image if provided and model supports it
		if (params.imageEndUrl && modelConfig?.imageEndParam) {
			const { name, isArray, needsDataUri } = modelConfig.imageEndParam;

			try {
				let imageData: string | string[];

				const isInternalPath = params.imageEndUrl.startsWith('/api/images/') ||
					params.imageEndUrl.startsWith('/static/') ||
					params.imageEndUrl.startsWith('/uploads/');

				if (needsDataUri || isInternalPath) {
					const dataUri = await fetchImageAsDataUri(params.imageEndUrl);
					imageData = isArray ? [dataUri] : dataUri;
				} else {
					imageData = isArray ? [params.imageEndUrl] : params.imageEndUrl;
				}

				input[name] = imageData;
			} catch (error) {
				console.error('Failed to process end image input for video:', error);
				throw new Error(`Failed to process end image: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}

		// Run the model (assert type as Replicate expects owner/model format)
		const output = await client.run(modelIdentifier as `${string}/${string}`, { input });

		// Handle output
		let videoData: string;

		if (Array.isArray(output) && output.length > 0) {
			videoData = await fileOutputToBase64(output[0]);
		} else if (output) {
			videoData = await fileOutputToBase64(output);
		} else {
			throw new Error('No output received from Replicate');
		}

		// Determine if video has audio based on model
		const hasAudio = params.model.includes('veo') || params.model.includes('wan') || params.model.includes('hailuo');

		// Save to storage and database with generation metadata
		const videoId = await saveVideoAndGetId(
			videoData,
			'video/mp4', // Replicate typically returns MP4
			params.userId,
			params.chatId,
			params.duration || 8,
			params.resolution || '720p',
			params.fps || 24,
			hasAudio,
			{
				prompt: params.prompt,
				model: params.model,
				aspectRatio: params.resolution,
				seed: params.seed,
				quality: params.quality,
				style: params.style,
				imageStartUrl: params.imageUrl,
				imageEndUrl: params.imageEndUrl
			}
		);

		return {
			videoId,
			mimeType: 'video/mp4',
			prompt: params.prompt,
			model: params.model,
			duration: params.duration || 8,
			resolution: params.resolution || '720p',
			fps: params.fps || 24,
			hasAudio,
			usage: {
				promptTokens: Math.ceil(params.prompt.length / 4),
				totalTokens: Math.ceil(params.prompt.length / 4)
			}
		};
	} catch (error) {
		throw createProviderError('Replicate', 'video generation', error);
	}
}

/**
 * Placeholder chat method (not used for Replicate, but required by interface)
 */
async function chat(params: {
	model: string;
	messages: AIMessage[];
	maxTokens?: number;
	temperature?: number;
	stream?: boolean;
}): Promise<AIResponse | AsyncIterableIterator<AIStreamChunk>> {
	throw new Error('Replicate provider does not support text chat. Use OpenRouter instead.');
}

// Export the Replicate provider
export const replicateProvider: AIProvider = {
	name: 'Replicate',
	models: [...REPLICATE_IMAGE_MODELS, ...REPLICATE_VIDEO_MODELS],
	chat,
	generateImage,
	generateVideo
};
