<script lang="ts">
  import { goto } from "$app/navigation";
  import { getContext } from "svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import Input from "$lib/components/ui/input/input.svelte";
  import Textarea from "$lib/components/ui/textarea/textarea.svelte";
  import Label from "$lib/components/ui/label/label.svelte";
  import * as Card from "$lib/components/ui/card/index.js";
  import { ArrowLeftIcon } from "$lib/icons/index.js";
  import { toast } from "svelte-sonner";
  import type { SettingsState } from "$lib/stores/settings.svelte.js";
  import * as m from "$lib/../paraglide/messages.js";

  const settingsState = getContext<SettingsState>("settings");

  let name = $state("");
  let description = $state("");
  let isCreating = $state(false);

  async function handleCreate() {
    if (!name.trim()) {
      toast.error(m['projects.name_required']());
      return;
    }

    try {
      isCreating = true;
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(m['projects.project_created']());
        goto(`/projects/${data.project.id}`);
      } else {
        const err = await response.json();
        toast.error(err.error || "Failed to create project");
      }
    } catch (err) {
      console.error("Failed to create project:", err);
      toast.error("Failed to create project");
    } finally {
      isCreating = false;
    }
  }
</script>

<svelte:head>
  <title>{m['projects.create_project']()} | {settingsState.siteName}</title>
</svelte:head>

<div class="max-w-2xl mx-auto p-6">
  <!-- Back link -->
  <Button
    variant="ghost"
    size="sm"
    class="mb-6"
    onclick={() => goto("/projects")}
  >
    <ArrowLeftIcon class="w-4 h-4 me-1" />
    {m['projects.back_to_projects']()}
  </Button>

  <Card.Root>
    <Card.Header>
      <Card.Title class="text-xl">{m['projects.create_project']()}</Card.Title>
    </Card.Header>
    <Card.Content>
      <form
        class="space-y-6"
        onsubmit={(e) => {
          e.preventDefault();
          handleCreate();
        }}
      >
        <div class="space-y-2">
          <Label for="project-name">{m['projects.project_name']()} *</Label>
          <Input
            id="project-name"
            bind:value={name}
            placeholder={m['projects.project_name_placeholder']()}
            maxlength={100}
            required
          />
        </div>

        <div class="space-y-2">
          <Label for="project-description">{m['projects.project_description']()}</Label>
          <Textarea
            id="project-description"
            bind:value={description}
            placeholder={m['projects.project_description_placeholder']()}
            maxlength={500}
            rows={3}
          />
        </div>

        <div class="flex gap-3 justify-end">
          <Button
            variant="outline"
            type="button"
            onclick={() => goto("/projects")}
          >
            {m['projects.cancel']()}
          </Button>
          <Button type="submit" disabled={isCreating || !name.trim()}>
            {isCreating ? m['projects.creating_project']() : m['projects.create_project']()}
          </Button>
        </div>
      </form>
    </Card.Content>
  </Card.Root>
</div>
