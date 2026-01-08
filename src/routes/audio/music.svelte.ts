import { ELEVENLABS_MUSIC_MODELS } from "$lib/constants/elevenlabs.js";

/**
 * Music history item interface for generated music
 */
export interface MusicHistoryItem {
  id: string;
  prompt: string;
  model: string;
  durationMs: number;
  isInstrumental: boolean;
  createdAt: string;
  fileSize: number;
  mimeType: string;
  url: string;
}

/**
 * MusicState - Music generation state management class
 *
 * Encapsulates all music-related state and methods for the /audio page.
 * Uses Svelte 5 runes for reactive state management.
 */
export class MusicState {
  // Constants (reference to imported constants)
  readonly models = ELEVENLABS_MUSIC_MODELS;

  // Model Selection
  selectedModel = $state<string>("music_v1");

  // Input Settings
  inputPrompt = $state<string>("");
  durationSeconds = $state<number | null>(null); // null = Auto mode, UI shows seconds, API expects milliseconds
  forceInstrumental = $state<boolean>(false);

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
  history = $state<MusicHistoryItem[]>([]);
  historyPage = $state<number>(1);
  readonly itemsPerPage = 5;
  totalHistoryItems = $state<number>(0);
  isLoadingHistory = $state<boolean>(false);
  historyAudioElements = $state<Map<string, HTMLAudioElement>>(new Map());
  historyAudioCurrentTime = $state<Map<string, number>>(new Map());
  historyAudioDuration = $state<Map<string, number>>(new Map());
  currentlyPlayingAudioId = $state<string | null>(null);

  // Dialog State
  selectedMusicPrompt = $state<string>("");
  selectedMusicId = $state<string>("");
  selectedMusicUrl = $state<string>("");
  selectedMusicModel = $state<string>("");
  selectedMusicDurationMs = $state<number>(0);
  selectedMusicIsInstrumental = $state<boolean>(false);
  selectedMusicMimeType = $state<string>("");
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

  get durationMilliseconds() {
    return this.durationSeconds !== null ? this.durationSeconds * 1000 : null;
  }

  get durationDisplay(): string {
    return this.durationSeconds !== null ? `${this.durationSeconds}s` : 'Auto';
  }

  get promptCharacterCount() {
    return this.inputPrompt.length;
  }

  get isPromptTooLong() {
    return this.inputPrompt.length > 4100;
  }

  // ==================== Core Music Methods ====================

