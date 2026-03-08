<script lang="ts">
  import type { PageData, ActionData } from "./$types";
  import { enhance } from "$app/forms";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Button from "$lib/components/ui/button/index.js";
  import * as Input from "$lib/components/ui/input/index.js";
  import * as Label from "$lib/components/ui/label/index.js";
  import { BrainIcon, SaveIcon, UserIcon } from "$lib/icons/index.js";
  import { toast } from "svelte-sonner";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let profession = $state(data.profession || "");
  let personalInstructions = $state(data.personalInstructions || "");
  let saving = $state(false);

  const charCount = $derived(personalInstructions.length);
  const charLimit = 2000;

  $effect(() => {
    if (form?.success) {
      toast.success("AI personalization saved");
    }
    if (form?.error) {
      toast.error(form.error);
    }
  });
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-xl font-semibold tracking-tight flex items-center gap-2">
      <BrainIcon class="w-5 h-5" />
      AI Personalization
    </h2>
    <p class="text-muted-foreground text-sm mt-1">
      Help the AI understand you better. This information is included in every conversation to provide more relevant and personalized responses.
    </p>
  </div>

  <form method="POST" action="?/save" use:enhance={() => {
    saving = true;
    return async ({ update }) => {
      await update();
      saving = false;
    };
  }}>
    <div class="space-y-6">
      <Card.Root>
        <Card.Header>
          <Card.Title class="flex items-center gap-2">
            <UserIcon class="w-4 h-4" />
            About You
          </Card.Title>
          <Card.Description>
            Tell the AI about yourself so it can tailor responses to your background.
          </Card.Description>
        </Card.Header>
        <Card.Content class="space-y-4">
          <div class="space-y-2">
            <Label.Root class="text-sm font-medium">Your Name</Label.Root>
            <p class="text-xs text-muted-foreground">
              The AI already knows your name from your profile: <strong>{data.userName || "Not set"}</strong>
            </p>
          </div>

          <div class="space-y-2">
            <Label.Root for="profession" class="text-sm font-medium">Profession / Role</Label.Root>
            <Input.Root
              id="profession"
              name="profession"
              type="text"
              placeholder="e.g. Software Engineer, Student, Marketing Manager, Designer..."
              bind:value={profession}
              maxlength={100}
            />
            <p class="text-xs text-muted-foreground">
              Helps the AI adjust technical depth and terminology.
            </p>
          </div>
        </Card.Content>
      </Card.Root>

      <Card.Root>
        <Card.Header>
          <Card.Title class="flex items-center gap-2">
            <BrainIcon class="w-4 h-4" />
            Custom Instructions
          </Card.Title>
          <Card.Description>
            Tell the AI how you'd like it to respond. These instructions apply to all your conversations.
          </Card.Description>
        </Card.Header>
        <Card.Content class="space-y-4">
          <div class="space-y-2">
            <Label.Root for="personalInstructions" class="text-sm font-medium">Instructions for the AI</Label.Root>
            <textarea
              id="personalInstructions"
              name="personalInstructions"
              class="w-full min-h-[150px] rounded-md border bg-transparent px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Examples:&#10;• Always explain things simply, avoiding jargon&#10;• I prefer concise answers over long explanations&#10;• When writing code, use TypeScript and add comments&#10;• Respond in a professional but friendly tone&#10;• I'm learning Spanish, occasionally include Spanish translations"
              bind:value={personalInstructions}
              maxlength={charLimit}
            ></textarea>
            <div class="flex justify-between items-center">
              <p class="text-xs text-muted-foreground">
                These instructions are prepended to every conversation.
              </p>
              <span class="text-xs {charCount > charLimit * 0.9 ? 'text-orange-500' : 'text-muted-foreground'}">
                {charCount}/{charLimit}
              </span>
            </div>
          </div>
        </Card.Content>
      </Card.Root>

      <div class="flex justify-end">
        <Button.Root type="submit" disabled={saving}>
          <SaveIcon class="w-4 h-4 mr-1" />
          {saving ? "Saving..." : "Save Personalization"}
        </Button.Root>
      </div>
    </div>
  </form>
</div>
