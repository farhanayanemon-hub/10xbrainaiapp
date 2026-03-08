/**
 * Model metadata for image and video generation models.
 * Provides descriptions, categories, and optional badges for UI display.
 */

export interface ModelMetadata {
	description: string;
	categories: string[];
	isNew?: boolean;
}

/**
 * Image model categories
 */
export const IMAGE_CATEGORIES = ['All', 'Realistic', 'Creative', 'Fast', 'Editing', 'Upscaling'] as const;
export type ImageCategory = (typeof IMAGE_CATEGORIES)[number];

/**
 * Video model categories
 */
export const VIDEO_CATEGORIES = ['All', 'Realistic', 'Fast', 'HD', 'Cinematic'] as const;
export type VideoCategory = (typeof VIDEO_CATEGORIES)[number];

/**
 * Image model metadata
 */
export const IMAGE_MODEL_METADATA: Record<string, ModelMetadata> = {
	// OpenAI Models
	'gpt-image-1.5': {
		description: 'Latest GPT image model with strong prompt adherence and fast generation',
		categories: ['Realistic', 'Creative', 'Editing'],
		isNew: true
	},
	'dall-e-3': {
		description: 'High-quality image generation with vivid or natural styles',
		categories: ['Realistic', 'Creative']
	},
	'dall-e-2': {
		description: 'Classic DALL-E model for reliable image generation',
		categories: ['Creative', 'Fast']
	},

	// Google Models
	'nano-banana-pro': {
		description: 'Google\'s premium model with up to 4K resolution and multi-image editing',
		categories: ['Realistic', 'Upscaling', 'Editing'],
		isNew: true
	},
	'nano-banana': {
		description: 'Google\'s versatile image model with aspect ratio matching',
		categories: ['Realistic', 'Fast']
	},
	'imagen-4': {
		description: 'Google\'s latest Imagen with photorealistic quality',
		categories: ['Realistic', 'Creative'],
		isNew: true
	},
	'imagen-4-ultra': {
		description: 'Highest quality Imagen model for professional results',
		categories: ['Realistic', 'Upscaling']
	},
	'imagen-4-fast': {
		description: 'Optimized Imagen for faster generation with great quality',
		categories: ['Fast', 'Realistic']
	},
	'imagen-3': {
		description: 'Reliable Imagen model with consistent quality',
		categories: ['Realistic', 'Creative']
	},
	'imagen-3-fast': {
		description: 'Quick Imagen generation for rapid prototyping',
		categories: ['Fast', 'Realistic']
	},

	// Black Forest Labs (FLUX) Models
	'flux-2-max': {
		description: 'Maximum quality FLUX with up to 4MP resolution and image editing',
		categories: ['Realistic', 'Upscaling', 'Editing'],
		isNew: true
	},
	'flux-2-pro': {
		description: 'Professional FLUX model with advanced resolution options',
		categories: ['Realistic', 'Upscaling', 'Editing']
	},
	'flux-2-flex': {
		description: 'Flexible FLUX model for versatile image generation',
		categories: ['Creative', 'Editing']
	},
	'flux-2-dev': {
		description: 'Developer-focused FLUX with extensive customization',
		categories: ['Creative', 'Editing']
	},
	'flux-krea-dev': {
		description: 'FLUX variant optimized for creative workflows',
		categories: ['Creative', 'Fast']
	},
	'flux-1.1-pro': {
		description: 'Stable FLUX pro model with reliable quality',
		categories: ['Realistic', 'Creative']
	},
	'flux-1.1-pro-ultra': {
		description: 'Ultra-quality FLUX for premium image generation',
		categories: ['Realistic', 'Upscaling']
	},
	'flux-kontext-pro': {
		description: 'Context-aware FLUX for coherent image editing',
		categories: ['Editing', 'Creative']
	},
	'flux-kontext-max': {
		description: 'Maximum context FLUX for complex image manipulations',
		categories: ['Editing', 'Upscaling']
	},
	'flux-schnell': {
		description: 'Lightning-fast FLUX for rapid iterations',
		categories: ['Fast', 'Creative']
	},

	// Stability AI Models
	'stable-diffusion-3.5-large': {
		description: 'Large SD3.5 model with excellent detail and composition',
		categories: ['Realistic', 'Creative']
	},
	'stable-diffusion-3.5-large-turbo': {
		description: 'Faster SD3.5 large with turbo optimization',
		categories: ['Fast', 'Realistic']
	},
	'stable-diffusion-3.5-medium': {
		description: 'Balanced SD3.5 for quality and speed',
		categories: ['Creative', 'Fast']
	},
	'stable-diffusion-3': {
		description: 'Core Stable Diffusion 3 with improved aesthetics',
		categories: ['Creative', 'Realistic']
	},

	// Luma Models
	'photon-1': {
		description: 'Photorealistic image generation with reference support',
		categories: ['Realistic', 'Editing']
	},
	'photon-flash-1': {
		description: 'Fast photorealistic generation with Luma quality',
		categories: ['Fast', 'Realistic']
	},

	// ByteDance Models
	'seedream-4.5': {
		description: 'Up to 4K resolution with multi-image editing capabilities',
		categories: ['Upscaling', 'Editing'],
		isNew: true
	},
	'seedream-4': {
		description: 'High-quality generation with extensive customization',
		categories: ['Realistic', 'Upscaling', 'Editing']
	},
	'seedream-3': {
		description: 'Reliable ByteDance model with quality presets',
		categories: ['Creative', 'Realistic']
	},
	'dreamina-3.1': {
		description: 'ByteDance creative model with resolution options',
		categories: ['Creative', 'Upscaling']
	},

	// Alibaba Models
	'wan-2.2-image': {
		description: 'Alibaba\'s image model with good prompt following',
		categories: ['Creative', 'Realistic']
	},
	'qwen-image-2512': {
		description: 'Qwen-based image generation with editing support',
		categories: ['Creative', 'Editing']
	},

	// Tencent Models
	'hunyuan-image-3': {
		description: 'Latest Hunyuan with improved quality and diversity',
		categories: ['Realistic', 'Creative'],
		isNew: true
	},
	'hunyuan-image-2.1': {
		description: 'Stable Hunyuan model for consistent results',
		categories: ['Creative', 'Realistic']
	},

	// xAI Models
	'grok-2-image': {
		description: 'xAI\'s image generation with unique style',
		categories: ['Creative', 'Realistic']
	},

	// LeonardoAI Models
	'lucid-origin': {
		description: 'Versatile model with 20+ style presets',
		categories: ['Creative', 'Realistic']
	},
	'phoenix-1.0': {
		description: 'Professional model with extensive style options',
		categories: ['Creative', 'Realistic']
	},

	// IdeogramAI Models
	'ideogram-v3-quality': {
		description: 'Premium quality with excellent text rendering',
		categories: ['Realistic', 'Creative'],
		isNew: true
	},
	'ideogram-v3-balanced': {
		description: 'Balanced quality and speed with text capabilities',
		categories: ['Creative', 'Realistic']
	},
	'ideogram-v3-turbo': {
		description: 'Fast generation with good text rendering',
		categories: ['Fast', 'Creative']
	},
	'ideogram-v2': {
		description: 'Reliable Ideogram with 3D render and anime styles',
		categories: ['Creative', 'Realistic']
	},
	'ideogram-v2-turbo': {
		description: 'Fast Ideogram v2 for quick iterations',
		categories: ['Fast', 'Creative']
	},

	// Google Upscaler
	'upscaler': {
		description: 'Upscale images to 2x or 4x resolution with adjustable quality',
		categories: ['Upscaling'],
		isNew: true
	}
};

