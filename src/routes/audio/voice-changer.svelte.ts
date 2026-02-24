import {
  ELEVENLABS_VOICES,
  ELEVENLABS_STS_MODELS,
} from "$lib/constants/elevenlabs.js";

/**
 * Voice Change history item interface
 */
export interface VoiceChangeHistoryItem {
  id: string;
  originalFilename: string;
  originalMimeType: string;
  originalFileSize: number;
  originalUrl: string;
  mimeType: string;
  fileSize: number;
  model: string;
  targetVoiceId: string;
  createdAt: string;
  duration: number | null;
  url: string;
  transformedUrl: string;
}

/**
 * VoiceChangerState - Speech-to-Speech state management class
 *
 * Encapsulates all Voice Changer related state and methods for the /audio page.
 * Uses Svelte 5 runes for reactive state management.
 */
export class VoiceChangerState {
  // Constants (reference to imported constants)
  readonly models = ELEVENLABS_STS_MODELS;
  readonly voices = ELEVENLABS_VOICES;
  readonly itemsPerPage = 5;

  // Model & Voice Selection
  selectedModel = $state<string>("eleven_multilingual_sts_v2");
  selectedVoice = $state<string>("2EiwWnXFnvU5JabPnv8n"); // Clyde voice ID

  // Voice Settings
  stability = $state<number>(0.5);
  similarityBoost = $state<number>(0.75);
  style = $state<number>(0);
  useSpeakerBoost = $state<boolean>(true);
  speed = $state<number>(1);

  // Audio Settings
  removeBackgroundNoise = $state<boolean>(false);

  // File Upload State
  uploadedFile = $state<File | null>(null);
  dragOver = $state<boolean>(false);
  fileInputElement = $state<HTMLInputElement | null>(null);

  // Processing State
  isVoiceChanging = $state<boolean>(false);
  errorMessage = $state<string | null>(null);

  // History State
  history = $state<VoiceChangeHistoryItem[]>([]);
  historyPage = $state<number>(1);
  totalHistoryItems = $state<number>(0);
  isLoadingHistory = $state<boolean>(false);

  // Dialog State
  showDialog = $state<boolean>(false);
  selectedId = $state<string>("");
  selectedOriginalUrl = $state<string>("");
  selectedTransformedUrl = $state<string>("");
  selectedDialogModel = $state<string>("");
  selectedDialogVoice = $state<string>("");
  selectedOriginalFilename = $state<string>("");

  // Dialog Audio Elements
  dialogOriginalAudio = $state<HTMLAudioElement | null>(null);
  dialogTransformedAudio = $state<HTMLAudioElement | null>(null);
  isDialogOriginalPlaying = $state<boolean>(false);
  isDialogTransformedPlaying = $state<boolean>(false);

  // Dialog Audio Playback State
  dialogOriginalCurrentTime = $state<number>(0);
  dialogOriginalDuration = $state<number>(0);
  dialogTransformedCurrentTime = $state<number>(0);
  dialogTransformedDuration = $state<number>(0);

  // History Table Audio Playback
  currentlyPlayingTransformedAudioId = $state<string | null>(null);
  vcHistoryAudioElements = $state<Map<string, HTMLAudioElement>>(new Map());

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

  // ==================== File Upload Methods ====================

