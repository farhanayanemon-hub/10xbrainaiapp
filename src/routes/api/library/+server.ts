import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { images, videos, audio, transcriptions, voiceChanges, music, soundEffects, chats } from '$lib/server/db/schema.js';
import { eq, desc, or, isNull } from 'drizzle-orm';
import { storageService } from '$lib/server/storage.js';

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const session = await locals.auth();
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Get query parameters for filtering
		const searchParams = url.searchParams;
		const type = searchParams.get('type'); // 'images', 'videos', 'audio', 'transcription', 'voice_change', 'music', 'sound_effects', or null for all

		// Fetch user's images with optional chat context
		let userImages: any[] = [];
		if (!type || type === 'images') {
			const rawImages = await db
				.select({
					id: images.id,
					filename: images.filename,
					mimeType: images.mimeType,
					fileSize: images.fileSize,
					storageLocation: images.storageLocation,
					cloudPath: images.cloudPath,
					createdAt: images.createdAt,
					chatId: images.chatId,
					chatTitle: chats.title,
					chatModel: chats.model,
				})
				.from(images)
				.leftJoin(chats, eq(images.chatId, chats.id))
				.where(eq(images.userId, session.user.id))
				.orderBy(desc(images.createdAt));

			// Generate URLs for each image based on storage location
			const imagesWithUrls = await Promise.all(
				rawImages.map(async (img) => {
					let imageUrl: string;

					// For R2 storage, generate presigned URL
					if (img.storageLocation === 'r2' && img.cloudPath) {
						// Let initialization errors propagate instead of silently falling back
						imageUrl = await storageService.getUrl(img.cloudPath);
					} else {
						// For local storage, use API endpoint
						imageUrl = `/api/images/${img.id}`;
					}

					return {
						...img,
						type: 'image' as const,
						url: imageUrl
					};
				})
			);

			userImages = imagesWithUrls;
		}

		// Fetch user's videos with optional chat context
		let userVideos: any[] = [];
		if (!type || type === 'videos') {
			const rawVideos = await db
				.select({
					id: videos.id,
					filename: videos.filename,
					mimeType: videos.mimeType,
					fileSize: videos.fileSize,
					duration: videos.duration,
					resolution: videos.resolution,
					fps: videos.fps,
					hasAudio: videos.hasAudio,
					storageLocation: videos.storageLocation,
					cloudPath: videos.cloudPath,
					createdAt: videos.createdAt,
					chatId: videos.chatId,
					chatTitle: chats.title,
					chatModel: chats.model,
				})
				.from(videos)
				.leftJoin(chats, eq(videos.chatId, chats.id))
				.where(eq(videos.userId, session.user.id))
				.orderBy(desc(videos.createdAt));

			// Generate URLs for each video based on storage location
			const videosWithUrls = await Promise.all(
				rawVideos.map(async (vid) => {
					let videoUrl: string;

					// For R2 storage, generate presigned URL
					if (vid.storageLocation === 'r2' && vid.cloudPath) {
						// Let initialization errors propagate instead of silently falling back
						videoUrl = await storageService.getUrl(vid.cloudPath);
					} else {
						// For local storage, use API endpoint
						videoUrl = `/api/videos/${vid.id}`;
					}

					return {
						...vid,
						type: 'video' as const,
						url: videoUrl
					};
				})
			);

			userVideos = videosWithUrls;
		}

		// Fetch user's audio files with optional chat context
		let userAudio: any[] = [];
		if (!type || type === 'audio') {
			const rawAudio = await db
				.select({
					id: audio.id,
					filename: audio.filename,
					mimeType: audio.mimeType,
					fileSize: audio.fileSize,
					duration: audio.duration,
					text: audio.text,
					model: audio.model,
					voiceId: audio.voiceId,
					storageLocation: audio.storageLocation,
					cloudPath: audio.cloudPath,
					createdAt: audio.createdAt,
					chatId: audio.chatId,
					chatTitle: chats.title,
					chatModel: chats.model,
				})
				.from(audio)
				.leftJoin(chats, eq(audio.chatId, chats.id))
				.where(eq(audio.userId, session.user.id))
				.orderBy(desc(audio.createdAt));

			// Generate URLs for each audio file based on storage location
			const audioWithUrls = await Promise.all(
				rawAudio.map(async (aud) => {
					let audioUrl: string;

					// For R2 storage, generate presigned URL
					if (aud.storageLocation === 'r2' && aud.cloudPath) {
						// Let initialization errors propagate instead of silently falling back
						audioUrl = await storageService.getUrl(aud.cloudPath);
					} else {
						// For local storage, use API endpoint
						audioUrl = `/api/audio/${aud.id}`;
					}

					return {
						...aud,
						type: 'audio' as const,
						url: audioUrl
					};
				})
			);

			userAudio = audioWithUrls;
		}

		// Fetch user's transcriptions with optional chat context
		let userTranscriptions: any[] = [];
		if (!type || type === 'transcription') {
			const rawTranscriptions = await db
				.select({
					id: transcriptions.id,
					filename: transcriptions.filename,
					mimeType: transcriptions.mimeType,
					fileSize: transcriptions.fileSize,
					duration: transcriptions.duration,
					text: transcriptions.text,
					words: transcriptions.words,
					model: transcriptions.model,
					storageLocation: transcriptions.storageLocation,
					cloudPath: transcriptions.cloudPath,
					createdAt: transcriptions.createdAt,
					chatId: transcriptions.chatId,
					chatTitle: chats.title,
					chatModel: chats.model,
				})
				.from(transcriptions)
				.leftJoin(chats, eq(transcriptions.chatId, chats.id))
				.where(eq(transcriptions.userId, session.user.id))
				.orderBy(desc(transcriptions.createdAt));

			// Generate URLs for each transcription based on storage location
			const transcriptionsWithUrls = await Promise.all(
				rawTranscriptions.map(async (trans) => {
					let audioUrl: string;

					// For R2 storage, generate presigned URL
					if (trans.storageLocation === 'r2' && trans.cloudPath) {
						audioUrl = await storageService.getUrl(trans.cloudPath);
					} else {
						// For local storage, use API endpoint
						audioUrl = `/api/transcriptions/${trans.id}/audio`;
					}

					return {
						...trans,
						type: 'transcription' as const,
						url: audioUrl
					};
				})
			);

			userTranscriptions = transcriptionsWithUrls;
		}

		// Fetch user's voice changes with optional chat context
		let userVoiceChanges: any[] = [];
		if (!type || type === 'voice_change') {
			const rawVoiceChanges = await db
				.select({
					id: voiceChanges.id,
					filename: voiceChanges.filename,
					mimeType: voiceChanges.mimeType,
					fileSize: voiceChanges.fileSize,
					duration: voiceChanges.duration,
					targetVoiceId: voiceChanges.targetVoiceId,
					model: voiceChanges.model,
					storageLocation: voiceChanges.storageLocation,
					cloudPath: voiceChanges.cloudPath,
					originalFilename: voiceChanges.originalFilename,
					originalMimeType: voiceChanges.originalMimeType,
					originalFileSize: voiceChanges.originalFileSize,
					originalStorageLocation: voiceChanges.originalStorageLocation,
					originalCloudPath: voiceChanges.originalCloudPath,
					createdAt: voiceChanges.createdAt,
					chatId: voiceChanges.chatId,
					chatTitle: chats.title,
					chatModel: chats.model,
				})
				.from(voiceChanges)
				.leftJoin(chats, eq(voiceChanges.chatId, chats.id))
				.where(eq(voiceChanges.userId, session.user.id))
				.orderBy(desc(voiceChanges.createdAt));

			// Generate URLs for each voice change based on storage location
			const voiceChangesWithUrls = await Promise.all(
				rawVoiceChanges.map(async (vc) => {
					let transformedUrl: string;
					let originalUrl: string;

					// Transformed audio URL
					if (vc.storageLocation === 'r2' && vc.cloudPath) {
						transformedUrl = await storageService.getUrl(vc.cloudPath);
					} else {
						transformedUrl = `/api/voice-changes/${vc.id}?audio=transformed`;
					}

					// Original audio URL
					if (vc.originalStorageLocation === 'r2' && vc.originalCloudPath) {
						originalUrl = await storageService.getUrl(vc.originalCloudPath);
					} else {
						originalUrl = `/api/voice-changes/${vc.id}?audio=original`;
					}

					return {
						...vc,
						type: 'voice_change' as const,
						url: transformedUrl,
						transformedUrl,
						originalUrl
					};
				})
			);

			userVoiceChanges = voiceChangesWithUrls;
		}

		// Fetch user's music files with optional chat context
		let userMusic: any[] = [];
		if (!type || type === 'music') {
			const rawMusic = await db
				.select({
					id: music.id,
					filename: music.filename,
					mimeType: music.mimeType,
					fileSize: music.fileSize,
					durationMs: music.durationMs,
					prompt: music.prompt,
					model: music.model,
					isInstrumental: music.isInstrumental,
					storageLocation: music.storageLocation,
					cloudPath: music.cloudPath,
					createdAt: music.createdAt,
					chatId: music.chatId,
					chatTitle: chats.title,
					chatModel: chats.model,
				})
				.from(music)
				.leftJoin(chats, eq(music.chatId, chats.id))
				.where(eq(music.userId, session.user.id))
				.orderBy(desc(music.createdAt));

			// Generate URLs for each music file based on storage location
			const musicWithUrls = await Promise.all(
				rawMusic.map(async (mus) => {
					let musicUrl: string;

					// For R2 storage, generate presigned URL
					if (mus.storageLocation === 'r2' && mus.cloudPath) {
						musicUrl = await storageService.getUrl(mus.cloudPath);
					} else {
						// For local storage, use API endpoint
						musicUrl = `/api/music/${mus.id}`;
					}

					return {
						...mus,
						type: 'music' as const,
						url: musicUrl
					};
				})
			);

			userMusic = musicWithUrls;
		}

		// Fetch user's sound effects with optional chat context
		let userSoundEffects: any[] = [];
		if (!type || type === 'sound_effects') {
			const rawSoundEffects = await db
				.select({
					id: soundEffects.id,
					filename: soundEffects.filename,
					mimeType: soundEffects.mimeType,
					fileSize: soundEffects.fileSize,
					durationSeconds: soundEffects.durationSeconds,
					text: soundEffects.text,
					promptInfluence: soundEffects.promptInfluence,
					model: soundEffects.model,
					storageLocation: soundEffects.storageLocation,
					cloudPath: soundEffects.cloudPath,
					createdAt: soundEffects.createdAt,
					chatId: soundEffects.chatId,
					chatTitle: chats.title,
					chatModel: chats.model,
				})
				.from(soundEffects)
				.leftJoin(chats, eq(soundEffects.chatId, chats.id))
				.where(eq(soundEffects.userId, session.user.id))
				.orderBy(desc(soundEffects.createdAt));

			// Generate URLs for each sound effect file based on storage location
			const soundEffectsWithUrls = await Promise.all(
				rawSoundEffects.map(async (sfx) => {
					let soundEffectUrl: string;

					// For R2 storage, generate presigned URL
					if (sfx.storageLocation === 'r2' && sfx.cloudPath) {
						soundEffectUrl = await storageService.getUrl(sfx.cloudPath);
					} else {
						// For local storage, use API endpoint
						soundEffectUrl = `/api/sound-effects/${sfx.id}`;
					}

					return {
						...sfx,
						type: 'sound_effect' as const,
						url: soundEffectUrl
					};
				})
			);

			userSoundEffects = soundEffectsWithUrls;
		}

		// Combine and sort by creation date
		const allMedia = [...userImages, ...userVideos, ...userAudio, ...userTranscriptions, ...userVoiceChanges, ...userMusic, ...userSoundEffects]
			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

		return json({
			media: allMedia,
			total: allMedia.length,
			images: userImages.length,
			videos: userVideos.length,
			audio: userAudio.length,
			transcriptions: userTranscriptions.length,
			voiceChanges: userVoiceChanges.length,
			music: userMusic.length,
			soundEffects: userSoundEffects.length
		});
	} catch (error) {
		console.error('Get library error:', error);
		return json({ error: 'Failed to fetch library' }, { status: 500 });
	}
};