/**
 * Video model metadata
 */
export const VIDEO_MODEL_METADATA: Record<string, ModelMetadata> = {
	// OpenAI Models
	'sora-2': {
		description: 'OpenAI\'s video model with portrait/landscape support',
		categories: ['Realistic', 'Cinematic'],
		isNew: true
	},
	'sora-2-pro': {
		description: 'Premium Sora with high resolution and extended duration',
		categories: ['HD', 'Cinematic'],
		isNew: true
	},

	// Google Models
	'veo-3.1': {
		description: 'Latest Veo with 1080p and end frame support',
		categories: ['HD', 'Realistic'],
		isNew: true
	},
	'veo-3.1-fast': {
		description: 'Faster Veo 3.1 for quick video generation',
		categories: ['Fast', 'HD']
	},
	'veo-3': {
		description: 'Google\'s premium video model with audio support',
		categories: ['HD', 'Cinematic']
	},
	'veo-3-fast': {
		description: 'Optimized Veo 3 for faster generation',
		categories: ['Fast', 'Realistic']
	},
	'veo-2': {
		description: 'Reliable Veo model with consistent quality',
		categories: ['Realistic', 'HD']
	},

	// Luma Models
	'ray-2-720p': {
		description: 'High-quality Ray model with start/end frame control',
		categories: ['Realistic', 'Cinematic']
	},
	'ray-2-540p': {
		description: 'Balanced Ray for quality and speed at 540p',
		categories: ['Fast', 'Realistic']
	},
	'ray-flash-2-720p': {
		description: 'Fast Ray generation at 720p with frame control',
		categories: ['Fast', 'Realistic']
	},
	'ray-flash-2-540p': {
		description: 'Lightning-fast Ray for rapid iterations',
		categories: ['Fast']
	},
	'ray': {
		description: 'Classic Ray model with reliable generation',
		categories: ['Realistic', 'Cinematic']
	},

	// ByteDance Models
	'seedance-1.5-pro': {
		description: 'Latest Seedance with extended duration and end frame',
		categories: ['HD', 'Cinematic'],
		isNew: true
	},
	'seedance-1-pro': {
		description: 'Professional quality with up to 1080p resolution',
		categories: ['HD', 'Realistic']
	},
	'seedance-1-pro-fast': {
		description: 'Fast Seedance for quick video generation',
		categories: ['Fast', 'HD']
	},
	'seedance-1-lite': {
		description: 'Lightweight Seedance for efficient generation',
		categories: ['Fast', 'Realistic']
	},

	// Alibaba/Wan Models
	'wan-2.6-t2v': {
		description: 'Latest Wan text-to-video with up to 1080p',
		categories: ['HD', 'Realistic'],
		isNew: true
	},
	'wan-2.5-t2v': {
		description: 'Reliable Wan text-to-video with quality options',
		categories: ['HD', 'Realistic']
	},
	'wan-2.5-t2v-fast': {
		description: 'Fast Wan for quick text-to-video generation',
		categories: ['Fast', 'Realistic']
	},
	'wan-2.6-i2v': {
		description: 'Latest Wan image-to-video with 1080p support',
		categories: ['HD', 'Realistic'],
		isNew: true
	},
	'wan-2.5-i2v': {
		description: 'Reliable Wan image-to-video conversion',
		categories: ['Realistic', 'HD']
	},
	'wan-2.5-i2v-fast': {
		description: 'Fast Wan image-to-video for quick results',
		categories: ['Fast', 'Realistic']
	},
	'wan-2.2-5b-fast': {
		description: 'Lightweight 5B model for fast generation',
		categories: ['Fast']
	},

	// LeonardoAI Models
	'motion-2.0': {
		description: 'Image animation with aspect ratio control',
		categories: ['Cinematic', 'Realistic']
	},

	// MiniMax Models
	'hailuo-2.3': {
		description: 'A high-fidelity model for generating realistic motion',
		categories: ['Cinematic', 'Realistic', 'HD']
	},

	// Pixverse Models
	'pixverse-v5': {
		description: 'Latest Pixverse with 1080p and end frame support',
		categories: ['HD', 'Cinematic'],
		isNew: true
	},
	'pixverse-v4.5': {
		description: 'Pixverse with anime, 3D, and cyberpunk styles',
		categories: ['Cinematic', 'Realistic']
	},
	'pixverse-v4': {
		description: 'Reliable Pixverse with style presets',
		categories: ['Realistic', 'Cinematic']
	},

	// KlingAI Models
	'kling-v2.6': {
		description: 'Latest Kling with improved quality',
		categories: ['Realistic', 'Cinematic'],
		isNew: true
	},
	'kling-v2.5-turbo-pro': {
		description: 'Fast turbo mode with end frame support',
		categories: ['Fast', 'Realistic']
	},
	'kling-v2.1': {
		description: 'Reliable Kling with start/end frame control',
		categories: ['Realistic', 'Cinematic']
	},
	'kling-v2.1-master': {
		description: 'Master quality Kling for premium results',
		categories: ['HD', 'Cinematic']
	},
	'kling-v2.0': {
		description: 'Classic Kling model with consistent output',
		categories: ['Realistic', 'Fast']
	}
};

/**
 * Get metadata for a model (image or video)
 */
export function getModelMetadata(modelName: string, type: 'image' | 'video'): ModelMetadata | null {
	const metadata = type === 'image' ? IMAGE_MODEL_METADATA : VIDEO_MODEL_METADATA;
	return metadata[modelName] || null;
}

/**
 * Check if a model matches a category
 */
export function modelMatchesCategory(modelName: string, category: string, type: 'image' | 'video'): boolean {
	if (category === 'All') return true;
	const metadata = getModelMetadata(modelName, type);
	return metadata?.categories.includes(category) ?? false;
}