  /**
   * Handle file input change
   */
  handleFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.uploadedFile = input.files[0];
    }
  }

  /**
   * Trigger file input click
   */
  triggerFileUpload() {
    this.fileInputElement?.click();
  }

  /**
   * Handle file drop
   */
  handleDrop(event: DragEvent) {
    event.preventDefault();
    this.dragOver = false;

    if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
      const file = event.dataTransfer.files[0];
      if (file.type.startsWith("audio/")) {
        this.uploadedFile = file;
      }
    }
  }

  /**
   * Handle drag over
   */
  handleDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragOver = true;
  }

  /**
   * Handle drag leave
   */
  handleDragLeave() {
    this.dragOver = false;
  }

  /**
   * Remove uploaded file
   */
  removeUploadedFile() {
    this.uploadedFile = null;
  }

  // ==================== Voice Change Methods ====================

  /**
   * Handle voice change submission
   */
  async handleVoiceChange() {
    if (!this.uploadedFile) return;

    this.isVoiceChanging = true;
    this.errorMessage = null;

    try {
      const formData = new FormData();
      formData.append("file", this.uploadedFile);
      formData.append("targetVoiceId", this.selectedVoice);
      formData.append("modelId", this.selectedModel);
      formData.append("removeBackgroundNoise", this.removeBackgroundNoise.toString());
      formData.append("voiceSettings", JSON.stringify({
        stability: this.stability,
        similarityBoost: this.similarityBoost,
        style: this.style,
        useSpeakerBoost: this.useSpeakerBoost,
        speed: this.speed
      }));

      const response = await fetch("/api/voice-change", {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to change voice");
      }

      // Clear the uploaded file after successful voice change
      this.uploadedFile = null;

      // Reload history to show the new voice change
      await this.loadHistory();

      // Auto-open dialog with the newly created voice change
      if (data.voiceChangeId) {
        const vcResponse = await fetch(`/api/voice-changes/${data.voiceChangeId}`);
        if (vcResponse.ok) {
          const vcData = await vcResponse.json();
          this.selectedId = vcData.id;
          this.selectedOriginalUrl = vcData.originalUrl;
          this.selectedTransformedUrl = vcData.transformedUrl;
          this.selectedDialogModel = vcData.model;
          this.selectedDialogVoice = vcData.targetVoiceId;
          this.selectedOriginalFilename = vcData.originalFilename;
          this.showDialog = true;
        }
      }
    } catch (error) {
      console.error("Voice change error:", error);
      this.errorMessage =
        error instanceof Error ? error.message : "Failed to change voice";
    } finally {
      this.isVoiceChanging = false;
    }
  }

  // ==================== History Methods ====================

  /**
   * Load voice change history from API
   */
  async loadHistory() {
    this.isLoadingHistory = true;
    this.errorMessage = null;

    try {
      const response = await fetch("/api/library?type=voice_change");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load voice change history");
      }

      const startIndex = (this.historyPage - 1) * this.itemsPerPage;
      const endIndex = startIndex + this.itemsPerPage;
      this.history = data.media.slice(startIndex, endIndex);
      this.totalHistoryItems = data.media.length;
    } catch (error) {
      console.error("Failed to load voice change history:", error);
      this.errorMessage = "Failed to load history";
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
   * Delete voice change
   */
  async deleteVoiceChange(id: string) {
    try {
      const response = await fetch(`/api/voice-changes/${id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete voice change");
      }

      // Reload history
      await this.loadHistory();
    } catch (error) {
      console.error("Delete voice change error:", error);
      this.errorMessage =
        error instanceof Error ? error.message : "Failed to delete voice change";
    }
  }

  // ==================== Dialog Methods ====================

  /**
   * View voice change details
   */
  viewDetails(item: VoiceChangeHistoryItem) {
    this.selectedId = item.id;
    this.selectedOriginalUrl = item.originalUrl;
    this.selectedTransformedUrl = item.transformedUrl;
    this.selectedDialogModel = item.model;
    this.selectedDialogVoice = item.targetVoiceId;
    this.selectedOriginalFilename = item.originalFilename;
    this.showDialog = true;
  }

  /**
   * Close dialog and cleanup audio
   */
  closeDialog() {
    this.showDialog = false;

    // Stop and cleanup original audio
    if (this.dialogOriginalAudio) {
      this.dialogOriginalAudio.pause();
      this.dialogOriginalAudio = null;
    }
    this.isDialogOriginalPlaying = false;
    this.dialogOriginalCurrentTime = 0;
    this.dialogOriginalDuration = 0;

    // Stop and cleanup transformed audio
    if (this.dialogTransformedAudio) {
      this.dialogTransformedAudio.pause();
      this.dialogTransformedAudio = null;
    }
    this.isDialogTransformedPlaying = false;
    this.dialogTransformedCurrentTime = 0;
    this.dialogTransformedDuration = 0;
  }

  /**
   * Toggle original audio playback with full playback tracking
   */
  toggleDialogOriginalAudio() {
    if (!this.dialogOriginalAudio) {
      this.dialogOriginalAudio = new Audio(this.selectedOriginalUrl);

      // Track current time
      this.dialogOriginalAudio.addEventListener("timeupdate", () => {
        if (this.dialogOriginalAudio) {
          this.dialogOriginalCurrentTime = this.dialogOriginalAudio.currentTime;
        }
      });

      // Track duration
      this.dialogOriginalAudio.addEventListener("loadedmetadata", () => {
        if (this.dialogOriginalAudio) {
          this.dialogOriginalDuration = this.dialogOriginalAudio.duration;
        }
      });

      // Auto-stop on end
      this.dialogOriginalAudio.addEventListener("ended", () => {
        this.isDialogOriginalPlaying = false;
        this.dialogOriginalCurrentTime = this.dialogOriginalDuration;
      });
    }

    if (this.isDialogOriginalPlaying) {
      this.dialogOriginalAudio.pause();
    } else {
      // Stop transformed audio if playing
      if (this.dialogTransformedAudio && this.isDialogTransformedPlaying) {
        this.dialogTransformedAudio.pause();
        this.isDialogTransformedPlaying = false;
      }
      this.dialogOriginalAudio.play();
    }
    this.isDialogOriginalPlaying = !this.isDialogOriginalPlaying;
  }

  /**
   * Toggle transformed audio playback with full playback tracking
   */
  toggleDialogTransformedAudio() {
    if (!this.dialogTransformedAudio) {
      this.dialogTransformedAudio = new Audio(this.selectedTransformedUrl);

      // Track current time
      this.dialogTransformedAudio.addEventListener("timeupdate", () => {
        if (this.dialogTransformedAudio) {
          this.dialogTransformedCurrentTime = this.dialogTransformedAudio.currentTime;
        }
      });

      // Track duration
      this.dialogTransformedAudio.addEventListener("loadedmetadata", () => {
        if (this.dialogTransformedAudio) {
          this.dialogTransformedDuration = this.dialogTransformedAudio.duration;
        }
      });

      // Auto-stop on end
      this.dialogTransformedAudio.addEventListener("ended", () => {
        this.isDialogTransformedPlaying = false;
        this.dialogTransformedCurrentTime = this.dialogTransformedDuration;
      });
    }

    if (this.isDialogTransformedPlaying) {
      this.dialogTransformedAudio.pause();
    } else {
      // Stop original audio if playing
      if (this.dialogOriginalAudio && this.isDialogOriginalPlaying) {
        this.dialogOriginalAudio.pause();
        this.isDialogOriginalPlaying = false;
      }
      this.dialogTransformedAudio.play();
    }
    this.isDialogTransformedPlaying = !this.isDialogTransformedPlaying;
  }

  /**
   * Toggle transformed audio playback in History table
   */
  toggleHistoryTransformedAudio(audioId: string, audioUrl: string) {
    // If clicking the same audio that's playing, pause it
    if (this.currentlyPlayingTransformedAudioId === audioId) {
      const audioElement = this.vcHistoryAudioElements.get(audioId);
      if (audioElement) {
        audioElement.pause();
      }
      this.currentlyPlayingTransformedAudioId = null;
      return;
    }

    // Stop any currently playing audio
    if (this.currentlyPlayingTransformedAudioId) {
      const currentAudio = this.vcHistoryAudioElements.get(
        this.currentlyPlayingTransformedAudioId
      );
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
    }

    // Get or create audio element for this item
    let audioElement = this.vcHistoryAudioElements.get(audioId);
    if (!audioElement) {
      audioElement = new Audio(audioUrl);
      audioElement.onended = () => {
        this.currentlyPlayingTransformedAudioId = null;
      };
      this.vcHistoryAudioElements.set(audioId, audioElement);
    }

    // Play the audio
    audioElement.play().catch((err) => {
      console.error("Error playing transformed audio:", err);
      this.currentlyPlayingTransformedAudioId = null;
    });

    this.currentlyPlayingTransformedAudioId = audioId;
  }

  /**
   * Download transformed audio from History table
   */
  downloadTransformedAudio(
    id: string,
    transformedUrl: string,
    originalFilename: string,
    mimeType: string
  ) {
    const extension = mimeType.includes("mpeg") ? "mp3" : "wav";
    const link = document.createElement("a");
    link.href = transformedUrl;
    link.download = `transformed-${originalFilename}`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Seek original audio to specific time
   */
  seekDialogOriginalAudio(value: number) {
    if (this.dialogOriginalAudio) {
      this.dialogOriginalAudio.currentTime = value;
      this.dialogOriginalCurrentTime = value;
    }
  }

  /**
   * Seek transformed audio to specific time
   */
  seekDialogTransformedAudio(value: number) {
    if (this.dialogTransformedAudio) {
      this.dialogTransformedAudio.currentTime = value;
      this.dialogTransformedCurrentTime = value;
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Get model name by ID
   */
  getModelName(modelId: string): string {
    return this.models.find((m) => m.id === modelId)?.name || modelId;
  }

  /**
   * Get voice name by ID
   */
  getVoiceName(voiceId: string): string {
    return this.voices.find((v) => v.id === voiceId)?.name || voiceId;
  }
}
