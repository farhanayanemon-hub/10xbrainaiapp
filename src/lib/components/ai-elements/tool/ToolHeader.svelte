<script lang="ts">
	import { CollapsibleTrigger } from "$lib/components/ui/collapsible/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { cn } from "$lib/utils";
	import {
		CheckCircleIcon,
		ChevronDownIcon,
		CircleIcon,
		ClockIcon,
		GlobeIcon,
		WrenchIcon,
		XCircleIcon,
	} from "@lucide/svelte";
	import { getToolDisplayName } from "$lib/ai/tools/index.js";

	type ToolUIPartType = string;
	type ToolUIPartState =
		| "input-streaming"
		| "input-available"
		| "output-available"
		| "output-error";

	interface ToolHeaderProps {
		type: ToolUIPartType;
		state: ToolUIPartState;
		class?: string;
		[key: string]: any;
	}

	let { type, state, class: className = "", ...restProps }: ToolHeaderProps = $props();

	// Get display-friendly name for the tool
	let displayName = $derived(getToolDisplayName(type));

	// Determine tool icon based on type
	let ToolIcon = $derived(type === 'web_search' ? GlobeIcon : WrenchIcon);

	let getStatusBadge = $derived.by(() => {
		let labels = {
			"input-streaming": "Pending",
			"input-available": "Running",
			"output-available": "Completed",
			"output-error": "Error",
		} as const;

		let icons = {
			"input-streaming": CircleIcon,
			"input-available": ClockIcon,
			"output-available": CheckCircleIcon,
			"output-error": XCircleIcon,
		} as const;

		let IconComponent = icons[state];
		let label = labels[state];

		return { IconComponent, label };
	});
	let IconComponent = $derived(getStatusBadge.IconComponent);

	let id = $props.id();
</script>

<CollapsibleTrigger
	{id}
	class={cn("flex w-full items-center justify-between gap-4 p-3", className)}
	{...restProps}
>
	<div class="flex items-center gap-2">
		<ToolIcon class="text-muted-foreground size-4" />
		<span class="text-sm font-medium">{displayName}</span>
		<Badge class="gap-1.5 rounded-full text-xs" variant="secondary">
			<!-- <svelte:component
        this={getStatusBadge.IconComponent}
        class={cn(
          "size-4",
          state === "input-available" && "animate-pulse",
          state === "output-available" && "text-green-600",
          state === "output-error" && "text-red-600"
        )}
      /> -->
			<IconComponent
				class={cn(
					"size-4",
					state === "input-available" && "animate-pulse",
					state === "output-available" && "text-green-600",
					state === "output-error" && "text-red-600"
				)}
			/>

			{getStatusBadge.label}
		</Badge>
	</div>
	<ChevronDownIcon
		class="text-muted-foreground size-4 transition-transform group-data-[state=open]:rotate-180"
	/>
</CollapsibleTrigger>
