<script lang="ts">
  import { ChevronDownIcon, CircleCheckIcon } from "$lib/icons/index.js";
  import { providerConfig } from "$lib/config/provider-icons.js";
  import { positionPopover } from "../chat-utils/popover-positioning.js";
  import {
    getCapabilities,
    getModalityConfig,
    getSyntheticArchitecture,
    groupModelsByProvider,
    filterModelGroups,
    type ModelGroup,
    type Capability,
  } from "../chat-utils/model-capabilities.js";
  import type { AIModelConfig } from "$lib/ai/types.js";
  import * as m from "$lib/../paraglide/messages.js";

  interface Props {
    models: AIModelConfig[];
    selectedModel: string;
    isLoadingModels: boolean;
    userId: string | null;
    onSelectModel: (modelName: string) => boolean;
    getModelDisplayName: (modelName: string) => string;
  }

  let {
    models,
    selectedModel,
    isLoadingModels,
    userId,
    onSelectModel,
    getModelDisplayName,
  }: Props = $props();

  // Local filter state
  let modelFilter = $state<"all" | "images" | "videos">("all");

  // Derived model groups
  const aiModelGroups = $derived(groupModelsByProvider(models));
  const filteredModelGroups = $derived(
    filterModelGroups(aiModelGroups, models, modelFilter)
  );

  function handleTriggerClick() {
    const popover = document.getElementById("model-selector-popover");
    const trigger = document.getElementById("model-selector-trigger");
    if (popover && trigger) {
      requestAnimationFrame(() => {
        positionPopover(popover, trigger);
      });
    }
  }

  function handleModelSelect(e: MouseEvent, modelValue: string) {
    e.preventDefault();
    e.stopPropagation();

    // Validate and select model (includes lock validation)
    if (!onSelectModel(modelValue)) {
      return;
    }

    // Close the popover after successful selection
    document.getElementById("model-selector-popover")?.hidePopover();
  }
</script>

<button
  id="model-selector-trigger"
  popovertarget="model-selector-popover"
  class="text-sm h-6 border-transparent cursor-pointer ml-3 flex items-center gap-1"
  disabled={isLoadingModels}
  onclick={handleTriggerClick}
>
  <span class="truncate {isLoadingModels ? 'italic' : ''}">
    {isLoadingModels
      ? m["interface.loading"]()
      : getModelDisplayName(selectedModel) || m["interface.select"]()}
  </span>
  <ChevronDownIcon class="w-4 h-4 flex-shrink-0" />
</button>

