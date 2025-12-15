import {
  ELEVENLABS_VOICES,
  ELEVENLABS_TTS_MODELS,
} from "$lib/constants/elevenlabs.js";

/**
 * Audio history item interface for TTS generated audio
 */
export interface AudioHistoryItem {
  id: string;
  text: string;
  model: string;
  voiceId: string;
  createdAt: string;
  duration: number | null;
  fileSize: number;
  mimeType: string;
  url: string;
}

/**
 * TTSState - Text-to-Speech state management class
 *
 * Encapsulates all TTS-related state and methods for the /audio page.
 * Uses Svelte 5 runes for reactive state management.
 */
export class TTSState {
  // Constants (reference to imported constants)
  readonly models = ELEVENLABS_TTS_MODELS;
  readonly voices = ELEVENLABS_VOICES;

  // Model & Voice Selection
  selectedModel = $state<string>("eleven_multilingual_v2");
  selectedVoice = $state<string>("2EiwWnXFnvU5JabPnv8n"); // Clyde voice ID

  // Voice Settings
  stability = $state<number>(0.5);
  similarityBoost = $state<number>(0.75);
  style = $state<number>(0);
  useSpeakerBoost = $state<boolean>(true);
  speed = $state<number>(1);

  // Input & Generation
  inputText = $state<string>("");
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

  // Voice Preview
  previewingVoiceId = $state<string | null>(null);
  previewAudio = $state<HTMLAudioElement | null>(null);

  // History State
  history = $state<AudioHistoryItem[]>([]);
  historyPage = $state<number>(1);
  readonly itemsPerPage = 5;
  totalHistoryItems = $state<number>(0);
  isLoadingHistory = $state<boolean>(false);
  historyAudioElements = $state<Map<string, HTMLAudioElement>>(new Map());
  historyAudioCurrentTime = $state<Map<string, number>>(new Map());
  historyAudioDuration = $state<Map<string, number>>(new Map());
  currentlyPlayingAudioId = $state<string | null>(null);

  // Dialog State
  selectedAudioText = $state<string>("");
  selectedAudioId = $state<string>("");
  selectedAudioUrl = $state<string>("");
  selectedAudioModel = $state<string>("");
  selectedAudioVoice = $state<string>("");
  selectedAudioMimeType = $state<string>("");
  showTextDialog = $state<boolean>(false);
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

  get selectedVoiceName() {
    return (
      this.voices.find((v) => v.id === this.selectedVoice)?.name ||
      "Select a voice"
    );
  }

  // ==================== Core TTS Methods ====================