  /**
   * Generate music from input prompt
   */
  async handleGenerate() {
    if (!this.inputPrompt.trim()) return;
    if (this.isPromptTooLong) return;

    this.isGenerating = true;
    this.errorMessage = null;

    try {
      // Always include musicLengthMs - null = auto mode (model chooses duration based on prompt)
      const response = await fetch("/api/music-generation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: this.inputPrompt.trim(),
          modelId: this.selectedModel,
          forceInstrumental: this.forceInstrumental,
          outputFormat: "mp3_44100_128",
          musicLengthMs: this.durationMilliseconds, // null = auto mode
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate music");
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

      // Reload history to show the new music
      await this.loadHistory();

      // Auto-open dialog with the newly created music
      if (this.history.length > 0) {
        const newItem = this.history[0];
        this.selectedMusicPrompt = newItem.prompt;
        this.selectedMusicId = newItem.id;
        this.selectedMusicUrl = newItem.url;
        this.selectedMusicModel = newItem.model;
        this.selectedMusicDurationMs = newItem.durationMs;
        this.selectedMusicIsInstrumental = newItem.isInstrumental;
        this.selectedMusicMimeType = newItem.mimeType;
        this.showDetailsDialog = true;
      }

      // Clear input after successful generation
      this.inputPrompt = "";
    } catch (error) {
      console.error("Music generation error:", error);
      this.errorMessage =
        error instanceof Error ? error.message : "Failed to generate music";
    } finally {
      this.isGenerating = false;
    }
  }

  // ==================== Playback Methods ====================

  /**
   * Toggle play/pause for the generated music
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
   * Stop the generated music and reset to beginning
   */
  stopAudio() {
    if (!this.audioElement) return;
    this.audioElement.pause();
    this.audioElement.currentTime = 0;
    this.currentTime = 0;
    this.isPlaying = false;
  }

  /**
   * Clear the generated music output
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
   * Download the generated music
   */
  downloadAudio() {
    if (!this.generatedAudioUrl) return;

    const extension = this.generatedAudioMimeType.includes("mpeg")
      ? "mp3"
      : "wav";
    const link = document.createElement("a");
    link.href = this.generatedAudioUrl;
    link.download = `generated-music-${Date.now()}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Download music from history
   */
  downloadHistoryMusic(musicId: string, musicUrl: string, mimeType: string) {
    const extension = mimeType.includes("mpeg") ? "mp3" : "wav";
    const link = document.createElement("a");
    link.href = musicUrl;
    link.download = `music-${musicId}.${extension}`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ==================== History Methods ====================

  /**
   * Load music history from API
   */
  async loadHistory() {
    this.isLoadingHistory = true;
    try {
      const response = await fetch(`/api/library?type=music`);
      if (!response.ok) {
        throw new Error("Failed to load music history");
      }

      const data = await response.json();
      const allMusic = data.media || [];

      this.totalHistoryItems = allMusic.length;

      // Paginate locally
      const startIndex = (this.historyPage - 1) * this.itemsPerPage;
      const endIndex = startIndex + this.itemsPerPage;
      this.history = allMusic.slice(startIndex, endIndex);
    } catch (error) {
      console.error("Failed to load music history:", error);
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
   * Toggle history music playback
   */
  toggleHistoryAudio(musicId: string, musicUrl: string) {
    // If clicking the same music that's playing, pause it
    if (this.currentlyPlayingAudioId === musicId) {
      const audio = this.historyAudioElements.get(musicId);
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
    let audio = this.historyAudioElements.get(musicId);
    if (!audio) {
      audio = new Audio(musicUrl);
      this.historyAudioElements.set(musicId, audio);

      // Set up event listeners
      audio.addEventListener("timeupdate", () => {
        if (audio) {
          this.historyAudioCurrentTime.set(musicId, audio.currentTime);
        }
      });

      audio.addEventListener("loadedmetadata", () => {
        if (audio) {
          this.historyAudioDuration.set(musicId, audio.duration);
        }
      });

      audio.addEventListener("ended", () => {
        this.currentlyPlayingAudioId = null;
      });
    }

    // Play the audio
    audio.play();
    this.currentlyPlayingAudioId = musicId;
  }

  /**
   * Seek history music to a specific time
   */
  seekHistoryAudio(musicId: string, value: number) {
    const audio = this.historyAudioElements.get(musicId);
    if (audio) {
      audio.currentTime = value;
      this.historyAudioCurrentTime.set(musicId, value);
    }
  }

  /**
   * Delete music from history
   */
  async deleteMusic(musicId: string) {
    if (!confirm("Are you sure you want to delete this music?")) return;

    try {
      const response = await fetch(`/api/music/${musicId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete music");
      }

      // Remove from history
      this.history = this.history.filter((item) => item.id !== musicId);
      this.totalHistoryItems--;

      // Clean up audio element
      const audio = this.historyAudioElements.get(musicId);
      if (audio) {
        audio.pause();
        this.historyAudioElements.delete(musicId);
        this.historyAudioCurrentTime.delete(musicId);
        this.historyAudioDuration.delete(musicId);
      }

      if (this.currentlyPlayingAudioId === musicId) {
        this.currentlyPlayingAudioId = null;
      }

      // Reload history if current page is now empty
      if (this.history.length === 0 && this.historyPage > 1) {
        this.historyPage--;
        await this.loadHistory();
      }
    } catch (error) {
      console.error("Failed to delete music:", error);
      alert("Failed to delete music. Please try again.");
    }
  }

  // ==================== Dialog Methods ====================

  /**
   * View full details in dialog
   */
  viewDetails(
    prompt: string,
    musicId: string,
    musicUrl: string,
    model: string,
    durationMs: number,
    isInstrumental: boolean,
    mimeType: string
  ) {
    this.selectedMusicPrompt = prompt;
    this.selectedMusicId = musicId;
    this.selectedMusicUrl = musicUrl;
    this.selectedMusicModel = model;
    this.selectedMusicDurationMs = durationMs;
    this.selectedMusicIsInstrumental = isInstrumental;
    this.selectedMusicMimeType = mimeType;
    this.showDetailsDialog = true;
  }

  /**
   * Toggle dialog audio playback
   */
  toggleDialogAudio() {
    if (!this.dialogAudioElement) {
      // Create audio element
      const audio = new Audio(this.selectedMusicUrl);
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
   * Format duration from milliseconds to MM:SS
   */
  formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
}
