import type { AIModelConfig } from '$lib/ai/types.js';
import {
	VIDEO_MODEL_CAPABILITIES,
	DEFAULT_VIDEO_ASPECT_RATIO,
	DEFAULT_VIDEO_MODEL,
	getModelAspectRatioOptions,
	getModelQualityOptions,
	getModelStyleOptions,
	getModelDurationRange
} from '$lib/constants/model-capabilities.js';

/**
 * Video history item interface
 */
export interface VideoHistoryItem {
	id: string;
	filename: string;
	mimeType: string;
	fileSize: number;
	duration: number | null;
	resolution: string | null;
	fps: number | null;
	hasAudio: boolean;
	storageLocation: string;
	cloudPath: string | null;
	createdAt: string;
	chatId: string | null;
	chatTitle: string | null;
	chatModel: string | null;
	type: 'video';
	url: string;
	// Generation metadata
	prompt: string | null;
	model: string | null;
	aspectRatio: string | null;
	seed: number | null;
	quality: string | null;
	style: string | null;
	imageStartUrl: string | null;
	imageEndUrl: string | null;
}

/**
 * VideoState - Video generation state management class
 *
 * Encapsulates all video generation-related state and methods for the /image-video page.
 * Uses Svelte 5 runes for reactive state management.
 */
export class VideoState {
	// Models
	models = $state<AIModelConfig[]>([]);
	selectedModel = $state<string>(DEFAULT_VIDEO_MODEL);

	// Input
	inputPrompt = $state<string>('');
	selectedAspectRatio = $state<string>(DEFAULT_VIDEO_ASPECT_RATIO);
	duration = $state<number>(5);
	seed = $state<string>('');

	// Start image (for i2v)
	startImageFile = $state<File | null>(null);
	startImagePreview = $state<string | null>(null);
	uploadedImageUrl = $state<string | null>(null);

	// End image (for models that support it)
	endImageFile = $state<File | null>(null);
	endImagePreview = $state<string | null>(null);
	uploadedEndImageUrl = $state<string | null>(null);

	// New optional parameters
	selectedQuality = $state<string>('');
	selectedStyle = $state<string>('');

	// Generation state
	isGenerating = $state<boolean>(false);
	generationDialogOpen = $state<boolean>(false);
	errorMessage = $state<string | null>(null);

	// History (infinite scroll)
	history = $state<VideoHistoryItem[]>([]);
	readonly batchSize = 9;
	hasMore = $state<boolean>(true);
	isLoadingHistory = $state<boolean>(false);

	// Video dialog
	dialogOpen = $state<boolean>(false);
	selectedVideoId = $state<string>('');
	selectedVideoUrl = $state<string>('');
	selectedVideoFilename = $state<string>('');
	selectedVideoCreatedAt = $state<string>('');
	selectedVideoDuration = $state<number | null>(null);
	selectedVideoResolution = $state<string | null>(null);
	// Selected video metadata
	selectedVideoPrompt = $state<string | null>(null);
	selectedVideoModel = $state<string | null>(null);
	selectedVideoAspectRatio = $state<string | null>(null);
	selectedVideoSeed = $state<number | null>(null);
	selectedVideoQuality = $state<string | null>(null);
	selectedVideoStyle = $state<string | null>(null);
	selectedVideoImageStartUrl = $state<string | null>(null);
	selectedVideoImageEndUrl = $state<string | null>(null);
	selectedVideoFps = $state<number | null>(null);
	selectedVideoHasAudio = $state<boolean>(false);
	selectedVideoFileSize = $state<number>(0);

	// Video player state
	videoElement = $state<HTMLVideoElement | null>(null);
	videoContainerElement = $state<HTMLDivElement | null>(null);
	isPlaying = $state<boolean>(false);
	currentTime = $state<number>(0);
	videoDuration = $state<number>(0);

	// Volume state
	volume = $state<number>(1);
	isMuted = $state<boolean>(false);