  /**
   * Generate TTS audio from input text
   */
  async handleGenerate() {
    if (!this.inputText.trim()) return;

    this.isGenerating = true;
    this.errorMessage = null;

    try {
      const response = await fetch("/api/audio-generation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.selectedModel,
          text: this.inputText.trim(),
          voiceId: this.selectedVoice,
          voiceSettings: {
            stability: this.stability,
            similarityBoost: this.similarityBoost,
            style: this.style,
            useSpeakerBoost: this.useSpeakerBoost,
            speed: this.speed,
          },
          outputFormat: "mp3_44100_128",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate audio");
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

      // Reload history to show the new audio
      await this.loadHistory();

      // Auto-open dialog with the newly created audio
      if (this.history.length > 0) {
        const newItem = this.history[0];
        this.selectedAudioText = newItem.text;
        this.selectedAudioId = newItem.id;
        this.selectedAudioUrl = newItem.url;
        this.selectedAudioModel = newItem.model;
        this.selectedAudioVoice = newItem.voiceId;
        this.selectedAudioMimeType = newItem.mimeType;
        this.showTextDialog = true;
      }

      // Clear input after successful generation
      this.inputText = "";
    } catch (error) {
      console.error("Audio generation error:", error);
      this.errorMessage =
        error instanceof Error ? error.message : "Failed to generate audio";
    } finally {
      this.isGenerating = false;
    }
  }

  // ==================== Playback Methods ====================

  /**
   * Toggle play/pause for the generated audio
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
   * Stop the generated audio and reset to beginning
   */
  stopAudio() {
    if (!this.audioElement) return;
    this.audioElement.pause();
    this.audioElement.currentTime = 0;
    this.currentTime = 0;
    this.isPlaying = false;
  }

  /**
   * Clear the generated audio output
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

  // ==================== Voice Preview Methods ====================

  /**
   * Stop voice preview playback
   */
  stopVoicePreview() {
    if (this.previewAudio) {
      this.previewAudio.pause();
      this.previewAudio = null;
    }
    this.previewingVoiceId = null;
  }

  /**
   * Play voice preview sample
   */
  playVoicePreview(voiceId: string) {
    // If clicking the same voice that's playing, stop it
    if (this.previewingVoiceId === voiceId) {
      this.stopVoicePreview();
      return;
    }

    // Stop any existing preview
    this.stopVoicePreview();

    // Get voice name and construct static file path
    const voice = this.voices.find((v) => v.id === voiceId);
    if (!voice) return;

    const fileName = voice.name.toLowerCase();
    const audioUrl = `/elevenlabs-tts-preview/voice_preview_${fileName}.mp3`;

    this.previewingVoiceId = voiceId;

    const audio = new Audio(audioUrl);
    this.previewAudio = audio;

    audio.onended = () => {
      if (this.previewingVoiceId === voiceId) {
        this.previewingVoiceId = null;
        this.previewAudio = null;
      }
    };

    audio.onerror = () => {
      console.error("Failed to load voice preview");
      if (this.previewingVoiceId === voiceId) {
        this.previewingVoiceId = null;
        this.previewAudio = null;
      }
    };

    audio.play();
  }

  // ==================== Download Methods ====================

  /**
   * Download the generated audio
   */
  downloadAudio() {
    if (!this.generatedAudioUrl) return;

    const extension = this.generatedAudioMimeType.includes("mpeg")
      ? "mp3"
      : "wav";
    const link = document.createElement("a");
    link.href = this.generatedAudioUrl;
    link.download = `generated-audio-${Date.now()}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Download audio from history
   */
  downloadHistoryAudio(audioId: string, audioUrl: string, mimeType: string) {
    const extension = mimeType.includes("mpeg") ? "mp3" : "wav";
    const link = document.createElement("a");
    link.href = audioUrl;
    link.download = `audio-${audioId}.${extension}`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ==================== History Methods ====================

  /**
   * Load audio history from API
   */
  async loadHistory() {
    this.isLoadingHistory = true;
    try {
      const response = await fetch(`/api/library?type=audio`);
      if (!response.ok) {
        throw new Error("Failed to load audio history");
      }

      const data = await response.json();
      const allAudio = data.media || [];

      this.totalHistoryItems = allAudio.length;

      // Paginate locally
      const startIndex = (this.historyPage - 1) * this.itemsPerPage;
      const endIndex = startIndex + this.itemsPerPage;
      this.history = allAudio.slice(startIndex, endIndex);
    } catch (error) {
      console.error("Failed to load audio history:", error);
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
   * Toggle history audio playback
   */
  toggleHistoryAudio(audioId: string, audioUrl: string) {
    // If clicking the same audio that's playing, pause it
    if (this.currentlyPlayingAudioId === audioId) {
      const audio = this.historyAudioElements.get(audioId);
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
    let audio = this.historyAudioElements.get(audioId);
    if (!audio) {
      audio = new Audio(audioUrl);
      this.historyAudioElements.set(audioId, audio);

      // Set up event listeners
      audio.addEventListener("timeupdate", () => {
        if (audio) {
          this.historyAudioCurrentTime.set(audioId, audio.currentTime);
        }
      });

      audio.addEventListener("loadedmetadata", () => {
        if (audio) {
          this.historyAudioDuration.set(audioId, audio.duration);
        }
      });

      audio.addEventListener("ended", () => {
        this.currentlyPlayingAudioId = null;
      });
    }

    // Play the audio
    audio.play();
    this.currentlyPlayingAudioId = audioId;
  }

  /**
   * Seek history audio to a specific time
   */
  seekHistoryAudio(audioId: string, value: number) {
    const audio = this.historyAudioElements.get(audioId);
    if (audio) {
      audio.currentTime = value;
      this.historyAudioCurrentTime.set(audioId, value);
    }
  }

  /**
   * Delete audio from history
   */
  async deleteAudio(audioId: string) {
    if (!confirm("Are you sure you want to delete this audio?")) return;

    try {
      const response = await fetch(`/api/audio/${audioId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete audio");
      }

      // Remove from history
      this.history = this.history.filter((item) => item.id !== audioId);
      this.totalHistoryItems--;

      // Clean up audio element
      const audio = this.historyAudioElements.get(audioId);
      if (audio) {
        audio.pause();
        this.historyAudioElements.delete(audioId);
        this.historyAudioCurrentTime.delete(audioId);
        this.historyAudioDuration.delete(audioId);
      }

      if (this.currentlyPlayingAudioId === audioId) {
        this.currentlyPlayingAudioId = null;
      }

      // Reload history if current page is now empty
      if (this.history.length === 0 && this.historyPage > 1) {
        this.historyPage--;
        await this.loadHistory();
      }
    } catch (error) {
      console.error("Failed to delete audio:", error);
      alert("Failed to delete audio. Please try again.");
    }
  }

  // ==================== Dialog Methods ====================

  /**
   * View full text in dialog
   */
  viewFullText(
    text: string,
    audioId: string,
    audioUrl: string,
    model: string,
    voiceId: string,
    mimeType: string
  ) {
    this.selectedAudioText = text;
    this.selectedAudioId = audioId;
    this.selectedAudioUrl = audioUrl;
    this.selectedAudioModel = model;
    this.selectedAudioVoice = voiceId;
    this.selectedAudioMimeType = mimeType;
    this.showTextDialog = true;
  }

  /**
   * Toggle dialog audio playback
   */
  toggleDialogAudio() {
    if (!this.dialogAudioElement) {
      // Create audio element
      const audio = new Audio(this.selectedAudioUrl);
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
   * Get voice name by ID
   */
  getVoiceName(voiceId: string): string {
    return this.voices.find((v) => v.id === voiceId)?.name || voiceId;
  }

  /**
   * Get model name by ID
   */
  getModelName(modelId: string): string {
    return this.models.find((m) => m.id === modelId)?.name || modelId;
  }
}
