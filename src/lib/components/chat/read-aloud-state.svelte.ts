import { toast } from "svelte-sonner";
import { READ_ALOUD_DEFAULTS } from "$lib/constants/elevenlabs.js";

/**
 * ReadAloudState - Text-to-Speech playback state management class
 *
 * Manages inline TTS playback for AI messages in the chat interface.
 * Uses Svelte 5 runes for reactive state management.
 * Supports caching: audio is saved per-message and reused on subsequent plays.
 */
export class ReadAloudState {
	// Configuration (from shared constants - single source of truth)
	readonly defaultModel = READ_ALOUD_DEFAULTS.model;
	readonly defaultVoiceId = READ_ALOUD_DEFAULTS.voiceId;
	readonly defaultVoiceSettings = READ_ALOUD_DEFAULTS.voiceSettings;
	readonly maxTextLength = READ_ALOUD_DEFAULTS.maxTextLength;

	// Playback state
	currentlyReadingMessageIndex = $state<number | null>(null);
	isGenerating = $state<boolean>(false);
	isPlaying = $state<boolean>(false);
	audioElement = $state<HTMLAudioElement | null>(null);
	audioUrl = $state<string | null>(null);
	errorMessage = $state<string | null>(null);

	// Progress tracking
	currentTime = $state<number>(0);
	duration = $state<number>(0);

	// In-memory cache of audio IDs per message index (for current chat session)
	// This avoids hitting the API when replaying the same message
	private audioCache = new Map<number, { audioId: string; text: string }>();

	// Track bound event handlers for proper cleanup (prevents memory leaks)
	private boundHandlers: {
		timeupdate: () => void;
		loadedmetadata: () => void;
		ended: () => void;
		error: () => void;
	} | null = null;

	// AbortController for cancelling in-flight requests (prevents race conditions)
	private abortController: AbortController | null = null;

	/**
	 * Clear the audio cache (call when chat changes)
	 */
	clearCache(): void {
		this.audioCache.clear();
	}

	/**
	 * Invalidate cache for a specific message index (call after message edit)
	 * @param messageIndex - Index of the edited message
	 */
	invalidateCacheForMessageIndex(messageIndex: number): void {
		this.audioCache.delete(messageIndex);
	}

	/**
	 * Start reading a message aloud
	 * @param messageIndex - Index of the message in the messages array
	 * @param content - Text content of the message
	 * @param chatId - Optional chat ID for caching (if null, uses direct generation without caching)
	 */
	async startReadAloud(messageIndex: number, content: string, chatId: string | null): Promise<void> {
		// If same message is playing, stop it (toggle behavior)
		if (this.currentlyReadingMessageIndex === messageIndex && this.isPlaying) {
			this.stopReadAloud();
			return;
		}

		// Stop any currently playing audio and abort any in-flight requests
		this.stopReadAloud();
		this.abortController?.abort();
		this.abortController = new AbortController();

		// Validate content
		if (!content || content.trim().length === 0) {
			toast.error("No content to read");
			return;
		}

		// Truncate if needed
		const textToRead = content.trim().slice(0, this.maxTextLength);

		this.currentlyReadingMessageIndex = messageIndex;
		this.isGenerating = true;
		this.errorMessage = null;

		try {
			let audioUrl: string;

			// Check in-memory cache first (for instant replay within same session)
			const cached = this.audioCache.get(messageIndex);
			if (cached && cached.text === textToRead) {
				// Use cached audio URL directly
				audioUrl = `/api/audio/${cached.audioId}`;
				await this.playAudioFromUrl(audioUrl);
				return;
			}

			// If we have a chatId, use the caching endpoint
			if (chatId) {
				const response = await fetch("/api/read-aloud", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						chatId,
						messageIndex,
						text: textToRead,
					}),
					signal: this.abortController.signal,
				});

				const data = await response.json();

				if (!response.ok) {
					throw new Error(data.error || "Failed to generate audio");
				}

				// Cache the audioId for instant replay
				this.audioCache.set(messageIndex, { audioId: data.audioId, text: textToRead });

