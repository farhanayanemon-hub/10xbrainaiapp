<script lang="ts">
  import type { Snippet } from "svelte";
  import { fade, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import {
    XIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
  } from "$lib/icons/index.js";
  import Button from "$lib/components/ui/button/button.svelte";

  interface Props {
    open: boolean;
    onClose: () => void;
    onPrevious?: () => void;
    onNext?: () => void;
    showNavigation?: boolean;
    hasPrevious?: boolean;
    hasNext?: boolean;
    children: Snippet;
    metadata?: Snippet;
    /** Optional image URL to extract dominant color for background */
    mediaSrc?: string;
  }

  let {
    open = $bindable(),
    onClose,
    onPrevious,
    onNext,
    showNavigation = false,
    hasPrevious = false,
    hasNext = false,
    children,
    metadata,
    mediaSrc,
  }: Props = $props();

  // Dominant color extracted from image
  let dominantColor = $state<string>("");

  // Extract dominant color from image when mediaSrc changes
  $effect(() => {
    if (!mediaSrc || !open) {
      dominantColor = "";
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Sample at a small size for performance
        const sampleSize = 50;
        canvas.width = sampleSize;
        canvas.height = sampleSize;

        ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
        const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;

        // Calculate average color and boost saturation for more vibrant background
        let r = 0,
          g = 0,
          b = 0,
          count = 0;

        for (let i = 0; i < imageData.length; i += 4) {
          r += imageData[i];
          g += imageData[i + 1];
          b += imageData[i + 2];
          count++;
        }

        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        // Boost saturation by pushing colors away from gray
        const avg = (r + g + b) / 3;
        const saturationBoost = 1.5;
        r = Math.min(255, Math.round(avg + (r - avg) * saturationBoost));
        g = Math.min(255, Math.round(avg + (g - avg) * saturationBoost));
        b = Math.min(255, Math.round(avg + (b - avg) * saturationBoost));

        dominantColor = `rgb(${r}, ${g}, ${b})`;
      } catch {
        // CORS or other error - fall back to default
        dominantColor = "";
      }
    };

    img.onerror = () => {
      dominantColor = "";
    };

    img.src = mediaSrc;
  });

  // Handle escape key and arrow navigation
  $effect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft" && onPrevious && hasPrevious) {
        e.preventDefault();
        onPrevious();
      } else if (e.key === "ArrowRight" && onNext && hasNext) {
        e.preventDefault();
        onNext();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  });

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }
</script>

{#if open}
  <!-- Backdrop -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 md:p-4"
    transition:fade={{ duration: 200, easing: cubicOut }}
    onclick={handleBackdropClick}
    onkeydown={(e) => e.key === "Escape" && onClose()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- Modal Container -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="relative flex flex-col md:flex-row w-[90vw] max-w-[1800px] h-[85vh] max-h-[85vh] bg-background rounded-xl overflow-hidden shadow-2xl"
      in:scale={{ duration: 200, start: 0.95, easing: cubicOut }}
      out:scale={{ duration: 150, start: 0.95, easing: cubicOut }}
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <!-- Close button (top right of modal) -->
      <button
        type="button"
        class="absolute top-3 end-3 z-20 p-2 rounded-md bg-background/80 hover:bg-background text-foreground transition-colors"
        onclick={() => onClose()}
      >
        <XIcon class="w-5 h-5" />
      </button>

      <!-- Left: Metadata Panel -->
      {#if metadata}
        <aside
          class="w-full md:w-72 lg:w-80 bg-muted/50 border-b md:border-b-0 md:border-e border-border overflow-y-auto shrink-0 max-h-[35vh] md:max-h-full"
        >
          <div class="p-5 h-full">
            {@render metadata()}
          </div>
        </aside>
      {/if}

      <!-- Right: Media Area with dynamic background -->
      <div
        class="relative flex-1 flex items-center justify-center min-h-[40vh] md:min-h-0 overflow-hidden bg-neutral-900"
      >
        <!-- Blurred background layers -->
        {#if dominantColor}
          <!-- Solid color base layer -->
          <div
            class="absolute inset-0 opacity-70"
            style="background: {dominantColor};"
          ></div>
          <!-- Blurred image background for texture -->
          {#if mediaSrc}
            <div
              class="absolute inset-0 bg-cover bg-center opacity-50 blur-2xl scale-125"
              style="background-image: url({mediaSrc});"
            ></div>
          {/if}
        {/if}

        <!-- Subtle dark overlay for contrast -->
        <div class="absolute inset-0 bg-black/30"></div>

        <!-- Media content via children snippet -->
        <div
          class="relative w-full h-full flex items-center justify-center px-4 z-10"
        >
          {@render children()}
        </div>

        <!-- Navigation buttons -->
        {#if showNavigation}
          {#if hasPrevious && onPrevious}
            <Button
              variant="ghost"
              size="icon"
              class="absolute start-2 top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/70 text-white"
              onclick={onPrevious}
            >
              <ChevronLeftIcon class="w-6 h-6" />
            </Button>
          {/if}
          {#if hasNext && onNext}
            <Button
              variant="ghost"
              size="icon"
              class="absolute end-2 top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/70 text-white"
              onclick={onNext}
            >
              <ChevronRightIcon class="w-6 h-6" />
            </Button>
          {/if}
        {/if}
      </div>
    </div>
  </div>
{/if}
