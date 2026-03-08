/**
 * Client-safe model parameter configurations for Replicate image and video generation models.
 * Single source of truth for model capabilities - used by both server (replicate.ts) and client (model-capabilities.ts).
 */

export interface ModelParamConfig {
	imageInputParam?: {
		name: string;          // Parameter name (e.g., "image", "image_input", "image_prompt", "image_reference")
		isArray: boolean;      // Whether to wrap in array
		needsDataUri: boolean; // Whether to convert to data URI (vs URL)
	};
	sizeParam?: {
		name: string;                           // Parameter name (e.g., "aspect_ratio")
		options: readonly string[];             // Per-model aspect ratio options (e.g., ['1:1', '16:9', '9:16'])
	};
	seedParam?: {
		name: string;          // Parameter name (e.g., "seed", "random_seed")
		type: 'integer';       // Type validation
	};
	qualityParam?: {
		name: string;                           // Parameter name (e.g., "quality", "resolution")
		options: readonly string[];             // Valid options (e.g., ['low', 'medium', 'high'] or ['720p', '1080p', '4K'])
	};
	numberOfImagesParam?: {
		name: string;          // Parameter name (e.g., "num_images", "n", "batch_size")
		min: number;           // Minimum value
		max: number;           // Maximum value
	};
	styleParam?: {
		name: string;                           // Parameter name (e.g., "style", "style_preset")
		options: readonly string[];             // Valid options (e.g., ['anime', 'photorealistic', 'digital-art'])
	};
	durationParam?: {
		name: string;          // Parameter name (e.g., "duration", "length", "video_length")
		min: number;           // Minimum duration
		max: number;           // Maximum duration
		unit: 'seconds' | 'frames';  // Whether the model expects seconds or frames
	};
	imageStartParam?: {
		name: string;          // Parameter name (e.g., "start_image", "first_frame", "image_start")
		isArray: boolean;      // Whether to wrap in array
		needsDataUri: boolean; // Whether to convert to data URI (vs URL)
	};
	imageEndParam?: {
		name: string;          // Parameter name (e.g., "end_image", "last_frame", "image_end")
		isArray: boolean;      // Whether to wrap in array
		needsDataUri: boolean; // Whether to convert to data URI (vs URL)
	};

	// IMAGE UPSCALERS SPECIFIC PARAMS
	upscaleParam?: {
		name: string;		   			// Parameter name (e.g., "upscale_factor", "upscaling", "upscaler")
		options: readonly string[];		// Per-model upscaling options (e.g., ['x2', 'x4'])
	};
	compressionParam?: {
		name: string;		   // Parameter name (e.g., "compression_quality", "compression", "compression_input")
		type: 'integer';
		min: number;		   // Minimum value
		max: number;		   // Maximum value
	}
}

