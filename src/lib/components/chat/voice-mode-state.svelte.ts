import { toast } from "svelte-sonner";

export class VoiceModeState {
  isActive = $state(false);
  isRecording = $state(false);
  isTranscribing = $state(false);
  recordingTime = $state(0);
  error = $state<string | null>(null);

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  get isProcessing() {
    return this.isRecording || this.isTranscribing;
  }

  async startRecording(): Promise<void> {
    this.error = null;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(100);
      this.isRecording = true;
      this.isActive = true;
      this.recordingTime = 0;

      this.timerInterval = setInterval(() => {
        this.recordingTime++;
      }, 1000);
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone access denied. Please allow microphone access in your browser settings."
          : "Failed to start recording. Please check your microphone.";
      this.error = message;
      toast.error(message);
    }
  }

  async stopRecording(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
        this.isRecording = false;
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || "audio/webm";
        const blob = new Blob(this.audioChunks, { type: mimeType });
        this.audioChunks = [];
        this.isRecording = false;
        this.cleanupTimer();
        this.cleanupStream();
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  async stopAndTranscribe(): Promise<string | null> {
    const blob = await this.stopRecording();
    if (!blob || blob.size === 0) {
      return null;
    }

    this.isTranscribing = true;
    this.error = null;

    try {
      const formData = new FormData();
      const ext = blob.type.includes("webm") ? "webm" : "mp4";
      formData.append("file", blob, `voice-input.${ext}`);
      formData.append("modelId", "scribe_v1");
      formData.append("tagAudioEvents", "false");
      formData.append("diarize", "false");

      const res = await fetch("/api/audio-transcription", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Transcription failed (${res.status})`);
      }

      const data = await res.json();
      return data.text || null;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Transcription failed";
      this.error = message;
      toast.error(message);
      return null;
    } finally {
      this.isTranscribing = false;
    }
  }

  cancelRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
    this.audioChunks = [];
    this.isRecording = false;
    this.isTranscribing = false;
    this.cleanupStream();
    this.cleanupTimer();
  }

  deactivate(): void {
    this.cancelRecording();
    this.isActive = false;
    this.error = null;
    this.recordingTime = 0;
  }

  private cleanupStream(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  private cleanupTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  destroy(): void {
    this.deactivate();
    this.cleanupStream();
  }
}
