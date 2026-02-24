import { ELEVENLABS_SOUND_EFFECTS_MODELS } from "$lib/constants/elevenlabs.js";

/**
 * Sound effect history item interface for generated sound effects
 */
export interface SoundEffectHistoryItem {
  id: string;
  text: string;
  durationSeconds: number;
  promptInfluence: number;
  model: string;
  createdAt: string;
  fileSize: number;
  mimeType: string;
  url: string;
}

/**
 * SoundEffectsState - Sound effects generation state management class
 *
 * Encapsulates all sound effects-related state and methods for the /audio page.
 * Uses Svelte 5 runes for reactive state management.
 */
export class SoundEffectsState {
  // Constants (reference to imported constants)
  readonly models = ELEVENLABS_SOUND_EFFECTS_MODELS;

  // Model Selection
  selectedModel = $state<string>("sound_effects_v1");

  // Input Settings
  inputDescription = $state<string>("");
  durationSeconds = $state<number | null>(null); // null = Auto mode
  promptInfluence = $state<number>(0.3); // 0.0-1.0, default 0.3

  // Generation State
  isGenerating = $state<boolean>(false);
  generatedAudioUrl = $state<string | null>(null);
  generatedAudioMimeType = $state<string>("audio/mpeg");
  errorMessage = $state<string | null>(null);

  // Playback State
  isPlaying = $state<boolean>(false);
  currentTime = $state<number>(0);
  duration = $state<number>(0);
  isSeeking = $state<boolean>(false);
  audioElement = $state<HTMLAudioElement | null>(null);

  // History State
  history = $state<SoundEffectHistoryItem[]>([]);
  historyPage = $state<number>(1);
  readonly itemsPerPage = 5;
  totalHistoryItems = $state<number>(0);
  isLoadingHistory = $state<boolean>(false);
  historyAudioElements = $state<Map<string, HTMLAudioElement>>(new Map());
  historyAudioCurrentTime = $state<Map<string, number>>(new Map());
  historyAudioDuration = $state<Map<string, number>>(new Map());
  currentlyPlayingAudioId = $state<string | null>(null);

  // Dialog State
  selectedSoundEffectText = $state<string>("");
  selectedSoundEffectId = $state<string>("");
  selectedSoundEffectUrl = $state<string>("");
  selectedSoundEffectModel = $state<string>("");
  selectedSoundEffectDurationSeconds = $state<number>(0);
  selectedSoundEffectPromptInfluence = $state<number>(0);
  selectedSoundEffectMimeType = $state<string>("");
  showDetailsDialog = $state<boolean>(false);
  dialogAudioElement = $state<HTMLAudioElement | null>(null);
  dialogAudioCurrentTime = $state<number>(0);
  dialogAudioDuration = $state<number>(0);
  isDialogAudioPlaying = $state<boolean>(false);

  // Derived values
  get totalPages() {
    return Math.ceil(this.totalHistoryItems / this.itemsPerPage);
  }

  get selectedModelName() {
    return (
      this.models.find((m) => m.id === this.selectedModel)?.name ||
      "Select a model"
    );
  }

  get durationDisplay(): string {
    return this.durationSeconds !== null ? `${this.durationSeconds}s` : "Auto";
  }

  get promptInfluenceDisplay(): string {
    if (this.promptInfluence <= 0.33) return "Creative";
    if (this.promptInfluence <= 0.66) return "Balanced";
    return "Literal";
  }

  get descriptionCharacterCount() {
    return this.inputDescription.length;
  }

  get isDescriptionTooLong() {
    return this.inputDescription.length > 4100;
  }

  // ==================== Core Sound Effects Methods ====================

  /**
   * Generate sound effect from input description
   */
  async handleGenerate() {
    if (!this.inputDescription.trim()) return;
    if (this.isDescriptionTooLong) return;

    this.isGenerating = true;
    this.errorMessage = null;

    try {
      const response = await fetch("/api/sound-effects-generation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: this.inputDescription.trim(),
          durationSeconds: this.durationSeconds,
          promptInfluence: this.promptInfluence,
          outputFormat: "mp3_44100_128",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate sound effect");
      }

      // Convert base64 audio to blob URL
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
      if (this.generatedAudioUrl) {
        URL.revokeObjectURL(this.generatedAudioUrl);
      }

      this.generatedAudioUrl = URL.createObjectURL(blob);
      this.generatedAudioMimeType = mimeType;

      // Reload history to show the new sound effect
      await this.loadHistory();

      // Auto-open dialog with the newly created sound effect
      if (this.history.length > 0) {
        const newItem = this.history[0];
        this.selectedSoundEffectText = newItem.text;
        this.selectedSoundEffectId = newItem.id;
        this.selectedSoundEffectUrl = newItem.url;
        this.selectedSoundEffectModel = newItem.model;
        this.selectedSoundEffectDurationSeconds = newItem.durationSeconds;
        this.selectedSoundEffectPromptInfluence = newItem.promptInfluence;
        this.selectedSoundEffectMimeType = newItem.mimeType;
        this.showDetailsDialog = true;
      }

      // Clear input after successful generation
      this.inputDescription = "";
    } catch (error) {
      console.error("Sound effect generation error:", error);
      this.errorMessage =
        error instanceof Error ? error.message : "Failed to generate sound effect";
    } finally {
      this.isGenerating = false;
    }
  }

