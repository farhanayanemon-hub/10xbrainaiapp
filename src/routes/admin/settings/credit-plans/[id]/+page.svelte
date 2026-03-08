<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import { goto } from "$app/navigation";
  import { enhance } from "$app/forms";

  let { data, form } = $props();

  let isSubmitting = $state(false);
  let isDeleting = $state(false);

  let creditType = $state(form?.creditType || data.plan.creditType);
  let currency = $state(form?.currency || data.plan.currency);

  const creditTypeOptions = [
    { value: "text", label: "Text" },
    { value: "image", label: "Image" },
    { value: "video", label: "Video" },
    { value: "audio", label: "Audio" },
  ];

  const currencyOptions = [
    { value: "usd", label: "USD" },
    { value: "eur", label: "EUR" },
    { value: "gbp", label: "GBP" },
  ];

  const creditTypeTriggerContent = $derived(
    creditTypeOptions.find((t) => t.value === creditType)?.label ??
      "Select type",
  );

  const currencyTriggerContent = $derived(
    currencyOptions.find((c) => c.value === currency)?.label ?? "USD",
  );
</script>

<svelte:head>
  <title>Edit Credit Plan - Admin Settings</title>
</svelte:head>

<div class="space-y-6">
  {#if data.isDemoMode}
    <div
      class="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-md"
    >
      <div class="flex items-center gap-2">
        <div class="flex-shrink-0">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clip-rule="evenodd"
            ></path>
          </svg>
        </div>
        <div>
          <p class="font-medium">Demo Mode Active</p>
          <p class="text-sm">
            All modifications are disabled. This is a read-only demonstration of
            the admin interface.
          </p>
        </div>
      </div>
    </div>
  {/if}

  <div class="flex justify-between items-center">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">Edit Credit Plan</h1>
      <p class="text-muted-foreground">
        Modify the credit plan details below.
      </p>
    </div>
    <Button
      variant="outline"
      onclick={() => goto("/admin/settings/credit-plans")}
    >
      Back to Credit Plans
    </Button>
  </div>

  <Card.Root class="max-w-2xl">
    <Card.Header>
      <Card.Title>Credit Plan Details</Card.Title>
      <Card.Description>
        Update the information below to modify the credit plan.
      </Card.Description>
    </Card.Header>
    <Card.Content>
      <form
        method="POST"
        action="?/update"
        use:enhance={() => {
          isSubmitting = true;
          return async ({ update }) => {
            await update();
            isSubmitting = false;
          };
        }}
        class="space-y-6"
      >
        {#if form?.error}
          <div
            class="p-3 text-sm text-destructive-foreground bg-destructive/10 border border-destructive/20 rounded-md"
          >
            {form.error}
          </div>
        {/if}

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="name">Plan Name</Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g., 100 Text Credits"
              value={form?.name || data.plan.name}
              required
            />
          </div>

          <div class="space-y-2">
            <Label for="creditType">Credit Type</Label>
            <Select.Root
              type="single"
              name="creditType"
              bind:value={creditType}
              required
            >
              <Select.Trigger>
                {creditTypeTriggerContent}
              </Select.Trigger>
              <Select.Content>
                {#each creditTypeOptions as option (option.value)}
                  <Select.Item value={option.value} label={option.label}>
                    {option.label}
                  </Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
        </div>

        <div class="space-y-2">
          <Label for="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            placeholder="Describe what this credit plan includes..."
            value={form?.description || data.plan.description || ""}
            rows={3}
          />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="creditAmount">Credit Amount</Label>
            <Input
              id="creditAmount"
              name="creditAmount"
              type="number"
              placeholder="100"
              min="1"
              value={form?.creditAmount || data.plan.creditAmount}
              required
            />
          </div>

          <div class="space-y-2">
            <Label for="priceAmount">Price (in cents)</Label>
            <Input
              id="priceAmount"
              name="priceAmount"
              type="number"
              placeholder="999"
              min="0"
              value={form?.priceAmount || data.plan.priceAmount}
              required
            />
            <p class="text-xs text-muted-foreground">
              Enter price in cents (e.g., 999 = $9.99)
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="priceAmountBdt">Price BDT (in paisa)</Label>
            <Input
              id="priceAmountBdt"
              name="priceAmountBdt"
              type="number"
              placeholder="50000"
              min="0"
              value={form?.priceAmountBdt || (data.plan.priceAmountBdt ?? "")}
            />
            <p class="text-xs text-muted-foreground">
              For Opaybd payments (e.g., 50000 = ৳500)
            </p>
          </div>

          <div class="space-y-2">
            <Label for="currency">Currency</Label>
            <Select.Root type="single" name="currency" bind:value={currency}>
              <Select.Trigger>
                {currencyTriggerContent}
              </Select.Trigger>
              <Select.Content>
                {#each currencyOptions as option (option.value)}
                  <Select.Item value={option.value} label={option.label}>
                    {option.label}
                  </Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
        </div>

        <div class="space-y-2">
          <div class="flex items-center space-x-2">
            <Switch
              id="isActive"
              name="isActive"
              checked={form?.isActive ?? data.plan.isActive}
            />
            <Label for="isActive">Plan is Active</Label>
          </div>
          <p class="text-xs text-muted-foreground">
            Toggle to activate or deactivate this credit plan
          </p>
        </div>

        <div class="space-y-2">
          <div class="flex justify-between">
            <form
              method="POST"
              action="?/delete"
              use:enhance={() => {
                if (!confirm("Are you sure you want to delete this credit plan? This action cannot be undone.")) {
                  return ({ cancel }) => cancel();
                }
                isDeleting = true;
                return async ({ update }) => {
                  await update();
                  isDeleting = false;
                };
              }}
            >
              <Button
                type="submit"
                variant="destructive"
                disabled={isDeleting || data.isDemoMode}
              >
                {isDeleting ? "Deleting..." : "Delete Plan"}
              </Button>
            </form>

            <div class="flex space-x-2">
              <Button
                type="button"
                variant="outline"
                onclick={() => goto("/admin/settings/credit-plans")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || data.isDemoMode}>
                {isSubmitting
                  ? "Updating..."
                  : data.isDemoMode
                    ? "Demo Mode - Read Only"
                    : "Update Credit Plan"}
              </Button>
            </div>
          </div>
          {#if data.isDemoMode}
            <p class="text-xs text-muted-foreground text-right">
              Updates are disabled in demo mode. This is a read-only
              demonstration.
            </p>
          {/if}
        </div>
      </form>
    </Card.Content>
  </Card.Root>
</div>
