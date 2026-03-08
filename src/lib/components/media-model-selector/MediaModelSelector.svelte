<script lang="ts">
  import * as Popover from "$lib/components/ui/popover/index.js";
  import Input from "$lib/components/ui/input/input.svelte";
  import { SearchIcon, ChevronDownIcon, CheckIcon } from "$lib/icons/index.js";
  import { providerConfig } from "$lib/config/provider-icons.js";
  import {
    IMAGE_CATEGORIES,
    VIDEO_CATEGORIES,
    getModelMetadata,
    modelMatchesCategory,
  } from "$lib/constants/media-model-metadata.js";
  import type { AIModelConfig } from "$lib/ai/types.js";

  interface Props {
    models: AIModelConfig[];
    selectedModel: string;
    type: "image" | "video";
    onSelectModel: (modelName: string) => void;
    onModelSelected?: () => void;
    disabled?: boolean;
    readOnly?: boolean;
  }

  let {
    models,
    selectedModel,
    type,
    onSelectModel,
    onModelSelected,
    disabled = false,
    readOnly = false,
  }: Props = $props();

  // Internal state
  let searchQuery = $state("");
  let activeCategory = $state<string>("All");
  let popoverOpen = $state(false);

  // Get categories based on type
  const categories = $derived(
    type === "image" ? IMAGE_CATEGORIES : VIDEO_CATEGORIES,
  );

  // Get selected model display name
  const selectedModelDisplayName = $derived.by(() => {
    const model = models.find((m) => m.name === selectedModel);
    return model?.displayName || selectedModel;
  });

  // Get selected model provider
  const selectedModelProvider = $derived.by(() => {
    const model = models.find((m) => m.name === selectedModel);
    return model?.provider || "";
  });

  // Filter models based on search and category
  const filteredModels = $derived.by(() => {
    let result = models;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((model) => {
        const displayName = model.displayName.toLowerCase();
        const name = model.name.toLowerCase();
        const metadata = getModelMetadata(model.name, type);
        const description = metadata?.description?.toLowerCase() || "";

        return (
          displayName.includes(query) ||
          name.includes(query) ||
          description.includes(query)
        );
      });
    }

    // Filter by category
    if (activeCategory !== "All") {
      result = result.filter((model) =>
        modelMatchesCategory(model.name, activeCategory, type),
      );
    }

    return result;
  });

  // Handle model selection
  function handleSelectModel(modelName: string) {
    if (readOnly) return;
    onSelectModel(modelName);
    popoverOpen = false;
    searchQuery = "";
    activeCategory = "All";
    // Delay to ensure popover closes first
    if (onModelSelected) {
      setTimeout(() => onModelSelected(), 50);
    }
  }

  // Handle category click
  function handleCategoryClick(category: string) {
    activeCategory = category === activeCategory ? "All" : category;
  }

  // Handle popover open state change
  function handleOpenChange(open: boolean) {
    popoverOpen = open;
    // Reset filters when popover closes
    if (!open) {
      searchQuery = "";
      activeCategory = "All";
    }
  }
</script>

<Popover.Root open={popoverOpen} onOpenChange={handleOpenChange}>
  <Popover.Trigger
    disabled={disabled && !readOnly}
    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md
			bg-transparent hover:bg-accent/50 transition-colors cursor-pointer
			disabled:opacity-50 disabled:cursor-not-allowed border-0 flex-shrink-0"
  >
    <!-- Provider icon -->
    {#if selectedModelProvider && providerConfig[selectedModelProvider]}
      <img
        src={providerConfig[selectedModelProvider].iconPath}
        alt=""
        class="w-4 h-4 rounded-full object-contain"
      />
    {/if}
    <span class="truncate max-w-[120px]">{selectedModelDisplayName}</span>
    <ChevronDownIcon class="w-4 h-4 flex-shrink-0 text-muted-foreground" />
  </Popover.Trigger>

  <Popover.Content
    side="top"
    align="start"
    class="w-[380px] sm:w-[440px] p-0 max-h-[600px] flex flex-col border-0 rounded-xl overflow-hidden"
  >
    <!-- Search Header (Sticky) -->
    <div class="p-3 border-b border-border sticky top-0 bg-popover z-10">
      <div class="relative">
        <SearchIcon
          class="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
        />
        <Input
          bind:value={searchQuery}
          placeholder="Search models..."
          class="ps-9 h-9 bg-muted/50"
        />
      </div>
    </div>

    <!-- Category Filters -->
    <div
      class="px-3 py-2 border-b border-border sticky top-[57px] bg-popover z-10"
    >
      <div class="flex flex-wrap gap-1.5">
        {#each categories as category (category)}
          <button
            type="button"
            onclick={() => handleCategoryClick(category)}
            class="px-2.5 py-1 text-xs font-medium rounded-full transition-colors cursor-pointer
							{activeCategory === category
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'}"
          >
            {category}
          </button>
        {/each}
      </div>
    </div>

    <!-- Model List (Scrollable) -->
    <div class="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
      {#if filteredModels.length === 0}
        <div class="flex flex-col items-center justify-center py-8 text-center">
          <p class="text-sm text-muted-foreground">No models found</p>
          <p class="text-xs text-muted-foreground mt-1">
            Try a different search or category
          </p>
        </div>
      {:else}
        {#each filteredModels as model (model.name)}
          {@const metadata = getModelMetadata(model.name, type)}
          {@const isSelected = selectedModel === model.name}

          <button
            type="button"
            onclick={() => handleSelectModel(model.name)}
            disabled={readOnly}
            class="w-full flex items-start gap-3 p-2.5 rounded-lg transition-colors text-start
							{readOnly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
							{isSelected ? 'bg-primary/10 ring-1 ring-primary/20' : readOnly ? '' : 'hover:bg-accent/50'}"
          >
            <!-- Provider Icon -->
            <div
              class="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center"
            >
              {#if model.provider && providerConfig[model.provider]}
                <img
                  src={providerConfig[model.provider].iconPath}
                  alt=""
                  class="w-6 h-6 object-contain"
                />
              {:else}
                <span class="text-lg">AI</span>
              {/if}
            </div>

            <!-- Model Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-medium text-sm truncate"
                  >{model.displayName}</span
                >
                {#if metadata?.isNew}
                  <span
                    class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-primary/10 text-primary"
                  >
                    New
                  </span>
                {/if}
                {#if readOnly}
                  <span
                    class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground whitespace-nowrap"
                  >
                    Not available in Demo
                  </span>
                {/if}
              </div>
              {#if metadata?.description}
                <p class="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {metadata.description}
                </p>
              {/if}
            </div>

            <!-- Selected Indicator -->
            {#if isSelected}
              <div
                class="flex-shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
              >
                <CheckIcon class="w-3 h-3 text-primary-foreground" />
              </div>
            {/if}
          </button>
        {/each}
      {/if}
    </div>
  </Popover.Content>
</Popover.Root>

<style>
  /* Line clamp utility for description */
  .line-clamp-1 {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
