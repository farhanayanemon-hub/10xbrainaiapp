import { db } from '$lib/server/db/index.js';
import { images, videos, audio, transcriptions, voiceChanges, music, soundEffects } from '$lib/server/db/schema.js';
import { storageService } from '$lib/server/storage.js';

/**
 * Helper function to clean up orphaned files when database operations fail.
 * This prevents files from accumulating in storage without database records.
 */
async function cleanupOrphanedFile(storagePath: string, context: string): Promise<void> {
	try {
		console.error(`Cleaning up orphaned file after DB failure (${context}): ${storagePath}`);
		await storageService.delete(storagePath);
		console.log(`Successfully cleaned up orphaned file: ${storagePath}`);
	} catch (cleanupError) {
		// Log but don't throw - the original error is more important
		console.error(`Failed to cleanup orphaned file ${storagePath}:`, cleanupError);
		// Consider implementing a dead-letter queue or scheduled cleanup job
		// to handle files that couldn't be deleted
	}
}

/**
 * Image generation metadata for storing alongside the image
 */
export interface ImageMetadata {
	prompt?: string;
	model?: string;
	aspectRatio?: string;
	seed?: number;
	quality?: string;
	style?: string;
	numberOfImages?: number;
	referenceImageUrl?: string;
	upscaleFactor?: string;
	compressionQuality?: number;
}

/**
 * Shared utility function to save image data to storage and create database record
 * Used across multiple AI providers to maintain consistency
 */
export async function saveImageAndGetId(
	imageData: string,
	mimeType: string,
	userId: string,
	chatId?: string,
	metadata?: ImageMetadata
): Promise<string> {
	// Generate unique filename
	const extension = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1] || 'png';
	const filename = storageService.generateFilename(`file.${extension}`);

	// Convert base64 to buffer
	const imageBuffer = Buffer.from(imageData, 'base64');

	// Upload to storage (R2 or local)
	const storageResult = await storageService.upload(
		{
			buffer: imageBuffer,
			mimeType,
			filename
		},
		userId,
		'images',
		'generated'
	);

	// Create database record with user association and metadata
	// Wrap in try-catch to cleanup orphaned files on DB failure
	try {
		const [imageRecord] = await db
			.insert(images)
			.values({
				filename,
				userId,
				chatId: chatId || null,
				mimeType,
				fileSize: imageBuffer.length,
				storageLocation: storageResult.storageLocation,
				cloudPath: storageResult.path,
				// Generation metadata
				prompt: metadata?.prompt || null,
				model: metadata?.model || null,
				aspectRatio: metadata?.aspectRatio || null,
				seed: metadata?.seed || null,
				quality: metadata?.quality || null,
				style: metadata?.style || null,
				numberOfImages: metadata?.numberOfImages || null,
				referenceImageUrl: metadata?.referenceImageUrl || null,
				upscaleFactor: metadata?.upscaleFactor || null,
				compressionQuality: metadata?.compressionQuality || null
			})
			.returning();

		// Return database ID
		return imageRecord.id;
	} catch (dbError) {
		// Clean up the orphaned file from storage
		await cleanupOrphanedFile(storageResult.path, 'saveImageAndGetId');
		throw dbError;
	}
}

/**
 * Video generation metadata for storing alongside the video
 */
export interface VideoMetadata {
	prompt?: string;
	model?: string;
	aspectRatio?: string;
	seed?: number;
	quality?: string;
	style?: string;
	imageStartUrl?: string;
	imageEndUrl?: string;
}

/**
 * Shared utility function to save video data to storage and create database record
 * Used across multiple AI providers to maintain consistency
 */
export async function saveVideoAndGetId(
	videoData: string,
	mimeType: string,
	userId: string,
	chatId?: string,
	duration = 8,
	resolution = '720p',
	fps = 24,
	hasAudio = false,
	metadata?: VideoMetadata
): Promise<string> {
	// Generate unique filename
	const extension = mimeType.split('/')[1] || 'mp4';
	const filename = storageService.generateFilename(`file.${extension}`);

	// Convert base64 to buffer
	const videoBuffer = Buffer.from(videoData, 'base64');

	// Upload to storage (R2 or local)
	const storageResult = await storageService.upload(
		{
			buffer: videoBuffer,
			mimeType,
			filename
		},
		userId,
		'videos',
		'generated'
	);

	// Create database record with user association and metadata
	// Wrap in try-catch to cleanup orphaned files on DB failure
	try {
		const [videoRecord] = await db
			.insert(videos)
			.values({
				filename,
				userId,
				chatId: chatId || null,
				mimeType,
				fileSize: videoBuffer.length,
				duration,
				resolution,
				fps,
				hasAudio,
				storageLocation: storageResult.storageLocation,
				cloudPath: storageResult.path,
				// Generation metadata
				prompt: metadata?.prompt || null,
				model: metadata?.model || null,
				aspectRatio: metadata?.aspectRatio || null,
				seed: metadata?.seed || null,
				quality: metadata?.quality || null,
				style: metadata?.style || null,
				imageStartUrl: metadata?.imageStartUrl || null,
				imageEndUrl: metadata?.imageEndUrl || null
			})
			.returning();

		// Return database ID
		return videoRecord.id;
	} catch (dbError) {
		// Clean up the orphaned file from storage
		await cleanupOrphanedFile(storageResult.path, 'saveVideoAndGetId');
		throw dbError;
	}
}

