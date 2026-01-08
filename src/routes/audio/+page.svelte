<script lang="ts">
  import { getContext } from "svelte";
  import * as m from "$lib/../paraglide/messages.js";

  // UI Components
  import Button from "$lib/components/ui/button/button.svelte";
  import * as InputGroup from "$lib/components/ui/input-group/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import Switch from "$lib/components/ui/switch/switch.svelte";
  import * as Popover from "$lib/components/ui/popover/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";

  // Icons
  import {
    AudioLinesIcon,
    MicIcon, // Used for STT mode toggle
    PlayIcon,
    PauseIcon,
    SquareIcon,
    Volume2Icon,
    UploadIcon,
    DownloadIcon,
    TrashIcon,
    XIcon,
    SettingsIcon,
    EyeIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ArrowUpIcon,
    ShuffleIcon, // Used for Voice Changer mode toggle
    Music2Icon, // Used for Music mode toggle
    SparklesIcon, // Used for Sound Effects mode toggle
    CheckCircleIcon, // Used for copy confirmation
  } from "$lib/icons/index.js";

  import type { SettingsState } from "$lib/stores/settings.svelte.js";

  // Import voices from client-safe constants file (for shared getVoiceName helper)
  import { ELEVENLABS_VOICES } from "$lib/constants/elevenlabs.js";

  // Import TTS, STT, Voice Changer, Music, and Sound Effects state classes
  import { TTSState } from "./tts.svelte.ts";
  import { STTState } from "./stt.svelte.ts";
  import { VoiceChangerState } from "./voice-changer.svelte.ts";
  import { MusicState } from "./music.svelte.ts";
  import { SoundEffectsState } from "./sound-effects.svelte.ts";

  // Get settings from context (provided by layout)
  const settingsState = getContext<SettingsState>("settings");

  // Get page data (includes isDemoMode)
  let { data } = $props();

  // TTS State (encapsulated in class)
  const tts = new TTSState();

  // STT State (encapsulated in class)
  const stt = new STTState();

  // Voice Changer State (encapsulated in class)
  const vc = new VoiceChangerState();

  // Music State (encapsulated in class)
  const music = new MusicState();

  // Sound Effects State (encapsulated in class)
  const sfx = new SoundEffectsState();

  // State
  let activeMode = $state<
    "tts" | "stt" | "voice_changer" | "music" | "sound_effects"
  >("tts");

  // Tab button refs for sliding animation
  let tabRefs: Record<string, HTMLButtonElement | null> = $state({
    tts: null,
    stt: null,
    voice_changer: null,
    music: null,
    sound_effects: null,
  });

  let tabContainer: HTMLDivElement | null = $state(null);

  // Tab indicator position for sliding animation
  const tabIndicatorStyle = $derived(() => {
    const activeButton = tabRefs[activeMode];
    const container = tabContainer;

    if (!activeButton || !container) {
      return "opacity: 0;";
    }

    const containerRect = container.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();
    const left = buttonRect.left - containerRect.left;
    const width = buttonRect.width;

    return `left: ${left}px; width: ${width}px; opacity: 1;`;
  });

  // Use imported voices from ElevenLabs provider (single source of truth) - for shared helper
  const voices = ELEVENLABS_VOICES;

  // Handle mode change
  function handleModeChange(
    mode: "tts" | "stt" | "voice_changer" | "music" | "sound_effects"
  ) {
    activeMode = mode;
    // Reset model selection when mode changes
    if (mode === "tts") {
      tts.selectedModel = "eleven_multilingual_v2";
    } else if (mode === "stt") {
      stt.selectedModel = "scribe_v1";
    } else if (mode === "music") {
      music.selectedModel = "music_v1";
    } else if (mode === "sound_effects") {
      sfx.selectedModel = "sound_effects_v1";
    }
    // Voice changer uses stsSelectedModel separately
  }

  // Shared helper functions (used by TTS, STT, and Voice Changer)
  function formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return m["audio.just_now"]();
    if (diffMins < 60) return m["audio.minutes_ago"]({ minutes: diffMins });
    if (diffHours < 24) return m["audio.hours_ago"]({ hours: diffHours });
    if (diffDays < 7) return m["audio.days_ago"]({ days: diffDays });

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }

  function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
  }

  // Voice name helper (used by TTS and Voice Changer)
  function getVoiceName(voiceId: string): string {
    return voices.find((v) => v.id === voiceId)?.name || voiceId;
  }

  // Load history on mount and mode change using $effect
  $effect(() => {
    if (activeMode === "tts") {
      tts.loadHistory();
    } else if (activeMode === "stt") {
      stt.loadHistory();
    } else if (activeMode === "voice_changer") {
      vc.loadHistory();
    } else if (activeMode === "music") {
      music.loadHistory();
    } else if (activeMode === "sound_effects") {
      sfx.loadHistory();
    }
  });

  // Auto-scroll effect for STT dialog word highlighting
  $effect(() => {
    if (stt.dialogCurrentWordIndex >= 0 && stt.transcriptContainer) {
      const wordElement = document.getElementById(
        `dialog-stt-word-${stt.dialogCurrentWordIndex}`
      );
      if (wordElement) {
        const container = stt.transcriptContainer;
        const containerRect = container.getBoundingClientRect();
        const wordRect = wordElement.getBoundingClientRect();

        if (
          wordRect.top < containerRect.top ||
          wordRect.bottom > containerRect.bottom
        ) {
          wordElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
    }
  });
</script>

<svelte:head>
  <title>{m["audio.page_title"]()}</title>
  <meta
    name="description"
    content={m["audio.description"]()}
  />
</svelte:head>

<main class="h-full p-6 pb-2 flex flex-col">
  <div class="max-w-4xl mx-auto w-full flex-1 flex flex-col">
    <!-- Header -->
    <div class="mb-4 text-center">
      <div class="flex items-center justify-center gap-3">
        <AudioLinesIcon class="w-5 h-5 text-primary" />
        <h1 class="text-2xl font-bold">{m["audio.title"]()}</h1>
      </div>
    </div>

    <!-- Output Section -->
    <div class="flex-1 flex flex-col w-full">
      {#if activeMode === "tts"}
        <!-- TTS History Section -->
        <div class="flex-1 flex flex-col min-h-0">
          <div class="mb-2 flex items-center justify-between">
            <h3 class="text-md font-semibold">{m["audio.history_tts_title"]()}</h3>
            <p class="text-sm text-muted-foreground">
              {tts.totalHistoryItems}
              {tts.totalHistoryItems === 1 ? m["audio.speech_singular"]() : m["audio.speech_plural"]()}
            </p>
          </div>

          {#if tts.errorMessage}
            <div class="text-center py-8">
              <p class="text-sm text-destructive mb-2">{tts.errorMessage}</p>
              <Button
                variant="ghost"
                size="sm"
                onclick={() => (tts.errorMessage = null)}
              >
                {m["audio.dismiss"]()}
              </Button>
            </div>
          {:else if tts.isLoadingHistory}
            <div class="flex flex-col items-center justify-center py-12">
              <div
                class="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"
              ></div>
              <p class="text-sm text-muted-foreground mt-3">
                {m["audio.loading_history"]()}
              </p>
            </div>
          {:else if tts.history.length === 0}
            <div
              class="flex flex-col items-center justify-center py-12 text-center"
            >
              <AudioLinesIcon class="w-12 h-12 text-muted-foreground/50 mb-3" />
              <p class="text-sm text-muted-foreground">
                {m["audio.no_speeches_yet"]()}
              </p>
              <p class="text-xs text-muted-foreground mt-1">
                {m["audio.speeches_will_appear"]()}
              </p>
            </div>
          {:else}
            <div class="rounded-lg">
              <Table.Root>
                <Table.Header>
                  <Table.Row>
                    <Table.Head class="w-[90px] xl:w-[110px]">{m["audio.table_date"]()}</Table.Head>
                    <Table.Head class="w-[100px] xl:w-[120px]">{m["audio.table_model"]()}</Table.Head
                    >
                    <Table.Head class="w-[80px] xl:w-[100px]">{m["audio.table_voice"]()}</Table.Head>
                    <Table.Head>{m["audio.table_text"]()}</Table.Head>
                    <Table.Head class="hidden xl:table-cell w-[70px]"
                      >{m["audio.table_size"]()}</Table.Head
                    >
                    <Table.Head class="w-[140px] xl:w-[160px] text-right"
                      >{m["audio.table_actions"]()}</Table.Head
                    >
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {#each tts.history as item (item.id)}
                    <Table.Row>
                      <Table.Cell class="text-sm text-muted-foreground">
                        {formatDate(item.createdAt)}
                      </Table.Cell>
                      <Table.Cell class="text-sm">
                        {tts.getModelName(item.model)}
                      </Table.Cell>
                      <Table.Cell class="text-sm">
                        {tts.getVoiceName(item.voiceId)}
                      </Table.Cell>
                      <Table.Cell>
                        <button
                          type="button"
                          onclick={() =>
                            tts.viewFullText(
                              item.text,
                              item.id,
                              item.url,
                              item.model,
                              item.voiceId,
                              item.mimeType
                            )}
                          class="cursor-pointer text-sm text-left hover:text-primary transition-colors max-w-[150px] xl:max-w-[200px] truncate block"
                          title={m["audio.click_to_view_text"]()}
                        >
                          {truncateText(item.text, 50)}
                        </button>
                      </Table.Cell>
                      <Table.Cell
                        class="hidden xl:table-cell text-sm text-muted-foreground"
                      >
                        {formatFileSize(item.fileSize)}
                      </Table.Cell>
                      <Table.Cell>
                        <div class="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onclick={() =>
                              tts.toggleHistoryAudio(item.id, item.url)}
                            title={tts.currentlyPlayingAudioId === item.id
                              ? m["audio.pause"]()
                              : m["audio.play"]()}
                          >
                            {#if tts.currentlyPlayingAudioId === item.id}
                              <PauseIcon class="w-4 h-4" />
                            {:else}
                              <PlayIcon class="w-4 h-4" />
                            {/if}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onclick={() =>
                              tts.viewFullText(
                                item.text,
                                item.id,
                                item.url,
                                item.model,
                                item.voiceId,
                                item.mimeType
                              )}
                            title={m["audio.view_full_text"]()}
                          >
                            <EyeIcon class="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onclick={() =>
                              tts.downloadHistoryAudio(
                                item.id,
                                item.url,
                                item.mimeType
                              )}
                            title={m["audio.download"]()}
                          >
                            <DownloadIcon class="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onclick={() => tts.deleteAudio(item.id)}
                            disabled={data.isDemoMode}
                            title={data.isDemoMode
                              ? m["audio.deletion_disabled_demo"]()
                              : m["audio.delete"]()}
                            class="text-destructive hover:text-destructive {data.isDemoMode
                              ? 'opacity-50 cursor-not-allowed'
                              : ''}"
                          >
                            <TrashIcon class="w-4 h-4" />
                          </Button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  {/each}
                </Table.Body>
              </Table.Root>
            </div>

            <!-- Pagination -->
            {#if tts.totalPages > 1}
              <div class="flex items-center justify-end mt-2 px-2">
                <div class="flex items-center gap-2">
                  <p class="text-sm text-muted-foreground mr-2">
                    {m["audio.page_of"]({ current: tts.historyPage, total: tts.totalPages })}
                  </p>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onclick={() => tts.changePage(tts.historyPage - 1)}
                    disabled={tts.historyPage === 1}
                  >
                    <ChevronLeftIcon class="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onclick={() => tts.changePage(tts.historyPage + 1)}
                    disabled={tts.historyPage === tts.totalPages}
                  >
                    <ChevronRightIcon class="w-4 h-4" />
                  </Button>
                </div>
              </div>
            {/if}
          {/if}
        </div>
      {:else if activeMode === "stt"}
        <!-- STT History Section -->
        <div class="flex-1 flex flex-col min-h-0">
          <div class="mb-2 flex items-center justify-between">
            <h3 class="text-md font-semibold">{m["audio.history_stt_title"]()}</h3>
            <p class="text-sm text-muted-foreground">
              {stt.totalHistoryItems}
              {stt.totalHistoryItems === 1 ? m["audio.transcription_singular"]() : m["audio.transcription_plural"]()}
            </p>
          </div>

          {#if stt.errorMessage}
            <div class="text-center py-8">
              <p class="text-sm text-destructive mb-2">{stt.errorMessage}</p>
              <Button
                variant="ghost"
                size="sm"
                onclick={() => (stt.errorMessage = null)}
              >
                {m["audio.dismiss"]()}
              </Button>
            </div>
          {:else if stt.isLoadingHistory}
            <div class="flex flex-col items-center justify-center py-12">
              <div
                class="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"
              ></div>
              <p class="text-sm text-muted-foreground mt-3">
                {m["audio.loading_history"]()}
              </p>
            </div>
          {:else if stt.isTranscribing}
            <div class="flex flex-col items-center justify-center py-12">
              <div
                class="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"
              ></div>
              <p class="text-sm text-muted-foreground mt-3">{m["audio.transcribing"]()}</p>
            </div>
          {:else if stt.history.length === 0}
            <div
              class="flex flex-col items-center justify-center py-12 text-center"
            >
              <MicIcon class="w-12 h-12 text-muted-foreground/50 mb-3" />
              <p class="text-sm text-muted-foreground">{m["audio.no_transcriptions_yet"]()}</p>
              <p class="text-xs text-muted-foreground mt-1">
                {m["audio.transcriptions_will_appear"]()}
              </p>
            </div>
          {:else}
            <div class="rounded-lg">
              <Table.Root>
                <Table.Header>
                  <Table.Row>
                    <Table.Head class="w-[90px] xl:w-[110px]">{m["audio.table_date"]()}</Table.Head>
                    <Table.Head class="w-[100px] xl:w-[120px]">{m["audio.table_model"]()}</Table.Head
                    >
                    <Table.Head class="w-auto">{m["audio.table_text"]()}</Table.Head>
                    <Table.Head class="w-[80px]">{m["audio.table_actions"]()}</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {#each stt.history as item (item.id)}
                    <Table.Row>
                      <Table.Cell class="text-sm text-muted-foreground">
                        {formatDate(item.createdAt)}
                      </Table.Cell>
                      <Table.Cell class="text-sm">
                        {stt.getModelName(item.model)}
                      </Table.Cell>
                      <Table.Cell>
                        <button
                          type="button"
                          onclick={() => stt.viewDetails(item)}
                          class="cursor-pointer text-sm text-left hover:text-primary transition-colors truncate block"
                          title={m["audio.click_to_view_transcription"]()}
                        >
                          {truncateText(item.text, 50)}
                        </button>
                      </Table.Cell>
                      <Table.Cell>
                        <div class="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onclick={() => stt.viewDetails(item)}
                            title={m["audio.view_transcription"]()}
                          >
                            <EyeIcon class="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onclick={() => stt.deleteTranscription(item.id)}
                            disabled={data.isDemoMode}
                            title={data.isDemoMode
                              ? m["audio.deletion_disabled_demo"]()
                              : m["audio.delete"]()}
                            class="text-destructive hover:text-destructive {data.isDemoMode
                              ? 'opacity-50 cursor-not-allowed'
                              : ''}"
                          >
                            <TrashIcon class="w-4 h-4" />
                          </Button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  {/each}
                </Table.Body>
              </Table.Root>
            </div>

            <!-- Pagination -->
            {#if stt.totalPages > 1}
              <div class="flex items-center justify-end mt-2 px-2">
                <div class="flex items-center gap-2">
                  <p class="text-sm text-muted-foreground mr-2">
                    {m["audio.page_of"]({ current: stt.historyPage, total: stt.totalPages })}
                  </p>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onclick={() => stt.changePage(stt.historyPage - 1)}
                    disabled={stt.historyPage === 1}
                  >
                    <ChevronLeftIcon class="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onclick={() => stt.changePage(stt.historyPage + 1)}
                    disabled={stt.historyPage === stt.totalPages}
                  >
                    <ChevronRightIcon class="w-4 h-4" />
                  </Button>
                </div>
              </div>
            {/if}
          {/if}
        </div>
      {:else if activeMode === "voice_changer"}
        <!-- Voice Changer History Section -->
        <div class="flex-1 flex flex-col min-h-0">
          <div class="mb-2 flex items-center justify-between">
            <h3 class="text-md font-semibold">{m["audio.history_voice_changer_title"]()}</h3>
            <p class="text-sm text-muted-foreground">
              {vc.totalHistoryItems}
              {vc.totalHistoryItems === 1
                ? m["audio.transformation_singular"]()
                : m["audio.transformation_plural"]()}
            </p>
          </div>

          {#if vc.errorMessage}
            <div class="text-center py-8">
              <p class="text-sm text-destructive mb-2">{vc.errorMessage}</p>
              <Button
                variant="ghost"
                size="sm"
                onclick={() => (vc.errorMessage = null)}
              >
                {m["audio.dismiss"]()}
              </Button>
            </div>
          {:else if vc.isLoadingHistory}
            <div class="flex flex-col items-center justify-center py-12">
              <div
                class="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"
              ></div>
              <p class="text-sm text-muted-foreground mt-3">
                {m["audio.loading_history"]()}
              </p>
            </div>
          {:else if vc.isVoiceChanging}
            <div class="flex flex-col items-center justify-center py-12">
              <div
                class="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"
              ></div>
              <p class="text-sm text-muted-foreground mt-3">
                {m["audio.transforming_voice"]()}
              </p>
            </div>
          {:else if vc.history.length === 0}
            <div
              class="flex flex-col items-center justify-center py-12 text-center"
            >
              <ShuffleIcon class="w-12 h-12 text-muted-foreground/50 mb-3" />
              <p class="text-sm text-muted-foreground">{m["audio.no_voice_changes_yet"]()}</p>
              <p class="text-xs text-muted-foreground mt-1">
                {m["audio.voice_changes_will_appear"]()}
              </p>
            </div>
          {:else}
            <div class="rounded-lg">
              <Table.Root>
                <Table.Header>
                  <Table.Row>
                    <Table.Head class="w-[90px] xl:w-[110px]">{m["audio.table_date"]()}</Table.Head>
                    <Table.Head class="w-[100px] xl:w-[120px]">{m["audio.table_model"]()}</Table.Head
                    >
                    <Table.Head class="w-[80px] xl:w-[100px]">{m["audio.table_voice"]()}</Table.Head>
                    <Table.Head>{m["audio.table_original_file"]()}</Table.Head>
                    <Table.Head class="hidden xl:table-cell w-[70px]"
                      >{m["audio.table_size"]()}</Table.Head
                    >
                    <Table.Head class="w-[100px] text-right">{m["audio.table_actions"]()}</Table.Head
                    >
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {#each vc.history as item (item.id)}
                    <Table.Row>
                      <Table.Cell class="text-sm text-muted-foreground">
                        {formatDate(item.createdAt)}
                      </Table.Cell>
                      <Table.Cell class="text-sm">
                        {vc.getModelName(item.model)}
                      </Table.Cell>
                      <Table.Cell class="text-sm">
                        {vc.getVoiceName(item.targetVoiceId)}
                      </Table.Cell>
                      <Table.Cell>
                        <button
                          type="button"
                          onclick={() => vc.viewDetails(item)}
                          class="cursor-pointer text-sm text-left hover:text-primary transition-colors max-w-[150px] xl:max-w-[200px] truncate block"
                          title={m["audio.click_to_view_details"]()}
                        >
                          {truncateText(item.originalFilename, 30)}
                        </button>
                      </Table.Cell>
                      <Table.Cell
                        class="hidden xl:table-cell text-sm text-muted-foreground"
                      >
                        {formatFileSize(item.fileSize)}
                      </Table.Cell>
                      <Table.Cell>
                        <div class="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onclick={() =>
                              vc.toggleHistoryTransformedAudio(
                                item.id,
                                item.transformedUrl
                              )}
                            title={vc.currentlyPlayingTransformedAudioId ===
                            item.id
                              ? m["audio.pause_audio"]()
                              : m["audio.play_transformed_audio"]()}
                          >
                            {#if vc.currentlyPlayingTransformedAudioId === item.id}
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                class="lucide lucide-pause w-4 h-4"
                              >
                                <rect
                                  x="14"
                                  y="4"
                                  width="4"
                                  height="16"
                                  rx="1"
                                />
                                <rect
                                  x="6"
                                  y="4"
                                  width="4"
                                  height="16"
                                  rx="1"
                                />
                              </svg>
                            {:else}
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                class="lucide lucide-play w-4 h-4"
                              >
                                <polygon points="6 3 20 12 6 21 6 3" />
                              </svg>
                            {/if}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onclick={() => vc.viewDetails(item)}
                            title={m["audio.view_details"]()}
                          >
                            <EyeIcon class="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onclick={() =>
                              vc.downloadTransformedAudio(
                                item.id,
                                item.transformedUrl,
                                item.originalFilename,
                                item.mimeType
                              )}
                            title={m["audio.download_transformed"]()}
                          >
                            <DownloadIcon class="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onclick={() => vc.deleteVoiceChange(item.id)}
                            disabled={data.isDemoMode}
                            title={data.isDemoMode
                              ? m["audio.deletion_disabled_demo"]()
                              : m["audio.delete"]()}
                            class="text-destructive hover:text-destructive {data.isDemoMode
                              ? 'opacity-50 cursor-not-allowed'
                              : ''}"
                          >
                            <TrashIcon class="w-4 h-4" />
                          </Button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  {/each}
                </Table.Body>
              </Table.Root>
            </div>

            <!-- Pagination -->
            {#if vc.totalPages > 1}
              <div class="flex items-center justify-end mt-2 px-2">
                <div class="flex items-center gap-2">
                  <p class="text-sm text-muted-foreground mr-2">
                    {m["audio.page_of"]({ current: vc.historyPage, total: vc.totalPages })}
                  </p>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onclick={() => vc.changePage(vc.historyPage - 1)}
                    disabled={vc.historyPage === 1}
                  >
                    <ChevronLeftIcon class="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onclick={() => vc.changePage(vc.historyPage + 1)}
                    disabled={vc.historyPage === vc.totalPages}
                  >
                    <ChevronRightIcon class="w-4 h-4" />
                  </Button>
                </div>
              </div>
            {/if}
          {/if}
        </div>
      {:else if activeMode === "music"}
        <!-- Music History Section -->
        <div class="flex-1 flex flex-col min-h-0">
          <div class="mb-2 flex items-center justify-between">
            <h3 class="text-md font-semibold">{m["audio.history_music_title"]()}</h3>
            <p class="text-sm text-muted-foreground">
              {music.totalHistoryItems}
              {music.totalHistoryItems === 1 ? m["audio.track_singular"]() : m["audio.track_plural"]()}
            </p>
          </div>

          {#if music.errorMessage}
            <div class="text-center py-8">
              <p class="text-sm text-destructive mb-2">{music.errorMessage}</p>
              <Button
                variant="ghost"
                size="sm"
                onclick={() => (music.errorMessage = null)}
              >
                {m["audio.dismiss"]()}
              </Button>
            </div>
          {:else if music.isLoadingHistory}
            <div class="flex flex-col items-center justify-center py-12">
              <div
                class="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"
              ></div>
              <p class="text-sm text-muted-foreground mt-3">
                {m["audio.loading_history"]()}
              </p>
            </div>
          {:else if music.isGenerating}
            <div class="flex flex-col items-center justify-center py-12">
              <div
                class="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"
              ></div>
              <p class="text-sm text-muted-foreground mt-3">
                {m["audio.generating_music"]()}
              </p>
            </div>
          {:else if music.history.length === 0}
            <div
              class="flex flex-col items-center justify-center py-12 text-center"
            >
              <Music2Icon class="w-12 h-12 text-muted-foreground/50 mb-3" />
              <p class="text-sm text-muted-foreground">
                {m["audio.no_music_yet"]()}
              </p>
              <p class="text-xs text-muted-foreground mt-1">
                {m["audio.music_will_appear"]()}
              </p>
            </div>
          {:else}
            <div class="rounded-lg">
              <Table.Root>
                <Table.Header>
                  <Table.Row>
                    <Table.Head class="w-[90px] xl:w-[110px]">{m["audio.table_date"]()}</Table.Head>
                    <Table.Head class="w-[100px] xl:w-[120px]">{m["audio.table_model"]()}</Table.Head
                    >
                    <Table.Head class="w-[80px]">{m["audio.table_text"]()}</Table.Head>
                    <Table.Head>{m["audio.table_prompt"]()}</Table.Head>
                    <Table.Head class="hidden xl:table-cell w-[70px]"
                      >{m["audio.table_size"]()}</Table.Head
                    >
                    <Table.Head class="w-[140px] xl:w-[160px] text-right"
                      >{m["audio.table_actions"]()}</Table.Head
                    >
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {#each music.history as item (item.id)}
                    <Table.Row>
                      <Table.Cell class="text-sm text-muted-foreground">
                        {formatDate(item.createdAt)}
                      </Table.Cell>
                      <Table.Cell class="text-sm">
                        {music.getModelName(item.model)}
                      </Table.Cell>
                      <Table.Cell class="text-sm">
                        {item.isInstrumental ? m["audio.type_instrumental"]() : m["audio.type_vocal"]()}
                      </Table.Cell>
                      <Table.Cell>
                        <button
                          type="button"
                          onclick={() =>
                            music.viewDetails(
                              item.prompt,
                              item.id,
                              item.url,
                              item.model,
                              item.durationMs,
                              item.isInstrumental,
                              item.mimeType
                            )}
                          class="cursor-pointer text-sm text-left hover:text-primary transition-colors max-w-[150px] xl:max-w-[200px] truncate block"
                          title={m["audio.click_to_view_details"]()}
                        >
                          {truncateText(item.prompt, 50)}
                        </button>
                      </Table.Cell>
                      <Table.Cell
                        class="hidden xl:table-cell text-sm text-muted-foreground"
                      >
                        {formatFileSize(item.fileSize)}
                      </Table.Cell>
                      <Table.Cell>
                        <div class="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onclick={() =>
                              music.toggleHistoryAudio(item.id, item.url)}
                            title={music.currentlyPlayingAudioId === item.id
                              ? m["audio.pause"]()
                              : m["audio.play"]()}
                          >
                            {#if music.currentlyPlayingAudioId === item.id}
                              <PauseIcon class="w-4 h-4" />
                            {:else}
                              <PlayIcon class="w-4 h-4" />
                            {/if}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onclick={() =>
                              music.viewDetails(
                                item.prompt,
                                item.id,
                                item.url,
                                item.model,
                                item.durationMs,
                                item.isInstrumental,
                                item.mimeType
                              )}
                            title={m["audio.view_details"]()}
                          >
                            <EyeIcon class="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onclick={() =>
                              music.downloadHistoryMusic(
                                item.id,
                                item.url,
                                item.mimeType
                              )}
                            title={m["audio.download"]()}
                          >
                            <DownloadIcon class="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onclick={() => music.deleteMusic(item.id)}
                            disabled={data.isDemoMode}
                            title={data.isDemoMode
                              ? m["audio.deletion_disabled_demo"]()
                              : m["audio.delete"]()}
                            class="text-destructive hover:text-destructive {data.isDemoMode
                              ? 'opacity-50 cursor-not-allowed'
                              : ''}"
                          >
                            <TrashIcon class="w-4 h-4" />
                          </Button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  {/each}
                </Table.Body>
              </Table.Root>
            </div>

            <!-- Pagination -->
            {#if music.totalPages > 1}
              <div class="flex items-center justify-end mt-2 px-2">
                <div class="flex items-center gap-2">
                  <p class="text-sm text-muted-foreground mr-2">
                    {m["audio.page_of"]({ current: music.historyPage, total: music.totalPages })}
                  </p>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onclick={() => music.changePage(music.historyPage - 1)}
                    disabled={music.historyPage === 1}
                  >
                    <ChevronLeftIcon class="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onclick={() => music.changePage(music.historyPage + 1)}
                    disabled={music.historyPage === music.totalPages}
                  >
                    <ChevronRightIcon class="w-4 h-4" />
                  </Button>
                </div>
              </div>
            {/if}
          {/if}
        </div>
      {:else if activeMode === "sound_effects"}
        <!-- Sound Effects History Section -->
        <div class="flex-1 flex flex-col min-h-0">
          <div class="mb-2 flex items-center justify-between">
            <h3 class="text-md font-semibold">{m["audio.history_sound_effects_title"]()}</h3>
            <p class="text-sm text-muted-foreground">
              {sfx.totalHistoryItems}
              {sfx.totalHistoryItems === 1 ? m["audio.effect_singular"]() : m["audio.effect_plural"]()}
            </p>
          </div>

          {#if sfx.errorMessage}
            <div class="text-center py-8">
              <p class="text-sm text-destructive mb-2">{sfx.errorMessage}</p>
              <Button
                variant="ghost"
                size="sm"
                onclick={() => (sfx.errorMessage = null)}
              >
                {m["audio.dismiss"]()}
              </Button>
            </div>
          {:else if sfx.isLoadingHistory}
            <div class="flex flex-col items-center justify-center py-12">
              <div
                class="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"
              ></div>
              <p class="text-sm text-muted-foreground mt-3">
                {m["audio.loading_history"]()}
              </p>
            </div>
          {:else if sfx.isGenerating}
            <div class="flex flex-col items-center justify-center py-12">
              <div
                class="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"
              ></div>
              <p class="text-sm text-muted-foreground mt-3">
                {m["audio.generating_sound_effect"]()}
              </p>
            </div>
          {:else if sfx.history.length === 0}
            <div
              class="flex flex-col items-center justify-center py-12 text-center"
            >
              <SparklesIcon class="w-12 h-12 text-muted-foreground/50 mb-3" />
              <p class="text-sm text-muted-foreground">
                {m["audio.no_sound_effects_yet"]()}
              </p>
              <p class="text-xs text-muted-foreground mt-1">
                {m["audio.effects_will_appear"]()}
              </p>
            </div>
          {:else}
            <div class="rounded-lg">
              <Table.Root>
                <Table.Header>
                  <Table.Row>
                    <Table.Head class="w-[90px] xl:w-[110px]">{m["audio.table_date"]()}</Table.Head>
                    <Table.Head class="w-[100px] xl:w-[120px]">{m["audio.table_model"]()}</Table.Head
                    >
                    <Table.Head>{m["audio.table_text"]()}</Table.Head>
                    <Table.Head class="hidden xl:table-cell w-[70px]"
                      >{m["audio.table_size"]()}</Table.Head
                    >
                    <Table.Head class="w-[140px] xl:w-[160px] text-right"
                      >{m["audio.table_actions"]()}</Table.Head
                    >
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {#each sfx.history as item (item.id)}
                    <Table.Row>
                      <Table.Cell class="text-sm text-muted-foreground">
                        {formatDate(item.createdAt)}
                      </Table.Cell>
                      <Table.Cell class="text-sm">
                        {sfx.getModelName(item.model)}
                      </Table.Cell>
                      <Table.Cell>
                        <button
                          type="button"
                          onclick={() =>
                            sfx.viewDetails(
                              item.text,
                              item.id,
                              item.url,
                              item.model,
                              item.durationSeconds,
                              item.promptInfluence,
                              item.mimeType
                            )}
                          class="cursor-pointer text-sm text-left hover:text-primary transition-colors max-w-[150px] xl:max-w-[200px] truncate block"
                          title={m["audio.click_to_view_details"]()}
                        >
                          {truncateText(item.text, 50)}
                        </button>
                      </Table.Cell>
                      <Table.Cell
                        class="hidden xl:table-cell text-sm text-muted-foreground"
                      >
                        {formatFileSize(item.fileSize)}
                      </Table.Cell>
                      <Table.Cell>
                        <div class="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onclick={() =>
                              sfx.toggleHistoryAudio(item.id, item.url)}
                            title={sfx.currentlyPlayingAudioId === item.id
                              ? m["audio.pause"]()
                              : m["audio.play"]()}
                          >
                            {#if sfx.currentlyPlayingAudioId === item.id}
                              <PauseIcon class="w-4 h-4" />
                            {:else}
                              <PlayIcon class="w-4 h-4" />
                            {/if}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onclick={() =>
                              sfx.viewDetails(
                                item.text,
                                item.id,
                                item.url,
                                item.model,
                                item.durationSeconds,
                                item.promptInfluence,
                                item.mimeType
                              )}
                            title={m["audio.view_details"]()}
                          >
                            <EyeIcon class="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onclick={() =>
                              sfx.downloadHistorySoundEffect(
                                item.id,
                                item.url,
                                item.mimeType
                              )}
                            title={m["audio.download"]()}
                          >
                            <DownloadIcon class="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onclick={() => sfx.deleteSoundEffect(item.id)}
                            disabled={data.isDemoMode}
                            title={data.isDemoMode
                              ? m["audio.deletion_disabled_demo"]()
                              : m["audio.delete"]()}
                            class="text-destructive hover:text-destructive {data.isDemoMode
                              ? 'opacity-50 cursor-not-allowed'
                              : ''}"
                          >
                            <TrashIcon class="w-4 h-4" />
                          </Button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  {/each}
                </Table.Body>
              </Table.Root>
            </div>

            <!-- Pagination -->
            {#if sfx.totalPages > 1}
              <div class="flex items-center justify-end mt-2 px-2">
                <div class="flex items-center gap-2">
                  <p class="text-sm text-muted-foreground mr-2">
                    {m["audio.page_of"]({ current: sfx.historyPage, total: sfx.totalPages })}
                  </p>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onclick={() => sfx.changePage(sfx.historyPage - 1)}
                    disabled={sfx.historyPage === 1}
                  >
                    <ChevronLeftIcon class="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onclick={() => sfx.changePage(sfx.historyPage + 1)}
                    disabled={sfx.historyPage === sfx.totalPages}
                  >
                    <ChevronRightIcon class="w-4 h-4" />
                  </Button>
                </div>
              </div>
            {/if}
          {/if}
        </div>
      {/if}
    </div>

    <!-- Spacer to push input to bottom -->
    <div class="flex-1"></div>

    <!-- Mode Toggle -->
    <div class="max-w-3xl mx-auto w-full mb-2">
      <div
        bind:this={tabContainer}
        class="inline-flex items-center gap-0.5 md:gap-1 rounded-md border bg-muted p-0.5 relative"
      >
        <!-- Animated background indicator -->
        <div
          class="absolute inset-y-0.5 bg-background rounded-md shadow-sm border border-border transition-all duration-300 ease-in-out pointer-events-none"
          style={tabIndicatorStyle()}
        ></div>

        <button
          bind:this={tabRefs.tts}
          onclick={() => handleModeChange("tts")}
          aria-label={m["audio.tab_aria_tts"]()}
          class="cursor-pointer flex items-center md:gap-1.5 px-2 md:px-2.5 py-1 text-sm font-medium rounded-md transition-colors relative z-10 whitespace-nowrap {activeMode ===
          'tts'
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-foreground'}"
        >
          <Volume2Icon class="w-3.5 h-3.5" />
          <span class="hidden md:inline">{m["audio.tab_label_tts"]()}</span>
        </button>
        <button
          bind:this={tabRefs.stt}
          onclick={() => handleModeChange("stt")}
          aria-label={m["audio.tab_aria_stt"]()}
          class="cursor-pointer flex items-center md:gap-1.5 px-2 md:px-2.5 py-1 text-sm font-medium rounded-md transition-colors relative z-10 whitespace-nowrap {activeMode ===
          'stt'
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-foreground'}"
        >
          <MicIcon class="w-3.5 h-3.5" />
          <span class="hidden md:inline">{m["audio.tab_label_stt"]()}</span>
        </button>
        <button
          bind:this={tabRefs.voice_changer}
          onclick={() => handleModeChange("voice_changer")}
          aria-label={m["audio.tab_aria_voice_changer"]()}
          class="cursor-pointer flex items-center md:gap-1.5 px-2 md:px-2.5 py-1 text-sm font-medium rounded-md transition-colors relative z-10 whitespace-nowrap {activeMode ===
          'voice_changer'
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-foreground'}"
        >
          <ShuffleIcon class="w-3.5 h-3.5" />
          <span class="hidden md:inline">{m["audio.tab_label_voice_changer"]()}</span>
        </button>
        <button
          bind:this={tabRefs.music}
          onclick={() => handleModeChange("music")}
          aria-label={m["audio.tab_aria_music"]()}
          class="cursor-pointer flex items-center md:gap-1.5 px-2 md:px-2.5 py-1 text-sm font-medium rounded-md transition-colors relative z-10 whitespace-nowrap {activeMode ===
          'music'
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-foreground'}"
        >
          <Music2Icon class="w-3.5 h-3.5" />
          <span class="hidden md:inline">{m["audio.tab_label_music"]()}</span>
        </button>
        <button
          bind:this={tabRefs.sound_effects}
          onclick={() => handleModeChange("sound_effects")}
          aria-label={m["audio.tab_aria_sound_effects"]()}
          class="cursor-pointer flex items-center md:gap-1.5 px-2 md:px-2.5 py-1 text-sm font-medium rounded-md transition-colors relative z-10 whitespace-nowrap {activeMode ===
          'sound_effects'
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-foreground'}"
        >
          <SparklesIcon class="w-3.5 h-3.5" />
          <span class="hidden md:inline">{m["audio.tab_label_sound_effects"]()}</span>
        </button>
      </div>
    </div>

    <!-- Input Section (at bottom) -->
    <div class="space-y-2">
      {#if activeMode === "tts"}
        <!-- TTS Input -->
        <InputGroup.Root
          class="min-h-36 max-w-3xl mx-auto bg-transparent dark:bg-transparent rounded-2xl shadow-md has-[[data-slot=input-group-control]:focus-visible]:!ring-0 has-[[data-slot=input-group-control]:focus-visible]:!border-input"
        >
          <InputGroup.Textarea
            bind:value={tts.inputText}
            placeholder={data.isDemoMode
              ? "Text-to-speech generation is disabled in demo mode"
              : "Enter text to convert to speech..."}
            disabled={data.isDemoMode}
            class="min-h-24 max-h-24 overflow-y-auto bg-transparent p-5"
          />
          <InputGroup.Addon align="block-end">
            <!-- Model Dropdown -->
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                {#snippet child({ props })}
                  <InputGroup.Button {...props} variant="ghost">
                    {tts.selectedModelName}
                  </InputGroup.Button>
                {/snippet}
              </DropdownMenu.Trigger>
              <DropdownMenu.Content
                side="top"
                align="start"
                class="[--radius:0.95rem]"
              >
                {#each tts.models as model}
                  <DropdownMenu.Item
                    onclick={() => (tts.selectedModel = model.id)}
                  >
                    {model.name}
                  </DropdownMenu.Item>
                {/each}
              </DropdownMenu.Content>
            </DropdownMenu.Root>

            <!-- Voice Dropdown -->
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                {#snippet child({ props })}
                  <InputGroup.Button {...props} variant="ghost">
                    {tts.selectedVoiceName}
                  </InputGroup.Button>
                {/snippet}
              </DropdownMenu.Trigger>
              <DropdownMenu.Content
                side="top"
                align="start"
                class="[--radius:0.95rem] max-h-76 overflow-y-auto"
              >
                {#each tts.voices as voice}
                  <DropdownMenu.Item
                    onclick={() => (tts.selectedVoice = voice.id)}
                    class="flex items-center gap-2"
                  >
                    <button
                      type="button"
                      onclick={(e) => {
                        e.stopPropagation();
                        tts.playVoicePreview(voice.id);
                      }}
                      class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent cursor-pointer"
                      aria-label={tts.previewingVoiceId === voice.id
                        ? `Stop ${voice.name} preview`
                        : `Preview ${voice.name}`}
                    >
                      {#if tts.previewingVoiceId === voice.id}
                        <SquareIcon class="w-4 h-4 text-primary" />
                      {:else}
                        <PlayIcon class="w-4 h-4 text-primary" />
                      {/if}
                    </button>
                    <div class="flex flex-col">
                      <span>{voice.name}</span>
                      <span
                        class="text-xs text-muted-foreground truncate max-w-62"
                        title={voice.description}>{voice.description}</span
                      >
                    </div>
                  </DropdownMenu.Item>
                {/each}
              </DropdownMenu.Content>
            </DropdownMenu.Root>

            <!-- Voice Settings Popover -->
            <Popover.Root>
              <Popover.Trigger>
                {#snippet child({ props })}
                  <InputGroup.Button {...props} variant="ghost" size="icon-sm">
                    <SettingsIcon class="w-4 h-4" />
                  </InputGroup.Button>
                {/snippet}
              </Popover.Trigger>
              <Popover.Content side="top" align="start" class="w-72">
                <div class="space-y-4">
                  <h4 class="font-medium text-sm">Voice Settings</h4>

                  <!-- Stability -->
                  <div class="space-y-2">
                    <div class="flex justify-between">
                      <Label class="text-xs">Stability</Label>
                      <span class="text-xs text-muted-foreground"
                        >{Math.round(tts.stability * 100)}%</span
                      >
                    </div>
                    <input
                      type="range"
                      bind:value={tts.stability}
                      min="0"
                      max="1"
                      step="0.01"
                      class="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <p class="text-xs text-muted-foreground">
                      Higher values make the voice more consistent but less
                      expressive.
                    </p>
                  </div>

                  <!-- Similarity Boost -->
                  <div class="space-y-2">
                    <div class="flex justify-between">
                      <Label class="text-xs">Similarity Boost</Label>
                      <span class="text-xs text-muted-foreground"
                        >{Math.round(tts.similarityBoost * 100)}%</span
                      >
                    </div>
                    <input
                      type="range"
                      bind:value={tts.similarityBoost}
                      min="0"
                      max="1"
                      step="0.01"
                      class="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <p class="text-xs text-muted-foreground">
                      Higher values make the voice sound more like the original.
                    </p>
                  </div>

                  <!-- Style -->
                  <div class="space-y-2">
                    <div class="flex justify-between">
                      <Label class="text-xs">Style Exaggeration</Label>
                      <span class="text-xs text-muted-foreground"
                        >{Math.round(tts.style * 100)}%</span
                      >
                    </div>
                    <input
                      type="range"
                      bind:value={tts.style}
                      min="0"
                      max="1"
                      step="0.01"
                      class="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <p class="text-xs text-muted-foreground">
                      Increases character intensity. Keep at 0 for most use
                      cases.
                    </p>
                  </div>

                  <!-- Speed -->
                  <div class="space-y-2">
                    <div class="flex justify-between">
                      <Label class="text-xs">Speed</Label>
                      <span class="text-xs text-muted-foreground"
                        >{tts.speed.toFixed(2)}x</span
                      >
                    </div>
                    <input
                      type="range"
                      bind:value={tts.speed}
                      min="0.7"
                      max="1.2"
                      step="0.01"
                      class="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <p class="text-xs text-muted-foreground">
                      Adjust the speaking rate. 1.0x is normal speed.
                    </p>
                  </div>

                  <!-- Speaker Boost -->
                  <div class="flex items-center justify-between">
                    <div>
                      <Label class="text-xs">Speaker Boost</Label>
                      <p class="text-xs text-muted-foreground">
                        Enhances voice clarity
                      </p>
                    </div>
                    <Switch bind:checked={tts.useSpeakerBoost} />
                  </div>
                </div>
              </Popover.Content>
            </Popover.Root>

            <!-- Generate Button -->
            <InputGroup.Button
              variant="default"
              size="sm"
              onclick={() => tts.handleGenerate()}
              disabled={!tts.inputText.trim() ||
                tts.isGenerating ||
                data.isDemoMode}
              class="ml-auto {data.isDemoMode
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer'}"
              title={data.isDemoMode
                ? "Audio generation is disabled in demo mode"
                : ""}
            >
              {#if tts.isGenerating}
                <span class="hidden md:inline">Generating...</span>
                <ArrowUpIcon class="w-4 h-4 md:hidden animate-pulse" />
              {:else}
                <span class="hidden md:inline">Generate Speech</span>
                <ArrowUpIcon class="w-4 h-4 md:hidden" />
              {/if}
            </InputGroup.Button>
          </InputGroup.Addon>
        </InputGroup.Root>
      {:else if activeMode === "stt"}
        <!-- STT Input -->
        <InputGroup.Root
          class="min-h-36 max-w-3xl mx-auto bg-transparent dark:bg-transparent rounded-2xl shadow-md"
        >
          <!-- Upload/File Content Area -->
          <div class="flex-1 px-4 flex items-center min-h-24">
            {#if stt.uploadedFile}
              <!-- Uploaded File Display -->
              <div class="flex items-center justify-between h-full">
                <div class="flex items-center gap-3">
                  <div
                    class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center"
                  >
                    <AudioLinesIcon class="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p class="font-medium">{stt.uploadedFile.name}</p>
                    <p class="text-sm text-muted-foreground">
                      {(stt.uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onclick={() => stt.removeUploadedFile()}
                >
                  <XIcon class="w-4 h-4" />
                </Button>
              </div>
            {:else}
              <!-- Upload Area -->
              <button
                type="button"
                class="h-full w-full flex flex-col items-center justify-center text-center rounded-md transition-colors cursor-pointer {stt.dragOver
                  ? 'bg-primary/5'
                  : ''}"
                ondrop={(e) => stt.handleDrop(e)}
                ondragover={(e) => stt.handleDragOver(e)}
                ondragleave={() => stt.handleDragLeave()}
                onclick={() => stt.triggerFileUpload()}
              >
                <UploadIcon class="w-7 h-7 text-muted-foreground/50 mb-1" />
                <p class="text-sm text-muted-foreground">
                  Drag and drop an audio file here, or click to browse
                </p>
              </button>
            {/if}
          </div>

          <InputGroup.Addon align="block-end">
            <!-- Hidden file input -->
            <input
              bind:this={stt.fileInputElement}
              type="file"
              accept="audio/*"
              class="hidden"
              onchange={(e) => stt.handleFileUpload(e)}
            />

            <!-- Model Dropdown -->
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                {#snippet child({ props })}
                  <InputGroup.Button {...props} variant="ghost">
                    {stt.selectedModelName}
                  </InputGroup.Button>
                {/snippet}
              </DropdownMenu.Trigger>
              <DropdownMenu.Content
                side="top"
                align="start"
                class="[--radius:0.95rem]"
              >
                {#each stt.models as model}
                  <DropdownMenu.Item
                    onclick={() => (stt.selectedModel = model.id)}
                  >
                    {model.name}
                  </DropdownMenu.Item>
                {/each}
              </DropdownMenu.Content>
            </DropdownMenu.Root>

            <!-- STT Settings Popover -->
            <Popover.Root>
              <Popover.Trigger>
                {#snippet child({ props })}
                  <InputGroup.Button {...props} variant="ghost" size="icon-sm">
                    <SettingsIcon class="w-4 h-4" />
                  </InputGroup.Button>
                {/snippet}
              </Popover.Trigger>
              <Popover.Content side="top" align="start" class="w-72">
                <div class="space-y-4">
                  <h4 class="font-medium text-sm">Transcription Settings</h4>

                  <!-- Tag Audio Events -->
                  <div class="flex items-center justify-between">
                    <div>
                      <Label class="text-xs">Tag Audio Events</Label>
                      <p class="text-xs text-muted-foreground">
                        Tag events like laughter, etc...
                      </p>
                    </div>
                    <Switch bind:checked={stt.tagAudioEvents} />
                  </div>

                  <!-- Diarize -->
                  <div class="flex items-center justify-between">
                    <div>
                      <Label class="text-xs">Speaker Diarization</Label>
                      <p class="text-xs text-muted-foreground">
                        Annotate who is speaking
                      </p>
                    </div>
                    <Switch bind:checked={stt.diarize} />
                  </div>
                </div>
              </Popover.Content>
            </Popover.Root>

            <!-- Transcribe Button -->
            <InputGroup.Button
              variant="default"
              size="sm"
              onclick={() => stt.handleTranscribe()}
              disabled={!stt.uploadedFile ||
                stt.isTranscribing ||
                data.isDemoMode}
              class="ml-auto {data.isDemoMode
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer'}"
              title={data.isDemoMode
                ? "Audio transcription is disabled in demo mode"
                : ""}
            >
              {#if stt.isTranscribing}
                <span class="hidden md:inline">Transcribing...</span>
                <ArrowUpIcon class="w-4 h-4 md:hidden animate-pulse" />
              {:else}
                <span class="hidden md:inline">Transcribe</span>
                <ArrowUpIcon class="w-4 h-4 md:hidden" />
              {/if}
            </InputGroup.Button>
          </InputGroup.Addon>
        </InputGroup.Root>
      {:else if activeMode === "voice_changer"}
        <!-- Voice Changer Input -->
        <InputGroup.Root
          class="min-h-36 max-w-3xl mx-auto bg-transparent dark:bg-transparent rounded-2xl shadow-md"
        >
          <!-- Upload/File Content Area -->
          <div class="flex-1 px-4 flex items-center min-h-24">
            {#if vc.uploadedFile}
              <!-- Uploaded File Display -->
              <div class="flex items-center justify-between h-full">
                <div class="flex items-center gap-3">
                  <div
                    class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center"
                  >
                    <AudioLinesIcon class="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p class="font-medium">{vc.uploadedFile.name}</p>
                    <p class="text-sm text-muted-foreground">
                      {(vc.uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onclick={() => vc.removeUploadedFile()}
                >
                  <XIcon class="w-4 h-4" />
                </Button>
              </div>
            {:else}
              <!-- Upload Area -->
              <button
                type="button"
                class="h-full w-full flex flex-col items-center justify-center text-center rounded-md transition-colors cursor-pointer {vc.dragOver
                  ? 'bg-primary/5'
                  : ''}"
                ondrop={(e) => vc.handleDrop(e)}
                ondragover={(e) => vc.handleDragOver(e)}
                ondragleave={() => vc.handleDragLeave()}
                onclick={() => vc.triggerFileUpload()}
              >
                <UploadIcon class="w-7 h-7 text-muted-foreground/50 mb-1" />
                <p class="text-sm text-muted-foreground">
                  Drag and drop an audio file here, or click to browse
                </p>
              </button>
            {/if}
          </div>

          <InputGroup.Addon align="block-end">
            <!-- Hidden file input -->
            <input
              bind:this={vc.fileInputElement}
              type="file"
              accept="audio/*"
              class="hidden"
              onchange={(e) => vc.handleFileUpload(e)}
            />

            <!-- Model Dropdown -->
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                {#snippet child({ props })}
                  <InputGroup.Button {...props} variant="ghost">
                    {vc.selectedModelName}
                  </InputGroup.Button>
                {/snippet}
              </DropdownMenu.Trigger>
              <DropdownMenu.Content
                side="top"
                align="start"
                class="[--radius:0.95rem]"
              >
                {#each vc.models as model}
                  <DropdownMenu.Item
                    onclick={() => (vc.selectedModel = model.id)}
                  >
                    {model.name}
                  </DropdownMenu.Item>
                {/each}
              </DropdownMenu.Content>
            </DropdownMenu.Root>

            <!-- Voice Dropdown -->
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                {#snippet child({ props })}
                  <InputGroup.Button {...props} variant="ghost">
                    {vc.selectedVoiceName}
                  </InputGroup.Button>
                {/snippet}
              </DropdownMenu.Trigger>
              <DropdownMenu.Content
                side="top"
                align="start"
                class="[--radius:0.95rem] max-h-76 overflow-y-auto"
              >
                {#each vc.voices as voice}
                  <DropdownMenu.Item
                    onclick={() => (vc.selectedVoice = voice.id)}
                    class="flex items-center gap-2"
                  >
                    <button
                      type="button"
                      onclick={(e) => {
                        e.stopPropagation();
                        tts.playVoicePreview(voice.id);
                      }}
                      class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent cursor-pointer"
                      aria-label={tts.previewingVoiceId === voice.id
                        ? `Stop ${voice.name} preview`
                        : `Preview ${voice.name}`}
                    >
                      {#if tts.previewingVoiceId === voice.id}
                        <SquareIcon class="w-4 h-4 text-primary" />
                      {:else}
                        <PlayIcon class="w-4 h-4 text-primary" />
                      {/if}
                    </button>
                    <div class="flex flex-col">
                      <span>{voice.name}</span>
                      <span
                        class="text-xs text-muted-foreground truncate max-w-62"
                        title={voice.description}>{voice.description}</span
                      >
                    </div>
                  </DropdownMenu.Item>
                {/each}
              </DropdownMenu.Content>
            </DropdownMenu.Root>

            <!-- Voice Settings Popover -->
            <Popover.Root>
              <Popover.Trigger>
                {#snippet child({ props })}
                  <InputGroup.Button {...props} variant="ghost" size="icon-sm">
                    <SettingsIcon class="w-4 h-4" />
                  </InputGroup.Button>
                {/snippet}
              </Popover.Trigger>
              <Popover.Content side="top" align="start" class="w-72">
                <div class="space-y-4">
                  <h4 class="font-medium text-sm">Voice Settings</h4>

                  <!-- Stability -->
                  <div class="space-y-2">
                    <div class="flex justify-between">
                      <Label class="text-xs">Stability</Label>
                      <span class="text-xs text-muted-foreground"
                        >{Math.round(vc.stability * 100)}%</span
                      >
                    </div>
                    <input
                      type="range"
                      bind:value={vc.stability}
                      min="0"
                      max="1"
                      step="0.01"
                      class="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <p class="text-xs text-muted-foreground">
                      Higher values make the voice more consistent but less
                      expressive.
                    </p>
                  </div>

                  <!-- Similarity Boost -->
                  <div class="space-y-2">
                    <div class="flex justify-between">
                      <Label class="text-xs">Similarity Boost</Label>
                      <span class="text-xs text-muted-foreground"
                        >{Math.round(vc.similarityBoost * 100)}%</span
                      >
                    </div>
                    <input
                      type="range"
                      bind:value={vc.similarityBoost}
                      min="0"
                      max="1"
                      step="0.01"
                      class="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <p class="text-xs text-muted-foreground">
                      Higher values make the voice sound more like the target.
                    </p>
                  </div>

                  <!-- Style -->
                  <div class="space-y-2">
                    <div class="flex justify-between">
                      <Label class="text-xs">Style Exaggeration</Label>
                      <span class="text-xs text-muted-foreground"
                        >{Math.round(vc.style * 100)}%</span
                      >
                    </div>
                    <input
                      type="range"
                      bind:value={vc.style}
                      min="0"
                      max="1"
                      step="0.01"
                      class="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <p class="text-xs text-muted-foreground">
                      Increases character intensity. Keep at 0 for most use
                      cases.
                    </p>
                  </div>

                  <!-- Speed -->
                  <div class="space-y-2">
                    <div class="flex justify-between">
                      <Label class="text-xs">Speed</Label>
                      <span class="text-xs text-muted-foreground"
                        >{vc.speed.toFixed(2)}x</span
                      >
                    </div>
                    <input
                      type="range"
                      bind:value={vc.speed}
                      min="0.7"
                      max="1.2"
                      step="0.01"
                      class="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <p class="text-xs text-muted-foreground">
                      Adjust the speaking rate. 1.0x is normal speed.
                    </p>
                  </div>

                  <!-- Speaker Boost -->
                  <div class="flex items-center justify-between">
                    <div>
                      <Label class="text-xs">Speaker Boost</Label>
                      <p class="text-xs text-muted-foreground">
                        Enhances voice clarity
                      </p>
                    </div>
                    <Switch bind:checked={vc.useSpeakerBoost} />
                  </div>

                  <!-- Separator -->
                  <div class="border-t pt-4">
                    <h4 class="font-medium text-sm mb-3">Audio Settings</h4>

                    <!-- Remove Background Noise -->
                    <div class="flex items-center justify-between">
                      <div>
                        <Label class="text-xs">Remove Background Noise</Label>
                        <p class="text-xs text-muted-foreground">
                          Clean up audio before processing
                        </p>
                      </div>
                      <Switch bind:checked={vc.removeBackgroundNoise} />
                    </div>
                  </div>
                </div>
              </Popover.Content>
            </Popover.Root>

            <!-- Transform Button -->
            <InputGroup.Button
              variant="default"
              size="sm"
              onclick={() => vc.handleVoiceChange()}
              disabled={!vc.uploadedFile ||
                vc.isVoiceChanging ||
                data.isDemoMode}
              class="ml-auto {data.isDemoMode
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer'}"
              title={data.isDemoMode
                ? "Voice transformation is disabled in demo mode"
                : ""}
            >
              {#if vc.isVoiceChanging}
                <span class="hidden md:inline">Transforming...</span>
                <ArrowUpIcon class="w-4 h-4 md:hidden animate-pulse" />
              {:else}
                <span class="hidden md:inline">Transform Voice</span>
                <ArrowUpIcon class="w-4 h-4 md:hidden" />
              {/if}
            </InputGroup.Button>
          </InputGroup.Addon>
        </InputGroup.Root>
      {:else if activeMode === "music"}
        <!-- Music Input -->
        <InputGroup.Root
          class="min-h-36 max-w-3xl mx-auto bg-transparent dark:bg-transparent rounded-2xl shadow-md has-[[data-slot=input-group-control]:focus-visible]:!ring-0 has-[[data-slot=input-group-control]:focus-visible]:!border-input"
        >
          <InputGroup.Textarea
            bind:value={music.inputPrompt}
            placeholder={data.isDemoMode
              ? "Music generation is disabled in demo mode"
              : "Describe the music you want to generate... (e.g., 'An upbeat electronic dance track with energetic synths and a driving beat')"}
            disabled={data.isDemoMode}
            class="min-h-24 max-h-24 overflow-y-auto bg-transparent p-5"
            maxlength={4100}
          />
          <InputGroup.Addon align="block-end">
            <!-- Character Count -->
            <span
              class="text-xs text-muted-foreground px-2 {music.isPromptTooLong
                ? 'text-destructive'
                : ''}"
            >
              {music.promptCharacterCount}/4100
            </span>

            <!-- Model Dropdown -->
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                {#snippet child({ props })}
                  <InputGroup.Button {...props} variant="ghost">
                    {music.selectedModelName}
                  </InputGroup.Button>
                {/snippet}
              </DropdownMenu.Trigger>
              <DropdownMenu.Content
                side="top"
                align="start"
                class="[--radius:0.95rem]"
              >
                {#each music.models as model}
                  <DropdownMenu.Item
                    onclick={() => (music.selectedModel = model.id)}
                  >
                    {model.name}
                  </DropdownMenu.Item>
                {/each}
              </DropdownMenu.Content>
            </DropdownMenu.Root>

            <!-- Music Settings Popover -->
            <Popover.Root>
              <Popover.Trigger>
                {#snippet child({ props })}
                  <InputGroup.Button {...props} variant="ghost" size="icon-sm">
                    <SettingsIcon class="w-4 h-4" />
                  </InputGroup.Button>
                {/snippet}
              </Popover.Trigger>
              <Popover.Content side="top" align="start" class="w-72">
                <div class="space-y-4">
                  <h4 class="font-medium text-sm">Music Settings</h4>

                  <!-- Duration -->
                  <div class="space-y-2">
                    <div class="flex justify-between">
                      <Label class="text-xs">Duration</Label>
                      <span class="text-xs text-muted-foreground"
                        >{music.durationDisplay}</span
                      >
                    </div>
                    <input
                      type="range"
                      value={music.durationSeconds ?? 3}
                      oninput={(e) => {
                        const val = parseInt(e.currentTarget.value);
                        music.durationSeconds = val;
                      }}
                      min="3"
                      max="300"
                      step="1"
                      class="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div class="h-2 flex justify-end items-center">
                      {#if music.durationSeconds !== null}
                        <button
                          type="button"
                          onclick={() => (music.durationSeconds = null)}
                          class="text-xs text-primary hover:underline"
                        >
                          Reset to Auto
                        </button>
                      {/if}
                    </div>
                  </div>

                  <!-- Instrumental Only -->
                  <div class="flex items-center justify-between">
                    <div>
                      <Label class="text-xs">{m["audio.force_instrumental"]()}</Label>
                      <p class="text-xs text-muted-foreground">
                        Generate music without vocals
                      </p>
                    </div>
                    <Switch bind:checked={music.forceInstrumental} />
                  </div>
                </div>
              </Popover.Content>
            </Popover.Root>

            <!-- Generate Button -->
            <InputGroup.Button
              variant="default"
              size="sm"
              onclick={() => music.handleGenerate()}
              disabled={!music.inputPrompt.trim() ||
                music.isGenerating ||
                music.isPromptTooLong ||
                data.isDemoMode}
              class="ml-auto {data.isDemoMode
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer'}"
              title={data.isDemoMode
                ? "Music generation is disabled in demo mode"
                : ""}
            >
              {#if music.isGenerating}
                <span class="hidden md:inline">Generating...</span>
                <ArrowUpIcon class="w-4 h-4 md:hidden animate-pulse" />
              {:else}
                <span class="hidden md:inline">Generate Music</span>
                <ArrowUpIcon class="w-4 h-4 md:hidden" />
              {/if}
            </InputGroup.Button>
          </InputGroup.Addon>
        </InputGroup.Root>
      {:else}
        <!-- Sound Effects Input -->
        <InputGroup.Root
          class="min-h-36 max-w-3xl mx-auto bg-transparent dark:bg-transparent rounded-2xl shadow-md has-[[data-slot=input-group-control]:focus-visible]:!ring-0 has-[[data-slot=input-group-control]:focus-visible]:!border-input"
        >
          <InputGroup.Textarea
            bind:value={sfx.inputDescription}
            placeholder={data.isDemoMode
              ? "Sound effect generation is disabled in demo mode"
              : "Describe the sound effect you want to generate... (e.g., 'Thunder rolling in the distance', 'Footsteps on gravel', 'Door creaking open')"}
            disabled={data.isDemoMode}
            class="min-h-24 max-h-24 overflow-y-auto bg-transparent p-5"
            maxlength={4100}
          />
          <InputGroup.Addon align="block-end">
            <!-- Character Count -->
            <span
              class="text-xs text-muted-foreground px-2 {sfx.isDescriptionTooLong
                ? 'text-destructive'
                : ''}"
            >
              {sfx.descriptionCharacterCount}/4100
            </span>

            <!-- Model Dropdown -->
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                {#snippet child({ props })}
                  <InputGroup.Button {...props} variant="ghost">
                    {sfx.selectedModelName}
                  </InputGroup.Button>
                {/snippet}
              </DropdownMenu.Trigger>
              <DropdownMenu.Content
                side="top"
                align="start"
                class="[--radius:0.95rem]"
              >
                {#each sfx.models as model}
                  <DropdownMenu.Item
                    onclick={() => (sfx.selectedModel = model.id)}
                  >
                    {model.name}
                  </DropdownMenu.Item>
                {/each}
              </DropdownMenu.Content>
            </DropdownMenu.Root>

            <!-- Sound Effects Settings Popover -->
            <Popover.Root>
              <Popover.Trigger>
                {#snippet child({ props })}
                  <InputGroup.Button {...props} variant="ghost" size="icon-sm">
                    <SettingsIcon class="w-4 h-4" />
                  </InputGroup.Button>
                {/snippet}
              </Popover.Trigger>
              <Popover.Content side="top" align="start" class="w-72">
                <div class="space-y-4">
                  <h4 class="font-medium text-sm">Sound Effect Settings</h4>

                  <!-- Duration -->
                  <div class="space-y-2">
                    <div class="flex justify-between">
                      <Label class="text-xs">Duration</Label>
                      <span class="text-xs text-muted-foreground"
                        >{sfx.durationDisplay}</span
                      >
                    </div>
                    <input
                      type="range"
                      value={sfx.durationSeconds ?? 0.5}
                      oninput={(e) => {
                        const val = parseFloat(e.currentTarget.value);
                        sfx.durationSeconds = val;
                      }}
                      min="0.5"
                      max="22"
                      step="0.5"
                      class="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div class="h-2 flex justify-end items-center">
                      {#if sfx.durationSeconds !== null}
                        <button
                          type="button"
                          onclick={() => (sfx.durationSeconds = null)}
                          class="text-xs text-primary hover:underline"
                        >
                          Reset to Auto
                        </button>
                      {/if}
                    </div>
                  </div>

                  <!-- Prompt Influence -->
                  <div class="space-y-2">
                    <div class="flex justify-between">
                      <Label class="text-xs">Prompt Influence</Label>
                      <span class="text-xs text-muted-foreground"
                        >{sfx.promptInfluenceDisplay}</span
                      >
                    </div>
                    <input
                      type="range"
                      bind:value={sfx.promptInfluence}
                      min="0"
                      max="1"
                      step="0.01"
                      class="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <p class="text-xs text-muted-foreground">
                      Creative (0) = more variation, Literal (1) = closer to
                      description.
                    </p>
                  </div>
                </div>
              </Popover.Content>
            </Popover.Root>

            <!-- Generate Button -->
            <InputGroup.Button
              variant="default"
              size="sm"
              onclick={() => sfx.handleGenerate()}
              disabled={!sfx.inputDescription.trim() ||
                sfx.isGenerating ||
                sfx.isDescriptionTooLong ||
                data.isDemoMode}
              class="ml-auto {data.isDemoMode
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer'}"
              title={data.isDemoMode
                ? "Sound effect generation is disabled in demo mode"
                : ""}
            >
              {#if sfx.isGenerating}
                <span class="hidden md:inline">Generating...</span>
                <ArrowUpIcon class="w-4 h-4 md:hidden animate-pulse" />
              {:else}
                <span class="hidden md:inline">Generate SFX</span>
                <ArrowUpIcon class="w-4 h-4 md:hidden" />
              {/if}
            </InputGroup.Button>
          </InputGroup.Addon>
        </InputGroup.Root>
      {/if}
    </div>
  </div>

  <!-- Full Text Dialog -->
  <AlertDialog.Root
    bind:open={tts.showTextDialog}
    onOpenChange={(open) => {
      if (!open) {
        tts.cleanupDialogAudio();
      }
    }}
  >
    <AlertDialog.Content class="max-w-2xl max-h-[80vh] flex flex-col">
      <AlertDialog.Header>
        <AlertDialog.Title>TTS Speech</AlertDialog.Title>
        <AlertDialog.Description>
          Model: {tts.getModelName(tts.selectedAudioModel)} • Voice: {tts.getVoiceName(
            tts.selectedAudioVoice
          )}
        </AlertDialog.Description>
      </AlertDialog.Header>

      <!-- Audio Player Controls -->
      <div class="my-4 border-b pb-4 space-y-3">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <!-- Play/Pause Button -->
            <Button
              variant="outline"
              size="icon-sm"
              onclick={() => tts.toggleDialogAudio()}
              title={tts.isDialogAudioPlaying ? "Pause" : "Play"}
            >
              {#if tts.isDialogAudioPlaying}
                <PauseIcon class="w-4 h-4" />
              {:else}
                <PlayIcon class="w-4 h-4" />
              {/if}
            </Button>

            <!-- Time Display -->
            <span class="text-xs text-muted-foreground font-mono">
              {formatTime(tts.dialogAudioCurrentTime)} / {formatTime(
                tts.dialogAudioDuration
              )}
            </span>
          </div>

          <!-- Download and Delete Buttons (Right-aligned) -->
          <div class="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onclick={() =>
                tts.downloadHistoryAudio(
                  tts.selectedAudioId,
                  tts.selectedAudioUrl,
                  tts.selectedAudioMimeType
                )}
              title={m["audio.download"]()}
            >
              <DownloadIcon class="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onclick={async () => {
                await tts.deleteAudio(tts.selectedAudioId);
                if (tts.showTextDialog) {
                  tts.showTextDialog = false;
                  tts.cleanupDialogAudio();
                }
              }}
              disabled={data.isDemoMode}
              title={data.isDemoMode
                ? "Deletion is disabled in demo mode"
                : "Delete"}
              class="text-destructive hover:text-destructive {data.isDemoMode
                ? 'opacity-50 cursor-not-allowed'
                : ''}"
            >
              <TrashIcon class="w-4 h-4" />
            </Button>
          </div>
        </div>

        <!-- Progress Bar -->
        <input
          type="range"
          min="0"
          max={tts.dialogAudioDuration || 0}
          value={tts.dialogAudioCurrentTime}
          oninput={(e) =>
            tts.seekDialogAudio(parseFloat(e.currentTarget.value))}
          class="w-full h-2 bg-gray-300 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-primary
                 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary
                 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
                 [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
        />
      </div>

      <!-- Text Title (outside scrollable area) -->
      <div class="px-6 pt-4 pb-2">
        <h4 class="font-medium text-sm">Text</h4>
      </div>

      <!-- Text Content (scrollable) -->
      <div class="flex-1 overflow-y-auto min-h-0 px-6 pb-4">
        <p class="text-sm whitespace-pre-wrap text-muted-foreground">
          {tts.selectedAudioText}
        </p>
      </div>

      <AlertDialog.Footer>
        <AlertDialog.Cancel onclick={() => tts.cleanupDialogAudio()}
          >Close</AlertDialog.Cancel
        >
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>

  <!-- STT Transcription Dialog -->
  <AlertDialog.Root
    bind:open={stt.showDialog}
    onOpenChange={(open) => {
      if (!open) {
        stt.cleanupDialogAudio();
      }
    }}
  >
    <AlertDialog.Content class="max-w-2xl max-h-[80vh] flex flex-col">
      <AlertDialog.Header>
        <AlertDialog.Title>STT Transcription</AlertDialog.Title>
        <AlertDialog.Description>
          Model: {stt.getModelName(stt.selectedDialogModel)}
        </AlertDialog.Description>
      </AlertDialog.Header>

      <!-- Audio Player Controls -->
      <div class="my-4 border-b pb-4 space-y-3">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <!-- Play/Pause Button -->
            <Button
              variant="outline"
              size="icon-sm"
              onclick={() => stt.toggleDialogAudio()}
              title={stt.isDialogAudioPlaying ? "Pause" : "Play"}
            >
              {#if stt.isDialogAudioPlaying}
                <PauseIcon class="w-4 h-4" />
              {:else}
                <PlayIcon class="w-4 h-4" />
              {/if}
            </Button>

            <!-- Time Display -->
            <span class="text-xs text-muted-foreground font-mono">
              {formatTime(stt.dialogAudioCurrentTime)} / {formatTime(
                stt.dialogAudioDuration
              )}
            </span>
          </div>

          <!-- Copy, Download, and Delete Buttons (Right-aligned) -->
          <div class="flex items-center gap-1">
            <!-- Copy Button -->
            <Button
              variant="ghost"
              size="icon-sm"
              onclick={() => stt.copyTranscriptionText()}
              title={stt.copiedTranscriptionText ? "Copied!" : "Copy"}
            >
              {#if stt.copiedTranscriptionText}
                <CheckCircleIcon class="w-4 h-4 text-green-600" />
              {:else}
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              {/if}
            </Button>

            <!-- Download Button -->
            <Button
              variant="ghost"
              size="icon-sm"
              onclick={() =>
                stt.downloadAudio(
                  stt.selectedId,
                  stt.selectedUrl,
                  stt.selectedMimeType
                )}
              title="Download"
            >
              <DownloadIcon class="w-4 h-4" />
            </Button>

            <!-- Delete Button -->
            <Button
              variant="ghost"
              size="icon-sm"
              onclick={async () => {
                await stt.deleteTranscription(stt.selectedId);
              }}
              disabled={data.isDemoMode}
              title={data.isDemoMode
                ? "Deletion is disabled in demo mode"
                : "Delete"}
              class="text-destructive hover:text-destructive {data.isDemoMode
                ? 'opacity-50 cursor-not-allowed'
                : ''}"
            >
              <TrashIcon class="w-4 h-4" />
            </Button>
          </div>
        </div>

        <!-- Progress Bar -->
        <input
          type="range"
          min="0"
          max={stt.dialogAudioDuration || 0}
          value={stt.dialogAudioCurrentTime}
          oninput={(e) =>
            stt.seekDialogAudio(parseFloat(e.currentTarget.value))}
          class="w-full h-2 bg-gray-300 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-primary
                 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary
                 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
                 [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
        />
      </div>

      <!-- Transcribed Text with Word Highlighting -->
      <div
        bind:this={stt.transcriptContainer}
        class="flex-1 overflow-y-auto min-h-0 max-h-64 rounded-lg border p-4 bg-background"
      >
        {#if stt.selectedWords.length > 0}
          <p class="text-sm leading-relaxed">
            {#each stt.selectedWords as word, index}
              <button
                type="button"
                id="dialog-stt-word-{index}"
                onclick={() => stt.seekToWord(index)}
                class="inline cursor-pointer hover:text-primary transition-colors rounded px-0.5 -mx-0.5 {stt.dialogCurrentWordIndex ===
                index
                  ? 'bg-primary/20'
                  : ''}">{word.text}</button
              >{" "}
            {/each}
          </p>
        {:else}
          <p class="text-sm whitespace-pre-wrap">{stt.selectedText}</p>
        {/if}
      </div>

      <AlertDialog.Footer>
        <AlertDialog.Cancel onclick={() => stt.cleanupDialogAudio()}
          >Close</AlertDialog.Cancel
        >
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>

  <!-- Voice Changer Dialog -->
  <AlertDialog.Root
    bind:open={vc.showDialog}
    onOpenChange={(open) => {
      if (!open) {
        vc.closeDialog();
      }
    }}
  >
    <AlertDialog.Content class="max-w-2xl max-h-[80vh] flex flex-col">
      <AlertDialog.Header>
        <AlertDialog.Title>Voice Change Comparison</AlertDialog.Title>
        <AlertDialog.Description>
          Model: {vc.getModelName(vc.selectedDialogModel)} • Target Voice: {vc.getVoiceName(
            vc.selectedDialogVoice
          )}
        </AlertDialog.Description>
      </AlertDialog.Header>

      <!-- Audio Players Side by Side -->
      <div class="my-4 space-y-4">
        <!-- Transformed Audio -->
        <div>
          <!-- Header -->
          <div class="mb-2">
            <h4 class="font-medium text-sm">Transformed Audio</h4>
            <p class="text-xs text-muted-foreground">
              Voice: {vc.getVoiceName(vc.selectedDialogVoice)}
            </p>
          </div>

          <!-- Controls (TTS-style) -->
          <div class="space-y-3">
            <div class="flex items-center justify-between gap-3">
              <!-- Left: Play button + Time -->
              <div class="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onclick={() => vc.toggleDialogTransformedAudio()}
                  title={vc.isDialogTransformedPlaying ? "Pause" : "Play"}
                >
                  {#if vc.isDialogTransformedPlaying}
                    <PauseIcon class="w-4 h-4" />
                  {:else}
                    <PlayIcon class="w-4 h-4" />
                  {/if}
                </Button>
                <span class="text-xs text-muted-foreground font-mono">
                  {formatTime(vc.dialogTransformedCurrentTime)} / {formatTime(
                    vc.dialogTransformedDuration
                  )}
                </span>
              </div>

              <!-- Right: Download button -->
              <div class="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onclick={() => {
                    const link = document.createElement("a");
                    link.href = vc.selectedTransformedUrl;
                    link.download = `transformed-${vc.selectedOriginalFilename}`;
                    link.target = "_blank";
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  title="Download Transformed"
                >
                  <DownloadIcon class="w-4 h-4" />
                </Button>
              </div>
            </div>

            <!-- Progress Bar -->
            <input
              type="range"
              min="0"
              max={vc.dialogTransformedDuration || 0}
              value={vc.dialogTransformedCurrentTime}
              oninput={(e) =>
                vc.seekDialogTransformedAudio(
                  parseFloat(e.currentTarget.value)
                )}
              class="w-full h-2 bg-gray-300 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-primary
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                     [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary
                     [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
                     [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
            />
          </div>
        </div>

        <!-- Horizontal Separator -->
        <hr class="my-4 border-border" />

        <!-- Original Audio -->
        <div>
          <!-- Header -->
          <div class="mb-2">
            <h4 class="font-medium text-sm">Original Audio</h4>
            <p class="text-xs text-muted-foreground truncate max-w-[300px]">
              {vc.selectedOriginalFilename}
            </p>
          </div>

          <!-- Controls (TTS-style) -->
          <div class="space-y-3">
            <div class="flex items-center justify-between gap-3">
              <!-- Left: Play button + Time -->
              <div class="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onclick={() => vc.toggleDialogOriginalAudio()}
                  title={vc.isDialogOriginalPlaying ? "Pause" : "Play"}
                >
                  {#if vc.isDialogOriginalPlaying}
                    <PauseIcon class="w-4 h-4" />
                  {:else}
                    <PlayIcon class="w-4 h-4" />
                  {/if}
                </Button>
                <span class="text-xs text-muted-foreground font-mono">
                  {formatTime(vc.dialogOriginalCurrentTime)} / {formatTime(
                    vc.dialogOriginalDuration
                  )}
                </span>
              </div>

              <!-- Right: Download button -->
              <div class="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onclick={() => {
                    const link = document.createElement("a");
                    link.href = vc.selectedOriginalUrl;
                    link.download = vc.selectedOriginalFilename;
                    link.target = "_blank";
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  title="Download Original"
                >
                  <DownloadIcon class="w-4 h-4" />
                </Button>
              </div>
            </div>

            <!-- Progress Bar -->
            <input
              type="range"
              min="0"
              max={vc.dialogOriginalDuration || 0}
              value={vc.dialogOriginalCurrentTime}
              oninput={(e) =>
                vc.seekDialogOriginalAudio(parseFloat(e.currentTarget.value))}
              class="w-full h-2 bg-gray-300 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-primary
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                     [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary
                     [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
                     [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
            />
          </div>
        </div>
      </div>

      <AlertDialog.Footer class="flex items-center justify-between">
        <Button
          variant="destructive"
          size="sm"
          onclick={async () => {
            await vc.deleteVoiceChange(vc.selectedId);
            vc.closeDialog();
          }}
          disabled={data.isDemoMode}
          title={data.isDemoMode ? "Deletion is disabled in demo mode" : ""}
          class={data.isDemoMode ? "opacity-50 cursor-not-allowed" : ""}
        >
          <TrashIcon class="w-4 h-4 mr-1" />
          Delete
        </Button>
        <AlertDialog.Cancel onclick={() => vc.closeDialog()}>
          Close
        </AlertDialog.Cancel>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>

  <!-- Music Details Dialog -->
  <AlertDialog.Root
    bind:open={music.showDetailsDialog}
    onOpenChange={(open) => {
      if (!open) {
        music.cleanupDialogAudio();
      }
    }}
  >
    <AlertDialog.Content class="max-w-2xl max-h-[80vh] flex flex-col">
      <AlertDialog.Header>
        <AlertDialog.Title>Music Details</AlertDialog.Title>
        <AlertDialog.Description>
          {m["audio.table_model"]()}: {music.getModelName(music.selectedMusicModel)} • {m["audio.table_text"]()}: {music.selectedMusicIsInstrumental
            ? m["audio.type_instrumental"]()
            : m["audio.type_vocal"]()}
        </AlertDialog.Description>
      </AlertDialog.Header>

      <!-- Audio Player Controls -->
      <div class="my-4 border-b pb-4 space-y-3">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <!-- Play/Pause Button -->
            <Button
              variant="outline"
              size="icon-sm"
              onclick={() => music.toggleDialogAudio()}
              title={music.isDialogAudioPlaying ? "Pause" : "Play"}
            >
              {#if music.isDialogAudioPlaying}
                <PauseIcon class="w-4 h-4" />
              {:else}
                <PlayIcon class="w-4 h-4" />
              {/if}
            </Button>

            <!-- Time Display -->
            <span class="text-xs text-muted-foreground font-mono">
              {formatTime(music.dialogAudioCurrentTime)} / {formatTime(
                music.dialogAudioDuration
              )}
            </span>
          </div>

          <!-- Download and Delete Buttons (Right-aligned) -->
          <div class="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onclick={() =>
                music.downloadHistoryMusic(
                  music.selectedMusicId,
                  music.selectedMusicUrl,
                  music.selectedMusicMimeType
                )}
              title="Download"
            >
              <DownloadIcon class="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onclick={async () => {
                await music.deleteMusic(music.selectedMusicId);
                if (music.showDetailsDialog) {
                  music.showDetailsDialog = false;
                  music.cleanupDialogAudio();
                }
              }}
              disabled={data.isDemoMode}
              title={data.isDemoMode
                ? "Deletion is disabled in demo mode"
                : "Delete"}
              class="text-destructive hover:text-destructive {data.isDemoMode
                ? 'opacity-50 cursor-not-allowed'
                : ''}"
            >
              <TrashIcon class="w-4 h-4" />
            </Button>
          </div>
        </div>

        <!-- Progress Bar -->
        <input
          type="range"
          min="0"
          max={music.dialogAudioDuration || 0}
          value={music.dialogAudioCurrentTime}
          oninput={(e) =>
            music.seekDialogAudio(parseFloat(e.currentTarget.value))}
          class="w-full h-2 bg-gray-300 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-primary
                 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary
                 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
                 [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
        />
      </div>

      <!-- Prompt Title (outside scrollable area) -->
      <div class="px-6 pt-4 pb-2">
        <h4 class="font-medium text-sm">Prompt</h4>
      </div>

      <!-- Prompt Content (scrollable) -->
      <div class="flex-1 overflow-y-auto min-h-0 px-6 pb-4">
        <p class="text-sm whitespace-pre-wrap text-muted-foreground">
          {music.selectedMusicPrompt}
        </p>
      </div>

      <AlertDialog.Footer>
        <AlertDialog.Cancel onclick={() => music.cleanupDialogAudio()}
          >Close</AlertDialog.Cancel
        >
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>

  <!-- Sound Effects Details Dialog -->
  <AlertDialog.Root
    bind:open={sfx.showDetailsDialog}
    onOpenChange={(open) => {
      if (!open) {
        sfx.cleanupDialogAudio();
      }
    }}
  >
    <AlertDialog.Content class="max-w-2xl max-h-[80vh] flex flex-col">
      <AlertDialog.Header>
        <AlertDialog.Title>Sound Effect Details</AlertDialog.Title>
        <AlertDialog.Description>
          Model: {sfx.getModelName(sfx.selectedSoundEffectModel)} • Influence: {sfx.getPromptInfluenceLabel(
            sfx.selectedSoundEffectPromptInfluence
          )}
        </AlertDialog.Description>
      </AlertDialog.Header>

      <!-- Audio Player Controls -->
      <div class="my-4 border-b pb-4 space-y-3">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <!-- Play/Pause Button -->
            <Button
              variant="outline"
              size="icon-sm"
              onclick={() => sfx.toggleDialogAudio()}
              title={sfx.isDialogAudioPlaying ? "Pause" : "Play"}
            >
              {#if sfx.isDialogAudioPlaying}
                <PauseIcon class="w-4 h-4" />
              {:else}
                <PlayIcon class="w-4 h-4" />
              {/if}
            </Button>

            <!-- Time Display -->
            <span class="text-xs text-muted-foreground font-mono">
              {formatTime(sfx.dialogAudioCurrentTime)} / {formatTime(
                sfx.dialogAudioDuration
              )}
            </span>
          </div>

          <!-- Download and Delete Buttons (Right-aligned) -->
          <div class="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onclick={() =>
                sfx.downloadHistorySoundEffect(
                  sfx.selectedSoundEffectId,
                  sfx.selectedSoundEffectUrl,
                  sfx.selectedSoundEffectMimeType
                )}
              title="Download"
            >
              <DownloadIcon class="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onclick={async () => {
                await sfx.deleteSoundEffect(sfx.selectedSoundEffectId);
                if (sfx.showDetailsDialog) {
                  sfx.showDetailsDialog = false;
                  sfx.cleanupDialogAudio();
                }
              }}
              disabled={data.isDemoMode}
              title={data.isDemoMode
                ? "Deletion is disabled in demo mode"
                : "Delete"}
              class="text-destructive hover:text-destructive {data.isDemoMode
                ? 'opacity-50 cursor-not-allowed'
                : ''}"
            >
              <TrashIcon class="w-4 h-4" />
            </Button>
          </div>
        </div>

        <!-- Progress Bar -->
        <input
          type="range"
          min="0"
          max={sfx.dialogAudioDuration || 0}
          value={sfx.dialogAudioCurrentTime}
          oninput={(e) =>
            sfx.seekDialogAudio(parseFloat(e.currentTarget.value))}
          class="w-full h-2 bg-gray-300 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-primary
                 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary
                 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
                 [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
        />
      </div>

      <!-- Description Title (outside scrollable area) -->
      <div class="px-6 pt-4 pb-2">
        <h4 class="font-medium text-sm">Description</h4>
      </div>

      <!-- Description Content (scrollable) -->
      <div class="flex-1 overflow-y-auto min-h-0 px-6 pb-4">
        <p class="text-sm whitespace-pre-wrap text-muted-foreground">
          {sfx.selectedSoundEffectText}
        </p>
      </div>

      <AlertDialog.Footer>
        <AlertDialog.Cancel onclick={() => sfx.cleanupDialogAudio()}
          >Close</AlertDialog.Cancel
        >
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
</main>
