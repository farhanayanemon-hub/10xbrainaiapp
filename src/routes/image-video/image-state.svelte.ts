import type { AIModelConfig } from '$lib/ai/types.js';
import {
	IMAGE_MODEL_CAPABILITIES,
	DEFAULT_IMAGE_ASPECT_RATIO,
	DEFAULT_IMAGE_MODEL,
	getModelAspectRatioOptions,
	getModelQualityOptions,
	getModelStyleOptions,
	getModelNumberOfImagesRange,
	getModelUpscaleOptions,
	getModelCompressionRange
} from '$lib/constants/model-capabilities.js';
import { MODEL_CONFIGS } from '$lib/constants/replicate-model-configs.js';

/**
 * Image history item interface
 */
export interface ImageHistoryItem {
	id: string;
	filename: string;
	mimeType: string;
	fileSize: number;
	storageLocation: string;
	cloudPath: string | null;
	createdAt: string;
	chatId: string | null;
	chatTitle: string | null;
	chatModel: string | null;
	type: 'image';
	url: string;
	// Generation metadata
	prompt: string | null;
	model: string | null;
	aspectRatio: string | null;
	seed: number | null;
	quality: string | null;
	style: string | null;
	numberOfImages: number | null;
	referenceImageUrl: string | null;
	upscaleFactor: string | null;
	compressionQuality: number | null;
}

/**
 * ImageState - Image generation state management class
 *
 * Encapsulates all image generation-related state and methods for the /image-video page.
 * Uses Svelte 5 runes for reactive state management.
 */
export class ImageState {

	// Models
	models = $state<AIModelConfig[]>([]);
	selectedModel = $state<string>(DEFAULT_IMAGE_MODEL);

	// Input
	inputPrompt = $state<string>('');
	selectedAspectRatio = $state<string>(DEFAULT_IMAGE_ASPECT_RATIO);
	seed = $state<string>('');

	// New optional parameters
	selectedQuality = $state<string>('');
	selectedStyle = $state<string>('');
	numberOfImages = $state<number>(1);

	// Upscaler-specific parameters
	selectedUpscaleFactor = $state<string>('');
	compressionQuality = $state<number>(80);

	// Image references (for i2i) - arrays to support multiple images for models that support it
	imageReferenceFiles = $state<File[]>([]);
	imageReferencePreviews = $state<string[]>([]);
	uploadedImageUrls = $state<string[]>([]);

	// Generation state
	isGenerating = $state<boolean>(false);
	generationDialogOpen = $state<boolean>(false);
	errorMessage = $state<string | null>(null);

	// History (infinite scroll)
	history = $state<ImageHistoryItem[]>([]);
	readonly batchSize = 12;
	hasMore = $state<boolean>(true);
	isLoadingHistory = $state<boolean>(false);

	// Lightbox
	lightboxOpen = $state<boolean>(false);
	selectedImageId = $state<string>('');
	selectedImageUrl = $state<string>('');
	selectedImageFilename = $state<string>('');
	selectedImageCreatedAt = $state<string>('');
	// Selected image metadata
	selectedImagePrompt = $state<string | null>(null);
	selectedImageModel = $state<string | null>(null);
	selectedImageAspectRatio = $state<string | null>(null);
	selectedImageSeed = $state<number | null>(null);
	selectedImageQuality = $state<string | null>(null);
	selectedImageStyle = $state<string | null>(null);
	selectedImageNumberOfImages = $state<number | null>(null);
	selectedImageReferenceUrls = $state<string[] | null>(null);
	selectedImageUpscaleFactor = $state<string | null>(null);
	selectedImageCompressionQuality = $state<number | null>(null);
	selectedImageFileSize = $state<number>(0);

