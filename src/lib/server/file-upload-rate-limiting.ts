import { rateLimiter, type RateLimitConfig } from './security-headers.js';

/**
 * Rate limiting configurations for file upload operations
 * Prevents abuse of storage resources and API costs
 */
export const FILE_UPLOAD_RATE_LIMITS: Record<string, RateLimitConfig> = {
	// Image uploads (chat attachments, image-to-image references)
	imageUpload: {
		windowMs: 60 * 1000, // 1 minute
		max: 20, // 20 uploads per minute
		message: 'Too many image uploads. Please wait a moment before uploading more.'
	},

	// Image generation (Replicate API calls)
	imageGeneration: {
		windowMs: 60 * 1000, // 1 minute
		max: 10, // 10 generations per minute
		message: 'Too many image generation requests. Please wait before generating more images.'
	},

	// Video generation (Replicate API calls - more expensive)
	videoGeneration: {
		windowMs: 60 * 1000, // 1 minute
		max: 5, // 5 generations per minute
		message: 'Too many video generation requests. Please wait before generating more videos.'
	},

	// Audio generation (ElevenLabs TTS)
	audioGeneration: {
		windowMs: 60 * 1000, // 1 minute
		max: 10, // 10 generations per minute
		message: 'Too many audio generation requests. Please wait before generating more audio.'
	},

	// Audio transcription (ElevenLabs STT)
	audioTranscription: {
		windowMs: 60 * 1000, // 1 minute
		max: 10, // 10 transcriptions per minute
		message: 'Too many transcription requests. Please wait before transcribing more audio.'
	},

	// Voice changing (ElevenLabs STS)
	voiceChange: {
		windowMs: 60 * 1000, // 1 minute
		max: 10, // 10 voice changes per minute
		message: 'Too many voice change requests. Please wait before processing more audio.'
	},

	// Music generation (ElevenLabs - expensive)
	musicGeneration: {
		windowMs: 60 * 1000, // 1 minute
		max: 5, // 5 generations per minute
		message: 'Too many music generation requests. Please wait before generating more music.'
	},

	// Sound effects generation (ElevenLabs)
	soundEffectsGeneration: {
		windowMs: 60 * 1000, // 1 minute
		max: 10, // 10 generations per minute
		message: 'Too many sound effects requests. Please wait before generating more.'
	},

	// Branding file uploads (admin dashboard - should be rare)
	brandingUpload: {
		windowMs: 60 * 60 * 1000, // 1 hour
		max: 10, // 10 branding uploads per hour
		message: 'Too many branding file uploads. Please wait before uploading more.'
	},

	// Text file uploads (chat attachments)
	textFileUpload: {
		windowMs: 60 * 1000, // 1 minute
		max: 20, // 20 uploads per minute
		message: 'Too many file uploads. Please wait before uploading more.'
	}
};

export type FileUploadOperation = keyof typeof FILE_UPLOAD_RATE_LIMITS;

export interface FileUploadRateLimitResult {
	allowed: boolean;
	message?: string;
	resetTime?: number;
	remainingMs?: number;
}

/**
 * Generate rate limit key for file upload operations
 * Uses userId to track per-user limits
 */
function generateFileUploadKey(operation: FileUploadOperation, userId: string): string {
	return `file-upload:${operation}:${userId}`;
}

/**
 * Check rate limit for a file upload operation
 * @param operation - Type of file upload operation
 * @param userId - User ID making the request
 * @returns Rate limit result with allowed status and optional error message
 */
export function checkFileUploadRateLimit(
	operation: FileUploadOperation,
	userId: string
): FileUploadRateLimitResult {
	const config = FILE_UPLOAD_RATE_LIMITS[operation];

	if (!config) {
		console.warn(`Unknown file upload operation: ${operation}`);
		return { allowed: true };
	}

	const key = generateFileUploadKey(operation, userId);
	const result = rateLimiter.isAllowed(key, config);

	if (!result.allowed) {
		const remainingMs = result.resetTime ? Math.max(0, result.resetTime - Date.now()) : 0;

		return {
			allowed: false,
			message: config.message,
			resetTime: result.resetTime,
			remainingMs
		};
	}

	return { allowed: true };
}

/**
 * Middleware-style rate limit check that throws an error if limit exceeded
 * Use this in API endpoints for cleaner error handling
 * @throws Error with 429 status if rate limit exceeded
 */
export function enforceFileUploadRateLimit(
	operation: FileUploadOperation,
	userId: string
): void {
	const result = checkFileUploadRateLimit(operation, userId);

	if (!result.allowed) {
		const error = new Error(result.message || 'Rate limit exceeded') as Error & { status: number };
		error.status = 429;
		throw error;
	}
}

/**
 * Get remaining requests for an operation
 * Useful for informing users of their remaining quota
 */
export function getRemainingUploads(
	operation: FileUploadOperation,
	_userId: string
): { remaining: number; resetInMs: number } | null {
	const config = FILE_UPLOAD_RATE_LIMITS[operation];

	if (!config) {
		return null;
	}

	// Note: Current SimpleRateLimit doesn't track remaining count efficiently
	// This would need to be enhanced for accurate remaining count
	// For now, return null to indicate this feature isn't available
	return null;
}
