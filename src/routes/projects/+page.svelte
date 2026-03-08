<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount, getContext } from "svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import * as Card from "$lib/components/ui/card/index.js";
  import Skeleton from "$lib/components/ui/skeleton/skeleton.svelte";
  import { FolderOpenIcon, PlusIcon, MessageSquareIcon } from "$lib/icons/index.js";
  import type { SettingsState } from "$lib/stores/settings.svelte.js";
  import * as m from "$lib/../paraglide/messages.js";

  const settingsState = getContext<SettingsState>("settings");

  interface ProjectItem {
    id: string;
    name: string;
    description: string | null;
    fileCount: number;
    chatCount: number;
    createdAt: string;
    updatedAt: string;
  }

  let projects = $state<ProjectItem[]>([]);
  let isLoading = $state(true);

  onMount(async () => {
    try {
      const response = await fetch("/api/projects");
      if (response.ok) {
        const data = await response.json();
        projects = data.projects;
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      isLoading = false;
    }
  });

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }
</script>

<svelte:head>
  <title>{m['projects.title']()} | {settingsState.siteName}</title>
</svelte:head>

<div class="max-w-5xl mx-auto p-6">
  <!-- Header -->
  <div class="flex items-center justify-between mb-8">
    <div>
      <h1 class="text-2xl font-semibold">{m['projects.title']()}</h1>
    </div>
    <Button onclick={() => goto("/projects/create")}>
      <PlusIcon class="w-4 h-4 me-2" />
      {m['projects.new_project']()}
    </Button>
  </div>

  <!-- Loading State -->
  {#if isLoading}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      {#each Array(3) as _}
        <Card.Root>
          <Card.Header>
            <Skeleton class="h-5 w-3/4" />
            <Skeleton class="h-4 w-full mt-2" />
          </Card.Header>
          <Card.Content>
            <Skeleton class="h-4 w-1/2" />
          </Card.Content>
        </Card.Root>
      {/each}
    </div>
  {:else if projects.length === 0}
    <!-- Empty State -->
    <div class="flex flex-col items-center justify-center py-20 text-center">
      <div class="rounded-full bg-muted p-4 mb-4">
        <FolderOpenIcon class="w-8 h-8 text-muted-foreground" />
      </div>
      <h2 class="text-lg font-medium mb-2">{m['projects.no_projects']()}</h2>
      <p class="text-muted-foreground mb-6 max-w-md">
        {m['projects.no_projects_description']()}
      </p>
      <Button onclick={() => goto("/projects/create")}>
        <PlusIcon class="w-4 h-4 me-2" />
        {m['projects.new_project']()}
      </Button>
    </div>
  {:else}
    <!-- Project Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      {#each projects as project}
        <Card.Root
          class="cursor-pointer transition-colors hover:bg-accent/50"
          onclick={() => goto(`/projects/${project.id}`)}
        >
          <Card.Header>
            <Card.Title class="text-base truncate">{project.name}</Card.Title>
            {#if project.description}
              <Card.Description class="line-clamp-2">
                {project.description}
              </Card.Description>
            {/if}
          </Card.Header>
          <Card.Content>
            <div class="flex items-center gap-4 text-xs text-muted-foreground">
              <span class="flex items-center gap-1">
                <MessageSquareIcon class="w-3 h-3" />
                {m['projects.chats_count']({ count: project.chatCount })}
              </span>
            </div>
            <p class="text-xs text-muted-foreground mt-2">
              {m['projects.updated']()} {formatDate(project.updatedAt)}
            </p>
          </Card.Content>
        </Card.Root>
      {/each}
    </div>
  {/if}
</div>