	// Derived: model capabilities
	get modelCapabilities() {
		return VIDEO_MODEL_CAPABILITIES[this.selectedModel] || {
			supportsImageInput: false,
			supportsAspectRatio: false,
			supportsSeed: false
		};
	}

	// Derived: aspect ratio options for selected model (from MODEL_CONFIGS)
	get aspectRatioOptions(): readonly string[] {
		return getModelAspectRatioOptions(this.selectedModel);
	}

	get modelSupportsImageInput() {
		return this.modelCapabilities.supportsImageInput;
	}

	get modelSupportsAspectRatio() {
		return this.modelCapabilities.supportsAspectRatio;
	}

	get modelSupportsSeed() {
		return this.modelCapabilities.supportsSeed;
	}

	get modelSupportsQuality() {
		return this.modelCapabilities.supportsQuality;
	}

	get modelSupportsStyle() {
		return this.modelCapabilities.supportsStyle;
	}

	get modelSupportsDuration() {
		return this.modelCapabilities.supportsDuration;
	}

	get modelSupportsImageStart() {
		return this.modelCapabilities.supportsImageStart;
	}

	get modelSupportsImageEnd() {
		return this.modelCapabilities.supportsImageEnd;
	}

	// Derived: quality options for selected model (from MODEL_CONFIGS)
	get qualityOptions(): readonly string[] {
		return getModelQualityOptions(this.selectedModel);
	}

	// Derived: style options for selected model (from MODEL_CONFIGS)
	get styleOptions(): readonly string[] {
		return getModelStyleOptions(this.selectedModel);
	}

	// Derived: duration range for selected model (from MODEL_CONFIGS)
	get durationRange(): { min: number; max: number; unit: 'seconds' | 'frames' } | null {
		return getModelDurationRange(this.selectedModel);
	}

	// Derived: duration options based on model's durationParam range
	get durationOptions(): { value: number; label: string }[] {
		const range = this.durationRange;
		if (!range) {
			// Fallback if no duration param configured
			return [{ value: 5, label: '5 seconds' }];
		}

		const options: { value: number; label: string }[] = [];
		for (let i = range.min; i <= range.max; i++) {
			options.push({ value: i, label: `${i} seconds` });
		}
		return options;
	}

	// Get selected model display name
	get selectedModelName() {
		return this.models.find(m => m.name === this.selectedModel)?.displayName || this.selectedModel;
	}

	// ==================== Model Methods ====================

	/**
	 * Load video generation models from API
	 */
	async loadModels() {
		try {
			const response = await fetch('/api/models?type=video');
			if (!response.ok) {
				throw new Error('Failed to load models');
			}

			const data = await response.json();
			this.models = data.models || [];

			// Ensure selected model is valid
			if (this.models.length > 0 && !this.models.find(m => m.name === this.selectedModel)) {
				this.selectedModel = this.models[0].name;
			}
		} catch (error) {
			console.error('Failed to load models:', error);
			this.errorMessage = 'Failed to load models';
		}
	}

	/**
	 * Reset optional parameters when model changes.
	 * Should be called when selectedModel changes.
	 */
	resetOptionalParameters() {
		// Reset quality to first option if available
		const qOpts = getModelQualityOptions(this.selectedModel);
		this.selectedQuality = qOpts.length > 0 ? qOpts[0] : '';

		// Reset style to first option if available
		const sOpts = getModelStyleOptions(this.selectedModel);
		this.selectedStyle = sOpts.length > 0 ? sOpts[0] : '';

		// Reset duration to min of range if available
		const dRange = getModelDurationRange(this.selectedModel);
		this.duration = dRange ? dRange.min : 5;

		// Reset aspect ratio to first option if available, otherwise default
		const arOpts = getModelAspectRatioOptions(this.selectedModel);
		this.selectedAspectRatio = arOpts.length > 0 ? arOpts[0] : DEFAULT_VIDEO_ASPECT_RATIO;

		// Clear end image when model changes
		this.clearEndImage();
	}

	// ==================== Generation Methods ====================