	// Derived: model capabilities
	get modelCapabilities() {
		return IMAGE_MODEL_CAPABILITIES[this.selectedModel] || {
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

	get modelSupportsNumberOfImages() {
		return this.modelCapabilities.supportsNumberOfImages;
	}

	get modelSupportsUpscale() {
		return this.modelCapabilities.supportsUpscale;
	}

	get modelSupportsCompression() {
		return this.modelCapabilities.supportsCompression;
	}

	// Check if model supports multiple image inputs (from MODEL_CONFIGS)
	get modelSupportsMultipleImageInput(): boolean {
		const config = MODEL_CONFIGS[this.selectedModel];
		return !!(config?.imageInputParam?.isArray && config?.imageInputParam?.needsDataUri);
	}

	// Derived: quality options for selected model (from MODEL_CONFIGS)
	get qualityOptions(): readonly string[] {
		return getModelQualityOptions(this.selectedModel);
	}

	// Derived: style options for selected model (from MODEL_CONFIGS)
	get styleOptions(): readonly string[] {
		return getModelStyleOptions(this.selectedModel);
	}

	// Derived: number of images range for selected model (from MODEL_CONFIGS)
	get numberOfImagesRange(): { min: number; max: number } | null {
		return getModelNumberOfImagesRange(this.selectedModel);
	}

	// Derived: number of images options array for dropdown
	get numberOfImagesOptions(): number[] {
		const range = this.numberOfImagesRange;
		if (!range) return [];
		const options: number[] = [];
		for (let i = range.min; i <= range.max; i++) {
			options.push(i);
		}
		return options;
	}

	// Derived: upscale options for selected model (from MODEL_CONFIGS)
	get upscaleOptions(): readonly string[] {
		return getModelUpscaleOptions(this.selectedModel);
	}

	// Derived: compression range for selected model (from MODEL_CONFIGS)
	get compressionRange(): { min: number; max: number } | null {
		return getModelCompressionRange(this.selectedModel);
	}

	// Check if the current model is an upscaler (doesn't support text input)
	get isUpscalerModel(): boolean {
		const model = this.models.find(m => m.name === this.selectedModel);
		return model ? model.supportsTextInput === false : false;
	}

	// Get selected model display name
	get selectedModelName() {
		return this.models.find(m => m.name === this.selectedModel)?.displayName || this.selectedModel;
	}

	// ==================== Model Methods ====================

	/**
	 * Load image generation models from API
	 */
	async loadModels() {
		try {
			const response = await fetch('/api/models?type=image');
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

		// Reset numberOfImages to min if available
		const numRange = getModelNumberOfImagesRange(this.selectedModel);
		this.numberOfImages = numRange ? numRange.min : 1;

		// Reset aspect ratio to first option if available, otherwise default
		const arOpts = getModelAspectRatioOptions(this.selectedModel);
		this.selectedAspectRatio = arOpts.length > 0 ? arOpts[0] : DEFAULT_IMAGE_ASPECT_RATIO;

		// Reset upscale factor to first option if available
		const upOpts = getModelUpscaleOptions(this.selectedModel);
		this.selectedUpscaleFactor = upOpts.length > 0 ? upOpts[0] : '';

		// Reset compression quality to 80 (high quality default) if available
		const compRange = getModelCompressionRange(this.selectedModel);
		this.compressionQuality = compRange ? 80 : 80;

		// Clear image references when switching models (different models have different image input requirements)
		this.clearAllImageReferences();
	}

	// ==================== Generation Methods ====================

	/**
	 * Generate image from prompt
	 */
	async handleGenerate() {
		// For upscaler models, image is required but prompt is optional
		if (this.isUpscalerModel) {
			if (this.imageReferenceFiles.length === 0 && this.uploadedImageUrls.length === 0) {
				this.errorMessage = 'Please upload an image to upscale';
				return;
			}
		} else {
			// For regular models, prompt is required
			if (!this.inputPrompt.trim()) return;
		}

		this.isGenerating = true;
		this.generationDialogOpen = true;
		this.errorMessage = null;

		try {
			// If there are reference image files, upload them first
			let imageUrls = this.uploadedImageUrls;
			if (this.imageReferenceFiles.length > 0 && imageUrls.length === 0) {
				imageUrls = await this.uploadReferenceImages();
			}

			// Build request body
			const body: Record<string, unknown> = {
				model: this.selectedModel,
				prompt: this.inputPrompt.trim()
			};

			// Add optional parameters based on model capabilities
			if (this.modelSupportsAspectRatio) {
				body.size = this.selectedAspectRatio;
			}

			// Handle image URLs - use imageUrls array for multi-image models, single imageUrl for single-image models
			if (this.modelSupportsImageInput && imageUrls.length > 0) {
				if (this.modelSupportsMultipleImageInput) {
					body.imageUrls = imageUrls; // Always array for multi-image models (even with 1 image)
				} else {
					body.imageUrl = imageUrls[0]; // Single URL for single-image models
				}
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

			if (this.modelSupportsNumberOfImages && this.numberOfImages > 1) {
				body.numberOfImages = this.numberOfImages;
			}

			if (this.modelSupportsUpscale && this.selectedUpscaleFactor) {
				body.upscaleFactor = this.selectedUpscaleFactor;
			}

			if (this.modelSupportsCompression && this.compressionQuality !== undefined) {
				body.compressionQuality = this.compressionQuality;
			}

			const response = await fetch('/api/image-generation', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(body)
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to generate image');
			}

			// Reload history to show the new image
			await this.loadHistory();

			// Close generation dialog and auto-open lightbox with the newly created image
			this.generationDialogOpen = false;
			if (this.history.length > 0) {
				const newItem = this.history[0];
				this.openLightbox(newItem);
			}

			// Clear input after successful generation
			this.inputPrompt = '';
			this.seed = '';
			this.clearAllImageReferences();
		} catch (error) {
			console.error('Image generation error:', error);
			this.generationDialogOpen = false;
			this.errorMessage = error instanceof Error ? error.message : 'Failed to generate image';
		} finally {
			this.isGenerating = false;
		}
	}

	/**
	 * Upload all reference images to storage
	 */
	async uploadReferenceImages(): Promise<string[]> {
		if (this.imageReferenceFiles.length === 0) {
			return [];
		}

		const uploadedUrls: string[] = [];

		for (const file of this.imageReferenceFiles) {
			// Convert file to base64
			const base64Data = await new Promise<string>((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => {
					const result = reader.result as string;
					const base64 = result.split(',')[1]; // Remove data URL prefix
					resolve(base64);
				};
				reader.onerror = reject;
				reader.readAsDataURL(file);
			});

			const response = await fetch('/api/images', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					imageData: base64Data,
					mimeType: file.type,
					filename: file.name
				})
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to upload reference image');
			}

			uploadedUrls.push(data.imageUrl);
		}

		this.uploadedImageUrls = uploadedUrls;
		return uploadedUrls;
	}

	// ==================== Image Reference Methods ====================

	/**
	 * Handle image reference file upload (supports multiple files for multi-image models)
	 */
	handleImageReferenceUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const files = input.files;

		if (!files || files.length === 0) return;

		const newFiles: File[] = [];
		const newPreviews: string[] = [];

		for (const file of Array.from(files)) {
			// Validate file type
			if (!file.type.startsWith('image/')) {
				this.errorMessage = 'Please select image files only';
				continue;
			}

			// Validate file size (max 10MB per file)
			if (file.size > 10 * 1024 * 1024) {
				this.errorMessage = 'Each image must be less than 10MB';
				continue;
			}

			newFiles.push(file);
			newPreviews.push(URL.createObjectURL(file));
		}

		if (newFiles.length === 0) return;

		if (this.modelSupportsMultipleImageInput) {
			// Append to existing files for multi-image models
			this.imageReferenceFiles = [...this.imageReferenceFiles, ...newFiles];
			this.imageReferencePreviews = [...this.imageReferencePreviews, ...newPreviews];
			this.uploadedImageUrls = []; // Reset uploaded URLs since we have new files
		} else {
			// Single file mode - replace existing
			this.clearAllImageReferences();
			this.imageReferenceFiles = newFiles.slice(0, 1);
			this.imageReferencePreviews = newPreviews.slice(0, 1);
		}

		// Reset file input to allow re-selecting same files
		input.value = '';
	}

	/**
	 * Remove a specific image reference by index
	 */
	removeImageReference(index: number) {
		// Check against previews length (source of truth for UI)
		if (index < 0 || index >= this.imageReferencePreviews.length) return;

		// Only revoke if it's an object URL (blob:), not a storage URL
		const preview = this.imageReferencePreviews[index];
		if (preview && preview.startsWith('blob:')) {
			URL.revokeObjectURL(preview);
		}

		// Remove from files array only if it has an item at this index
		if (index < this.imageReferenceFiles.length) {
			this.imageReferenceFiles = this.imageReferenceFiles.filter((_, i) => i !== index);
		}

		// Remove from previews
		this.imageReferencePreviews = this.imageReferencePreviews.filter((_, i) => i !== index);

		// Remove from uploadedImageUrls if it has an item at this index
		if (index < this.uploadedImageUrls.length) {
			this.uploadedImageUrls = this.uploadedImageUrls.filter((_, i) => i !== index);
		}
	}

	/**
	 * Clear all image references
	 */
	clearAllImageReferences() {
		// Only revoke object URLs (blob:), not storage URLs
		this.imageReferencePreviews.forEach(preview => {
			if (preview && preview.startsWith('blob:')) {
				URL.revokeObjectURL(preview);
			}
		});
		this.imageReferenceFiles = [];
		this.imageReferencePreviews = [];
		this.uploadedImageUrls = [];
	}

	/**
	 * Use the currently viewed lightbox image as a reference for i2i generation.
	 * Returns: { success: boolean, isMultiImage: boolean }
	 */
	useAsReference(): { success: boolean; isMultiImage: boolean } {
		if (!this.selectedImageUrl || !this.modelSupportsImageInput) {
			return { success: false, isMultiImage: false };
		}

		const imageUrl = this.selectedImageUrl;
		const isMultiImage = this.modelSupportsMultipleImageInput;

		if (isMultiImage) {
			// Multi-image models: append (avoid duplicates)
			if (!this.uploadedImageUrls.includes(imageUrl)) {
				this.uploadedImageUrls = [...this.uploadedImageUrls, imageUrl];
				this.imageReferencePreviews = [...this.imageReferencePreviews, imageUrl];
			}
		} else {
			// Single-image models: replace existing
			this.clearAllImageReferences();
			this.uploadedImageUrls = [imageUrl];
			this.imageReferencePreviews = [imageUrl];
		}

		this.closeLightbox();
		return { success: true, isMultiImage };
	}

	/**
	 * Use the currently viewed lightbox image for upscaling with Google Upscaler.
	 * Returns: { success: boolean }
	 */
	upscaleImage(): { success: boolean } {
		if (!this.selectedImageUrl) {
			return { success: false };
		}

		const imageUrl = this.selectedImageUrl;

		// Clear existing references and set the new one
		this.clearAllImageReferences();
		this.uploadedImageUrls = [imageUrl];
		this.imageReferencePreviews = [imageUrl];

		// Switch to upscaler model
		this.selectedModel = 'upscaler';

		// Close lightbox
		this.closeLightbox();

		return { success: true };
	}

	/**
	 * Recreate the currently viewed lightbox image by restoring its generation parameters.
	 * Returns: { success: boolean, reason?: string }
	 */
	recreateImage(): { success: boolean; reason?: string } {
		// Validate we have metadata to recreate
		if (!this.selectedImagePrompt && !this.selectedImageModel) {
			return { success: false, reason: 'No generation metadata available for this image' };
		}

		// Set prompt
		if (this.selectedImagePrompt) {
			this.inputPrompt = this.selectedImagePrompt;
		}

		// Set model if valid (don't call resetOptionalParameters to preserve values)
		if (this.selectedImageModel && this.models.find(m => m.name === this.selectedImageModel)) {
			this.selectedModel = this.selectedImageModel;
		}

		// Set aspect ratio
		if (this.selectedImageAspectRatio) {
			this.selectedAspectRatio = this.selectedImageAspectRatio;
		}

		// Set seed
		if (this.selectedImageSeed !== null) {
			this.seed = String(this.selectedImageSeed);
		} else {
			this.seed = '';
		}

		// Set quality
		if (this.selectedImageQuality) {
			this.selectedQuality = this.selectedImageQuality;
		}

		// Set style
		if (this.selectedImageStyle) {
			this.selectedStyle = this.selectedImageStyle;
		}

		// Set number of images
		if (this.selectedImageNumberOfImages !== null) {
			this.numberOfImages = this.selectedImageNumberOfImages;
		}

		// Set upscaler-specific parameters
		if (this.selectedImageUpscaleFactor) {
			this.selectedUpscaleFactor = this.selectedImageUpscaleFactor;
		}
		if (this.selectedImageCompressionQuality !== null) {
			this.compressionQuality = this.selectedImageCompressionQuality;
		}

		// Always clear existing references first, then set new ones if present
		this.clearAllImageReferences();
		if (this.selectedImageReferenceUrls && this.selectedImageReferenceUrls.length > 0) {
			this.uploadedImageUrls = [...this.selectedImageReferenceUrls];
			this.imageReferencePreviews = [...this.selectedImageReferenceUrls];
		}

		this.closeLightbox();
		return { success: true };
	}

	// ==================== History Methods ====================

	/**
	 * Load image history from API (resets and loads first batch)
	 */
	async loadHistory() {
		this.history = [];
		this.hasMore = true;
		await this.loadMore();
	}

	/**
	 * Load more images (append to existing history)
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
				`/api/library?type=images&limit=${this.batchSize}&offset=${offset}`,
				{ signal: controller.signal }
			);
			if (!response.ok) {
				throw new Error('Failed to load image history');
			}

			const data = await response.json();
			const newImages = data.media || [];

			this.history = [...this.history, ...newImages];
			this.hasMore = data.hasMore ?? false;
		} catch (error) {
			console.error('Failed to load image history:', error);
			// Set user-visible error message
			if (error instanceof Error && error.name === 'AbortError') {
				this.errorMessage = 'Request timed out. Scroll to try again.';
			} else {
				this.errorMessage = error instanceof Error
					? error.message
					: 'Failed to load more images. Scroll to try again.';
			}
			// Keep hasMore true to allow retry on next scroll
		} finally {
			clearTimeout(timeout);
			this.isLoadingHistory = false;
		}
	}

	/**
	 * Delete image from history
	 */
	async deleteImage(imageId: string) {
		if (!confirm('Are you sure you want to delete this image?')) return;

		try {
			const response = await fetch(`/api/images/${imageId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				throw new Error('Failed to delete image');
			}

			// Remove from history
			this.history = this.history.filter(item => item.id !== imageId);

			// Close lightbox if this image was selected
			if (this.selectedImageId === imageId) {
				this.closeLightbox();
			}
		} catch (error) {
			console.error('Failed to delete image:', error);
			alert('Failed to delete image. Please try again.');
		}
	}

	/**
	 * Download image
	 */
	downloadImage(imageUrl: string, filename: string) {
		const link = document.createElement('a');
		link.href = imageUrl;
		link.download = filename;
		link.target = '_blank';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	// ==================== Lightbox Methods ====================

	/**
	 * Open lightbox with selected image
	 */
	openLightbox(item: ImageHistoryItem) {
		this.selectedImageId = item.id;
		this.selectedImageUrl = item.url;
		this.selectedImageFilename = item.filename;
		this.selectedImageCreatedAt = item.createdAt;
		// Set metadata
		this.selectedImagePrompt = item.prompt;
		this.selectedImageModel = item.model;
		this.selectedImageAspectRatio = item.aspectRatio;
		this.selectedImageSeed = item.seed;
		this.selectedImageQuality = item.quality;
		this.selectedImageStyle = item.style;
		this.selectedImageNumberOfImages = item.numberOfImages;
		// Parse reference URLs - can be a single URL or JSON array
		if (item.referenceImageUrl) {
			if (item.referenceImageUrl.startsWith('[')) {
				try {
					this.selectedImageReferenceUrls = JSON.parse(item.referenceImageUrl);
				} catch {
					this.selectedImageReferenceUrls = [item.referenceImageUrl];
				}
			} else {
				this.selectedImageReferenceUrls = [item.referenceImageUrl];
			}
		} else {
			this.selectedImageReferenceUrls = null;
		}
		this.selectedImageUpscaleFactor = item.upscaleFactor;
		this.selectedImageCompressionQuality = item.compressionQuality;
		this.selectedImageFileSize = item.fileSize;
		this.lightboxOpen = true;
	}

	/**
	 * Close lightbox
	 */
	closeLightbox() {
		this.lightboxOpen = false;
		this.selectedImageId = '';
		this.selectedImageUrl = '';
		this.selectedImageFilename = '';
		this.selectedImageCreatedAt = '';
		// Clear metadata
		this.selectedImagePrompt = null;
		this.selectedImageModel = null;
		this.selectedImageAspectRatio = null;
		this.selectedImageSeed = null;
		this.selectedImageQuality = null;
		this.selectedImageStyle = null;
		this.selectedImageNumberOfImages = null;
		this.selectedImageReferenceUrls = null;
		this.selectedImageUpscaleFactor = null;
		this.selectedImageCompressionQuality = null;
		this.selectedImageFileSize = 0;
	}

	/**
	 * Navigate to previous image in lightbox
	 */
	previousImage() {
		const currentIndex = this.history.findIndex(item => item.id === this.selectedImageId);
		if (currentIndex > 0) {
			this.openLightbox(this.history[currentIndex - 1]);
		}
	}

	/**
	 * Navigate to next image in lightbox
	 */
	nextImage() {
		const currentIndex = this.history.findIndex(item => item.id === this.selectedImageId);
		if (currentIndex < this.history.length - 1) {
			this.openLightbox(this.history[currentIndex + 1]);
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