  // ==================== Playback Methods ====================

  /**
   * Toggle play/pause for the generated sound effect
   */
  togglePlayPause() {
    if (!this.audioElement) return;

    if (this.isPlaying) {
      this.audioElement.pause();
    } else {
      // Stop any playing history audio
      if (this.currentlyPlayingAudioId) {
        const historyAudio = this.historyAudioElements.get(
          this.currentlyPlayingAudioId
        );
        if (historyAudio) {
          historyAudio.pause();
        }
        this.currentlyPlayingAudioId = null;
      }
      this.audioElement.play();
    }
    this.isPlaying = !this.isPlaying;
  }

  /**
   * Stop the generated sound effect and reset to beginning
   */
  stopAudio() {
    if (!this.audioElement) return;
    this.audioElement.pause();
    this.audioElement.currentTime = 0;
    this.currentTime = 0;
    this.isPlaying = false;
  }

  /**
   * Clear the generated sound effect output
   */
  clearOutput() {
    if (this.generatedAudioUrl) {
      URL.revokeObjectURL(this.generatedAudioUrl);
    }
    this.generatedAudioUrl = null;
    this.isPlaying = false;
    this.errorMessage = null;
    this.currentTime = 0;
    this.duration = 0;
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }
  }

  // ==================== Audio Event Handlers ====================

  /**
   * Handle audio time update event
   */
  handleTimeUpdate() {
    if (!this.audioElement || this.isSeeking) return;
    this.currentTime = this.audioElement.currentTime;
  }

  /**
   * Handle audio metadata loaded event
   */
  handleLoadedMetadata() {
    if (!this.audioElement) return;
    this.duration = this.audioElement.duration;
  }

  /**
   * Handle seek via progress bar
   */
  handleSeek(value: number[]) {
    if (!this.audioElement) return;
    const newTime = value[0];
    this.audioElement.currentTime = newTime;
    this.currentTime = newTime;
  }

  /**
   * Handle seek start (to prevent jitter during drag)
   */
  handleSeekStart() {
    this.isSeeking = true;
  }

  /**
   * Handle seek end
   */
  handleSeekEnd() {
    this.isSeeking = false;
  }

  // ==================== Download Methods ====================

  /**
   * Download the generated sound effect
   */
  downloadAudio() {
    if (!this.generatedAudioUrl) return;

    const extension = this.generatedAudioMimeType.includes("mpeg")
      ? "mp3"
      : "wav";
    const link = document.createElement("a");
    link.href = this.generatedAudioUrl;
    link.download = `generated-sound-effect-${Date.now()}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Download sound effect from history
   */
  downloadHistorySoundEffect(soundEffectId: string, soundEffectUrl: string, mimeType: string) {
    const extension = mimeType.includes("mpeg") ? "mp3" : "wav";
    const link = document.createElement("a");
    link.href = soundEffectUrl;
    link.download = `sound-effect-${soundEffectId}.${extension}`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ==================== History Methods ====================

  /**
   * Load sound effects history from API
   */
  async loadHistory() {
    this.isLoadingHistory = true;
    try {
      const response = await fetch(`/api/library?type=sound_effects`);
      if (!response.ok) {
        throw new Error("Failed to load sound effects history");
      }

      const data = await response.json();
      const allSoundEffects = data.media || [];

      this.totalHistoryItems = allSoundEffects.length;

      // Paginate locally
      const startIndex = (this.historyPage - 1) * this.itemsPerPage;
      const endIndex = startIndex + this.itemsPerPage;
      this.history = allSoundEffects.slice(startIndex, endIndex);
    } catch (error) {
      console.error("Failed to load sound effects history:", error);
    } finally {
      this.isLoadingHistory = false;
    }
  }

  /**
   * Change history page
   */
  async changePage(newPage: number) {
    if (newPage < 1 || newPage > this.totalPages) return;
    this.historyPage = newPage;
    await this.loadHistory();
  }

  /**
   * Toggle history sound effect playback
   */
  toggleHistoryAudio(soundEffectId: string, soundEffectUrl: string) {
    // If clicking the same sound effect that's playing, pause it
    if (this.currentlyPlayingAudioId === soundEffectId) {
      const audio = this.historyAudioElements.get(soundEffectId);
      if (audio) {
        audio.pause();
        this.currentlyPlayingAudioId = null;
      }
      return;
    }

    // Stop any currently playing audio (including new generation)
    if (this.currentlyPlayingAudioId) {
      const currentAudio = this.historyAudioElements.get(
        this.currentlyPlayingAudioId
      );
      if (currentAudio) {
        currentAudio.pause();
      }
    }
    // Stop new generation audio
    if (this.audioElement && this.isPlaying) {
      this.audioElement.pause();
      this.isPlaying = false;
    }

    // Get or create audio element for this history item
    let audio = this.historyAudioElements.get(soundEffectId);
    if (!audio) {
      audio = new Audio(soundEffectUrl);
      this.historyAudioElements.set(soundEffectId, audio);

      // Set up event listeners
      audio.addEventListener("timeupdate", () => {
        if (audio) {
          this.historyAudioCurrentTime.set(soundEffectId, audio.currentTime);
        }
      });

      audio.addEventListener("loadedmetadata", () => {
        if (audio) {
          this.historyAudioDuration.set(soundEffectId, audio.duration);
        }
      });

      audio.addEventListener("ended", () => {
        this.currentlyPlayingAudioId = null;
      });
    }

    // Play the audio
    audio.play();
    this.currentlyPlayingAudioId = soundEffectId;
  }

  /**
   * Seek history sound effect to a specific time
   */
  seekHistoryAudio(soundEffectId: string, value: number) {
    const audio = this.historyAudioElements.get(soundEffectId);
    if (audio) {
      audio.currentTime = value;
      this.historyAudioCurrentTime.set(soundEffectId, value);
    }
  }

  /**
   * Delete sound effect from history
   */
  async deleteSoundEffect(soundEffectId: string) {
    if (!confirm("Are you sure you want to delete this sound effect?")) return;

    try {
      const response = await fetch(`/api/sound-effects/${soundEffectId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete sound effect");
      }

      // Remove from history
      this.history = this.history.filter((item) => item.id !== soundEffectId);
      this.totalHistoryItems--;

      // Clean up audio element
      const audio = this.historyAudioElements.get(soundEffectId);
      if (audio) {
        audio.pause();
        this.historyAudioElements.delete(soundEffectId);
        this.historyAudioCurrentTime.delete(soundEffectId);
        this.historyAudioDuration.delete(soundEffectId);
      }

      if (this.currentlyPlayingAudioId === soundEffectId) {
        this.currentlyPlayingAudioId = null;
      }

      // Reload history if current page is now empty
      if (this.history.length === 0 && this.historyPage > 1) {
        this.historyPage--;
        await this.loadHistory();
      }
    } catch (error) {
      console.error("Failed to delete sound effect:", error);
      alert("Failed to delete sound effect. Please try again.");
    }
  }

  // ==================== Dialog Methods ====================

  /**
   * View full details in dialog
   */
  viewDetails(
    text: string,
    soundEffectId: string,
    soundEffectUrl: string,
    model: string,
    durationSeconds: number,
    promptInfluence: number,
    mimeType: string
  ) {
    this.selectedSoundEffectText = text;
    this.selectedSoundEffectId = soundEffectId;
    this.selectedSoundEffectUrl = soundEffectUrl;
    this.selectedSoundEffectModel = model;
    this.selectedSoundEffectDurationSeconds = durationSeconds;
    this.selectedSoundEffectPromptInfluence = promptInfluence;
    this.selectedSoundEffectMimeType = mimeType;
    this.showDetailsDialog = true;
  }

  /**
   * Toggle dialog audio playback
   */
  toggleDialogAudio() {
    if (!this.dialogAudioElement) {
      // Create audio element
      const audio = new Audio(this.selectedSoundEffectUrl);
      this.dialogAudioElement = audio;

      // Update current time
      audio.addEventListener("timeupdate", () => {
        if (audio) {
          this.dialogAudioCurrentTime = audio.currentTime;
        }
      });

      // Load metadata (duration)
      audio.addEventListener("loadedmetadata", () => {
        if (audio) {
          this.dialogAudioDuration = audio.duration;
        }
      });

      // Handle audio end
      audio.addEventListener("ended", () => {
        this.isDialogAudioPlaying = false;
        this.dialogAudioCurrentTime = this.dialogAudioDuration;
      });

      // Start playing
      audio.play();
      this.isDialogAudioPlaying = true;
    } else {
      // Toggle play/pause
      if (this.isDialogAudioPlaying) {
        this.dialogAudioElement.pause();
        this.isDialogAudioPlaying = false;
      } else {
        this.dialogAudioElement.play();
        this.isDialogAudioPlaying = true;
      }
    }
  }

  /**
   * Seek dialog audio to a specific time
   */
  seekDialogAudio(value: number) {
    if (this.dialogAudioElement) {
      this.dialogAudioElement.currentTime = value;
      this.dialogAudioCurrentTime = value;
    }
  }

  /**
   * Cleanup dialog audio resources
   */
  cleanupDialogAudio() {
    if (this.dialogAudioElement) {
      this.dialogAudioElement.pause();
      this.dialogAudioElement = null;
    }
    this.dialogAudioCurrentTime = 0;
    this.dialogAudioDuration = 0;
    this.isDialogAudioPlaying = false;
  }

  // ==================== Helper Methods ====================

  /**
   * Get model name by ID
   */
  getModelName(modelId: string): string {
    return this.models.find((m) => m.id === modelId)?.name || modelId;
  }

  /**
   * Format duration from seconds to MM:SS
   */
  formatDuration(seconds: number): string {
    if (!seconds || !isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  /**
   * Get prompt influence label
   */
  getPromptInfluenceLabel(value: number): string {
    if (value <= 0.33) return "Creative";
    if (value <= 0.66) return "Balanced";
    return "Literal";
  }
}