/**
 * Shared utility function to save audio data to storage and create database record
 * Used for TTS (Text-to-Speech) generation to maintain consistency
 */
export async function saveAudioAndGetId(
	audioData: string,
	mimeType: string,
	userId: string,
	text: string,
	model: string,
	voiceId: string,
	chatId?: string,
	duration?: number,
	messageIndex?: number
): Promise<string> {
	// Generate unique filename
	const extension = mimeType.split('/')[1] || 'mp3';
	const filename = storageService.generateFilename(`file.${extension}`);

	// Convert base64 to buffer
	const audioBuffer = Buffer.from(audioData, 'base64');

	// Upload to storage (R2 or local)
	const storageResult = await storageService.upload(
		{
			buffer: audioBuffer,
			mimeType,
			filename
		},
		userId,
		'audio',
		'generated'
	);

	// Create database record with user association
	// Wrap in try-catch to cleanup orphaned files on DB failure
	try {
		const [audioRecord] = await db
			.insert(audio)
			.values({
				filename,
				userId,
				chatId: chatId || null,
				messageIndex: messageIndex ?? null,
				mimeType,
				fileSize: audioBuffer.length,
				duration: duration || null,
				text,
				model,
				voiceId,
				storageLocation: storageResult.storageLocation,
				cloudPath: storageResult.path
			})
			.returning();

		// Return database ID
		return audioRecord.id;
	} catch (dbError) {
		// Clean up the orphaned file from storage
		await cleanupOrphanedFile(storageResult.path, 'saveAudioAndGetId');
		throw dbError;
	}
}

/**
 * Shared utility function to save transcription data to storage and create database record
 * Stores the original uploaded audio file along with transcription metadata
 * @param audioFile - Original audio file buffer
 * @param mimeType - Audio MIME type (e.g., 'audio/mpeg')
 * @param userId - User ID for ownership
 * @param text - Full transcribed text
 * @param words - Optional array of word-level timestamps
 * @param model - STT model used (e.g., 'scribe_v1')
 * @param chatId - Optional chat association
 * @param duration - Optional audio duration in seconds
 * @returns Database ID of the created transcription record
 */
export async function saveTranscriptionAndGetId(
	audioFile: Buffer,
	mimeType: string,
	userId: string,
	text: string,
	words: Array<{ text: string; start: number; end: number }> | undefined,
	model: string,
	chatId?: string,
	duration?: number
): Promise<string> {
	// Generate unique filename
	const extension = mimeType.split('/')[1] || 'mp3';
	const filename = storageService.generateFilename(`file.${extension}`);

	// Upload audio file to storage (R2 or local)
	const storageResult = await storageService.upload(
		{
			buffer: audioFile,
			mimeType,
			filename
		},
		userId,
		'audio',
		'uploaded' // User-uploaded audio for transcription
	);

	// Create database record with transcription metadata
	// Wrap in try-catch to cleanup orphaned files on DB failure
	try {
		const [transcriptionRecord] = await db
			.insert(transcriptions)
			.values({
				filename,
				userId,
				chatId: chatId || null,
				mimeType,
				fileSize: audioFile.length,
				duration: duration || null,
				text,
				words: words || null,
				model,
				storageLocation: storageResult.storageLocation,
				cloudPath: storageResult.path
			})
			.returning();

		// Return database ID
		return transcriptionRecord.id;
	} catch (dbError) {
		// Clean up the orphaned file from storage
		await cleanupOrphanedFile(storageResult.path, 'saveTranscriptionAndGetId');
		throw dbError;
	}
}

/**
 * Shared utility function to save voice change data to storage and create database record
 * Stores both the original uploaded audio and the transformed output audio for comparison
 * @param outputAudioData - Base64 encoded transformed audio
 * @param outputMimeType - MIME type of output audio (e.g., 'audio/mpeg')
 * @param originalAudioBuffer - Buffer of original uploaded audio
 * @param originalMimeType - MIME type of original audio
 * @param userId - User ID for ownership
 * @param targetVoiceId - Voice ID used for transformation
 * @param model - STS model used (e.g., 'eleven_multilingual_sts_v2')
 * @param originalFilename - Original uploaded file name
 * @param chatId - Optional chat association
 * @param duration - Optional audio duration in seconds
 * @returns Database ID of the created voice change record
 */
