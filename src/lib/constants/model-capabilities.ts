/**
 * Client-safe model capability flags for image and video generation models.
 * Capabilities are derived from MODEL_CONFIGS - Single Source of Truth.
 */

import { MODEL_CONFIGS, IMAGE_MODEL_NAMES, VIDEO_MODEL_NAMES } from './replicate-model-configs.js';

export interface ModelCapability {
	supportsImageInput: boolean;
	supportsMultipleImageInput: boolean; // Models that accept multiple reference images (isArray && needsDataUri)
	supportsAspectRatio: boolean;
	supportsSeed: boolean;
	supportsQuality: boolean;
	supportsNumberOfImages: boolean;
	supportsStyle: boolean;
	supportsDuration: boolean;
	supportsImageStart: boolean;
	supportsImageEnd: boolean;
	supportsUpscale: boolean;
	supportsCompression: boolean;
}

/**
 * Derive capabilities from MODEL_CONFIGS - Single Source of Truth
 */
function deriveCapabilities(modelNames: readonly string[]): Record<string, ModelCapability> {
	return Object.fromEntries(
		modelNames.map(name => {
			const config = MODEL_CONFIGS[name];
			return [
				name,
				{
					supportsImageInput: !!config?.imageInputParam,
					supportsMultipleImageInput: !!(config?.imageInputParam?.isArray && config?.imageInputParam?.needsDataUri),
					supportsAspectRatio: !!config?.sizeParam,
					supportsSeed: !!config?.seedParam,
					supportsQuality: !!config?.qualityParam,
					supportsNumberOfImages: !!config?.numberOfImagesParam,
					supportsStyle: !!config?.styleParam,
					supportsDuration: !!config?.durationParam,
					supportsImageStart: !!config?.imageStartParam,
					supportsImageEnd: !!config?.imageEndParam,
					supportsUpscale: !!config?.upscaleParam,
					supportsCompression: !!config?.compressionParam
				}
			];
		})
	);
}

/**
 * Image model capabilities (derived from MODEL_CONFIGS)
 */
export const IMAGE_MODEL_CAPABILITIES: Record<string, ModelCapability> = deriveCapabilities(IMAGE_MODEL_NAMES);

/**
 * Video model capabilities (derived from MODEL_CONFIGS)
 */
export const VIDEO_MODEL_CAPABILITIES: Record<string, ModelCapability> = deriveCapabilities(VIDEO_MODEL_NAMES);

/**
 * Helper function to get a specific capability for a model
 */
export function getModelCapability(
	modelName: string,
	capability: keyof ModelCapability,
	type: 'image' | 'video'
): boolean {
	const capabilities = type === 'image'
		? IMAGE_MODEL_CAPABILITIES[modelName]
		: VIDEO_MODEL_CAPABILITIES[modelName];

	if (!capabilities) {
		// Default to false if model not found
		return false;
	}

	return capabilities[capability];
}

/**
 * Helper function to get aspect ratio options for a model.
 * Reads directly from MODEL_CONFIGS (Single Source of Truth).
 */
export function getModelAspectRatioOptions(modelName: string): readonly string[] {
	return MODEL_CONFIGS[modelName]?.sizeParam?.options ?? [];
}

/**
 * Helper function to get quality options for a model.
 * Reads directly from MODEL_CONFIGS (Single Source of Truth).
 */
export function getModelQualityOptions(modelName: string): readonly string[] {
	return MODEL_CONFIGS[modelName]?.qualityParam?.options ?? [];
}

/**
 * Helper function to get style options for a model.
 * Reads directly from MODEL_CONFIGS (Single Source of Truth).
 */
export function getModelStyleOptions(modelName: string): readonly string[] {
	return MODEL_CONFIGS[modelName]?.styleParam?.options ?? [];
}

/**
 * Helper function to get number of images range for a model.
 * Reads directly from MODEL_CONFIGS (Single Source of Truth).
 */
export function getModelNumberOfImagesRange(modelName: string): { min: number; max: number } | null {
	const config = MODEL_CONFIGS[modelName]?.numberOfImagesParam;
	return config ? { min: config.min, max: config.max } : null;
}

/**
 * Helper function to get duration range for a model.
 * Reads directly from MODEL_CONFIGS (Single Source of Truth).
 */
export function getModelDurationRange(modelName: string): { min: number; max: number; unit: 'seconds' | 'frames' } | null {
	const config = MODEL_CONFIGS[modelName]?.durationParam;
	return config ? { min: config.min, max: config.max, unit: config.unit } : null;
}

/**
 * Helper function to get upscale options for a model.
 * Reads directly from MODEL_CONFIGS (Single Source of Truth).
 */
export function getModelUpscaleOptions(modelName: string): readonly string[] {
	return MODEL_CONFIGS[modelName]?.upscaleParam?.options ?? [];
}

/**
 * Helper function to get compression range for a model.
 * Reads directly from MODEL_CONFIGS (Single Source of Truth).
 */
export function getModelCompressionRange(modelName: string): { min: number; max: number } | null {
	const config = MODEL_CONFIGS[modelName]?.compressionParam;
	return config ? { min: config.min, max: config.max } : null;
}

/**
 * Default aspect ratio for image generation
 */
export const DEFAULT_IMAGE_ASPECT_RATIO = '1:1';

/**
 * Default aspect ratio for video generation
 */
export const DEFAULT_VIDEO_ASPECT_RATIO = '16:9';

/**
 * Default image model
 */
export const DEFAULT_IMAGE_MODEL = 'nano-banana-pro';

/**
 * Default video model
 */
export const DEFAULT_VIDEO_MODEL = 'veo-3.1';