export const MODEL_CONFIGS: Record<string, ModelParamConfig> = {
	// ===== IMAGE MODELS =====

	// OpenAI Models
	'gpt-image-1.5': {
		imageInputParam: { name: 'input_images', isArray: true, needsDataUri: true },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2'] },
		qualityParam: { name: 'quality', options: ['low', 'medium', 'high', 'auto'] },
		numberOfImagesParam: { name: 'number_of_images', min: 1, max: 10 }
	},
	'dall-e-3': {
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2'] },
		styleParam: { name: 'style', options: ['vivid', 'natural'] }
	},

	// Google Models
	'nano-banana-pro': {
		imageInputParam: { name: 'image_input', isArray: true, needsDataUri: true },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'] },
		qualityParam: { name: 'resolution', options: ['1K', '2K', '4K'] },
	},
	'nano-banana': {
		imageInputParam: { name: 'image_input', isArray: true, needsDataUri: true },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'] },
	},
	'imagen-4': {
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '3:4', '4:3', '9:16', '16:9'] },
	},
	'imagen-4-ultra': {
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '3:4', '4:3', '9:16', '16:9'] },
	},
	'imagen-4-fast': {
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '3:4', '4:3', '9:16', '16:9'] },
	},
	'imagen-3': {
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '3:4', '4:3', '9:16', '16:9'] },
	},
	'imagen-3-fast': {
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '3:4', '4:3', '9:16', '16:9'] },
	},

	// Black Forest Labs Models
	'flux-2-max': {
		imageInputParam: { name: 'input_images', isArray: true, needsDataUri: true },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' },
		qualityParam: { name: 'resolution', options: ['1 MP', '2 MP', '4 MP'] },
	},
	'flux-2-pro': {
		imageInputParam: { name: 'input_images', isArray: true, needsDataUri: true },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' },
		qualityParam: { name: 'resolution', options: ['1 MP', '2 MP', '4 MP'] },
	},
	'flux-2-flex': {
		imageInputParam: { name: 'input_images', isArray: true, needsDataUri: true },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' },
		qualityParam: { name: 'resolution', options: ['1 MP', '2 MP', '4 MP'] },
	},
	'flux-2-dev': {
		imageInputParam: { name: 'input_images', isArray: true, needsDataUri: true },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' }
	},
	'flux-krea-dev': {
		imageInputParam: { name: 'image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' },
		numberOfImagesParam: { name: 'num_outputs', min: 1, max: 4 }
	},
	'flux-1.1-pro': {
		imageInputParam: { name: 'image_prompt', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' }
	},
	'flux-1.1-pro-ultra': {
		imageInputParam: { name: 'image_prompt', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' }
	},
	'flux-kontext-pro': {
		imageInputParam: { name: 'input_image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' }
	},
	'flux-kontext-max': {
		imageInputParam: { name: 'input_image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' }
	},
	'flux-schnell': {
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' },
		numberOfImagesParam: { name: 'num_outputs', min: 1, max: 4 }
	},

	// Stability AI Models
	'stable-diffusion-3.5-large': {
		imageInputParam: { name: 'image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' }
	},
	'stable-diffusion-3.5-large-turbo': {
		imageInputParam: { name: 'image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' }
	},
	'stable-diffusion-3.5-medium': {
		imageInputParam: { name: 'image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' }
	},
	'stable-diffusion-3': {
		imageInputParam: { name: 'image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' }
	},

	// Luma Models
	'photon-1': {
		imageInputParam: { name: 'image_reference', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '3:4', '4:3', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' }
	},
	'photon-flash-1': {
		imageInputParam: { name: 'image_reference', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '3:4', '4:3', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' }
	},

	// Bytedance Models
	'seedream-4.5': {
		imageInputParam: { name: 'image_input', isArray: true, needsDataUri: true },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'] },
		qualityParam: { name: 'size', options: ['2K', '4K'] },
		numberOfImagesParam: { name: 'max_images', min: 1, max: 15 }
	},
	'seedream-4': {
		imageInputParam: { name: 'image_input', isArray: true, needsDataUri: true },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'] },
		qualityParam: { name: 'size', options: ['1K', '2K', '4K'] },
		numberOfImagesParam: { name: 'max_images', min: 1, max: 15 }
	},
	'seedream-3': {
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' },
		qualityParam: { name: 'size', options: ['small', 'regular', 'big'] },
	},
	'dreamina-3.1': {
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' },
		qualityParam: { name: 'resolution', options: ['1K', '2K'] },
	},

	// Alibaba/Wan Models
	'wan-2.2-image': {
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '3:4', '4:3', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' }
	},

	// Alibaba/Qwen Models
	'qwen-image-2512': {
		imageInputParam: { name: 'image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' }
	},

	// Tencent Models
	'hunyuan-image-3': {
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' }
	},
	'hunyuan-image-2.1': {
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' }
	},

	// LeonardoAI Models
	'lucid-origin': {
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'] },
		numberOfImagesParam: { name: 'num_images', min: 1, max: 8 },
		styleParam: {
			name: 'style', options: [
				'none',
				'bokeh',
				'cinematic',
				'cinematic_close_up',
				'creative',
				'dynamic',
				'fashion',
				'film',
				'food',
				'hdr',
				'long_exposure',
				'macro',
				'minimalist',
				'monochrome',
				'moody',
				'neutral',
				'none',
				'portrait',
				'retro',
				'stock_photo',
				'unprocessed',
				'vibrant'
			]
		}
	},
	'phoenix-1.0': {
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'] },
		numberOfImagesParam: { name: 'num_images', min: 1, max: 8 },
		styleParam: {
			name: 'style', options: [
				'none',
				'bokeh',
				'cinematic',
				'cinematic_concept',
				'creative',
				'dynamic',
				'fashion',
				'3d_render',
				'graphic_design_pop_art',
				'graphic_design_vector',
				'hdr',
				'illustration',
				'macro',
				'minimalist',
				'moody',
				'portrait',
				'pro_bw_photography',
				'pro_color_photography',
				'pro_film_photography',
				'portrait_fashion',
				'ray_traced',
				'sketch_bw',
				'sketch_color',
				'stock_photo',
				'vibrant'
			]
		}
	},

	// Ideogram Models
	'ideogram-v3-quality': {
		imageInputParam: { name: 'image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' },
		styleParam: { name: 'style_type', options: ['None', 'Auto', 'General', 'Realistic', 'Design'] }
	},
	'ideogram-v3-balanced': {
		imageInputParam: { name: 'image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' },
		styleParam: { name: 'style_type', options: ['None', 'Auto', 'General', 'Realistic', 'Design'] }
	},
	'ideogram-v3-turbo': {
		imageInputParam: { name: 'image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' },
		styleParam: { name: 'style_type', options: ['None', 'Auto', 'General', 'Realistic', 'Design'] }
	},
	'ideogram-v2': {
		imageInputParam: { name: 'image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' },
		styleParam: { name: 'style_type', options: ['None', 'Auto', 'General', 'Realistic', 'Design', 'Render 3D', 'Anime'] }
	},
	'ideogram-v2-turbo': {
		imageInputParam: { name: 'image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' },
		styleParam: { name: 'style_type', options: ['None', 'Auto', 'General', 'Realistic', 'Design', 'Render 3D', 'Anime'] }
	},
	// ===== IMAGE UPSCALERS =====

	'upscaler': {
		imageInputParam: { name: 'image', isArray: false, needsDataUri: false },
		upscaleParam: { name: 'upscale_factor', options: ['x2', 'x4'] },
		compressionParam: { name: 'compression_quality', min: 1, max: 100, type: 'integer' }
	},

	// ===== VIDEO MODELS =====

	// OpenAI models
	'sora-2': {
		imageInputParam: { name: 'input_reference', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['portrait', 'landscape'] },
		durationParam: { name: 'seconds', min: 4, max: 12, unit: 'seconds' }
	},
	'sora-2-pro': {
		imageInputParam: { name: 'input_reference', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['portrait', 'landscape'] },
		qualityParam: { name: 'resolution', options: ['standard', 'high'] },
		durationParam: { name: 'seconds', min: 4, max: 12, unit: 'seconds' }
	},

	// Google models
	'veo-3.1': {
		imageInputParam: { name: 'image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' },
		qualityParam: { name: 'resolution', options: ['720p', '1080p'] },
		durationParam: { name: 'duration', min: 4, max: 8, unit: 'seconds' },
		imageEndParam: { name: 'last_frame', isArray: false, needsDataUri: false }
	},
	'veo-3.1-fast': {
		imageInputParam: { name: 'image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' },
		qualityParam: { name: 'resolution', options: ['720p', '1080p'] },
		durationParam: { name: 'duration', min: 4, max: 8, unit: 'seconds' },
		imageEndParam: { name: 'last_frame', isArray: false, needsDataUri: false }
	},
	'veo-3': {
		imageInputParam: { name: 'image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' },
		qualityParam: { name: 'resolution', options: ['720p', '1080p'] },
		durationParam: { name: 'duration', min: 4, max: 8, unit: 'seconds' },
	},
	'veo-3-fast': {
		imageInputParam: { name: 'image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' },
		qualityParam: { name: 'resolution', options: ['720p', '1080p'] },
		durationParam: { name: 'duration', min: 4, max: 8, unit: 'seconds' },
	},
	'veo-2': {
		imageInputParam: { name: 'image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' },
		durationParam: { name: 'duration', min: 5, max: 8, unit: 'seconds' },
	},

	// Luma models
	'ray-2-720p': {
		imageInputParam: { name: 'start_image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '3:4', '4:3', '9:16', '16:9'] },
		durationParam: { name: 'duration', min: 5, max: 9, unit: 'seconds' },
		imageEndParam: { name: 'end_image', isArray: false, needsDataUri: false }
	},
	'ray-2-540p': {
		imageInputParam: { name: 'start_image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '3:4', '4:3', '9:16', '16:9'] },
		durationParam: { name: 'duration', min: 5, max: 9, unit: 'seconds' },
		imageEndParam: { name: 'end_image', isArray: false, needsDataUri: false }
	},
	'ray-flash-2-720p': {
		imageInputParam: { name: 'start_image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '3:4', '4:3', '9:16', '16:9'] },
		durationParam: { name: 'duration', min: 5, max: 9, unit: 'seconds' },
		imageEndParam: { name: 'end_image', isArray: false, needsDataUri: false }
	},
	'ray-flash-2-540p': {
		imageInputParam: { name: 'start_image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '3:4', '4:3', '9:16', '16:9'] },
		durationParam: { name: 'duration', min: 5, max: 9, unit: 'seconds' },
		imageEndParam: { name: 'end_image', isArray: false, needsDataUri: false }
	},
	'ray': {
		imageInputParam: { name: 'start_image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '3:4', '4:3', '9:16', '16:9'] },
		imageEndParam: { name: 'end_image', isArray: false, needsDataUri: false }
	},

	// ByteDance models
	'seedance-1.5-pro': {
		imageInputParam: { name: 'image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '3:4', '4:3', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' },
		durationParam: { name: 'duration', min: 2, max: 12, unit: 'seconds' },
		imageEndParam: { name: 'last_frame_image', isArray: false, needsDataUri: false }
	},
	'seedance-1-pro': {
		imageInputParam: { name: 'image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '3:4', '4:3', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' },
		durationParam: { name: 'duration', min: 2, max: 12, unit: 'seconds' },
		imageEndParam: { name: 'last_frame_image', isArray: false, needsDataUri: false },
		qualityParam: { name: 'resolution', options: ['480p', '720p', '1080p'] },
	},
	'seedance-1-pro-fast': {
		imageInputParam: { name: 'image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '3:4', '4:3', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' },
		durationParam: { name: 'duration', min: 2, max: 12, unit: 'seconds' },
		qualityParam: { name: 'resolution', options: ['480p', '720p', '1080p'] },
	},
	'seedance-1-lite': {
		imageInputParam: { name: 'image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '3:4', '4:3', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' },
		durationParam: { name: 'duration', min: 2, max: 12, unit: 'seconds' },
		imageEndParam: { name: 'last_frame_image', isArray: false, needsDataUri: false },
		qualityParam: { name: 'resolution', options: ['480p', '720p', '1080p'] },
	},

	// Alibaba/Wan models
	'wan-2.6-t2v': {
		seedParam: { name: 'seed', type: 'integer' },
		qualityParam: { name: 'size', options: ['1280*720', '720*1280', '1920*1080', '1080*1920'] },
		durationParam: { name: 'duration', min: 5, max: 15, unit: 'seconds' }
	},
	'wan-2.5-t2v': {
		seedParam: { name: 'seed', type: 'integer' },
		qualityParam: { name: 'size', options: ['1280*720', '720*1280', '1920*1080', '1080*1920'] },
		durationParam: { name: 'duration', min: 5, max: 15, unit: 'seconds' }
	},
	'wan-2.5-t2v-fast': {
		seedParam: { name: 'seed', type: 'integer' },
		qualityParam: { name: 'size', options: ['1280*720', '720*1280', '1920*1080', '1080*1920'] },
		durationParam: { name: 'duration', min: 5, max: 15, unit: 'seconds' }
	},
	'wan-2.6-i2v': {
		imageInputParam: { name: 'image', isArray: false, needsDataUri: false },
		seedParam: { name: 'seed', type: 'integer' },
		qualityParam: { name: 'resolution', options: ['720p', '1080p'] },
		durationParam: { name: 'duration', min: 5, max: 15, unit: 'seconds' }
	},
	'wan-2.5-i2v': {
		imageInputParam: { name: 'image', isArray: false, needsDataUri: false },
		seedParam: { name: 'seed', type: 'integer' },
		qualityParam: { name: 'resolution', options: ['480p', '720p', '1080p'] },
		durationParam: { name: 'duration', min: 5, max: 10, unit: 'seconds' }
	},
	'wan-2.5-i2v-fast': {
		imageInputParam: { name: 'image', isArray: false, needsDataUri: false },
		seedParam: { name: 'seed', type: 'integer' },
		qualityParam: { name: 'resolution', options: ['720p', '1080p'] },
		durationParam: { name: 'duration', min: 5, max: 10, unit: 'seconds' }
	},
	'wan-2.2-5b-fast': {
		imageInputParam: { name: 'image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' },
		qualityParam: { name: 'resolution', options: ['480p', '720p'] },
	},

	// LeonardoAI models
	'motion-2.0': {
		imageInputParam: { name: 'image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['2:3', '9:16', '16:9'] },
	},

	// MiniMax models
	'hailuo-2.3': {
		imageInputParam: { name: 'first_frame_image', isArray: false, needsDataUri: false },
		qualityParam: { name: 'resolution', options: ['768p', '1080p'] },
	},

	// Pixverse models
	'pixverse-v5': {
		imageInputParam: { name: 'image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' },
		qualityParam: { name: 'quality', options: ['360p', '540p', '720p', '1080p'] },
		durationParam: { name: 'duration', min: 5, max: 8, unit: 'seconds' },
		imageEndParam: { name: 'last_frame_image', isArray: false, needsDataUri: false },
	},
	'pixverse-v4.5': {
		imageInputParam: { name: 'image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' },
		qualityParam: { name: 'quality', options: ['360p', '540p', '720p', '1080p'] },
		durationParam: { name: 'duration', min: 5, max: 8, unit: 'seconds' },
		imageEndParam: { name: 'last_frame_image', isArray: false, needsDataUri: false },
		styleParam: { name: 'style', options: ['None', 'anime', '3d_animation', 'clay', 'cyberpunk', 'comic'] }
	},
	'pixverse-v4': {
		imageInputParam: { name: 'image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '9:16', '16:9'] },
		seedParam: { name: 'seed', type: 'integer' },
		qualityParam: { name: 'quality', options: ['360p', '540p', '720p', '1080p'] },
		durationParam: { name: 'duration', min: 5, max: 8, unit: 'seconds' },
		imageEndParam: { name: 'last_frame_image', isArray: false, needsDataUri: false },
		styleParam: { name: 'style', options: ['None', 'anime', '3d_animation', 'clay', 'cyberpunk', 'comic'] }
	},

	// KlingAI models
	'kling-v2.6': {
		imageInputParam: { name: 'start_image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '9:16', '16:9'] },
		durationParam: { name: 'duration', min: 5, max: 10, unit: 'seconds' },
	},
	'kling-v2.5-turbo-pro': {
		imageInputParam: { name: 'start_image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '9:16', '16:9'] },
		imageEndParam: { name: 'end_image', isArray: false, needsDataUri: false },
		durationParam: { name: 'duration', min: 5, max: 10, unit: 'seconds' },
	},
	'kling-v2.1': {
		imageInputParam: { name: 'start_image', isArray: false, needsDataUri: false },
		imageEndParam: { name: 'end_image', isArray: false, needsDataUri: false },
		durationParam: { name: 'duration', min: 5, max: 10, unit: 'seconds' },
	},
	'kling-v2.1-master': {
		imageInputParam: { name: 'start_image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '9:16', '16:9'] },
		durationParam: { name: 'duration', min: 5, max: 10, unit: 'seconds' },
	},
	'kling-v2.0': {
		imageInputParam: { name: 'start_image', isArray: false, needsDataUri: false },
		sizeParam: { name: 'aspect_ratio', options: ['1:1', '9:16', '16:9'] },
		durationParam: { name: 'duration', min: 5, max: 10, unit: 'seconds' },
	}
};

/**
 * Single source of truth: Model name to Replicate API path and type mapping.
 * IMAGE_MODEL_NAMES and VIDEO_MODEL_NAMES are derived from this object.
 * Adding a new model only requires adding one entry here - no other changes needed.
 */
export const MODEL_IDENTIFIERS: Record<string, { path: string; type: 'image' | 'video' }> = {
	// ===== IMAGE MODELS =====
	// OpenAI models
	'gpt-image-1.5': { path: 'openai/gpt-image-1.5', type: 'image' },
	'dall-e-3': { path: 'openai/dall-e-3', type: 'image' },
	'dall-e-2': { path: 'openai/dall-e-2', type: 'image' },

	// Google models
	'nano-banana-pro': { path: 'google/nano-banana-pro', type: 'image' },
	'nano-banana': { path: 'google/nano-banana', type: 'image' },
	'imagen-4': { path: 'google/imagen-4', type: 'image' },
	'imagen-4-ultra': { path: 'google/imagen-4-ultra', type: 'image' },
	'imagen-4-fast': { path: 'google/imagen-4-fast', type: 'image' },
	'imagen-3': { path: 'google/imagen-3', type: 'image' },
	'imagen-3-fast': { path: 'google/imagen-3-fast', type: 'image' },

	// Black Forest Labs models
	'flux-2-max': { path: 'black-forest-labs/flux-2-max', type: 'image' },
	'flux-2-pro': { path: 'black-forest-labs/flux-2-pro', type: 'image' },
	'flux-2-flex': { path: 'black-forest-labs/flux-2-flex', type: 'image' },
	'flux-2-dev': { path: 'black-forest-labs/flux-2-dev', type: 'image' },
	'flux-krea-dev': { path: 'black-forest-labs/flux-krea-dev', type: 'image' },
	'flux-1.1-pro': { path: 'black-forest-labs/flux-1.1-pro', type: 'image' },
	'flux-1.1-pro-ultra': { path: 'black-forest-labs/flux-1.1-pro-ultra', type: 'image' },
	'flux-kontext-pro': { path: 'black-forest-labs/flux-kontext-pro', type: 'image' },
	'flux-kontext-max': { path: 'black-forest-labs/flux-kontext-max', type: 'image' },
	'flux-schnell': { path: 'black-forest-labs/flux-schnell', type: 'image' },

	// Stable Diffusion models
	'stable-diffusion-3.5-large': { path: 'stability-ai/stable-diffusion-3.5-large', type: 'image' },
	'stable-diffusion-3.5-large-turbo': { path: 'stability-ai/stable-diffusion-3.5-large-turbo', type: 'image' },
	'stable-diffusion-3.5-medium': { path: 'stability-ai/stable-diffusion-3.5-medium', type: 'image' },
	'stable-diffusion-3': { path: 'stability-ai/stable-diffusion-3', type: 'image' },

	// Luma models
	'photon-1': { path: 'luma/photon', type: 'image' },
	'photon-flash-1': { path: 'luma/photon-flash', type: 'image' },

	// Bytedance models
	'seedream-4.5': { path: 'bytedance/seedream-4.5', type: 'image' },
	'seedream-4': { path: 'bytedance/seedream-4', type: 'image' },
	'seedream-3': { path: 'bytedance/seedream-3', type: 'image' },
	'dreamina-3.1': { path: 'bytedance/dreamina-3.1', type: 'image' },

	// Alibaba/Wan models
	'wan-2.2-image': { path: 'prunaai/wan-2.2-image', type: 'image' },

	// Alibaba/Qwen models
	'qwen-image-2512': { path: 'qwen/qwen-image-2512', type: 'image' },

	// Tencent models
	'hunyuan-image-3': { path: 'tencent/hunyuan-image-3', type: 'image' },
	'hunyuan-image-2.1': { path: 'tencent/hunyuan-image-2.1', type: 'image' },

	// XAI models
	'grok-2-image': { path: 'xai/grok-2-image', type: 'image' },

	// LeonardoAI models
	'lucid-origin': { path: 'leonardoai/lucid-origin', type: 'image' },
	'phoenix-1.0': { path: 'leonardoai/phoenix-1.0', type: 'image' },

	// IdeogramAI models
	'ideogram-v3-quality': { path: 'ideogram-ai/ideogram-v3-quality', type: 'image' },
	'ideogram-v3-balanced': { path: 'ideogram-ai/ideogram-v3-balanced', type: 'image' },
	'ideogram-v3-turbo': { path: 'ideogram-ai/ideogram-v3-turbo', type: 'image' },
	'ideogram-v2': { path: 'ideogram-ai/ideogram-v2', type: 'image' },
	'ideogram-v2-turbo': { path: 'ideogram-ai/ideogram-v2-turbo', type: 'image' },

	// IMAGE UPSCALERS
	'upscaler': { path: 'google/upscaler', type: 'image' },

	// ===== VIDEO MODELS =====
	// OpenAI models
	'sora-2': { path: 'openai/sora-2', type: 'video' },
	'sora-2-pro': { path: 'openai/sora-2-pro', type: 'video' },

	// Google models
	'veo-3.1': { path: 'google/veo-3.1', type: 'video' },
	'veo-3.1-fast': { path: 'google/veo-3.1-fast', type: 'video' },
	'veo-3': { path: 'google/veo-3', type: 'video' },
	'veo-3-fast': { path: 'google/veo-3-fast', type: 'video' },
	'veo-2': { path: 'google/veo-2', type: 'video' },

	// Luma models
	'ray-2-720p': { path: 'luma/ray-2-720p', type: 'video' },
	'ray-2-540p': { path: 'luma/ray-2-540p', type: 'video' },
	'ray-flash-2-720p': { path: 'luma/ray-flash-2-720p', type: 'video' },
	'ray-flash-2-540p': { path: 'luma/ray-flash-2-540p', type: 'video' },
	'ray': { path: 'luma/ray', type: 'video' },

	// Bytedance models
	'seedance-1.5-pro': { path: 'bytedance/seedance-1.5-pro', type: 'video' },
	'seedance-1-pro': { path: 'bytedance/seedance-1-pro', type: 'video' },
	'seedance-1-pro-fast': { path: 'bytedance/seedance-1-pro-fast', type: 'video' },
	'seedance-1-lite': { path: 'bytedance/seedance-1-lite', type: 'video' },

	// Alibaba/Wan models
	'wan-2.6-t2v': { path: 'wan-video/wan-2.6-t2v', type: 'video' },
	'wan-2.5-t2v': { path: 'wan-video/wan-2.5-t2v', type: 'video' },
	'wan-2.5-t2v-fast': { path: 'wan-video/wan-2.5-t2v-fast', type: 'video' },
	'wan-2.6-i2v': { path: 'wan-video/wan-2.6-i2v', type: 'video' },
	'wan-2.5-i2v': { path: 'wan-video/wan-2.5-i2v', type: 'video' },
	'wan-2.5-i2v-fast': { path: 'wan-video/wan-2.5-i2v-fast', type: 'video' },
	'wan-2.2-5b-fast': { path: 'wan-video/wan-2.2-5b-fast', type: 'video' },

	// LeonardoAI models
	'motion-2.0': { path: 'leonardoai/motion-2.0', type: 'video' },

	// MiniMax models
	'hailuo-2.3': { path: 'minimax/hailuo-2.3', type: 'video' },

	// Pixverse models
	'pixverse-v5': { path: 'pixverse/pixverse-v5', type: 'video' },
	'pixverse-v4.5': { path: 'pixverse/pixverse-v4.5', type: 'video' },
	'pixverse-v4': { path: 'pixverse/pixverse-v4', type: 'video' },

	// KlingAI models
	'kling-v2.6': { path: 'kwaivgi/kling-v2.6', type: 'video' },
	'kling-v2.5-turbo-pro': { path: 'kwaivgi/kling-v2.5-turbo-pro', type: 'video' },
	'kling-v2.1': { path: 'kwaivgi/kling-v2.1', type: 'video' },
	'kling-v2.1-master': { path: 'kwaivgi/kling-v2.1-master', type: 'video' },
	'kling-v2.0': { path: 'kwaivgi/kling-v2.0', type: 'video' }
};

/**
 * Check if a model is a video model
 */
export function isVideoModel(name: string): boolean {
	return MODEL_IDENTIFIERS[name]?.type === 'video';
}

/**
 * List of image model names (derived from MODEL_IDENTIFIERS)
 */
export const IMAGE_MODEL_NAMES = Object.entries(MODEL_IDENTIFIERS)
	.filter(([_, v]) => v.type === 'image')
	.map(([k]) => k) as readonly string[];

/**
 * List of video model names (derived from MODEL_IDENTIFIERS)
 */
export const VIDEO_MODEL_NAMES = Object.entries(MODEL_IDENTIFIERS)
	.filter(([_, v]) => v.type === 'video')
	.map(([k]) => k) as readonly string[];
