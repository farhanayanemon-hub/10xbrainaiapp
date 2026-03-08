<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount, getContext } from "svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import Input from "$lib/components/ui/input/input.svelte";
  import Textarea from "$lib/components/ui/textarea/textarea.svelte";
  import Separator from "$lib/components/ui/separator/separator.svelte";
  import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
  import {
    ArrowLeftIcon,
    PencilIcon,
    TrashIcon,
    FileTextIcon,
    CheckIcon,
    XIcon,
    PlusIcon,
  } from "$lib/icons/index.js";
  import { toast } from "svelte-sonner";
  import type { ChatState } from "$lib/components/chat-state.svelte.js";
  import type { SettingsState } from "$lib/stores/settings.svelte.js";
  import { ProjectState, type Project } from "./project-state.svelte.js";
  import * as m from "$lib/../paraglide/messages.js";
  import type { PageData } from './$types.js';

  // ChatInput + popover positioning
  import ChatInput from "$lib/components/chat/ChatInput.svelte";
  import { IsMounted } from "runed";
  import { setupPopoverPositioning } from "$lib/components/chat-utils/popover-positioning.js";

  let { data }: { data: PageData } = $props();

  const chatState = getContext<ChatState>("chatState");
  const settingsState = getContext<SettingsState>("settings");
  const getSession = getContext<() => any>("session");

  const projectState = new ProjectState(data.projectId, data.project as Project);

  let fileInput = $state<HTMLInputElement>(undefined!);
  let showFullDescription = $state(false);

  // Instructions edit state
  let isEditingInstructions = $state(false);

  const mounted = new IsMounted();

  // Setup popover positioning for ChatInput (model selector, file upload)
  $effect(() => {
    if (!mounted.current) return;
    const cleanup = setupPopoverPositioning(
      [
        { popoverId: "model-selector-popover", triggerId: "model-selector-trigger" },
        { popoverId: "file-upload-popover", triggerId: "file-upload-trigger" },
      ],
      () => mounted.current,
    );
    return cleanup;
  });

  onMount(() => {
    projectState.loadFiles();
    projectState.loadChats();
  });

  function handleFileUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      projectState.uploadFile(file);
      target.value = "";
    }
  }

  async function handleDeleteProject() {
    const success = await projectState.deleteProject();
    if (success) {
      goto("/projects");
    }
  }

  function handleNameKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      projectState.saveName();
    } else if (e.key === "Escape") {
      projectState.cancelEditingName();
    }
  }

  function handleDescriptionKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      projectState.cancelEditingDescription();
    }
  }

  function startEditingInstructions() {
    isEditingInstructions = true;
  }

  function cancelEditingInstructions() {
    // Revert to saved value
    projectState.customInstructions = projectState.project?.customInstructions || "";
    isEditingInstructions = false;
  }

  async function saveInstructions() {
    await projectState.saveCustomInstructions();
    isEditingInstructions = false;
  }

  // Get session for ChatInput userId
  const session = $derived(getSession());
</script>

<svelte:head>
  <title>{projectState.project?.name || 'Project'} | {settingsState.siteName}</title>
</svelte:head>

