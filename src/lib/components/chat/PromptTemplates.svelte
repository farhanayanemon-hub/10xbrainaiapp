<script lang="ts">
  import { getPromptTemplates, type PromptTemplate } from "../chat-utils/prompt-templates.js";

  interface Props {
    onTemplateClick: (template: string) => void;
  }

  let { onTemplateClick }: Props = $props();

  const templates = getPromptTemplates();

  function handleKeydown(event: KeyboardEvent, prompt: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onTemplateClick(prompt);
    }
  }
</script>

<div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
  {#each templates as template}
    <div
      class="p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
      role="button"
      tabindex="0"
      onclick={() => onTemplateClick(template.prompt)}
      onkeydown={(e) => handleKeydown(e, template.prompt)}
    >
      <div class="flex items-center gap-3 mb-2">
        <div class="p-2 rounded-full {template.bgColor}">
          <template.icon class="w-4 h-4 {template.iconColor}" />
        </div>
        <h3 class="font-medium text-sm">{template.title}</h3>
      </div>
      <p
        class="text-sm text-muted-foreground group-hover:text-foreground transition-colors text-start"
      >
        {template.description}
      </p>
    </div>
  {/each}
</div>