	/**
	 * Generate video from prompt
	 */
	async handleGenerate() {
		if (!this.inputPrompt.trim()) return;

		this.isGenerating = true;
		this.generationDialogOpen = true;
		this.errorMessage = null;

		try {
			// If there's a start image file, upload it first
			let imageUrl = this.uploadedImageUrl;
			if (this.startImageFile && !imageUrl) {
				imageUrl = await this.uploadStartImage();
			}

			// Build request body
			const body: Record<string, unknown> = {
				model: this.selectedModel,
				prompt: this.inputPrompt.trim()
			};

			// Add duration only if model supports it
			if (this.modelSupportsDuration) {
				body.duration = this.duration;
			}

			// Add optional parameters based on model capabilities
			if (this.modelSupportsAspectRatio) {
				body.resolution = this.selectedAspectRatio;
			}

			if (this.modelSupportsImageInput && imageUrl) {
				body.imageUrl = imageUrl;
			}

			if (this.modelSupportsSeed && this.seed.trim()) {
				const seedNum = parseInt(this.seed.trim(), 10);
				if (!isNaN(seedNum)) {
					body.seed = seedNum;
				}
			}

			if (this.modelSupportsQuality && this.selectedQuality) {
				body.quality = this.selectedQuality;
			}

			if (this.modelSupportsStyle && this.selectedStyle) {
				body.style = this.selectedStyle;
			}

			// Add end image handling
			if (this.modelSupportsImageEnd && this.endImageFile) {
				let endImageUrl = this.uploadedEndImageUrl;
				if (!endImageUrl) {
					endImageUrl = await this.uploadEndImage();
				}
				body.imageEndUrl = endImageUrl;
			}

			const response = await fetch('/api/video-generation', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(body)
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to generate video');
			}

			// Reload history to show the new video
			await this.loadHistory();

			// Close generation dialog and auto-open dialog with the newly created video
			this.generationDialogOpen = false;
			if (this.history.length > 0) {
				const newItem = this.history[0];
				this.openDialog(newItem);
			}

			// Clear input after successful generation
			this.inputPrompt = '';
			this.seed = '';
			this.clearStartImage();
		} catch (error) {
			console.error('Video generation error:', error);
			this.generationDialogOpen = false;
			this.errorMessage = error instanceof Error ? error.message : 'Failed to generate video';
		} finally {
			this.isGenerating = false;
		}
	}

