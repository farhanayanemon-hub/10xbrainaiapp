<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import { AlertTriangleIcon } from '$lib/icons/index.js';
	import { goto } from '$app/navigation';

	interface RenewalInfo {
		needsRenewal: boolean;
		planTier: string;
		daysRemaining: number;
		expiresAt: Date;
	}

	let { renewal }: { renewal: RenewalInfo | null } = $props();

	let isRenewing = $state(false);

	async function handleRenew() {
		isRenewing = true;
		// Navigate to pricing page to renew
		await goto('/pricing');
	}

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}
</script>

{#if renewal?.needsRenewal}
	<div class="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
		<div class="flex items-start gap-3">
			<AlertTriangleIcon class="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
			<div class="flex-1 min-w-0">
				<h3 class="font-medium text-amber-800 dark:text-amber-200">
					{#if renewal.daysRemaining <= 0}
						Your subscription has expired
					{:else if renewal.daysRemaining === 1}
						Your subscription expires tomorrow
					{:else}
						Your subscription expires in {renewal.daysRemaining} days
					{/if}
				</h3>
				<p class="text-sm text-amber-700 dark:text-amber-300 mt-1">
					{#if renewal.daysRemaining <= 0}
						Your {renewal.planTier} plan expired on {formatDate(renewal.expiresAt)}. Renew now to continue using premium features.
					{:else}
						Your {renewal.planTier} plan will expire on {formatDate(renewal.expiresAt)}. Renew now to avoid service interruption.
					{/if}
				</p>
			</div>
			<Button
				variant="default"
				size="sm"
				onclick={handleRenew}
				disabled={isRenewing}
				class="flex-shrink-0"
			>
				{#if isRenewing}
					Redirecting...
				{:else}
					Renew Now
				{/if}
			</Button>
		</div>
	</div>
{/if}
