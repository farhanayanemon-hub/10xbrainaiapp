<script lang="ts">
	import { Spinner } from "$lib/components/ui/spinner/index.js";
	import * as m from "$lib/../paraglide/messages.js";

	interface Props {
		class?: string;
	}

	let { class: className = "" }: Props = $props();
</script>

<div class="flex items-center gap-3 {className}">
	<Spinner class="size-6" />
	<span class="text-sm text-muted-foreground">
		{m["interface.generating_response"]()}
	</span>
</div>