<div class="max-w-6xl mx-auto p-4 sm:p-6">
  <!-- Back link -->
  <button
    class="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
    onclick={() => goto("/projects")}
  >
    <ArrowLeftIcon class="w-4 h-4 me-1.5" />
    {m['projects.back_to_projects']()}
  </button>

  <!-- Main Content Grid -->
  <div class="grid grid-cols-1 lg:grid-cols-5 gap-8">
    <!-- Left Column: Title + Description + ChatInput + Chat History -->
    <div class="lg:col-span-3 space-y-6">
      <!-- Project Title -->
      {#if projectState.isEditingName}
        <div class="flex items-center gap-2">
          <Input
            bind:value={projectState.editingName}
            class="text-2xl font-bold h-auto py-1 border-none shadow-none focus-visible:ring-0 px-0 text-foreground"
            onkeydown={handleNameKeydown}
            maxlength={100}
          />
          <Button size="icon-sm" variant="ghost" onclick={() => projectState.saveName()} disabled={projectState.isSavingName}>
            <CheckIcon class="w-4 h-4" />
          </Button>
          <Button size="icon-sm" variant="ghost" onclick={() => projectState.cancelEditingName()}>
            <XIcon class="w-4 h-4" />
          </Button>
        </div>
      {:else}
        <button
          class="text-start group w-full"
          onclick={() => projectState.startEditingName()}
          title={m['projects.edit_name']()}
        >
          <h1 class="text-2xl font-bold group-hover:text-muted-foreground transition-colors">
            {projectState.project?.name}
          </h1>
        </button>
      {/if}

      <!-- Description -->
      {#if projectState.isEditingDescription}
        <div class="flex items-start gap-2">
          <Textarea
            bind:value={projectState.editingDescription}
            class="text-sm text-muted-foreground"
            rows={2}
            maxlength={500}
            onkeydown={handleDescriptionKeydown}
          />
          <div class="flex flex-col gap-1">
            <Button size="icon-sm" variant="ghost" onclick={() => projectState.saveDescription()} disabled={projectState.isSavingDescription}>
              <CheckIcon class="w-4 h-4" />
            </Button>
            <Button size="icon-sm" variant="ghost" onclick={() => projectState.cancelEditingDescription()}>
              <XIcon class="w-4 h-4" />
            </Button>
          </div>
        </div>
      {:else if projectState.project?.description}
        <div class="group">
          <button
            class="text-start w-full"
            onclick={() => projectState.startEditingDescription()}
            title={m['projects.edit_description']()}
          >
            <p class="text-sm text-muted-foreground {showFullDescription ? '' : 'line-clamp-3'}">
              {projectState.project.description}
            </p>
          </button>
          {#if projectState.project.description.length > 200}
            <button
              class="text-sm text-muted-foreground/70 hover:text-muted-foreground underline underline-offset-2 mt-1"
              onclick={() => (showFullDescription = !showFullDescription)}
            >
              {showFullDescription ? "Show less" : "Show more"}
            </button>
          {/if}
        </div>
      {:else}
        <button
          class="text-sm text-muted-foreground/50 hover:text-muted-foreground transition-colors text-start"
          onclick={() => projectState.startEditingDescription()}
        >
          Add a description...
        </button>
      {/if}

      <!-- ChatInput — negative margin to offset the component's internal p-4 padding -->
      <div class="-mx-4">
        <ChatInput
          prompt={chatState.prompt}
          isLoading={chatState.isLoading}
          selectedTool={chatState.selectedTool}
          userId={session?.user?.id ?? null}
          guestMessageCount={chatState.guestMessageCount}
          models={chatState.models}
          selectedModel={chatState.selectedModel}
          isLoadingModels={chatState.isLoadingModels}
          webSearchEnabled={chatState.webSearchEnabled}
          isWebSearchAvailable={chatState.isWebSearchAvailable()}
          favoriteModels={chatState.favoriteModels}
          onToggleFavorite={(modelName) => chatState.toggleFavorite(modelName)}
          onPromptChange={(value) => (chatState.prompt = value)}
          onSubmit={(files) => {
            chatState.startProjectChat(data.projectId);
            chatState.handleSubmit(files);
          }}
          onClearTool={() => chatState.clearSelectedTool()}
          onSelectModel={(modelName) => chatState.selectModel(modelName)}
          onSelectTool={(tool) => (chatState.selectedTool = tool)}
          onWebSearchToggle={(enabled) => (chatState.webSearchEnabled = enabled)}
          cleanMessageContent={(content) => chatState.cleanMessageContent(content)}
          canGuestSendMessage={() => chatState.canGuestSendMessage()}
          getModelDisplayName={(name) => chatState.getModelDisplayName(name)}
        />
      </div>

      <!-- Chat History -->
      {#if projectState.isLoadingChats}
        <div class="space-y-0">
          {#each Array(3) as _}
            <div class="py-4">
              <div class="h-4 w-48 rounded bg-muted/50 animate-pulse mb-2"></div>
              <div class="h-3 w-32 rounded bg-muted/30 animate-pulse"></div>
            </div>
          {/each}
        </div>
      {:else if projectState.projectChats.length > 0}
        <div>
          {#each projectState.projectChats as chat, i}
            {#if i > 0}
              <Separator />
            {/if}
            <button
              class="flex flex-col gap-0.5 w-full py-4 text-start hover:bg-accent/30 transition-colors rounded-md px-2 -mx-2"
              onclick={() => goto(`/chat/${chat.id}`)}
            >
              <span class="text-sm font-medium truncate">{chat.title}</span>
              <span class="text-xs text-muted-foreground">
                Last message {projectState.formatDate(chat.updatedAt)}
              </span>
            </button>
          {/each}
        </div>
      {:else}
        <p class="text-sm text-muted-foreground py-4">{m['projects.no_chats']()}</p>
      {/if}
    </div>

    <!-- Right Column: Instructions + Files + Delete -->
    <div class="lg:col-span-2 space-y-6">
      <!-- Instructions Section -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-medium">{m['projects.custom_instructions']()}</h3>
          {#if !isEditingInstructions}
            <Button
              size="icon-sm"
              variant="ghost"
              class="text-muted-foreground"
              onclick={startEditingInstructions}
            >
              <PencilIcon class="w-3.5 h-3.5" />
            </Button>
          {/if}
        </div>

        {#if isEditingInstructions}
          <div class="space-y-3">
            <Textarea
              bind:value={projectState.customInstructions}
              placeholder={m['projects.custom_instructions_placeholder']()}
              rows={8}
              maxlength={4000}
              class="resize-y text-sm"
            />
            <div class="flex items-center justify-between">
              <span class="text-xs text-muted-foreground">
                {projectState.customInstructions.length}/4000
              </span>
              <div class="flex items-center gap-2">
                <Button size="sm" variant="ghost" onclick={cancelEditingInstructions}>
                  {m['projects.cancel']()}
                </Button>
                <Button
                  size="sm"
                  onclick={saveInstructions}
                  disabled={projectState.isSavingInstructions}
                >
                  {projectState.isSavingInstructions ? m['projects.saving_instructions']() : m['projects.save_instructions']()}
                </Button>
              </div>
            </div>
          </div>
        {:else if projectState.customInstructions}
          <p class="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">
            {projectState.customInstructions}
          </p>
        {:else}
          <p class="text-sm text-muted-foreground/50">
            {m['projects.custom_instructions_description']()}
          </p>
        {/if}
      </div>

      <Separator />

      <!-- Files Section -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-medium">{m['projects.files']()}</h3>
          {#if projectState.canUploadMore}
            <input
              bind:this={fileInput}
              type="file"
              class="hidden"
              accept=".txt,.md,.csv,.json,.html,.css,.js,.ts,.xml,.yaml,.yml,.py,.rb,.go,.rs,.java,.c,.cpp,.h,.sh,.sql,.env,.toml,.ini,.cfg"
              onchange={handleFileUpload}
            />
            <Button
              size="icon-sm"
              variant="ghost"
              class="text-muted-foreground"
              onclick={() => fileInput.click()}
              disabled={projectState.isUploadingFile}
            >
              <PlusIcon class="w-4 h-4" />
            </Button>
          {/if}
        </div>

        {#if projectState.files.length === 0}
          <div class="rounded-lg border border-dashed border-muted-foreground/25 p-6 text-center">
            <p class="text-sm text-muted-foreground/60">
              {m['projects.no_files']()}
            </p>
          </div>
        {:else}
          <div class="space-y-1">
            {#each projectState.files as file}
              <div class="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-accent/30 transition-colors group">
                <div class="flex items-center gap-2 min-w-0">
                  <FileTextIcon class="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span class="text-sm truncate">{file.filename}</span>
                  <span class="text-xs text-muted-foreground flex-shrink-0">
                    {projectState.formatFileSize(file.fileSize)}
                  </span>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  class="text-muted-foreground hover:text-destructive flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onclick={() => projectState.deleteFile(file.id)}
                >
                  <TrashIcon class="w-3.5 h-3.5" />
                </Button>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <Separator />

      <!-- Delete Project -->
      <button
        class="text-sm text-destructive/70 hover:text-destructive transition-colors"
        onclick={() => (projectState.showDeleteDialog = true)}
      >
        {m['projects.delete_project']()}
      </button>
    </div>
  </div>
</div>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root open={projectState.showDeleteDialog}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{m['projects.delete_project_title']()}</AlertDialog.Title>
      <AlertDialog.Description>
        {m['projects.delete_project_description']()}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel onclick={() => (projectState.showDeleteDialog = false)}>
        {m['projects.cancel']()}
      </AlertDialog.Cancel>
      <AlertDialog.Action
        onclick={handleDeleteProject}
        class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
      >
        {projectState.isDeleting ? "Deleting..." : m['projects.delete_project']()}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
