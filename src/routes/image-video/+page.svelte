<script lang="ts">
  // UI Components
  import Button from "$lib/components/ui/button/button.svelte";
  import * as InputGroup from "$lib/components/ui/input-group/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import * as Tooltip from "$lib/components/ui/tooltip/index.js";
  import Input from "$lib/components/ui/input/input.svelte";
  import MediaViewer from "$lib/components/MediaViewer.svelte";
  import GenerationProgressDialog from "$lib/components/GenerationProgressDialog.svelte";
  import { MediaModelSelector } from "$lib/components/media-model-selector/index.js";
  import { toast } from "svelte-sonner";

  // Icons
  import {
    ImageIcon,
    VideoIcon,
    ArrowUpIcon,
    DownloadIcon,
    TrashIcon,
    XIcon,
    PlayIcon,
    PauseIcon,
    Layers2Icon,
    Clock4Icon,
    DiamondIcon,
    PaintbrushIcon,
    MaximizeIcon,
    RefreshCwIcon,
    ImagePlusIcon,
    MoreVerticalIcon,
    LoaderIcon,
    Volume2Icon,
    VolumeXIcon,
    PaperclipIcon,
    ArrowRightLeftIcon,
  } from "$lib/icons/index.js";

  // Import state classes
  import { ImageState } from "./image-state.svelte.ts";
  import { VideoState } from "./video-state.svelte.ts";
  import { untrack } from "svelte";
  import { page } from "$app/state";

  // Get page data (includes session and isDemoMode)
  let { data } = $props();

  // Get session from server data (standalone page, no context)
  const session = $derived(data.session);
  const isAuthenticated = $derived(!!session?.user?.id);

  // State classes
  const imageState = new ImageState();
  const videoState = new VideoState();

  // Active tab
  let activeTab = $state<"image" | "video">("image");

  // Track if URL params have been processed (prevents re-processing)
  let urlParamsProcessed = false;

  // Infinite scroll sentinel refs
  let imageSentinel: HTMLDivElement | null = $state(null);
  let videoSentinel: HTMLDivElement | null = $state(null);

  // Prompt textarea refs for auto-focus after model selection
  let imagePromptTextarea: HTMLTextAreaElement | null = $state(null);
  let videoPromptTextarea: HTMLTextAreaElement | null = $state(null);

  // Track loaded images/videos for skeleton loading effect
  // Using version-based reactivity to avoid expensive Set recreation on each load
  const loadedImageSet = new Set<string>();
  const loadedVideoSet = new Set<string>();
  let loadedImagesVersion = $state(0);
  let loadedVideosVersion = $state(0);

  function markImageLoaded(id: string) {
    if (!loadedImageSet.has(id)) {
      loadedImageSet.add(id);
      loadedImagesVersion++; // Trigger reactivity without recreating Set
    }
  }

  function markVideoLoaded(id: string) {
    if (!loadedVideoSet.has(id)) {
      loadedVideoSet.add(id);
      loadedVideosVersion++; // Trigger reactivity without recreating Set
    }
  }

  function isImageLoaded(id: string): boolean {
    // Reference version to create dependency for Svelte's reactivity
    void loadedImagesVersion;
    return loadedImageSet.has(id);
  }

  function isVideoLoaded(id: string): boolean {
    // Reference version to create dependency for Svelte's reactivity
    void loadedVideosVersion;
    return loadedVideoSet.has(id);
  }

  // Setup Intersection Observer for infinite scroll - images
  $effect(() => {
    const sentinel = imageSentinel;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Check state inside callback (not tracked by Svelte's effect system)
        if (
          entries[0].isIntersecting &&
          imageState.hasMore &&
          !imageState.isLoadingHistory
        ) {
          imageState.loadMore();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  });

  // Setup Intersection Observer for infinite scroll - videos
  $effect(() => {
    const sentinel = videoSentinel;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Check state inside callback (not tracked by Svelte's effect system)
        if (
          entries[0].isIntersecting &&
          videoState.hasMore &&
          !videoState.isLoadingHistory
        ) {
          videoState.loadMore();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  });

  // Tab button refs for sliding animation
  let tabRefs: Record<string, HTMLButtonElement | null> = $state({
    image: null,
    video: null,
  });
  let tabContainer: HTMLDivElement | null = $state(null);

  // Tab indicator position for sliding animation
  const tabIndicatorStyle = $derived.by(() => {
    const activeButton = tabRefs[activeTab];
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

  // Handle tab change
  function handleTabChange(tab: "image" | "video") {
    activeTab = tab;
  }

  // Helper functions
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // Get aspect ratio icon dimensions (returns width, height for a 16px base)
  function getAspectRatioIconDimensions(ratio: string): {
    width: number;
    height: number;
  } {
    // Parse ratio like "16:9", "1:1", "9:16", etc.
    const parts = ratio.split(":").map(Number);
    if (parts.length !== 2 || parts[0] <= 0 || parts[1] <= 0) {
      return { width: 14, height: 14 }; // fallback square
    }

    const [w, h] = parts;
    const maxSize = 14;
    const minSize = 8;

    // Calculate proportional dimensions
    if (w >= h) {
      // Landscape or square
      const height = Math.max(minSize, Math.round((h / w) * maxSize));
      return { width: maxSize, height };
    } else {
      // Portrait
      const width = Math.max(minSize, Math.round((w / h) * maxSize));
      return { width, height: maxSize };
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }

  function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins === 1) return "about 1 minute ago";
    if (diffMins < 60) return `about ${diffMins} minutes ago`;
    if (diffHours === 1) return "about 1 hour ago";
    if (diffHours < 24) return `about ${diffHours} hours ago`;
    if (diffDays === 1) return "about 1 day ago";
    if (diffDays < 7) return `about ${diffDays} days ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }

  function formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  /**
   * Calculate row span based on aspect ratio string.
   * Portrait ratios (height > width) span 2 rows.
   */
  function getRowSpan(aspectRatio: string | null): number {
    if (!aspectRatio) return 1;
    const parts = aspectRatio.split(":").map(Number);
    if (parts.length !== 2 || parts[0] <= 0 || parts[1] <= 0) return 1;
    const [width, height] = parts;
    return height > width ? 2 : 1;
  }

  // Load models and history on mount/tab change
  $effect(() => {
    // Track only these dependencies
    const tab = activeTab;
    const auth = isAuthenticated;

    // Use untrack to prevent async state updates from re-triggering this effect
    untrack(() => {
      if (tab === "image") {
        imageState.loadModels();
        if (auth) {
          imageState.loadHistory();
        }
      } else {
        videoState.loadModels();
        if (auth) {
          videoState.loadHistory();
        }
      }
    });
  });

  // Handle URL parameters for prompt pre-fill (from chat "Generate image/video" actions)
  $effect(() => {
    // Only process URL params once to avoid reactive dependency issues
    if (urlParamsProcessed) return;

    const prompt = page.url.searchParams.get("prompt");
    const tab = page.url.searchParams.get("tab") as "image" | "video" | null;

    if (prompt) {
      urlParamsProcessed = true;
      const decodedPrompt = decodeURIComponent(prompt);

      // Use untrack to prevent creating reactive dependencies on state changes
      untrack(() => {
        // Set the tab if specified
        if (tab === "image" || tab === "video") {
          activeTab = tab;
        }

        // Set the prompt on the appropriate state
        if (tab === "video") {
          videoState.inputPrompt = decodedPrompt;
        } else {
          imageState.inputPrompt = decodedPrompt;
        }
      });

      // Clear URL params to keep URL clean (use replaceState to avoid history entry)
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("prompt");
      newUrl.searchParams.delete("tab");
      window.history.replaceState({}, "", newUrl.toString());
    }
  });

  // Determine if generation is disabled
  const isGenerationDisabled = $derived(!isAuthenticated || data.isDemoMode);
  const generationDisabledReason = $derived(
    !isAuthenticated
      ? "Sign in to generate"
      : data.isDemoMode
        ? "Generation disabled in demo mode"
        : "",
  );
</script>

<svelte:head>
  <title>Image & Video Generation</title>
  <meta
    name="description"
    content="Generate images and videos with AI models"
  />
</svelte:head>

<main class="h-full flex flex-col relative">
  <!-- Scrollable Content Area -->
  <div class="flex-1 overflow-auto p-6 pb-52" style="overflow-anchor: auto;">
    <div class="max-w-[1600px] mx-auto w-full">
      <!-- Header -->
      <div class="mb-4 text-center">
        <div class="flex items-center justify-center gap-3">
          {#if activeTab === "image"}
            <ImageIcon class="w-5 h-5 text-primary" />
          {:else}
            <VideoIcon class="w-5 h-5 text-primary" />
          {/if}
          <h1 class="text-2xl font-bold">Image & Video Generation</h1>
        </div>
      </div>

      <!-- Content Section -->
      {#if activeTab === "image"}
        <!-- Image History Section -->
        <div class="flex flex-col">
          {#if !isAuthenticated}
            <!-- Guest notice -->
            <div
              class="flex flex-col items-center justify-center py-12 text-center"
            >
              <ImageIcon class="w-12 h-12 text-muted-foreground/50 mb-3" />
              <p class="text-sm text-muted-foreground">
                Sign in to generate images and view your history
              </p>
            </div>
          {:else if imageState.errorMessage}
            <div class="text-center py-8">
              <p class="text-sm text-destructive mb-2">
                {imageState.errorMessage}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onclick={() => (imageState.errorMessage = null)}
              >
                Dismiss
              </Button>
            </div>
          {:else if imageState.isLoadingHistory && imageState.history.length === 0}
            <div class="flex flex-col items-center justify-center py-12">
              <div
                class="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"
              ></div>
              <p class="text-sm text-muted-foreground mt-3">
                Loading images...
              </p>
            </div>
          {:else if imageState.history.length === 0}
            <div
              class="flex flex-col items-center justify-center py-12 text-center"
            >
              <ImageIcon class="w-12 h-12 text-muted-foreground/50 mb-3" />
              <p class="text-sm text-muted-foreground">No images yet</p>
              <p class="text-xs text-muted-foreground mt-1">
                Generated images will appear here
              </p>
            </div>
          {:else}
            <!-- History header -->
            <div class="mb-3">
              <h3 class="text-md font-semibold">History</h3>
            </div>

            <!-- Image Grid -->
            <div
              class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1 auto-rows-[180px] sm:auto-rows-[200px] lg:auto-rows-[220px]"
            >
              {#each imageState.history as item (item.id)}
                {@const rowSpan = getRowSpan(item.aspectRatio)}
                {@const isLoaded = isImageLoaded(item.id)}
                {@const intrinsicHeight = rowSpan === 2 ? "440px" : "220px"}
                <div
                  class="group relative overflow-hidden bg-muted h-full rounded"
                  class:row-span-2={rowSpan === 2}
                  style="content-visibility: auto; contain-intrinsic-size: auto {intrinsicHeight};"
                >
                  <!-- Skeleton loader (single shimmer animation, no redundant animate-pulse) -->
                  {#if !isLoaded}
                    <div class="absolute inset-0 bg-muted">
                      <div
                        class="w-full h-full bg-gradient-to-r from-transparent via-foreground/5 to-transparent skeleton-shimmer"
                      ></div>
                    </div>
                  {/if}

                  <button
                    type="button"
                    class="w-full h-full cursor-pointer"
                    onclick={() => imageState.openLightbox(item)}
                  >
                    <img
                      src={item.url}
                      alt=""
                      class="w-full h-full object-cover transition-all duration-300 group-hover:scale-[1.02] {isLoaded
                        ? 'opacity-100'
                        : 'opacity-0'}"
                      loading="lazy"
                      onload={() => markImageLoaded(item.id)}
                    />
                    <!-- Top left timestamp -->
                    <div
                      class="absolute top-0 start-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      <span
                        class="px-1.5 py-0.5 rounded bg-black/40 text-xs text-white"
                        >{formatDate(item.createdAt)}</span
                      >
                    </div>
                    <!-- Bottom metadata -->
                    <div
                      class="absolute bottom-0 start-0 end-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      <div class="flex flex-wrap gap-1">
                        {#if item.model}
                          <span
                            class="px-1.5 py-0.5 rounded bg-black/40 text-xs text-white truncate max-w-full"
                          >
                            {imageState.getModelDisplayName(item.model)}
                          </span>
                        {/if}
                        {#if item.aspectRatio}
                          <span
                            class="px-1.5 py-0.5 rounded bg-black/40 text-xs text-white"
                          >
                            {item.aspectRatio}
                          </span>
                        {/if}
                        {#if item.quality}
                          <span
                            class="px-1.5 py-0.5 rounded bg-black/40 text-xs text-white capitalize"
                          >
                            {item.quality}
                          </span>
                        {/if}
                        {#if item.style}
                          <span
                            class="px-1.5 py-0.5 rounded bg-black/40 text-xs text-white capitalize"
                          >
                            {item.style}
                          </span>
                        {/if}
                        {#if item.seed !== null}
                          <span
                            class="px-1.5 py-0.5 rounded bg-black/40 text-xs text-white font-mono"
                          >
                            {item.seed}
                          </span>
                        {/if}
                        {#if item.upscaleFactor}
                          <span
                            class="px-1.5 py-0.5 rounded bg-black/40 text-xs text-white uppercase"
                          >
                            {item.upscaleFactor}
                          </span>
                        {/if}
                      </div>
                    </div>
                  </button>

                  <!-- Dropdown Menu -->
                  <div
                    class="absolute top-1.5 end-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
                  >
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger>
                        <button
                          type="button"
                          class="p-1.5 rounded-md bg-black/50 hover:bg-black/70 transition-colors"
                          onclick={(e) => e.stopPropagation()}
                        >
                          <MoreVerticalIcon class="w-4 h-4 text-white" />
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Content align="end" class="w-36">
                        <DropdownMenu.Item
                          onclick={() =>
                            imageState.downloadImage(item.url, item.filename)}
                        >
                          <DownloadIcon class="w-4 h-4 me-2" />
                          Download
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          onclick={() => imageState.deleteImage(item.id)}
                          disabled={data.isDemoMode}
                          class="text-destructive focus:text-destructive"
                        >
                          <TrashIcon class="w-4 h-4 me-2" />
                          Delete
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Root>
                  </div>
                </div>
              {/each}
            </div>

            <!-- Infinite scroll sentinel -->
            <div bind:this={imageSentinel} class="h-1"></div>

            <!-- Loading more indicator -->
            {#if imageState.isLoadingHistory && imageState.history.length > 0}
              <div class="flex items-center justify-center gap-2 py-4">
                <LoaderIcon
                  class="w-4 h-4 animate-spin text-muted-foreground"
                />
                <span class="text-sm text-muted-foreground"
                  >Loading more...</span
                >
              </div>
            {/if}

            <!-- End of list indicator -->
            {#if !imageState.hasMore && imageState.history.length > 0}
              <div class="text-center py-4">
                <p class="text-sm text-muted-foreground">No more images</p>
              </div>
            {/if}
          {/if}
        </div>
      {:else}
        <!-- Video History Section -->
        <div class="flex flex-col">
          {#if !isAuthenticated}
            <!-- Guest notice -->
            <div
              class="flex flex-col items-center justify-center py-12 text-center"
            >
              <VideoIcon class="w-12 h-12 text-muted-foreground/50 mb-3" />
              <p class="text-sm text-muted-foreground">
                Sign in to generate videos and view your history
              </p>
            </div>
          {:else if videoState.errorMessage}
            <div class="text-center py-8">
              <p class="text-sm text-destructive mb-2">
                {videoState.errorMessage}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onclick={() => (videoState.errorMessage = null)}
              >
                Dismiss
              </Button>
            </div>
          {:else if videoState.isLoadingHistory && videoState.history.length === 0}
            <div class="flex flex-col items-center justify-center py-12">
              <div
                class="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"
              ></div>
              <p class="text-sm text-muted-foreground mt-3">
                Loading videos...
              </p>
            </div>
          {:else if videoState.history.length === 0}
            <div
              class="flex flex-col items-center justify-center py-12 text-center"
            >
              <VideoIcon class="w-12 h-12 text-muted-foreground/50 mb-3" />
              <p class="text-sm text-muted-foreground">No videos yet</p>
              <p class="text-xs text-muted-foreground mt-1">
                Generated videos will appear here
              </p>
            </div>
          {:else}
            <!-- History header -->
            <div class="mb-3">
              <h3 class="text-md font-semibold">History</h3>
            </div>

            <!-- Video Grid -->
            <div
              class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1 auto-rows-[160px] sm:auto-rows-[180px] lg:auto-rows-[200px]"
            >
              {#each videoState.history as item (item.id)}
                {@const rowSpan = getRowSpan(item.aspectRatio)}
                {@const isLoaded = isVideoLoaded(item.id)}
                {@const intrinsicHeight = rowSpan === 2 ? "400px" : "200px"}
                <div
                  class="group relative overflow-hidden bg-muted h-full rounded"
                  class:row-span-2={rowSpan === 2}
                  style="content-visibility: auto; contain-intrinsic-size: auto {intrinsicHeight};"
                >
                  <!-- Skeleton loader (single shimmer animation, no redundant animate-pulse) -->
                  {#if !isLoaded}
                    <div class="absolute inset-0 bg-muted">
                      <div
                        class="w-full h-full bg-gradient-to-r from-transparent via-foreground/5 to-transparent skeleton-shimmer"
                      ></div>
                    </div>
                  {/if}

                  <button
                    type="button"
                    class="w-full h-full cursor-pointer"
                    onclick={() => videoState.openDialog(item)}
                  >
                    <video
                      src={item.url}
                      class="w-full h-full object-cover transition-all duration-300 group-hover:scale-[1.02] {isLoaded
                        ? 'opacity-100'
                        : 'opacity-0'}"
                      preload="metadata"
                      muted
                      onloadeddata={() => markVideoLoaded(item.id)}
                    ></video>
                    <div
                      class="absolute inset-0 flex items-center justify-center"
                    >
                      <div
                        class="w-12 h-12 rounded-full bg-white/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      >
                        <PlayIcon class="w-6 h-6 text-black ms-0.5" />
                      </div>
                    </div>
                    <!-- Top left timestamp -->
                    <div
                      class="absolute top-0 start-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      <span
                        class="px-1.5 py-0.5 rounded bg-black/40 text-xs text-white"
                        >{formatDate(item.createdAt)}</span
                      >
                    </div>
                    <!-- Bottom metadata -->
                    <div
                      class="absolute bottom-0 start-0 end-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      <div class="flex flex-wrap gap-1">
                        {#if item.model}
                          <span
                            class="px-1.5 py-0.5 rounded bg-black/40 text-xs text-white truncate max-w-full"
                          >
                            {videoState.getModelDisplayName(item.model)}
                          </span>
                        {/if}
                        {#if item.aspectRatio}
                          <span
                            class="px-1.5 py-0.5 rounded bg-black/40 text-xs text-white"
                          >
                            {item.aspectRatio}
                          </span>
                        {/if}
                        {#if item.quality}
                          <span
                            class="px-1.5 py-0.5 rounded bg-black/40 text-xs text-white capitalize"
                          >
                            {item.quality}
                          </span>
                        {/if}
                        {#if item.style}
                          <span
                            class="px-1.5 py-0.5 rounded bg-black/40 text-xs text-white capitalize"
                          >
                            {item.style}
                          </span>
                        {/if}
                        {#if item.seed !== null}
                          <span
                            class="px-1.5 py-0.5 rounded bg-black/40 text-xs text-white font-mono"
                          >
                            {item.seed}
                          </span>
                        {/if}
                      </div>
                    </div>
                  </button>

                  <!-- Dropdown Menu -->
                  <div
                    class="absolute top-1.5 end-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
                  >
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger>
                        <button
                          type="button"
                          class="p-1.5 rounded-md bg-black/50 hover:bg-black/70 transition-colors"
                          onclick={(e) => e.stopPropagation()}
                        >
                          <MoreVerticalIcon class="w-4 h-4 text-white" />
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Content align="end" class="w-36">
                        <DropdownMenu.Item
                          onclick={() =>
                            videoState.downloadVideo(item.url, item.filename)}
                        >
                          <DownloadIcon class="w-4 h-4 me-2" />
                          Download
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          onclick={() => videoState.deleteVideo(item.id)}
                          disabled={data.isDemoMode}
                          class="text-destructive focus:text-destructive"
                        >
                          <TrashIcon class="w-4 h-4 me-2" />
                          Delete
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Root>
                  </div>
                </div>
              {/each}
            </div>

            <!-- Infinite scroll sentinel -->
            <div bind:this={videoSentinel} class="h-1"></div>

            <!-- Loading more indicator -->
            {#if videoState.isLoadingHistory && videoState.history.length > 0}
              <div class="flex items-center justify-center gap-2 py-4">
                <LoaderIcon
                  class="w-4 h-4 animate-spin text-muted-foreground"
                />
                <span class="text-sm text-muted-foreground"
                  >Loading more...</span
                >
              </div>
            {/if}

            <!-- End of list indicator -->
            {#if !videoState.hasMore && videoState.history.length > 0}
              <div class="text-center py-4">
                <p class="text-sm text-muted-foreground">No more videos</p>
              </div>
            {/if}
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <!-- Sticky Input Section at bottom -->
  <div class="fixed bottom-0 inset-x-0 z-40 pointer-events-none">
    <div class="pt-8 pb-4 px-6">
      <!-- Tab Navigation -->
      <div class="max-w-3xl mx-auto w-full">
        <div
          bind:this={tabContainer}
          class="pointer-events-auto flex items-center rounded-t-2xl border bg-muted/80 backdrop-blur-xl p-0.5 relative w-full"
        >
          <!-- Animated background indicator -->
          <div
            class="absolute inset-y-0.5 bg-background shadow-sm border border-border transition-all duration-300 ease-in-out pointer-events-none {activeTab ===
            'image'
              ? 'rounded-tl-2xl rounded-tr-none'
              : 'rounded-tl-none rounded-tr-2xl'}"
            style={tabIndicatorStyle}
          ></div>

          <button
            bind:this={tabRefs.image}
            onclick={() => handleTabChange("image")}
            aria-label="Image generation"
            class="cursor-pointer flex-1 flex items-center justify-center gap-2 px-2 md:px-2.5 py-1.5 text-base font-medium rounded-md transition-colors relative z-10 whitespace-nowrap {activeTab ===
            'image'
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground'}"
          >
            <ImageIcon class="w-4 h-4" />
            <span>Image</span>
          </button>

          <!-- Vertical separator -->
          <div class="w-px h-5 bg-border/50 relative z-10 mx-2"></div>

          <button
            bind:this={tabRefs.video}
            onclick={() => handleTabChange("video")}
            aria-label="Video generation"
            class="cursor-pointer flex-1 flex items-center justify-center gap-2 px-2 md:px-2.5 py-1.5 text-base font-medium rounded-md transition-colors relative z-10 whitespace-nowrap {activeTab ===
            'video'
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground'}"
          >
            <VideoIcon class="w-4 h-4" />
            <span>Video</span>
          </button>
        </div>
      </div>

      <!-- Input Section -->
      <div class="space-y-2">
        {#if activeTab === "image"}
          <!-- Image Generation Input -->
          <InputGroup.Root
            class="pointer-events-auto min-h-36 max-w-3xl mx-auto bg-background/80 dark:bg-background/80 backdrop-blur-xl border border-border rounded-t-none rounded-b-2xl shadow-lg has-[[data-slot=input-group-control]:focus-visible]:!ring-0 has-[[data-slot=input-group-control]:focus-visible]:!border-input"
          >
            <!-- Top Addon - Reference Image(s) (conditional) -->
            {#if imageState.modelSupportsImageInput}
              <InputGroup.Addon align="block-start">
                <input
                  type="file"
                  accept="image/*"
                  multiple={imageState.modelSupportsMultipleImageInput}
                  class="hidden"
                  id="image-reference-input"
                  onchange={(e) => imageState.handleImageReferenceUpload(e)}
                />
                {#if imageState.imageReferencePreviews.length > 0}
                  <div class="flex items-center gap-1.5 flex-wrap">
                    {#each imageState.imageReferencePreviews as preview, index}
                      <div class="relative group">
                        <div
                          class="w-20 h-20 rounded-lg overflow-hidden border border-border"
                        >
                          <img
                            src={preview}
                            alt="Reference {index + 1}"
                            class="w-full h-full object-cover cursor-default"
                          />
                        </div>
                        <!-- Individual remove button -->
                        <button
                          type="button"
                          class="absolute -top-1.5 -end-1.5 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                          onclick={() => imageState.removeImageReference(index)}
                        >
                          <XIcon class="w-3 h-3" />
                        </button>
                      </div>
                    {/each}

                    <!-- Add more button (only for multi-image models) -->
                    {#if imageState.modelSupportsMultipleImageInput}
                      <button
                        type="button"
                        onclick={() =>
                          document
                            .getElementById("image-reference-input")
                            ?.click()}
                        disabled={isGenerationDisabled}
                        class="cursor-pointer w-20 h-20 flex items-center justify-center border border-dashed border-muted-foreground/30 rounded-lg hover:border-muted-foreground/50 hover:bg-muted/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span class="text-xs text-muted-foreground"
                          >+ Add Img</span
                        >
                      </button>
                    {/if}

                    <!-- Clear all button -->
                    <InputGroup.Button
                      variant="ghost"
                      size="icon-sm"
                      onclick={() => imageState.clearAllImageReferences()}
                      class="ms-1"
                    >
                      <XIcon class="w-4 h-4" />
                    </InputGroup.Button>
                  </div>
                {:else}
                  <button
                    type="button"
                    onclick={() =>
                      document.getElementById("image-reference-input")?.click()}
                    disabled={isGenerationDisabled}
                    class="cursor-pointer w-20 h-20 flex items-center justify-center border border-dashed border-muted-foreground/50 dark:border-muted-foreground/30 rounded-lg hover:border-muted-foreground/70 dark:hover:border-muted-foreground/50 hover:bg-muted/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span class="text-xs text-muted-foreground">+ Add Img</span>
                  </button>
                {/if}
              </InputGroup.Addon>
            {/if}

            {#if !imageState.isUpscalerModel}
              <InputGroup.Textarea
                bind:ref={imagePromptTextarea}
                bind:value={imageState.inputPrompt}
                placeholder={isGenerationDisabled
                  ? generationDisabledReason
                  : "Describe the image you want to generate..."}
                disabled={isGenerationDisabled}
                onkeydown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    const canGenerate =
                      imageState.inputPrompt.trim() &&
                      !imageState.isGenerating &&
                      !isGenerationDisabled;
                    if (canGenerate) {
                      imageState.handleGenerate();
                    }
                  }
                }}
                class="min-h-20 max-h-20 overflow-y-auto bg-transparent pt-5 px-5 pb-2"
              />
            {/if}
            <InputGroup.Addon align="block-end" class="mt-auto !pb-2.5">
              <!-- Model Selector -->
              <MediaModelSelector
                models={imageState.models}
                selectedModel={imageState.selectedModel}
                type="image"
                onSelectModel={(model) => {
                  imageState.selectedModel = model;
                  imageState.resetOptionalParameters();
                }}
                onModelSelected={() => imagePromptTextarea?.focus()}
                disabled={!isAuthenticated}
                readOnly={data.isDemoMode}
              />

              <!-- Aspect Ratio Dropdown (conditional) -->
              {#if imageState.modelSupportsAspectRatio}
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger>
                    {#snippet child({ props })}
                      <InputGroup.Button {...props} variant="ghost">
                        {@const dims = getAspectRatioIconDimensions(
                          imageState.selectedAspectRatio,
                        )}
                        <span
                          class="inline-block border border-current rounded-[1px]"
                          style="width: {dims.width}px; height: {dims.height}px;"
                        ></span>
                        {imageState.selectedAspectRatio}
                      </InputGroup.Button>
                    {/snippet}
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content
                    side="top"
                    align="start"
                    class="[--radius:0.95rem]"
                  >
                    <DropdownMenu.Label class="text-xs text-muted-foreground">
                      Aspect ratio
                    </DropdownMenu.Label>
                    {#each imageState.aspectRatioOptions as option}
                      {@const dims = getAspectRatioIconDimensions(option)}
                      <DropdownMenu.Item
                        onclick={() =>
                          (imageState.selectedAspectRatio = option)}
                        class={imageState.selectedAspectRatio === option
                          ? "bg-accent"
                          : ""}
                      >
                        <span
                          class="inline-block border border-current rounded-[1px] me-2"
                          style="width: {dims.width}px; height: {dims.height}px;"
                        ></span>
                        {option}
                      </DropdownMenu.Item>
                    {/each}
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              {/if}

              <!-- Quality Dropdown (conditional) -->
              {#if imageState.modelSupportsQuality}
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger>
                    {#snippet child({ props })}
                      <InputGroup.Button {...props} variant="ghost">
                        <DiamondIcon class="w-4 h-4" />
                        {imageState.selectedQuality || "Quality"}
                      </InputGroup.Button>
                    {/snippet}
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content
                    side="top"
                    align="start"
                    class="[--radius:0.95rem]"
                  >
                    <DropdownMenu.Label class="text-xs text-muted-foreground">
                      Quality
                    </DropdownMenu.Label>
                    {#each imageState.qualityOptions as option}
                      <DropdownMenu.Item
                        onclick={() => (imageState.selectedQuality = option)}
                        class={imageState.selectedQuality === option
                          ? "bg-accent"
                          : ""}
                      >
                        {option}
                      </DropdownMenu.Item>
                    {/each}
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              {/if}

              <!-- Style Dropdown (conditional) -->
              {#if imageState.modelSupportsStyle}
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger>
                    {#snippet child({ props })}
                      <InputGroup.Button {...props} variant="ghost">
                        <PaintbrushIcon class="w-4 h-4" />
                        {imageState.selectedStyle || "Style"}
                      </InputGroup.Button>
                    {/snippet}
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content
                    side="top"
                    align="start"
                    class="[--radius:0.95rem] max-h-48 overflow-y-auto"
                  >
                    <DropdownMenu.Label class="text-xs text-muted-foreground">
                      Style
                    </DropdownMenu.Label>
                    {#each imageState.styleOptions as option}
                      <DropdownMenu.Item
                        onclick={() => (imageState.selectedStyle = option)}
                        class={imageState.selectedStyle === option
                          ? "bg-accent"
                          : ""}
                      >
                        {option}
                      </DropdownMenu.Item>
                    {/each}
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              {/if}

              <!-- Number of Images Dropdown (conditional) -->
              {#if imageState.modelSupportsNumberOfImages && imageState.numberOfImagesOptions.length > 0}
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger>
                    {#snippet child({ props })}
                      <InputGroup.Button {...props} variant="ghost">
                        <Layers2Icon class="w-4 h-4" />
                        {imageState.numberOfImages}
                      </InputGroup.Button>
                    {/snippet}
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content
                    side="top"
                    align="start"
                    class="[--radius:0.95rem]"
                  >
                    <DropdownMenu.Label class="text-xs text-muted-foreground">
                      Generations
                    </DropdownMenu.Label>
                    {#each imageState.numberOfImagesOptions as option}
                      <DropdownMenu.Item
                        onclick={() => (imageState.numberOfImages = option)}
                        class={imageState.numberOfImages === option
                          ? "bg-accent"
                          : ""}
                      >
                        {option}
                        {option === 1 ? "image" : "images"}
                      </DropdownMenu.Item>
                    {/each}
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              {/if}

              <!-- Upscale Factor Dropdown (conditional) -->
              {#if imageState.modelSupportsUpscale}
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger>
                    {#snippet child({ props })}
                      <InputGroup.Button {...props} variant="ghost">
                        <MaximizeIcon class="w-4 h-4" />
                        {imageState.selectedUpscaleFactor || "Scale"}
                      </InputGroup.Button>
                    {/snippet}
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content
                    side="top"
                    align="start"
                    class="[--radius:0.95rem]"
                  >
                    <DropdownMenu.Label class="text-xs text-muted-foreground">
                      Upscale Factor
                    </DropdownMenu.Label>
                    {#each imageState.upscaleOptions as option}
                      <DropdownMenu.Item
                        onclick={() =>
                          (imageState.selectedUpscaleFactor = option)}
                        class={imageState.selectedUpscaleFactor === option
                          ? "bg-accent"
                          : ""}
                      >
                        {option}
                      </DropdownMenu.Item>
                    {/each}
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              {/if}

              <!-- Compression Quality Slider (conditional) -->
              {#if imageState.modelSupportsCompression}
                {@const range = imageState.compressionRange}
                {#if range}
                  <div class="flex items-center gap-2 px-2">
                    <span
                      class="text-xs text-muted-foreground whitespace-nowrap"
                      >Quality:</span
                    >
                    <input
                      type="range"
                      min={range.min}
                      max={range.max}
                      bind:value={imageState.compressionQuality}
                      disabled={isGenerationDisabled}
                      class="w-16 h-1 accent-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <span class="text-xs font-mono w-6"
                      >{imageState.compressionQuality}</span
                    >
                  </div>
                {/if}
              {/if}

              <!-- Seed Input (conditional) -->
              {#if imageState.modelSupportsSeed}
                <Input
                  type="text"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  maxlength={10}
                  placeholder="Seed"
                  value={imageState.seed}
                  onkeydown={(e) => {
                    const allowedKeys = [
                      "Backspace",
                      "Delete",
                      "Tab",
                      "Escape",
                      "Enter",
                      "ArrowLeft",
                      "ArrowRight",
                      "ArrowUp",
                      "ArrowDown",
                      "Home",
                      "End",
                    ];
                    if (
                      allowedKeys.includes(e.key) ||
                      (e.ctrlKey &&
                        ["a", "c", "v", "x"].includes(e.key.toLowerCase())) ||
                      (e.metaKey &&
                        ["a", "c", "v", "x"].includes(e.key.toLowerCase()))
                    ) {
                      return;
                    }
                    if (!/^[0-9]$/.test(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  oninput={(e) => {
                    const input = e.currentTarget as HTMLInputElement;
                    let value = input.value.replace(/\D/g, "");
                    // Limit to max 32-bit signed integer (2,147,483,647)
                    if (value && parseInt(value, 10) > 2147483647) {
                      value = "2147483647";
                    }
                    imageState.seed = value;
                  }}
                  disabled={isGenerationDisabled}
                  class="hidden sm:block w-24 h-8 text-xs"
                />
              {/if}

              <!-- Generate Button -->
              <div class="ms-auto">
                {#if isGenerationDisabled}
                  <Tooltip.Root>
                    <Tooltip.Trigger>
                      <InputGroup.Button
                        variant="default"
                        disabled={true}
                        class="w-9 h-9 rounded-full p-0 opacity-50 cursor-not-allowed"
                      >
                        <ArrowUpIcon size={20} />
                      </InputGroup.Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content side="top">
                      {generationDisabledReason}
                    </Tooltip.Content>
                  </Tooltip.Root>
                {:else}
                  <InputGroup.Button
                    variant="default"
                    onclick={() => imageState.handleGenerate()}
                    disabled={imageState.isUpscalerModel
                      ? (imageState.imageReferenceFiles.length === 0 &&
                          imageState.uploadedImageUrls.length === 0) ||
                        imageState.isGenerating
                      : !imageState.inputPrompt.trim() || imageState.isGenerating}
                    class="w-9 h-9 rounded-full p-0 cursor-pointer"
                  >
                    <ArrowUpIcon
                      size={20}
                      class={imageState.isGenerating ? "animate-pulse" : ""}
                    />
                  </InputGroup.Button>
                {/if}
              </div>
            </InputGroup.Addon>
          </InputGroup.Root>
        {:else}
          <!-- Video Generation Input -->
          <InputGroup.Root
            class="pointer-events-auto min-h-36 max-w-3xl mx-auto bg-background/80 dark:bg-background/80 backdrop-blur-xl border border-border rounded-t-none rounded-b-2xl shadow-lg has-[[data-slot=input-group-control]:focus-visible]:!ring-0 has-[[data-slot=input-group-control]:focus-visible]:!border-input"
          >
            <!-- Top Addon - Start/End Image (conditional) -->
            {#if videoState.modelSupportsImageInput || videoState.modelSupportsImageEnd}
              <InputGroup.Addon align="block-start">
                <!-- Start Image -->
                {#if videoState.modelSupportsImageInput}
                  <input
                    type="file"
                    accept="image/*"
                    class="hidden"
                    id="video-start-image-input"
                    onchange={(e) => videoState.handleStartImageUpload(e)}
                  />
                  {#if videoState.startImagePreview}
                    <div class="relative group">
                      <div
                        class="w-20 h-20 rounded-lg overflow-hidden border border-border"
                      >
                        <img
                          src={videoState.startImagePreview}
                          alt="Start frame"
                          class="w-full h-full object-cover cursor-default"
                        />
                      </div>
                      <button
                        type="button"
                        class="absolute -top-1.5 -end-1.5 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        onclick={() => videoState.clearStartImage()}
                      >
                        <XIcon class="w-3 h-3" />
                      </button>
                    </div>
                  {:else}
                    <button
                      type="button"
                      onclick={() =>
                        document
                          .getElementById("video-start-image-input")
                          ?.click()}
                      disabled={isGenerationDisabled}
                      class="cursor-pointer w-20 h-20 flex flex-col items-center justify-center border border-dashed border-muted-foreground/50 dark:border-muted-foreground/30 rounded-lg hover:border-muted-foreground/70 dark:hover:border-muted-foreground/50 hover:bg-muted/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span class="text-xs text-muted-foreground"
                        >+ Start Img</span
                      >
                    </button>
                  {/if}
                {/if}

                <!-- Swap Button (only when model supports both start and end images) -->
                {#if videoState.modelSupportsImageInput && videoState.modelSupportsImageEnd}
                  <button
                    type="button"
                    onclick={() => videoState.swapStartEndImages()}
                    disabled={isGenerationDisabled || (!videoState.startImagePreview && !videoState.endImagePreview)}
                    class="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed self-center"
                    title="Swap start and end images"
                  >
                    <ArrowRightLeftIcon class="w-4 h-4" />
                  </button>
                {/if}

                <!-- End Image -->
                {#if videoState.modelSupportsImageEnd}
                  <input
                    type="file"
                    accept="image/*"
                    class="hidden"
                    id="video-end-image-input"
                    onchange={(e) => videoState.handleEndImageUpload(e)}
                  />
                  {#if videoState.endImagePreview}
                    <div class="relative group">
                      <div
                        class="w-20 h-20 rounded-lg overflow-hidden border border-border"
                      >
                        <img
                          src={videoState.endImagePreview}
                          alt="End frame"
                          class="w-full h-full object-cover cursor-default"
                        />
                      </div>
                      <button
                        type="button"
                        class="absolute -top-1.5 -end-1.5 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        onclick={() => videoState.clearEndImage()}
                      >
                        <XIcon class="w-3 h-3" />
                      </button>
                    </div>
                  {:else}
                    <button
                      type="button"
                      onclick={() =>
                        document
                          .getElementById("video-end-image-input")
                          ?.click()}
                      disabled={isGenerationDisabled}
                      class="cursor-pointer w-20 h-20 flex flex-col items-center justify-center border border-dashed border-muted-foreground/50 dark:border-muted-foreground/30 rounded-lg hover:border-muted-foreground/70 dark:hover:border-muted-foreground/50 hover:bg-muted/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span class="text-xs text-muted-foreground"
                        >+ End Img</span
                      >
                    </button>
                  {/if}
                {/if}
              </InputGroup.Addon>
            {/if}

            <InputGroup.Textarea
              bind:ref={videoPromptTextarea}
              bind:value={videoState.inputPrompt}
              placeholder={isGenerationDisabled
                ? generationDisabledReason
                : "Describe the video you want to generate..."}
              disabled={isGenerationDisabled}
              onkeydown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  const canGenerate =
                    videoState.inputPrompt.trim() &&
                    !videoState.isGenerating &&
                    !isGenerationDisabled;
                  if (canGenerate) {
                    videoState.handleGenerate();
                  }
                }
              }}
              class="min-h-20 max-h-20 overflow-y-auto bg-transparent pt-5 px-5 pb-2"
            />
            <InputGroup.Addon align="block-end" class="mt-auto !pb-2.5">
              <!-- Model Selector -->
              <MediaModelSelector
                models={videoState.models}
                selectedModel={videoState.selectedModel}
                type="video"
                onSelectModel={(model) => {
                  videoState.selectedModel = model;
                  videoState.resetOptionalParameters();
                }}
                onModelSelected={() => videoPromptTextarea?.focus()}
                disabled={!isAuthenticated}
                readOnly={data.isDemoMode}
              />

              <!-- Aspect Ratio Dropdown (conditional) -->
              {#if videoState.modelSupportsAspectRatio}
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger>
                    {#snippet child({ props })}
                      <InputGroup.Button {...props} variant="ghost">
                        {@const dims = getAspectRatioIconDimensions(
                          videoState.selectedAspectRatio,
                        )}
                        <span
                          class="inline-block border border-current rounded-[1px]"
                          style="width: {dims.width}px; height: {dims.height}px;"
                        ></span>
                        {videoState.selectedAspectRatio}
                      </InputGroup.Button>
                    {/snippet}
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content
                    side="top"
                    align="start"
                    class="[--radius:0.95rem]"
                  >
                    <DropdownMenu.Label class="text-xs text-muted-foreground">
                      Aspect ratio
                    </DropdownMenu.Label>
                    {#each videoState.aspectRatioOptions as option}
                      {@const dims = getAspectRatioIconDimensions(option)}
                      <DropdownMenu.Item
                        onclick={() =>
                          (videoState.selectedAspectRatio = option)}
                        class={videoState.selectedAspectRatio === option
                          ? "bg-accent"
                          : ""}
                      >
                        <span
                          class="inline-block border border-current rounded-[1px] me-2"
                          style="width: {dims.width}px; height: {dims.height}px;"
                        ></span>
                        {option}
                      </DropdownMenu.Item>
                    {/each}
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              {/if}

              <!-- Duration Dropdown (conditional) -->
              {#if videoState.modelSupportsDuration}
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger>
                    {#snippet child({ props })}
                      <InputGroup.Button {...props} variant="ghost">
                        <Clock4Icon class="w-4 h-4" />
                        {videoState.duration}s
                      </InputGroup.Button>
                    {/snippet}
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content
                    side="top"
                    align="start"
                    class="[--radius:0.95rem]"
                  >
                    <DropdownMenu.Label class="text-xs text-muted-foreground">
                      Duration
                    </DropdownMenu.Label>
                    {#each videoState.durationOptions as option}
                      <DropdownMenu.Item
                        onclick={() => (videoState.duration = option.value)}
                        class={videoState.duration === option.value
                          ? "bg-accent"
                          : ""}
                      >
                        {option.label}
                      </DropdownMenu.Item>
                    {/each}
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              {/if}

              <!-- Quality Dropdown (conditional) -->
              {#if videoState.modelSupportsQuality}
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger>
                    {#snippet child({ props })}
                      <InputGroup.Button {...props} variant="ghost">
                        <DiamondIcon class="w-4 h-4" />
                        {videoState.selectedQuality || "Quality"}
                      </InputGroup.Button>
                    {/snippet}
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content
                    side="top"
                    align="start"
                    class="[--radius:0.95rem]"
                  >
                    <DropdownMenu.Label class="text-xs text-muted-foreground">
                      Quality
                    </DropdownMenu.Label>
                    {#each videoState.qualityOptions as option}
                      <DropdownMenu.Item
                        onclick={() => (videoState.selectedQuality = option)}
                        class={videoState.selectedQuality === option
                          ? "bg-accent"
                          : ""}
                      >
                        {option}
                      </DropdownMenu.Item>
                    {/each}
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              {/if}

              <!-- Style Dropdown (conditional) -->
              {#if videoState.modelSupportsStyle}
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger>
                    {#snippet child({ props })}
                      <InputGroup.Button {...props} variant="ghost">
                        <PaintbrushIcon class="w-4 h-4" />
                        {videoState.selectedStyle || "Style"}
                      </InputGroup.Button>
                    {/snippet}
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content
                    side="top"
                    align="start"
                    class="[--radius:0.95rem] max-h-48 overflow-y-auto"
                  >
                    <DropdownMenu.Label class="text-xs text-muted-foreground">
                      Style
                    </DropdownMenu.Label>
                    {#each videoState.styleOptions as option}
                      <DropdownMenu.Item
                        onclick={() => (videoState.selectedStyle = option)}
                        class={videoState.selectedStyle === option
                          ? "bg-accent"
                          : ""}
                      >
                        {option}
                      </DropdownMenu.Item>
                    {/each}
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              {/if}

              <!-- Seed Input (conditional) -->
              {#if videoState.modelSupportsSeed}
                <Input
                  type="text"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  maxlength={10}
                  placeholder="Seed"
                  value={videoState.seed}
                  onkeydown={(e) => {
                    const allowedKeys = [
                      "Backspace",
                      "Delete",
                      "Tab",
                      "Escape",
                      "Enter",
                      "ArrowLeft",
                      "ArrowRight",
                      "ArrowUp",
                      "ArrowDown",
                      "Home",
                      "End",
                    ];
                    if (
                      allowedKeys.includes(e.key) ||
                      (e.ctrlKey &&
                        ["a", "c", "v", "x"].includes(e.key.toLowerCase())) ||
                      (e.metaKey &&
                        ["a", "c", "v", "x"].includes(e.key.toLowerCase()))
                    ) {
                      return;
                    }
                    if (!/^[0-9]$/.test(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  oninput={(e) => {
                    const input = e.currentTarget as HTMLInputElement;
                    let value = input.value.replace(/\D/g, "");
                    // Limit to max 32-bit signed integer (2,147,483,647)
                    if (value && parseInt(value, 10) > 2147483647) {
                      value = "2147483647";
                    }
                    videoState.seed = value;
                  }}
                  disabled={isGenerationDisabled}
                  class="hidden sm:block w-24 h-8 text-xs"
                />
              {/if}

              <!-- Generate Button -->
              <div class="ms-auto">
                {#if isGenerationDisabled}
                  <Tooltip.Root>
                    <Tooltip.Trigger>
                      <InputGroup.Button
                        variant="default"
                        disabled={true}
                        class="w-9 h-9 rounded-full p-0 opacity-50 cursor-not-allowed"
                      >
                        <ArrowUpIcon size={20} />
                      </InputGroup.Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content side="top">
                      {generationDisabledReason}
                    </Tooltip.Content>
                  </Tooltip.Root>
                {:else}
                  <InputGroup.Button
                    variant="default"
                    onclick={() => videoState.handleGenerate()}
                    disabled={!videoState.inputPrompt.trim() ||
                      videoState.isGenerating}
                    class="w-9 h-9 rounded-full p-0 cursor-pointer"
                  >
                    <ArrowUpIcon
                      size={20}
                      class={videoState.isGenerating ? "animate-pulse" : ""}
                    />
                  </InputGroup.Button>
                {/if}
              </div>
            </InputGroup.Addon>
          </InputGroup.Root>
        {/if}
      </div>
    </div>
  </div>
</main>

<!-- Image Lightbox -->
<MediaViewer
  bind:open={imageState.lightboxOpen}
  onClose={() => imageState.closeLightbox()}
  showNavigation={imageState.history.length > 1}
  hasPrevious={imageState.history.findIndex(
    (item) => item.id === imageState.selectedImageId,
  ) > 0}
  hasNext={imageState.history.findIndex(
    (item) => item.id === imageState.selectedImageId,
  ) <
    imageState.history.length - 1}
  onPrevious={() => imageState.previousImage()}
  onNext={() => imageState.nextImage()}
  mediaSrc={imageState.selectedImageUrl}
>
  {#snippet metadata()}
    <div class="flex flex-col h-full min-h-[200px] gap-4">
      <!-- Date + Download -->
      <div class="flex items-center justify-between">
        <span class="text-sm text-muted-foreground">
          {formatRelativeTime(imageState.selectedImageCreatedAt)}
        </span>
        <button
          type="button"
          class="p-1.5 rounded-md hover:bg-muted transition-colors"
          onclick={() =>
            imageState.downloadImage(
              imageState.selectedImageUrl,
              imageState.selectedImageFilename,
            )}
        >
          <DownloadIcon class="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <!-- Prompt -->
      {#if imageState.selectedImagePrompt}
        <div>
          <p class="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Prompt
          </p>
          <p class="text-sm leading-relaxed">
            {imageState.selectedImagePrompt}
          </p>
        </div>
      {/if}

      <!-- Reference Images (for i2i) - small thumbnails -->
      {#if imageState.selectedImageReferenceUrls && imageState.selectedImageReferenceUrls.length > 0}
        <div class="flex flex-wrap gap-2">
          {#each imageState.selectedImageReferenceUrls as refUrl}
            <div class="relative">
              <img
                src={refUrl}
                alt="Reference"
                class="w-16 h-16 object-cover rounded-md border border-border"
              />
              <!-- User upload indicator -->
              <div class="absolute bottom-0 start-0 p-0.5">
                <PaperclipIcon class="w-4 h-4 text-white drop-shadow-lg" />
              </div>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Parameters as Pills -->
      {#if imageState.selectedImageModel || imageState.selectedImageAspectRatio || imageState.selectedImageSeed !== null || imageState.selectedImageQuality || imageState.selectedImageStyle || imageState.selectedImageNumberOfImages || imageState.selectedImageUpscaleFactor || imageState.selectedImageCompressionQuality !== null}
        <div class="flex flex-wrap gap-2">
          {#if imageState.selectedImageModel}
            <span
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
            >
              {imageState.getModelDisplayName(imageState.selectedImageModel)}
            </span>
          {/if}

          {#if imageState.selectedImageAspectRatio}
            <span
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
            >
              {imageState.selectedImageAspectRatio}
            </span>
          {/if}

          {#if imageState.selectedImageQuality}
            <span
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium capitalize"
            >
              {imageState.selectedImageQuality}
            </span>
          {/if}

          {#if imageState.selectedImageStyle}
            <span
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium capitalize"
            >
              {imageState.selectedImageStyle}
            </span>
          {/if}

          {#if imageState.selectedImageSeed !== null}
            <span
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-mono"
            >
              Seed: {imageState.selectedImageSeed}
            </span>
          {/if}

          {#if imageState.selectedImageNumberOfImages && imageState.selectedImageNumberOfImages > 1}
            <span
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
            >
              {imageState.selectedImageNumberOfImages} images
            </span>
          {/if}

          {#if imageState.selectedImageUpscaleFactor}
            <span
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium uppercase"
            >
              {imageState.selectedImageUpscaleFactor}
            </span>
          {/if}

          {#if imageState.selectedImageCompressionQuality !== null}
            <span
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
            >
              Quality: {imageState.selectedImageCompressionQuality}%
            </span>
          {/if}
        </div>
      {/if}

      <!-- Spacer to push bottom content down -->
      <div class="flex-1"></div>

      <!-- File Info (centered) -->
      <div class="text-center text-xs text-muted-foreground">
        {formatFileSize(imageState.selectedImageFileSize)}
      </div>

      <!-- Action Buttons (stacked) -->
      <div class="flex flex-col gap-2">
        <Button
          variant="outline"
          class="w-full justify-center"
          onclick={() => {
            if (!imageState.modelSupportsImageInput) {
              toast.warning(
                `${imageState.selectedModelName} doesn't support image references. Please switch to a model that supports image input.`
              );
              return;
            }

            const result = imageState.useAsReference();
            if (result.success) {
              toast.success(result.isMultiImage ? "Image added as reference" : "Image set as reference");
              setTimeout(() => imagePromptTextarea?.focus(), 100);
            }
          }}
        >
          <ImagePlusIcon class="w-4 h-4 me-2" />
          Use as Reference
        </Button>
        <Button
          variant="outline"
          class="w-full justify-center"
          onclick={() => {
            const result = imageState.upscaleImage();
            if (result.success) {
              toast.success("Image set for upscaling. Select upscale factor and generate.");
            }
          }}
        >
          <MaximizeIcon class="w-4 h-4 me-2" />
          Upscale Image
        </Button>
        <Button
          variant="outline"
          class="w-full justify-center"
          onclick={() => {
            const result = imageState.recreateImage();
            if (result.success) {
              toast.success("Generation parameters restored");
              setTimeout(() => imagePromptTextarea?.focus(), 100);
            } else {
              toast.warning(result.reason || "Could not recreate image");
            }
          }}
        >
          <RefreshCwIcon class="w-4 h-4 me-2" />
          Recreate
        </Button>
        <Button
          variant="outline"
          class="w-full justify-center bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-800 hover:border-zinc-800 dark:bg-white dark:text-zinc-900 dark:border-white dark:hover:bg-zinc-100 dark:hover:border-zinc-100"
          onclick={() => {
            // Set up video generation with this image as start frame (no prompt)
            videoState.setStartImageFromUrl(imageState.selectedImageUrl);

            // Close the lightbox
            imageState.closeLightbox();

            // Switch to video tab
            handleTabChange("video");

            // Show confirmation
            toast.success("Image set as start frame for video generation");

            // Focus video prompt textarea
            setTimeout(() => videoPromptTextarea?.focus(), 100);
          }}
        >
          <VideoIcon class="w-4 h-4 me-2" />
          Create Video
        </Button>
      </div>
    </div>
  {/snippet}

  <!-- Image (children slot) -->
  <img
    src={imageState.selectedImageUrl}
    alt={imageState.selectedImageFilename}
    class="max-w-full max-h-full object-contain"
  />
</MediaViewer>

<!-- Video Player -->
<MediaViewer
  bind:open={videoState.dialogOpen}
  onClose={() => videoState.closeDialog()}
>
  {#snippet metadata()}
    <div class="flex flex-col h-full min-h-[200px] gap-4">
      <!-- Date + Download -->
      <div class="flex items-center justify-between">
        <span class="text-sm text-muted-foreground">
          {formatRelativeTime(videoState.selectedVideoCreatedAt)}
        </span>
        <button
          type="button"
          class="p-1.5 rounded-md hover:bg-muted transition-colors"
          onclick={() =>
            videoState.downloadVideo(
              videoState.selectedVideoUrl,
              videoState.selectedVideoFilename,
            )}
        >
          <DownloadIcon class="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <!-- Prompt -->
      {#if videoState.selectedVideoPrompt}
        <div>
          <p class="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Prompt
          </p>
          <p class="text-sm leading-relaxed">
            {videoState.selectedVideoPrompt}
          </p>
        </div>
      {/if}

      <!-- Start/End Frame Images (for i2v) -->
      {#if videoState.selectedVideoImageStartUrl || videoState.selectedVideoImageEndUrl}
        <div class="flex flex-wrap gap-2">
          {#if videoState.selectedVideoImageStartUrl}
            <div class="relative">
              <img
                src={videoState.selectedVideoImageStartUrl}
                alt="Start frame"
                class="w-16 h-16 object-cover rounded-md border border-border"
              />
              <!-- User upload indicator -->
              <div class="absolute bottom-0 start-0 p-0.5">
                <PaperclipIcon class="w-4 h-4 text-white drop-shadow-lg" />
              </div>
            </div>
          {/if}
          {#if videoState.selectedVideoImageEndUrl}
            <div class="relative">
              <img
                src={videoState.selectedVideoImageEndUrl}
                alt="End frame"
                class="w-16 h-16 object-cover rounded-md border border-border"
              />
              <!-- User upload indicator -->
              <div class="absolute bottom-0 start-0 p-0.5">
                <PaperclipIcon class="w-4 h-4 text-white drop-shadow-lg" />
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Parameters as Pills (generation parameters only, matching image section) -->
      {#if videoState.selectedVideoModel || videoState.selectedVideoAspectRatio || videoState.selectedVideoQuality || videoState.selectedVideoStyle || videoState.selectedVideoSeed !== null}
        <div class="flex flex-wrap gap-2">
          {#if videoState.selectedVideoModel}
            <span
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
            >
              {videoState.getModelDisplayName(videoState.selectedVideoModel)}
            </span>
          {/if}

          {#if videoState.selectedVideoAspectRatio}
            <span
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
            >
              {videoState.selectedVideoAspectRatio}
            </span>
          {/if}

          {#if videoState.selectedVideoQuality}
            <span
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium capitalize"
            >
              {videoState.selectedVideoQuality}
            </span>
          {/if}

          {#if videoState.selectedVideoStyle}
            <span
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium capitalize"
            >
              {videoState.selectedVideoStyle}
            </span>
          {/if}

          {#if videoState.selectedVideoSeed !== null}
            <span
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-mono"
            >
              Seed: {videoState.selectedVideoSeed}
            </span>
          {/if}
        </div>
      {/if}

      <!-- Spacer to push bottom content down -->
      <div class="flex-1"></div>

      <!-- File Info (centered) -->
      <div class="text-center text-xs text-muted-foreground">
        {formatFileSize(videoState.selectedVideoFileSize)}
      </div>

      <!-- Action Buttons (stacked) -->
      <div class="flex flex-col gap-2">
        <Button
          variant="outline"
          class="w-full justify-center"
          onclick={() => {
            const result = videoState.recreateVideo();
            if (result.success) {
              toast.success("Generation parameters restored");
              setTimeout(() => videoPromptTextarea?.focus(), 100);
            } else {
              toast.warning(result.reason || "Could not recreate video");
            }
          }}
        >
          <RefreshCwIcon class="w-4 h-4 me-2" />
          Recreate
        </Button>
      </div>
    </div>
  {/snippet}

  <!-- Video Player (children slot) -->
  <div
    bind:this={videoState.videoContainerElement}
    class="relative w-full h-full max-w-full max-h-full flex flex-col items-center justify-center bg-black"
  >
    <!-- svelte-ignore a11y_media_has_caption -->
    <video
      bind:this={videoState.videoElement}
      src={videoState.selectedVideoUrl}
      class="max-w-full max-h-[calc(100%-4rem)] object-contain"
      ontimeupdate={() => videoState.handleTimeUpdate()}
      onloadedmetadata={() => videoState.handleLoadedMetadata()}
      onended={() => videoState.handleVideoEnded()}
      controls={false}
    ></video>

    <!-- Play/Pause overlay -->
    <button
      type="button"
      class="absolute inset-0 flex items-center justify-center cursor-pointer"
      onclick={() => videoState.togglePlayPause()}
    >
      {#if !videoState.isPlaying}
        <div
          class="w-16 h-16 rounded-full bg-white/80 flex items-center justify-center"
        >
          <PlayIcon class="w-8 h-8 text-black ms-1" />
        </div>
      {/if}
    </button>

    <!-- Bottom bar with controls -->
    <div
      class="absolute bottom-0 start-0 end-0 p-4 bg-gradient-to-t from-black/80 to-transparent rounded-b-lg"
    >
      <div class="flex flex-col gap-2">
        <!-- Progress bar -->
        <div class="flex items-center gap-2 text-white text-xs">
          <span>{formatTime(videoState.currentTime)}</span>
          <input
            type="range"
            min="0"
            max={videoState.videoDuration || 100}
            step="0.1"
            value={videoState.currentTime}
            oninput={(e) =>
              videoState.seekTo(
                parseFloat((e.target as HTMLInputElement).value),
              )}
            class="flex-1 h-1 bg-white/30 rounded-full appearance-none cursor-pointer accent-white"
          />
          <span>{formatTime(videoState.videoDuration)}</span>
        </div>

        <!-- Controls -->
        <div class="flex items-center justify-between text-white">
          <!-- Left: Play/Pause -->
          <Button
            variant="ghost"
            size="icon-sm"
            class="text-white hover:bg-white/20"
            onclick={() => videoState.togglePlayPause()}
          >
            {#if videoState.isPlaying}
              <PauseIcon class="w-4 h-4" />
            {:else}
              <PlayIcon class="w-4 h-4" />
            {/if}
          </Button>

          <!-- Right: Volume + Fullscreen -->
          <div class="flex items-center gap-1">
            <!-- Volume (disabled if video has no audio) -->
            <Button
              variant="ghost"
              size="icon-sm"
              class="text-white hover:bg-white/20 {!videoState.selectedVideoHasAudio ? 'opacity-50 cursor-not-allowed' : ''}"
              onclick={() => videoState.toggleMute()}
              disabled={!videoState.selectedVideoHasAudio}
            >
              {#if !videoState.selectedVideoHasAudio || videoState.isMuted || videoState.volume === 0}
                <VolumeXIcon class="w-4 h-4" />
              {:else}
                <Volume2Icon class="w-4 h-4" />
              {/if}
            </Button>

            <!-- Fullscreen -->
            <Button
              variant="ghost"
              size="icon-sm"
              class="text-white hover:bg-white/20"
              onclick={() => videoState.toggleFullscreen()}
            >
              <MaximizeIcon class="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</MediaViewer>

<!-- Generation Progress Dialogs -->
<GenerationProgressDialog
  bind:open={imageState.generationDialogOpen}
  mediaType="image"
  modelName={imageState.selectedModelName}
/>
<GenerationProgressDialog
  bind:open={videoState.generationDialogOpen}
  mediaType="video"
  modelName={videoState.selectedModelName}
/>

<style>
  .skeleton-shimmer {
    animation: shimmer 1.5s infinite;
    background-size: 200% 100%;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
</style>