				// Play from the API URL (handles both R2 and local storage)
				await this.playAudioFromUrl(data.audioUrl);
			} else {
				// No chatId (unsaved chat) - use direct generation without caching
				await this.generateAndPlayDirectly(textToRead);
			}
		} catch (error) {
			// Ignore abort errors (user cancelled by clicking another message)
			if (error instanceof Error && error.name === "AbortError") {
				return;
			}

			console.error("Read aloud error:", error);
			this.errorMessage =
				error instanceof Error ? error.message : "Failed to generate audio";

			// Check for specific error types
			if (this.errorMessage.includes("Authentication required") || this.errorMessage.includes("Unauthorized")) {
				toast.error("Sign in to use read aloud");
			} else if (this.errorMessage.includes("usage") || this.errorMessage.includes("limit")) {
				toast.error("Audio generation limit reached");
			} else {
				toast.error(this.errorMessage);
			}

			this.currentlyReadingMessageIndex = null;
		} finally {
			this.isGenerating = false;
		}
	}

	/**
	 * Set up event listeners on an audio element with proper tracking for cleanup
	 */
	private setupAudioEventListeners(audio: HTMLAudioElement): void {
		// Clean up any existing listeners first
		this.cleanupAudioEventListeners();

		// Create bound handlers that we can track and remove later
		this.boundHandlers = {
			timeupdate: () => this.handleTimeUpdate(),
			loadedmetadata: () => this.handleLoadedMetadata(),
			ended: () => this.handleEnded(),
			error: () => this.handleError(),
		};

		// Add all event listeners
		audio.addEventListener("timeupdate", this.boundHandlers.timeupdate);
		audio.addEventListener("loadedmetadata", this.boundHandlers.loadedmetadata);
		audio.addEventListener("ended", this.boundHandlers.ended);
		audio.addEventListener("error", this.boundHandlers.error);
	}

	/**
	 * Remove event listeners from the current audio element (prevents memory leaks)
	 */
	private cleanupAudioEventListeners(): void {
		if (this.audioElement && this.boundHandlers) {
			this.audioElement.removeEventListener("timeupdate", this.boundHandlers.timeupdate);
			this.audioElement.removeEventListener("loadedmetadata", this.boundHandlers.loadedmetadata);
			this.audioElement.removeEventListener("ended", this.boundHandlers.ended);
			this.audioElement.removeEventListener("error", this.boundHandlers.error);
		}
		this.boundHandlers = null;
	}

	/**
	 * Play audio from a URL (cached or newly generated)
	 */
	private async playAudioFromUrl(url: string): Promise<void> {
		// Revoke previous blob URL if it exists
		if (this.audioUrl && this.audioUrl.startsWith("blob:")) {
			URL.revokeObjectURL(this.audioUrl);
		}

		this.audioUrl = url;

		// Create and play audio element
		const audio = new Audio(url);
		this.audioElement = audio;

		// Set up event listeners with proper tracking
		this.setupAudioEventListeners(audio);

		// Start playback
		await audio.play();
		this.isPlaying = true;
	}

	/**
	 * Generate audio directly without caching (for unsaved chats)
	 */
	private async generateAndPlayDirectly(text: string): Promise<void> {
		const response = await fetch("/api/audio-generation", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: this.defaultModel,
				text,
				voiceId: this.defaultVoiceId,
				voiceSettings: this.defaultVoiceSettings,
				outputFormat: "mp3_44100_128",
			}),
			signal: this.abortController?.signal,
		});

		const data = await response.json();

		if (!response.ok) {
			throw new Error(data.error || "Failed to generate audio");
		}

		// Convert base64 to blob URL
		const audioData = data.audioData;
		const mimeType = data.mimeType || "audio/mpeg";
		const byteCharacters = atob(audioData);
		const byteNumbers = new Array(byteCharacters.length);
		for (let i = 0; i < byteCharacters.length; i++) {
			byteNumbers[i] = byteCharacters.charCodeAt(i);
		}
		const byteArray = new Uint8Array(byteNumbers);
		const blob = new Blob([byteArray], { type: mimeType });

		// Revoke previous URL to prevent memory leaks
		if (this.audioUrl && this.audioUrl.startsWith("blob:")) {
			URL.revokeObjectURL(this.audioUrl);
		}

		this.audioUrl = URL.createObjectURL(blob);

		// Create and play audio element
		const audio = new Audio(this.audioUrl);
		this.audioElement = audio;

		// Set up event listeners with proper tracking
		this.setupAudioEventListeners(audio);

		// Start playback
		await audio.play();
		this.isPlaying = true;
	}

	/**
	 * Stop reading aloud
	 */
	stopReadAloud(): void {
		// Clean up event listeners BEFORE nullifying the audio element
		this.cleanupAudioEventListeners();

		if (this.audioElement) {
			this.audioElement.pause();
			this.audioElement.currentTime = 0;
			this.audioElement = null;
		}

		// Only revoke blob URLs (not API URLs)
		if (this.audioUrl && this.audioUrl.startsWith("blob:")) {
			URL.revokeObjectURL(this.audioUrl);
		}
		this.audioUrl = null;

		this.isPlaying = false;
		this.currentlyReadingMessageIndex = null;
		this.currentTime = 0;
		this.duration = 0;
	}

	/**
	 * Toggle play/pause for current audio
	 */
	togglePlayPause(): void {
		if (!this.audioElement) return;

		if (this.isPlaying) {
			this.audioElement.pause();
			this.isPlaying = false;
		} else {
			this.audioElement.play();
			this.isPlaying = true;
		}
	}

	/**
	 * Handle audio time update
	 */
	handleTimeUpdate(): void {
		if (this.audioElement) {
			this.currentTime = this.audioElement.currentTime;
		}
	}

	/**
	 * Handle audio metadata loaded
	 */
	handleLoadedMetadata(): void {
		if (this.audioElement) {
			this.duration = this.audioElement.duration;
		}
	}

	/**
	 * Handle audio playback ended
	 */
	handleEnded(): void {
		this.isPlaying = false;
		this.currentTime = 0; // Reset to 0 for potential replay
		// Keep the message index so user can see which message just finished
		// They can click again to replay
	}

	/**
	 * Handle audio error
	 */
	handleError(): void {
		toast.error("Audio playback error");
		this.stopReadAloud();
	}

	/**
	 * Cleanup resources (call on component unmount)
	 */
	cleanup(): void {
		this.abortController?.abort();
		this.abortController = null;
		this.stopReadAloud();
		this.audioCache.clear();
	}
}
