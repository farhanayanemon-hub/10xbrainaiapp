<script lang="ts">
  import type { PageData, ActionData } from "./$types";
  import { enhance } from "$app/forms";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Button from "$lib/components/ui/button/index.js";
  import * as Input from "$lib/components/ui/input/index.js";
  import * as Label from "$lib/components/ui/label/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import { MessageCircleIcon, TrashIcon, CirclePlusIcon, RotateCcwIcon, SaveIcon, GripVerticalIcon } from "$lib/icons/index.js";
  import { toast } from "svelte-sonner";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let suggestions = $state(structuredClone(data.suggestions || []));
  let saving = $state(false);

  $effect(() => {
    if (form?.success) {
      toast.success(form?.reset ? 'Reset to defaults' : 'Suggestions saved');
    }
    if (form?.error) {
      toast.error(form.error);
    }
    if (form?.reset) {
      suggestions = structuredClone(data.suggestions || []);
    }
  });

  function addSuggestion() {
    const maxOrder = suggestions.length > 0 ? Math.max(...suggestions.map((s: any) => s.order)) + 1 : 0;
    suggestions = [...suggestions, {
      id: crypto.randomUUID(),
      text: '',
      prompt: '',
      order: maxOrder,
      isActive: true,
    }];
  }

  function removeSuggestion(id: string) {
    suggestions = suggestions.filter((s: any) => s.id !== id);
  }

  function moveSuggestion(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= suggestions.length) return;
    const copy = [...suggestions];
    [copy[index], copy[newIndex]] = [copy[newIndex], copy[index]];
    copy.forEach((s: any, i: number) => s.order = i);
    suggestions = copy;
  }
</script>

<svelte:head>
  <title>Prompt Suggestions - Admin</title>
</svelte:head>

<div class="space-y-4">
  {#if data.isDemoMode}
    <div class="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-md">
      <p class="font-medium">Demo Mode Active</p>
      <p class="text-sm">All modifications are disabled.</p>
    </div>
  {/if}

  <div>
    <h1 class="text-xl font-semibold tracking-tight flex items-center gap-2">
      <MessageCircleIcon class="w-6 h-6" />
      Prompt Suggestions
    </h1>
    <p class="text-muted-foreground">
      Manage the auto-scrolling prompt suggestions shown on the new chat screen. These appear as a single-line carousel.
    </p>
  </div>

  <Card.Root>
    <Card.Header>
      <div class="flex items-center justify-between">
        <div>
          <Card.Title>Suggestions</Card.Title>
          <Card.Description>Add, edit, reorder, or disable prompt suggestions. Active ones will auto-scroll on new chats.</Card.Description>
        </div>
        <Button.Root variant="outline" size="sm" onclick={addSuggestion} disabled={data.isDemoMode}>
          <CirclePlusIcon class="w-4 h-4 mr-1" />
          Add
        </Button.Root>
      </div>
    </Card.Header>
    <Card.Content>
      {#if suggestions.length === 0}
        <p class="text-center text-muted-foreground py-8">No suggestions. Click "Add" to create one.</p>
      {:else}
        <div class="space-y-3">
          {#each suggestions as suggestion, i (suggestion.id)}
            <div class="border rounded-lg p-4 space-y-3 {suggestion.isActive ? '' : 'opacity-60'}">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="flex flex-col gap-0.5">
                    <button class="p-0.5 hover:bg-muted rounded text-muted-foreground disabled:opacity-30" onclick={() => moveSuggestion(i, -1)} disabled={i === 0 || data.isDemoMode}>
                      <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 15-6-6-6 6"/></svg>
                    </button>
                    <button class="p-0.5 hover:bg-muted rounded text-muted-foreground disabled:opacity-30" onclick={() => moveSuggestion(i, 1)} disabled={i === suggestions.length - 1 || data.isDemoMode}>
                      <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                  </div>
                  <Badge variant={suggestion.isActive ? 'default' : 'secondary'} class="text-xs">
                    {suggestion.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <span class="text-xs text-muted-foreground">#{i + 1}</span>
                </div>
                <div class="flex items-center gap-2">
                  <Switch
                    checked={suggestion.isActive}
                    onCheckedChange={(v) => { suggestion.isActive = v; }}
                    disabled={data.isDemoMode}
                  />
                  <Button.Root variant="ghost" size="icon" class="h-8 w-8 text-destructive" onclick={() => removeSuggestion(suggestion.id)} disabled={data.isDemoMode}>
                    <TrashIcon class="w-4 h-4" />
                  </Button.Root>
                </div>
              </div>

              <div class="space-y-2">
                <div>
                  <Label.Root class="text-xs">Display Text (shown in carousel)</Label.Root>
                  <Input.Root
                    type="text"
                    placeholder="e.g. Help me brainstorm creative ideas"
                    bind:value={suggestion.text}
                    disabled={data.isDemoMode}
                  />
                </div>
                <div>
                  <Label.Root class="text-xs">Full Prompt (sent when clicked)</Label.Root>
                  <textarea
                    class="w-full min-h-[60px] rounded-md border bg-transparent px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="The full prompt text that gets sent to the AI..."
                    bind:value={suggestion.prompt}
                    disabled={data.isDemoMode}
                  ></textarea>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </Card.Content>
  </Card.Root>

  <div class="flex items-center justify-between">
    <form method="POST" action="?/reset" use:enhance={() => {
      return async ({ update }) => { await update(); };
    }}>
      <Button.Root type="submit" variant="outline" disabled={data.isDemoMode}>
        <RotateCcwIcon class="w-4 h-4 mr-1" />
        Reset to Defaults
      </Button.Root>
    </form>

    <form method="POST" action="?/save" use:enhance={() => {
      saving = true;
      return async ({ update }) => {
        await update();
        saving = false;
      };
    }}>
      <input type="hidden" name="suggestions" value={JSON.stringify(suggestions)} />
      <Button.Root type="submit" disabled={saving || data.isDemoMode}>
        <SaveIcon class="w-4 h-4 mr-1" />
        {saving ? 'Saving...' : 'Save Suggestions'}
      </Button.Root>
    </form>
  </div>
</div>
