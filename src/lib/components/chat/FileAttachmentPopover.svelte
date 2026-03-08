<script lang="ts">
  import { SquarePlusIcon } from "$lib/icons/index.js";
  import * as Tooltip from "$lib/components/ui/tooltip/index.js";
  import FileUpload from "../FileUpload.svelte";
  import { positionPopover } from "../chat-utils/popover-positioning.js";
  import * as m from "$lib/../paraglide/messages.js";
  import type { AttachedFile } from "../chat-state.svelte.js";

  interface Props {
    attachedFiles: AttachedFile[];
    onFilesSelected: (files: any[]) => void;
    onRemoveFile: (fileId: string) => void;
    onClearAll: () => void;
  }

  let { attachedFiles, onFilesSelected, onRemoveFile, onClearAll }: Props = $props();

  function handleTriggerClick() {
    const popover = document.getElementById("file-upload-popover");
    const trigger = document.getElementById("file-upload-trigger");
    if (popover && trigger) {
      requestAnimationFrame(() => {
        positionPopover(popover, trigger);
      });
    }
  }

  function handleClosePopover() {
    document.getElementById("file-upload-popover")?.hidePopover();
  }
</script>

<div class="relative">
  <button
    id="file-upload-trigger"
    popovertarget="file-upload-popover"
    class="h-6 {attachedFiles.length > 0
      ? 'w-auto px-3 bg-blue-500 hover:bg-blue-600 text-white'
      : 'w-6 bg-transparent'} border-transparent cursor-pointer flex items-center rounded-md justify-center gap-1 transition-all duration-300 ease-in-out"
    onclick={handleTriggerClick}
  >
    <SquarePlusIcon class="w-5 h-5 flex-shrink-0" />
    {#if attachedFiles.length > 0}
      <span class="text-xs font-medium whitespace-nowrap">
        {attachedFiles.length}
        {attachedFiles.length === 1
          ? m["interface.file_singular"]()
          : m["interface.files_plural"]()}
      </span>
    {/if}
  </button>

  <div
    id="file-upload-popover"
    popover="auto"
    class="file-upload-popover w-80 max-h-[300px] overflow-y-auto p-4 bg-popover text-popover-foreground border rounded-md shadow-md"
  >
    <div class="flex justify-between items-center mb-3">
      <h3 class="text-sm font-medium cursor-default">
        {m["interface.attach_files"]()}
      </h3>
      <button
        class="text-muted-foreground hover:text-foreground"
        onclick={handleClosePopover}
      >
        ✕
      </button>
    </div>

    <!-- File upload area - always at top -->
    <FileUpload
      {onFilesSelected}
      acceptedTypes={[
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/gif",
        "image/webp",
        "text/plain",
        "text/markdown",
        "text/csv",
        "application/json",
      ]}
      maxFiles={3 - attachedFiles.length}
      class="mb-3"
    />

    <!-- Attached files list - below upload area -->
    {#if attachedFiles.length > 0}
      <div class="border-t pt-3 mt-3">
        <h4 class="text-sm font-medium mb-2 cursor-default">
          Attached Files ({attachedFiles.length})
        </h4>
        <div class="space-y-2 mb-3">
          {#each attachedFiles as file}
            <div
              class="flex items-center justify-between gap-2 bg-muted/50 rounded px-3 py-2 cursor-default"
            >
              <div class="flex items-center gap-2 flex-1 min-w-0">
                <span class="text-sm truncate">{file.name}</span>
                <span class="text-xs text-muted-foreground"
                  >({(file.size / 1024).toFixed(1)}KB)</span
                >
              </div>
              <button
                onclick={() => onRemoveFile(file.id)}
                class="text-muted-foreground hover:text-foreground p-1 rounded-sm hover:bg-muted"
                type="button"
                aria-label={m["interface.remove_file"]()}
              >
                ✕
              </button>
            </div>
          {/each}

          <!-- Clear all button -->
          <div class="flex justify-end pt-2">
            <button
              onclick={onClearAll}
              class="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded"
            >
              {m["interface.remove_all"]()}
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Separate tooltip overlay -->
  <Tooltip.Provider>
    <Tooltip.Root>
      <Tooltip.Trigger class="absolute inset-0 pointer-events-none">
        <span class="sr-only">{m["interface.attach_files_tooltip"]()}</span>
      </Tooltip.Trigger>
      <Tooltip.Content>
        <p>{m["interface.attach_files_tooltip"]()}</p>
      </Tooltip.Content>
    </Tooltip.Root>
  </Tooltip.Provider>
</div>

<style>
  .file-upload-popover:popover-open {
    position: fixed;
    max-height: 415px;
    z-index: 50;

    /* Performance optimizations */
    will-change: transform;
    contain: layout style paint;
    transform: translateZ(0);

    /* Initial positioning - will be overridden by JavaScript */
    inset-inline-start: 0;
  }
</style>
