<script lang="ts">
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import type { Dialog as DialogPrimitive } from "bits-ui";
	import type { WithoutChildrenOrChild } from "$lib/utils.js";
	import type { Snippet } from "svelte";

	let {
		open = $bindable(false),
		onOpenChange,
		children,
		...restProps
	}: WithoutChildrenOrChild<DialogPrimitive.RootProps> & {
		children: Snippet;
		onOpenChange?: (open: boolean) => void;
	} = $props();

	function handleOpenChange(newOpen: boolean) {
		open = newOpen;
		onOpenChange?.(newOpen);
	}
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange} {...restProps}>
	{@render children()}
</Dialog.Root>
