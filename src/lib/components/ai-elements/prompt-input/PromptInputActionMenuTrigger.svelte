<script lang="ts">
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
	import PromptInputButton from "./PromptInputButton.svelte";
	import PlusIcon from "./PlusIcon.svelte";

	interface Props {
		class?: string;
		children?: import("svelte").Snippet;
	}

	let { class: className, children, ...props }: Props = $props();
</script>

<DropdownMenu.Trigger>
	{#snippet child({ props: triggerProps })}
		<PromptInputButton class={className} {...props} {...triggerProps}>
			{#if children}
				{@render children()}
			{:else}
				<PlusIcon class="size-4" />
			{/if}
		</PromptInputButton>
	{/snippet}
</DropdownMenu.Trigger>