export async function saveVoiceChangeAndGetId(
	outputAudioData: string,
	outputMimeType: string,
	originalAudioBuffer: Buffer,
	originalMimeType: string,
	userId: string,
	targetVoiceId: string,
	model: string,
	originalFilename: string,
	chatId?: string,
	duration?: number
): Promise<string> {
	// Generate unique filenames for both files
	const outputExtension = outputMimeType.split('/')[1] || 'mp3';
	const originalExtension = originalMimeType.split('/')[1] || 'mp3';
	const outputFilename = storageService.generateFilename(`file.${outputExtension}`);
	const originalStorageFilename = storageService.generateFilename(`file.${originalExtension}`);

	// Convert output base64 to buffer
	const outputAudioBuffer = Buffer.from(outputAudioData, 'base64');

	// Upload original audio to storage (category: 'uploaded')
	const originalStorageResult = await storageService.upload(
		{
			buffer: originalAudioBuffer,
			mimeType: originalMimeType,
			filename: originalStorageFilename
		},
		userId,
		'audio',
		'uploaded'
	);

	// Upload output audio to storage (category: 'generated')
	// If this fails, clean up the original file first
	let outputStorageResult;
	try {
		outputStorageResult = await storageService.upload(
			{
				buffer: outputAudioBuffer,
				mimeType: outputMimeType,
				filename: outputFilename
			},
			userId,
			'audio',
			'generated'
		);
	} catch (uploadError) {
		// Clean up the original file since output upload failed
		await cleanupOrphanedFile(originalStorageResult.path, 'saveVoiceChangeAndGetId (original)');
		throw uploadError;
	}

	// Create database record with both audio paths
	// Wrap in try-catch to cleanup orphaned files on DB failure
	try {
		const [voiceChangeRecord] = await db
			.insert(voiceChanges)
			.values({
				// Output audio info
				filename: outputFilename,
				mimeType: outputMimeType,
				fileSize: outputAudioBuffer.length,
				storageLocation: outputStorageResult.storageLocation,
				cloudPath: outputStorageResult.path,
				// Original audio info
				originalFilename,
				originalMimeType,
				originalFileSize: originalAudioBuffer.length,
				originalStorageLocation: originalStorageResult.storageLocation,
				originalCloudPath: originalStorageResult.path,
				// Metadata
				userId,
				chatId: chatId || null,
				duration: duration || null,
				targetVoiceId,
				model
			})
			.returning();

		// Return database ID
		return voiceChangeRecord.id;
	} catch (dbError) {
		// Clean up both orphaned files from storage
		await cleanupOrphanedFile(originalStorageResult.path, 'saveVoiceChangeAndGetId (original)');
		await cleanupOrphanedFile(outputStorageResult.path, 'saveVoiceChangeAndGetId (output)');
		throw dbError;
	}
}

/**
 * Shared utility function to save music data to storage and create database record
 * Used for music generation via ElevenLabs Music API
 * @param audioData - Base64 encoded audio data
 * @param mimeType - Audio MIME type (e.g., 'audio/mpeg')
 * @param userId - User ID for ownership
 * @param prompt - The prompt used to generate the music
 * @param model - Music model used (e.g., 'music_v1')
 * @param durationMs - Duration in milliseconds
 * @param isInstrumental - Whether the music is instrumental only
 * @param chatId - Optional chat association
 * @returns Database ID of the created music record
 */
export async function saveMusicAndGetId(
	audioData: string,
	mimeType: string,
	userId: string,
	prompt: string,
	model: string,
	durationMs: number,
	isInstrumental: boolean,
	chatId?: string
): Promise<string> {
	// Generate unique filename
	const extension = mimeType.split('/')[1] || 'mp3';
	const filename = storageService.generateFilename(`file.${extension}`);

	// Convert base64 to buffer
	const audioBuffer = Buffer.from(audioData, 'base64');

	// Upload to storage (R2 or local)
	const storageResult = await storageService.upload(
		{
			buffer: audioBuffer,
			mimeType,
			filename
		},
		userId,
		'audio',
		'generated'
	);

	// Create database record with music metadata
	// Wrap in try-catch to cleanup orphaned files on DB failure
	try {
		const [musicRecord] = await db
			.insert(music)
			.values({
				filename,
				userId,
				chatId: chatId || null,
				mimeType,
				fileSize: audioBuffer.length,
				durationMs,
				prompt,
				model,
				isInstrumental,
				storageLocation: storageResult.storageLocation,
				cloudPath: storageResult.path
			})
			.returning();

		// Return database ID
		return musicRecord.id;
	} catch (dbError) {
		// Clean up the orphaned file from storage
		await cleanupOrphanedFile(storageResult.path, 'saveMusicAndGetId');
		throw dbError;
	}
}

