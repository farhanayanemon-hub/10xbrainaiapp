<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';

	interface Props {
		open: boolean;
		mediaType: 'image' | 'video';
		modelName?: string;
	}

	let { open = $bindable(), mediaType, modelName }: Props = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		showCloseButton={false}
		class="sm:max-w-md"
		escapeKeydownBehavior="ignore"
		interactOutsideBehavior="ignore"
	>
		<div class="flex flex-col items-center justify-center py-8">
			<!-- Animated spinner -->
			<div class="relative w-16 h-16 mb-6">
				<div class="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
				<div
					class="absolute inset-0 border-4 border-transparent border-t-primary rounded-full animate-spin"
				></div>
			</div>

			<!-- Status text -->
			<h3 class="text-lg font-semibold mb-2">
				Generating {mediaType}...
			</h3>
			<p class="text-sm text-muted-foreground text-center">
				{#if modelName}
					Using {modelName}
				{:else}
					Please wait while your {mediaType} is being created
				{/if}
			</p>
		</div>
	</Dialog.Content>
</Dialog.Root>