	/**
	 * Upload start image to storage
	 */
	async uploadStartImage(): Promise<string> {
		if (!this.startImageFile) {
			throw new Error('No start image to upload');
		}

		// Convert file to base64
		const base64Promise = new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const result = reader.result as string;
				const base64Data = result.split(',')[1]; // Remove data URL prefix
				resolve(base64Data);
			};
			reader.onerror = reject;
			reader.readAsDataURL(this.startImageFile!);
		});

		const base64Data = await base64Promise;

		const response = await fetch('/api/images', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				imageData: base64Data,
				mimeType: this.startImageFile.type,
				filename: this.startImageFile.name
			})
		});

		const data = await response.json();

		if (!response.ok) {
			throw new Error(data.error || 'Failed to upload start image');
		}

		this.uploadedImageUrl = data.imageUrl;
		return data.imageUrl;
	}

	// ==================== Start Image Methods ====================

	/**
	 * Handle start image file upload
	 */
	handleStartImageUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (file) {
			// Validate file type
			if (!file.type.startsWith('image/')) {
				this.errorMessage = 'Please select an image file';
				return;
			}

			// Validate file size (max 10MB)
			if (file.size > 10 * 1024 * 1024) {
				this.errorMessage = 'Image must be less than 10MB';
				return;
			}

			this.startImageFile = file;
			this.uploadedImageUrl = null; // Reset uploaded URL when new file is selected

			// Create preview URL
			if (this.startImagePreview) {
				URL.revokeObjectURL(this.startImagePreview);
			}
			this.startImagePreview = URL.createObjectURL(file);
		}
	}

	/**
	 * Clear start image
	 */
	clearStartImage() {
		if (this.startImagePreview) {
			URL.revokeObjectURL(this.startImagePreview);
		}
		this.startImageFile = null;
		this.startImagePreview = null;
		this.uploadedImageUrl = null;
	}

	/**
	 * Set start image from an existing URL (for "Create Video" flow)
	 * @param imageUrl - URL of the image to use as start frame
	 * @param prompt - Optional prompt to carry over from image generation
	 */
	setStartImageFromUrl(imageUrl: string, prompt?: string) {
		// Clear any existing file reference
		this.startImageFile = null;

		// Set the URL directly (no need to upload, already in storage)
		this.uploadedImageUrl = imageUrl;
		this.startImagePreview = imageUrl;

		// Set prompt if provided
		if (prompt) {
			this.inputPrompt = prompt;
		}

		// Select Veo 3.1 Fast model (supports image input)
		this.selectedModel = 'veo-3.1-fast';
		this.resetOptionalParameters();
	}

	// ==================== End Image Methods ====================

	/**
	 * Handle end image file upload
	 */
	handleEndImageUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (file) {
			// Validate file type
			if (!file.type.startsWith('image/')) {
				this.errorMessage = 'Please select an image file';
				return;
			}

			// Validate file size (max 10MB)
			if (file.size > 10 * 1024 * 1024) {
				this.errorMessage = 'Image must be less than 10MB';
				return;
			}

			this.endImageFile = file;
			this.uploadedEndImageUrl = null; // Reset uploaded URL when new file is selected

			// Create preview URL
			if (this.endImagePreview) {
				URL.revokeObjectURL(this.endImagePreview);
			}
			this.endImagePreview = URL.createObjectURL(file);
		}
	}

	/**
	 * Clear end image
	 */
	clearEndImage() {
		if (this.endImagePreview) {
			URL.revokeObjectURL(this.endImagePreview);
		}
		this.endImageFile = null;
		this.endImagePreview = null;
		this.uploadedEndImageUrl = null;
	}

	/**
	 * Swap start and end images
	 */
	swapStartEndImages() {
		// Store current start values
		const tempFile = this.startImageFile;
		const tempPreview = this.startImagePreview;
		const tempUploadedUrl = this.uploadedImageUrl;

		// Move end to start
		this.startImageFile = this.endImageFile;
		this.startImagePreview = this.endImagePreview;
		this.uploadedImageUrl = this.uploadedEndImageUrl;

		// Move start to end
		this.endImageFile = tempFile;
		this.endImagePreview = tempPreview;
		this.uploadedEndImageUrl = tempUploadedUrl;
	}

	/**
	 * Upload end image to storage
	 */
	async uploadEndImage(): Promise<string> {
		if (!this.endImageFile) {
			throw new Error('No end image to upload');
		}

		// Convert file to base64
		const base64Promise = new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const result = reader.result as string;
				const base64Data = result.split(',')[1]; // Remove data URL prefix
				resolve(base64Data);
			};
			reader.onerror = reject;
			reader.readAsDataURL(this.endImageFile!);
		});

		const base64Data = await base64Promise;

		const response = await fetch('/api/images', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				imageData: base64Data,
				mimeType: this.endImageFile.type,
				filename: this.endImageFile.name
			})
		});

		const data = await response.json();

		if (!response.ok) {
			throw new Error(data.error || 'Failed to upload end image');
		}

		this.uploadedEndImageUrl = data.imageUrl;
		return data.imageUrl;
	}

	// ==================== History Methods ====================

	/**
	 * Load video history from API (resets and loads first batch)
	 */
	async loadHistory() {
		this.history = [];
		this.hasMore = true;
		await this.loadMore();
	}

	/**
	 * Load more videos (append to existing history)
	 */
	async loadMore() {
		if (this.isLoadingHistory || !this.hasMore) return;

		this.isLoadingHistory = true;
		this.errorMessage = null; // Clear previous errors

		// Set up request timeout (30 seconds)
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 30000);

		try {
			const offset = this.history.length;
			const response = await fetch(
				`/api/library?type=videos&limit=${this.batchSize}&offset=${offset}`,
				{ signal: controller.signal }
			);
			if (!response.ok) {
				throw new Error('Failed to load video history');
			}

			const data = await response.json();
			const newVideos = data.media || [];

			this.history = [...this.history, ...newVideos];
			this.hasMore = data.hasMore ?? false;
		} catch (error) {
			console.error('Failed to load video history:', error);
			// Set user-visible error message
			if (error instanceof Error && error.name === 'AbortError') {
				this.errorMessage = 'Request timed out. Scroll to try again.';
			} else {
				this.errorMessage = error instanceof Error
					? error.message
					: 'Failed to load more videos. Scroll to try again.';
			}
			// Keep hasMore true to allow retry on next scroll
		} finally {
			clearTimeout(timeout);
			this.isLoadingHistory = false;
		}
	}

	/**
	 * Delete video from history
	 */
	async deleteVideo(videoId: string) {
		if (!confirm('Are you sure you want to delete this video?')) return;

		try {
			const response = await fetch(`/api/videos/${videoId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				throw new Error('Failed to delete video');
			}

			// Remove from history
			this.history = this.history.filter(item => item.id !== videoId);

			// Close dialog if this video was selected
			if (this.selectedVideoId === videoId) {
				this.closeDialog();
			}
		} catch (error) {
			console.error('Failed to delete video:', error);
			alert('Failed to delete video. Please try again.');
		}
	}

	/**
	 * Download video
	 */
	downloadVideo(videoUrl: string, filename: string) {
		const link = document.createElement('a');
		link.href = videoUrl;
		link.download = filename;
		link.target = '_blank';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	// ==================== Dialog Methods ====================

	/**
	 * Open dialog with selected video
	 */
	openDialog(item: VideoHistoryItem) {
		this.selectedVideoId = item.id;
		this.selectedVideoUrl = item.url;
		this.selectedVideoFilename = item.filename;
		this.selectedVideoCreatedAt = item.createdAt;
		this.selectedVideoDuration = item.duration;
		this.selectedVideoResolution = item.resolution;
		// Set metadata
		this.selectedVideoPrompt = item.prompt;
		this.selectedVideoModel = item.model;
		this.selectedVideoAspectRatio = item.aspectRatio;
		this.selectedVideoSeed = item.seed;
		this.selectedVideoQuality = item.quality;
		this.selectedVideoStyle = item.style;
		this.selectedVideoImageStartUrl = item.imageStartUrl;
		this.selectedVideoImageEndUrl = item.imageEndUrl;
		this.selectedVideoFps = item.fps;
		this.selectedVideoHasAudio = item.hasAudio;
		this.selectedVideoFileSize = item.fileSize;
		this.dialogOpen = true;
		this.isPlaying = false;
		this.currentTime = 0;
		// Auto-mute if video has no audio
		this.isMuted = !item.hasAudio;
	}

	/**
	 * Close dialog
	 */
	closeDialog() {
		// Stop video if playing
		if (this.videoElement) {
			this.videoElement.pause();
			this.videoElement.currentTime = 0;
		}
		this.dialogOpen = false;
		this.selectedVideoId = '';
		this.selectedVideoUrl = '';
		this.selectedVideoFilename = '';
		this.selectedVideoCreatedAt = '';
		this.selectedVideoDuration = null;
		this.selectedVideoResolution = null;
		// Clear metadata
		this.selectedVideoPrompt = null;
		this.selectedVideoModel = null;
		this.selectedVideoAspectRatio = null;
		this.selectedVideoSeed = null;
		this.selectedVideoQuality = null;
		this.selectedVideoStyle = null;
		this.selectedVideoImageStartUrl = null;
		this.selectedVideoImageEndUrl = null;
		this.selectedVideoFps = null;
		this.selectedVideoHasAudio = false;
		this.selectedVideoFileSize = 0;
		this.isPlaying = false;
		this.currentTime = 0;
		this.videoDuration = 0;
	}

	/**
	 * Recreate the currently viewed video by restoring its generation parameters.
	 * Returns: { success: boolean, reason?: string }
	 */
	recreateVideo(): { success: boolean; reason?: string } {
		// Validate we have metadata to recreate
		if (!this.selectedVideoPrompt && !this.selectedVideoModel) {
			return { success: false, reason: 'No generation metadata available for this video' };
		}

		// Set prompt
		if (this.selectedVideoPrompt) {
			this.inputPrompt = this.selectedVideoPrompt;
		}

		// Set model if valid (don't call resetOptionalParameters to preserve values)
		if (this.selectedVideoModel && this.models.find(m => m.name === this.selectedVideoModel)) {
			this.selectedModel = this.selectedVideoModel;
		}

		// Set aspect ratio
		if (this.selectedVideoAspectRatio) {
			this.selectedAspectRatio = this.selectedVideoAspectRatio;
		}

		// Set seed
		if (this.selectedVideoSeed !== null) {
			this.seed = String(this.selectedVideoSeed);
		} else {
			this.seed = '';
		}

		// Set quality
		if (this.selectedVideoQuality) {
			this.selectedQuality = this.selectedVideoQuality;
		}

		// Set style
		if (this.selectedVideoStyle) {
			this.selectedStyle = this.selectedVideoStyle;
		}

		// Always clear existing references first, then set new ones if present
		this.clearStartImage();
		this.clearEndImage();
		if (this.selectedVideoImageStartUrl) {
			this.uploadedImageUrl = this.selectedVideoImageStartUrl;
			this.startImagePreview = this.selectedVideoImageStartUrl;
		}
		if (this.selectedVideoImageEndUrl) {
			this.uploadedEndImageUrl = this.selectedVideoImageEndUrl;
			this.endImagePreview = this.selectedVideoImageEndUrl;
		}

		this.closeDialog();
		return { success: true };
	}

	// ==================== Playback Methods ====================

	/**
	 * Toggle play/pause
	 */
	togglePlayPause() {
		if (!this.videoElement) return;

		if (this.isPlaying) {
			this.videoElement.pause();
		} else {
			this.videoElement.play();
		}
		this.isPlaying = !this.isPlaying;
	}

	/**
	 * Handle video time update
	 */
	handleTimeUpdate() {
		if (!this.videoElement) return;
		this.currentTime = this.videoElement.currentTime;
	}

	/**
	 * Handle video loaded metadata
	 */
	handleLoadedMetadata() {
		if (!this.videoElement) return;
		this.videoDuration = this.videoElement.duration;
	}

	/**
	 * Handle video ended
	 */
	handleVideoEnded() {
		this.isPlaying = false;
		this.currentTime = this.videoDuration;
	}

	/**
	 * Seek video to specific time
	 */
	seekTo(time: number) {
		if (!this.videoElement) return;
		this.videoElement.currentTime = time;
		this.currentTime = time;
	}

	/**
	 * Toggle mute state
	 */
	toggleMute() {
		if (!this.videoElement) return;
		this.isMuted = !this.isMuted;
		this.videoElement.muted = this.isMuted;
	}

	/**
	 * Set volume level (0-1)
	 */
	setVolume(value: number) {
		if (!this.videoElement) return;
		this.volume = Math.max(0, Math.min(1, value));
		this.videoElement.volume = this.volume;
		if (this.volume === 0) {
			this.isMuted = true;
			this.videoElement.muted = true;
		} else if (this.isMuted) {
			this.isMuted = false;
			this.videoElement.muted = false;
		}
	}

	/**
	 * Toggle fullscreen mode (uses container to keep controls visible)
	 */
	toggleFullscreen() {
		const element = this.videoContainerElement || this.videoElement;
		if (!element) return;
		if (document.fullscreenElement) {
			document.exitFullscreen();
		} else {
			element.requestFullscreen();
		}
	}

	// ==================== Helper Methods ====================

	/**
	 * Get model display name by name
	 */
	getModelDisplayName(modelName: string): string {
		return this.models.find(m => m.name === modelName)?.displayName || modelName;
	}
}