/**
 * Shared utility function to save sound effect data to storage and create database record
 * Used for sound effect generation via ElevenLabs Text-to-Sound-Effects API
 * @param audioData - Base64 encoded audio data
 * @param mimeType - Audio MIME type (e.g., 'audio/mpeg')
 * @param userId - User ID for ownership
 * @param text - The description used to generate the sound effect
 * @param durationSeconds - Duration in seconds
 * @param promptInfluence - 0.0-1.0, how literally the prompt was interpreted
 * @param model - Sound effect model used (e.g., 'sound_effects_v1')
 * @param chatId - Optional chat association
 * @returns Database ID of the created sound effect record
 */
export async function saveSoundEffectAndGetId(
	audioData: string,
	mimeType: string,
	userId: string,
	text: string,
	durationSeconds: number,
	promptInfluence: number,
	model: string,
	chatId?: string
): Promise<string> {
	// Generate unique filename
	const extension = mimeType.split('/')[1] || 'mp3';
	const filename = storageService.generateFilename(`file.${extension}`);

	// Convert base64 to buffer
	const audioBuffer = Buffer.from(audioData, 'base64');

	// Upload to storage (R2 or local)
	const storageResult = await storageService.upload(
		{
			buffer: audioBuffer,
			mimeType,
			filename
		},
		userId,
		'audio',
		'generated'
	);

	// Create database record with sound effect metadata
	// Wrap in try-catch to cleanup orphaned files on DB failure
	try {
		const [soundEffectRecord] = await db
			.insert(soundEffects)
			.values({
				filename,
				userId,
				chatId: chatId || null,
				mimeType,
				fileSize: audioBuffer.length,
				durationSeconds: durationSeconds || null,
				text,
				promptInfluence: promptInfluence || null,
				model,
				storageLocation: storageResult.storageLocation,
				cloudPath: storageResult.path
			})
			.returning();

		// Return database ID
		return soundEffectRecord.id;
	} catch (dbError) {
		// Clean up the orphaned file from storage
		await cleanupOrphanedFile(storageResult.path, 'saveSoundEffectAndGetId');
		throw dbError;
	}
}

/**
 * Standardized error handling for AI providers
 * Provides consistent error messages and logging
 */
export function createProviderError(providerName: string, operation: string, originalError: unknown): Error {
	const message = originalError instanceof Error ? originalError.message : 'Unknown error';
	return new Error(`${providerName} ${operation} error: ${message}`);
}

/**
 * Improved token usage calculation
 * More sophisticated estimation than simple length division
 */
export function estimateTokenUsage(text: string): number {
	// More sophisticated token estimation
	// Account for punctuation, spaces, and common patterns
	const words = text.trim().split(/\s+/).length;
	const chars = text.length;
	
	// Average tokens per word varies by language and complexity
	// Conservative estimate: ~1.3 tokens per word, with minimum based on character count
	const wordBasedTokens = words * 1.3;
	const charBasedTokens = chars / 3.5; // ~3.5 characters per token on average
	
	// Use the higher estimate for better accuracy
	return Math.max(Math.ceil(wordBasedTokens), Math.ceil(charBasedTokens));
}

/**
 * Convert ArrayBuffer to base64 string
 * Utility function for handling binary data from API responses
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const uint8Array = new Uint8Array(buffer);
	const binaryString = Array.from(uint8Array)
		.map(byte => String.fromCharCode(byte))
		.join('');
	return btoa(binaryString);
}

/**
 * Standard response format parser for multiple providers
 * Handles common response patterns from AI generation APIs
 */
export function parseMediaResponse(responseData: any, mediaType: 'image' | 'video'): {
	data?: string;
	buffer?: ArrayBuffer;
} {
	let mediaData: string | undefined;
	let mediaBuffer: ArrayBuffer | undefined;

	// Try to extract media data from common response formats
	if (responseData.data && Array.isArray(responseData.data) && responseData.data[0]) {
		// OpenAI-style response format
		if (responseData.data[0].b64_json) {
			mediaData = responseData.data[0].b64_json;
		} else if (responseData.data[0].url) {
			// URL will need to be fetched separately
			throw new Error('URL_RESPONSE_FORMAT');
		}
	} else if (responseData[mediaType]) {
		// Direct media field
		if (typeof responseData[mediaType] === 'string') {
			mediaData = responseData[mediaType];
		}
	} else if (responseData[`${mediaType}s`] && Array.isArray(responseData[`${mediaType}s`]) && responseData[`${mediaType}s`][0]) {
		// Media array format
		mediaData = responseData[`${mediaType}s`][0];
	} else if (responseData.result && responseData.result[mediaType]) {
		// Nested result format
		mediaData = responseData.result[mediaType];
	}

	return { data: mediaData, buffer: mediaBuffer };
}