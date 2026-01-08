import { ELEVENLABS_STT_MODELS } from "$lib/constants/elevenlabs.js";

/**
 * STT history item interface for transcriptions
 */
export interface SttHistoryItem {
  id: string;
  text: string;
  words: Array<{ text: string; start: number; end: number }> | null;
  model: string;
  createdAt: string;
  duration: number | null;
  fileSize: number;
  mimeType: string;
  url: string;
}

/**
 * STTState - Speech-to-Text state management class
 *
 * Encapsulates all STT-related state and methods for the /audio page.
 * Uses Svelte 5 runes for reactive state management.
 */
export class STTState {
  // Constants (reference to imported constants)
  readonly models = ELEVENLABS_STT_MODELS;
  readonly itemsPerPage = 5;

  // Model Selection
  selectedModel = $state<string>("scribe_v1");

  // File Upload State
  uploadedFile = $state<File | null>(null);
  dragOver = $state<boolean>(false);
  fileInputElement = $state<HTMLInputElement | null>(null);

  // Transcription State
  isTranscribing = $state<boolean>(false);
  errorMessage = $state<string | null>(null);

  // STT Settings
  tagAudioEvents = $state<boolean>(true);
  diarize = $state<boolean>(false);

  // History State
  history = $state<SttHistoryItem[]>([]);
  historyPage = $state<number>(1);
  totalHistoryItems = $state<number>(0);
  isLoadingHistory = $state<boolean>(false);

  // Dialog State
  showDialog = $state<boolean>(false);
  selectedId = $state<string>("");
  selectedText = $state<string>("");
  selectedWords = $state<Array<{ text: string; start: number; end: number }>>(
    []
  );
  selectedUrl = $state<string>("");
  selectedDialogModel = $state<string>("");
  selectedMimeType = $state<string>("");

  // Dialog Audio State
  dialogAudioElement = $state<HTMLAudioElement | null>(null);
  dialogAudioCurrentTime = $state<number>(0);
  dialogAudioDuration = $state<number>(0);
  isDialogAudioPlaying = $state<boolean>(false);
  dialogCurrentWordIndex = $state<number>(-1);
  transcriptContainer = $state<HTMLDivElement | null>(null);

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

  // Copy state
  copiedTranscriptionText = $state<boolean>(false);

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

  // ==================== Transcription Methods ====================

  /**
   * Handle transcription submission
   */
  async handleTranscribe() {
    if (!this.uploadedFile) return;

    this.isTranscribing = true;
    this.errorMessage = null;

    try {
      const formData = new FormData();
      formData.append("file", this.uploadedFile);
      formData.append("modelId", this.selectedModel);
      formData.append("tagAudioEvents", this.tagAudioEvents.toString());
      formData.append("diarize", this.diarize.toString());

      const response = await fetch("/api/audio-transcription", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to transcribe audio");
      }

      // Reload STT history to include the new transcription
      await this.loadHistory();

      // Fetch the newly created transcription details and auto-open dialog
      if (data.transcriptionId) {
        const transcriptionResponse = await fetch(
          `/api/transcriptions/${data.transcriptionId}`
        );
        if (transcriptionResponse.ok) {
          const transcriptionData = await transcriptionResponse.json();

          // Set dialog state and auto-open
          this.selectedId = transcriptionData.id;
          this.selectedText = transcriptionData.text;
          this.selectedWords = transcriptionData.words || [];
          this.selectedUrl = transcriptionData.audioUrl;
          this.selectedDialogModel = transcriptionData.model;
          this.selectedMimeType = transcriptionData.mimeType;
          this.showDialog = true;
        }
      }

      // Clear the uploaded file after successful transcription
      this.uploadedFile = null;
    } catch (error) {
      console.error("Transcription error:", error);
      this.errorMessage =
        error instanceof Error ? error.message : "Failed to transcribe audio";
    } finally {
      this.isTranscribing = false;
    }
  }

  // ==================== History Methods ====================