{#if !isLoadingModels}
  <div
    id="model-selector-popover"
    popover="auto"
    class="model-selector-popover w-[calc(100vw-16px)] sm:w-[580px] lg:w-[620px] max-w-[620px] max-h-96 overflow-y-auto p-4 bg-popover text-popover-foreground border rounded-md shadow-md"
  >
    <!-- Filter Header -->
    <div class="mb-4 pb-3 border-b">
      <div class="flex items-center gap-6">
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            bind:group={modelFilter}
            value="all"
            class="w-4 h-4 text-primary cursor-pointer"
          />
          <span class="text-sm font-light">All</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            bind:group={modelFilter}
            value="images"
            class="w-4 h-4 text-primary cursor-pointer"
          />
          <span class="text-sm font-light">Image generation</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            bind:group={modelFilter}
            value="videos"
            class="w-4 h-4 text-primary cursor-pointer"
          />
          <span class="text-sm font-light">Video generation</span>
        </label>
      </div>
    </div>

    <div class="space-y-4">
      {#each filteredModelGroups as group}
        <!-- Provider Group Header -->
        <div class="space-y-3 cursor-default">
          <div class="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
            <div
              class="inline-flex items-center justify-center w-5 h-5 rounded-full overflow-hidden"
            >
              {#if providerConfig[group.provider]?.iconPath}
                <img
                  src={providerConfig[group.provider].iconPath}
                  alt="{group.provider} icon"
                  class="w-4 h-4 object-contain"
                />
              {:else}
                <span class="text-xs">🤖</span>
              {/if}
            </div>
            <span class="font-medium text-sm">{group.provider}</span>
          </div>

          <!-- Model Cards Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {#each group.models as model}
              {@const foundModel = models.find((m) => m.name === model.value)}
              {@const effectiveArchitecture = foundModel
                ? model.architecture || getSyntheticArchitecture(foundModel)
                : null}
              {@const isSelected = selectedModel === model.value}
              {@const isLocked = foundModel?.isLocked || false}

              <button
                data-model-selector
                onclick={(e) => handleModelSelect(e, model.value)}
                disabled={isLocked}
                class="p-3 border rounded-lg bg-card transition-colors text-left relative group {isSelected
                  ? 'ring-2 ring-primary bg-primary/5'
                  : ''} {isLocked
                  ? 'opacity-50 cursor-not-allowed bg-muted/50'
                  : 'cursor-pointer hover:bg-accent/50'}"
              >
                <!-- Provider icon (top-right corner) -->
                <div
                  class="absolute top-2 right-2 w-4 h-4 group-hover:opacity-100
                  {isSelected ? 'opacity-100' : 'opacity-60'}"
                >
                  {#if providerConfig[group.provider]?.iconPath}
                    <img
                      src={providerConfig[group.provider].iconPath}
                      alt="{group.provider} icon"
                      class="w-full h-full object-contain"
                    />
                  {:else}
                    <span class="text-xs">🤖</span>
                  {/if}
                </div>

                <!-- Selected indicator -->
                {#if isSelected}
                  <div class="absolute bottom-2 right-2">
                    <CircleCheckIcon class="w-6 h-6 text-primary" />
                  </div>
                {/if}

                <!-- Model name -->
                <div class="pr-6 mb-3">
                  <h3
                    class="font-medium text-sm leading-tight truncate {isLocked
                      ? 'text-muted-foreground'
                      : ''}"
                    title={model.label}
                  >
                    {model.label}
                  </h3>
                  <!-- Always render lock message area for consistent layout -->
                  <p class="text-xs text-muted-foreground mt-1 min-h-[16px]">
                    {#if isLocked}
                      {#if !userId}
                        {m["interface.sign_up_to_unlock"]()}
                      {:else if userId && foundModel?.isDemoMode}
                        {m["interface.not_available_in_demo"]()}
                      {:else}
                        {m["interface.sign_up_to_unlock"]()}
                      {/if}
                    {:else}
                      <!-- Empty space to maintain layout consistency -->
                      &nbsp;
                    {/if}
                  </p>
                </div>

                <!-- Modality indicators -->
                {#if effectiveArchitecture && (effectiveArchitecture.input_modalities.length > 0 || effectiveArchitecture.output_modalities.length > 0)}
                  <div class="space-y-1">
                    <!-- Input modalities -->
                    {#if effectiveArchitecture.input_modalities.length > 0}
                      <div class="flex items-center gap-1">
                        <span class="text-sm text-muted-foreground"
                          >{m["interface.input_label"]()}:</span
                        >
                        <div class="flex gap-1">
                          {#each effectiveArchitecture.input_modalities.slice(0, 4) as modality}
                            {@const modalityConfig = getModalityConfig(modality)}
                            <span
                              class="inline-flex items-center justify-center w-5 h-5 rounded-full {modalityConfig.bgColor}"
                              title={modalityConfig.tooltip}
                            >
                              <modalityConfig.icon
                                class="w-2.5 h-2.5 {modalityConfig.iconColor}"
                              />
                            </span>
                          {/each}
                          {#if effectiveArchitecture.input_modalities.length > 4}
                            <span class="text-xs text-muted-foreground"
                              >+{effectiveArchitecture.input_modalities.length -
                                4}</span
                            >
                          {/if}
                        </div>
                      </div>
                    {/if}

                    <!-- Output modalities -->
                    {#if effectiveArchitecture.output_modalities.length > 0}
                      <div class="flex items-center gap-1">
                        <span class="text-sm text-muted-foreground"
                          >{m["interface.output_label"]()}:</span
                        >
                        <div class="flex gap-1">
                          {#each effectiveArchitecture.output_modalities.slice(0, 4) as modality}
                            {@const modalityConfig = getModalityConfig(modality)}
                            <span
                              class="inline-flex items-center justify-center w-5 h-5 rounded-full {modalityConfig.bgColor}"
                              title={modalityConfig.tooltip}
                            >
                              <modalityConfig.icon
                                class="w-2.5 h-2.5 {modalityConfig.iconColor}"
                              />
                            </span>
                          {/each}
                          {#if effectiveArchitecture.output_modalities.length > 4}
                            <span class="text-xs text-muted-foreground"
                              >+{effectiveArchitecture.output_modalities.length -
                                4}</span
                            >
                          {/if}
                        </div>
                      </div>
                    {/if}
                  </div>
                {/if}
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  /* Native HTML Popover Positioning and Performance Optimization */
  .model-selector-popover:popover-open {
    position: fixed;
    max-height: 550px;
    z-index: 50;

    /* Performance optimizations for Firefox scroll lag */
    will-change: transform, scroll-position;
    contain: layout style paint;
    transform: translateZ(0); /* Force hardware acceleration fallback */

    /* Smooth scrolling optimizations */
    -webkit-overflow-scrolling: touch; /* iOS Safari smooth scrolling */
    scroll-behavior: smooth;
    overscroll-behavior: contain;

    /* Initial positioning - will be overridden by JavaScript */
    top: 0;
    inset-inline-start: 0;
  }

  /* Optimize individual model cards for paint performance */
  .model-selector-popover [data-model-selector] {
    contain: paint;
    /* Avoid triggering layout/paint during scroll */
    will-change: auto;
  }

  /* Reduce paint complexity on hover to prevent scroll lag */
  .model-selector-popover [data-model-selector]:hover {
    transform: translateZ(0);
  }
</style>
