<script lang="ts">
  import { onMount } from "svelte";
  import { SparklesIcon } from "$lib/icons/index.js";

  interface Suggestion {
    id: string;
    text: string;
    prompt: string;
    order: number;
    isActive: boolean;
  }

  const FALLBACK_SUGGESTIONS: Suggestion[] = [
    { id: "f1", text: "Help me brainstorm creative ideas", prompt: "Help me brainstorm creative ideas about a character who discovers they have super powers...", order: 0, isActive: true },
    { id: "f2", text: "Explain this code and suggest improvements", prompt: "Explain this code and suggest improvements for better performance and readability", order: 1, isActive: true },
    { id: "f3", text: "Analyze the pros and cons of a topic", prompt: "Analyze the pros and cons of using renewable energy sources like solar and wind power...", order: 2, isActive: true },
    { id: "f4", text: "Let's have a general discussion", prompt: "I'm curious about how artificial intelligence is changing the way we work and live...", order: 3, isActive: true },
  ];

  interface Props {
    onTemplateClick: (template: string) => void;
  }

  let { onTemplateClick }: Props = $props();

  let suggestions = $state<Suggestion[]>(FALLBACK_SUGGESTIONS);
  let scrollContainer: HTMLDivElement | undefined = $state();
  let isPaused = $state(false);
  let scrollSpeed = 0.5;

  onMount(async () => {
    try {
      const res = await fetch("/api/prompt-suggestions");
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) suggestions = data;
      }
    } catch (e) {
      console.error("Failed to load prompt suggestions:", e);
    }
  });

  $effect(() => {
    if (!scrollContainer || suggestions.length === 0) return;

    let lastTime = 0;
    let rafId: number;

    function animate(time: number) {
      if (!scrollContainer) return;
      if (lastTime === 0) lastTime = time;
      const delta = time - lastTime;
      lastTime = time;

      if (!isPaused) {
        scrollContainer.scrollLeft += scrollSpeed * (delta / 16);

        if (scrollContainer.scrollLeft >= scrollContainer.scrollWidth / 2) {
          scrollContainer.scrollLeft = 0;
        }
      }

      rafId = requestAnimationFrame(animate);
    }

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
    };
  });

  function handleClick(suggestion: Suggestion) {
    onTemplateClick(suggestion.prompt || suggestion.text);
  }

  function handleKeydown(event: KeyboardEvent, suggestion: Suggestion) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClick(suggestion);
    }
  }
</script>

{#if suggestions.length > 0}
  <div
    class="relative w-full max-w-3xl mx-auto overflow-hidden"
    role="region"
    aria-label="Prompt suggestions"
    onmouseenter={() => (isPaused = true)}
    onmouseleave={() => (isPaused = false)}
    ontouchstart={() => (isPaused = true)}
    ontouchend={() => (isPaused = false)}
  >
    <div class="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-background to-transparent z-10"></div>
    <div class="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent z-10"></div>

    <div
      bind:this={scrollContainer}
      class="flex gap-3 overflow-x-hidden py-2 scrollbar-hide"
    >
      {#each [...suggestions, ...suggestions] as suggestion, i (suggestion.id + '-' + i)}
        <button
          class="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all cursor-pointer group whitespace-nowrap text-sm"
          onclick={() => handleClick(suggestion)}
          onkeydown={(e) => handleKeydown(e, suggestion)}
        >
          <SparklesIcon class="w-3.5 h-3.5 text-primary/60 group-hover:text-primary transition-colors" />
          <span class="text-muted-foreground group-hover:text-foreground transition-colors">
            {suggestion.text}
          </span>
        </button>
      {/each}
    </div>
  </div>
{/if}