  /**
   * Load STT history from API
   */
  async loadHistory() {
    this.isLoadingHistory = true;
    try {
      const response = await fetch(`/api/library?type=transcription`);
      if (!response.ok) {
        throw new Error("Failed to load STT history");
      }

      const data = await response.json();
      const allTranscriptions = data.media || [];

      this.totalHistoryItems = allTranscriptions.length;

      // Paginate locally
      const startIndex = (this.historyPage - 1) * this.itemsPerPage;
      const endIndex = startIndex + this.itemsPerPage;
      this.history = allTranscriptions.slice(startIndex, endIndex);
    } catch (error) {
      console.error("Failed to load STT history:", error);
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
   * Delete transcription
   */
  async deleteTranscription(transcriptionId: string) {
    if (!confirm("Are you sure you want to delete this transcription?")) return;

    try {
      const response = await fetch(`/api/transcriptions/${transcriptionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete transcription");
      }

      // Remove from history
      this.history = this.history.filter((item) => item.id !== transcriptionId);
      this.totalHistoryItems--;

      // Reload history if current page is now empty
      if (this.history.length === 0 && this.historyPage > 1) {
        this.historyPage--;
        await this.loadHistory();
      }

      // Close dialog if deleting the currently viewed item
      if (this.selectedId === transcriptionId && this.showDialog) {
        this.showDialog = false;
        this.cleanupDialogAudio();
      }
    } catch (error) {
      console.error("Failed to delete transcription:", error);
      alert("Failed to delete transcription. Please try again.");
    }
  }

  /**
   * Download STT audio
   */
  downloadAudio(transcriptionId: string, audioUrl: string, mimeType: string) {
    const extension = mimeType.includes("mpeg")
      ? "mp3"
      : mimeType.split("/")[1] || "audio";
    const link = document.createElement("a");
    link.href = audioUrl;
    link.download = `transcription-${transcriptionId}.${extension}`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ==================== Dialog Methods ====================

  /**
   * View STT transcription details
   */
  viewDetails(item: SttHistoryItem) {
    this.selectedId = item.id;
    this.selectedText = item.text;
    this.selectedWords = item.words || [];
    this.selectedUrl = item.url;
    this.selectedDialogModel = item.model;
    this.selectedMimeType = item.mimeType;
    this.showDialog = true;
  }

  /**
   * Toggle dialog audio playback
   */
  toggleDialogAudio() {
    if (!this.dialogAudioElement) {
      const audio = new Audio(this.selectedUrl);
      this.dialogAudioElement = audio;

      audio.addEventListener("timeupdate", () => {
        if (audio) {
          this.dialogAudioCurrentTime = audio.currentTime;
          this.updateHighlightedWord();
        }
      });

      audio.addEventListener("loadedmetadata", () => {
        if (audio) {
          this.dialogAudioDuration = audio.duration;
        }
      });

      audio.addEventListener("ended", () => {
        this.isDialogAudioPlaying = false;
        this.dialogCurrentWordIndex = -1;
        this.dialogAudioCurrentTime = this.dialogAudioDuration;
      });

      audio.play();
      this.isDialogAudioPlaying = true;
    } else {
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
   * Update highlighted word based on audio time
   */
  updateHighlightedWord() {
    if (!this.selectedWords.length) return;

    const time = this.dialogAudioCurrentTime;
    const wordIndex = this.selectedWords.findIndex(
      (word) => time >= word.start && time < word.end
    );

    if (wordIndex !== -1 && wordIndex !== this.dialogCurrentWordIndex) {
      this.dialogCurrentWordIndex = wordIndex;
    }
  }

  /**
   * Seek dialog audio to a specific time
   */
  seekDialogAudio(value: number) {
    if (this.dialogAudioElement) {
      this.dialogAudioElement.currentTime = value;
      this.dialogAudioCurrentTime = value;
      this.updateHighlightedWord();
    }
  }

  /**
   * Seek to specific word in STT dialog
   */
  seekToWord(wordIndex: number) {
    if (!this.dialogAudioElement && this.selectedUrl) {
      const audio = new Audio(this.selectedUrl);
      this.dialogAudioElement = audio;

      audio.addEventListener("timeupdate", () => {
        if (audio) {
          this.dialogAudioCurrentTime = audio.currentTime;
          this.updateHighlightedWord();
        }
      });

      audio.addEventListener("loadedmetadata", () => {
        this.dialogAudioDuration = audio.duration;
        if (this.selectedWords[wordIndex]) {
          audio.currentTime = this.selectedWords[wordIndex].start;
          this.dialogAudioCurrentTime = this.selectedWords[wordIndex].start;
          this.dialogCurrentWordIndex = wordIndex;
        }
      });

      audio.addEventListener("ended", () => {
        this.isDialogAudioPlaying = false;
        this.dialogCurrentWordIndex = -1;
        this.dialogAudioCurrentTime = this.dialogAudioDuration;
      });

      audio.play();
      this.isDialogAudioPlaying = true;
    } else if (this.dialogAudioElement && this.selectedWords[wordIndex]) {
      this.dialogAudioElement.currentTime = this.selectedWords[wordIndex].start;
      this.dialogAudioCurrentTime = this.selectedWords[wordIndex].start;
      this.dialogCurrentWordIndex = wordIndex;

      if (!this.isDialogAudioPlaying) {
        this.dialogAudioElement.play();
        this.isDialogAudioPlaying = true;
      }
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
    this.dialogCurrentWordIndex = -1;
  }

  // ==================== Helper Methods ====================

  /**
   * Get model name by ID
   */
  getModelName(modelId: string): string {
    return this.models.find((m) => m.id === modelId)?.name || modelId;
  }

  /**
   * Copy transcription text to clipboard
   */
  async copyTranscriptionText() {
    try {
      await navigator.clipboard.writeText(this.selectedText);
      this.copiedTranscriptionText = true;
      setTimeout(() => {
        this.copiedTranscriptionText = false;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy transcription:", err);
    }
  }
}
