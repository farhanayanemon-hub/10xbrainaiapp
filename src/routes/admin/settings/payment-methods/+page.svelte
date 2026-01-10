<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import { enhance } from "$app/forms";

  // Import icons
  import {
    CreditCardIcon,
    CheckCircleIcon,
    EyeIcon,
    EyeOffIcon,
  } from "$lib/icons/index.js";

  let { form, data } = $props();

  // Form state
  let isSubmitting = $state(false);
  let showSecretKey = $state(false);
  let showWebhookSecret = $state(false);
  let showOpayApiKey = $state(false);
  let showStripeInstructions = $state(false);
  let showOpayInstructions = $state(false);
  let copiedWebhookUrl = $state(false);

  // Environment options
  const environmentOptions = [
    { value: "test", label: "Test Mode" },
    { value: "live", label: "Live Mode" },
  ];

  // Payment provider options
  const providerOptions = [
    {
      value: "stripe",
      label: "Stripe",
      description: "Credit cards, Apple Pay, Google Pay, and more",
    },
    {
      value: "opaybd",
      label: "Opaybd",
      description: "bKash, Nagad, Rocket, and local payment methods",
    },
  ];

  // Reactive form values - initialize with current settings or form data
  let activeProvider = $state(
    form?.activeProvider || data?.settings?.activeProvider || "stripe"
  );
  let selectedEnvironment = $state(
    form?.environment || data?.settings?.environment || "test"
  );
  let stripePublishableKey = $state(
    form?.stripePublishableKey || data?.settings?.stripePublishableKey || ""
  );
  let stripeSecretKey = $state(
    form?.stripeSecretKey || data?.settings?.stripeSecretKey || ""
  );
  let stripeWebhookSecret = $state(
    form?.stripeWebhookSecret || data?.settings?.stripeWebhookSecret || ""
  );
  let opayApiKey = $state(form?.opayApiKey || data?.settings?.opayApiKey || "");
  const environmentLabel = $derived(
    environmentOptions.find((env) => env.value === selectedEnvironment)
      ?.label ?? "Test Mode"
  );

  // State sync effect
  $effect(() => {
    // Update reactive state when data changes (e.g., on page refresh or form reset)
    if (data?.settings && !form) {
      activeProvider = data.settings.activeProvider || "stripe";
      selectedEnvironment = data.settings.environment || "test";
      stripePublishableKey = data.settings.stripePublishableKey || "";
      stripeSecretKey = data.settings.stripeSecretKey || "";
      stripeWebhookSecret = data.settings.stripeWebhookSecret || "";
      opayApiKey = data.settings.opayApiKey || "";
    }
  });

  // Function to mask sensitive keys
  function maskKey(key: string) {
    if (!key || key.length < 8) return key;
    return key.substring(0, 8) + "•".repeat(key.length - 8);
  }

  // Function to check if Stripe is configured
  function isStripeConfigured() {
    return (
      data?.settings?.stripePublishableKey && data?.settings?.stripeSecretKey
    );
  }

  // Function to check if Opaybd is configured
  function isOpayConfigured() {
    return !!data?.settings?.opayApiKey;
  }

  // Get webhook URL for current domain
  function getWebhookUrl() {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/api/stripe/webhook`;
    }
    return "https://yourdomain.com/api/stripe/webhook";
  }

  // Get Opaybd callback URL for current domain
  function getOpayCallbackUrl() {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/api/opaybd/callback`;
    }
    return "https://yourdomain.com/api/opaybd/callback";
  }

  // Copy webhook URL to clipboard
  async function copyWebhookUrl() {
    try {
      await navigator.clipboard.writeText(getWebhookUrl());
      copiedWebhookUrl = true;
      setTimeout(() => {
        copiedWebhookUrl = false;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }
</script>

<svelte:head>
  <title>Payment Methods - Admin Settings</title>
</svelte:head>

<div class="space-y-4">
  <!-- Demo Mode Banner -->
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

  <!-- Page Header -->
  <div>
    <h1 class="text-xl font-semibold tracking-tight flex items-center gap-2">
      <CreditCardIcon class="w-6 h-6" />
      Payment Methods
    </h1>
    <p class="text-muted-foreground">
      Configure payment providers for subscription processing.
    </p>
  </div>

  <!-- Form -->
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
    <!-- Error Message -->
    {#if form?.error}
      <div
        class="p-3 text-sm text-destructive-foreground bg-destructive/10 border border-destructive/20 rounded-md"
      >
        {form.error}
      </div>
    {/if}

    <!-- Success Message -->
    {#if form?.success}
      <div
        class="p-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md"
      >
        Payment settings updated successfully!
      </div>
    {/if}

    <!-- Payment Provider Selection Card -->
    <Card.Root class="border-2 border-primary/20">
      <Card.Header>
        <Card.Title class="flex items-center gap-2">
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          Active Payment Provider
        </Card.Title>
        <Card.Description>
          Select which payment provider will be used for processing
          subscriptions
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <input type="hidden" name="activeProvider" value={activeProvider} />
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          {#each providerOptions as option}
            <button
              type="button"
              onclick={() => {
                if (!data.isDemoMode) activeProvider = option.value;
              }}
              class="relative flex text-left rounded-lg border p-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary {activeProvider ===
              option.value
                ? 'border-primary bg-primary/5'
                : 'border-muted'} {data.isDemoMode
                ? 'opacity-60 cursor-not-allowed'
                : 'cursor-pointer hover:border-primary/50'}"
              disabled={data.isDemoMode}
            >
              <div class="flex w-full items-center">
                <div class="flex items-center">
                  <div class="text-sm">
                    <p
                      class="font-medium {activeProvider === option.value
                        ? 'text-primary'
                        : ''}"
                    >
                      {option.label}
                    </p>
                    <p class="text-muted-foreground text-xs">
                      {option.description}
                    </p>
                  </div>
                </div>
              </div>
              {#if activeProvider === option.value}
                <CheckCircleIcon
                  class="absolute bottom-2 right-2 h-5 w-5 text-primary"
                />
              {/if}
              {#if option.value === "stripe" && isStripeConfigured()}
                <span
                  class="absolute top-2 right-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full"
                  >Configured</span
                >
              {:else if option.value === "opaybd" && isOpayConfigured()}
                <span
                  class="absolute top-2 right-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full"
                  >Configured</span
                >
              {/if}
            </button>
          {/each}
        </div>
        {#if activeProvider === "opaybd" && !isOpayConfigured()}
          <p class="mt-3 text-sm text-amber-600 flex items-center gap-1">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clip-rule="evenodd"
              ></path>
            </svg>
            Please configure Opaybd credentials below before saving
          </p>
        {/if}
      </Card.Content>
    </Card.Root>

    <!-- Stripe Configuration -->
    <Card.Root class={activeProvider === "stripe" ? "border-primary/30" : ""}>
      <Card.Header>
        <div class="flex items-center justify-between">
          <div>
            <Card.Title class="flex items-center gap-2">
              <CreditCardIcon class="w-5 h-5" />
              Stripe Configuration
              {#if activeProvider === "stripe"}
                <span
                  class="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full"
                  >Active</span
                >
              {/if}
            </Card.Title>
            <Card.Description
              >Configure your Stripe API keys for payment processing</Card.Description
            >
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onclick={() => (showStripeInstructions = !showStripeInstructions)}
          >
            {showStripeInstructions ? "Hide" : "Show"} Setup Guide
            <svg
              class="w-4 h-4 ml-1 transition-transform"
              class:rotate-180={showStripeInstructions}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              ></path>
            </svg>
          </Button>
        </div>
      </Card.Header>

      {#if showStripeInstructions}
        <Card.Content class="border-t bg-muted/30 space-y-4 py-2">
          <div class="text-sm space-y-3">
            <p class="font-medium">Quick Setup:</p>
            <ol
              class="list-decimal list-inside space-y-2 text-muted-foreground"
            >
              <li>
                Log in to your <a
                  href="https://dashboard.stripe.com"
                  target="_blank"
                  rel="noopener"
                  class="text-blue-600 hover:underline">Stripe Dashboard</a
                >
              </li>
              <li>
                Navigate to <strong>Developers</strong> →
                <strong>API keys</strong>
              </li>
              <li>
                Copy your Publishable key (<code class="bg-muted px-1 rounded"
                  >pk_test_</code
                >
                or <code class="bg-muted px-1 rounded">pk_live_</code>)
              </li>
              <li>
                Copy your Secret key (<code class="bg-muted px-1 rounded"
                  >sk_test_</code
                >
                or <code class="bg-muted px-1 rounded">sk_live_</code>)
              </li>
              <li>
                Set up a webhook endpoint at: <code
                  class="bg-muted px-1 rounded text-xs">{getWebhookUrl()}</code
                >
              </li>
              <li>
                Copy the webhook signing secret (<code
                  class="bg-muted px-1 rounded">whsec_</code
                >)
              </li>
            </ol>
          </div>
        </Card.Content>
      {/if}

      <Card.Content class="space-y-4">
        <!-- Environment Selection -->
        <div class="space-y-2">
          <Label for="environment">Environment</Label>
          <Select.Root
            type="single"
            name="environment"
            bind:value={selectedEnvironment}
            disabled={data.isDemoMode}
          >
            <Select.Trigger>
              {environmentLabel}
            </Select.Trigger>
            <Select.Content>
              {#each environmentOptions as option}
                <Select.Item value={option.value} label={option.label}>
                  {option.label}
                </Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
          <p class="text-xs text-muted-foreground">
            {selectedEnvironment === "test"
              ? "Use test keys for development and testing"
              : "Use live keys for production"}
          </p>
        </div>

        <!-- API Keys -->
        <div class="grid grid-cols-1 gap-4">
          <div class="space-y-2">
            <Label for="stripePublishableKey">Stripe Publishable Key</Label>
            <Input
              id="stripePublishableKey"
              name="stripePublishableKey"
              type="text"
              placeholder={selectedEnvironment === "test"
                ? "pk_test_..."
                : "pk_live_..."}
              bind:value={stripePublishableKey}
              class="font-mono"
              disabled={data.isDemoMode}
            />
            <p class="text-xs text-muted-foreground">
              Used in the frontend for creating payment elements
            </p>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <Label for="stripeSecretKey">Stripe Secret Key</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={() => (showSecretKey = !showSecretKey)}
                class="h-auto p-1"
                disabled={data.isDemoMode}
              >
                {#if showSecretKey}
                  <EyeOffIcon class="w-4 h-4" />
                {:else}
                  <EyeIcon class="w-4 h-4" />
                {/if}
              </Button>
            </div>
            <Input
              id="stripeSecretKey"
              name="stripeSecretKey"
              type={showSecretKey ? "text" : "password"}
              placeholder={selectedEnvironment === "test"
                ? "sk_test_..."
                : "sk_live_..."}
              bind:value={stripeSecretKey}
              class="font-mono"
              disabled={data.isDemoMode}
            />
            <p class="text-xs text-muted-foreground">
              Used on the server for API calls (encrypted)
            </p>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <Label for="stripeWebhookSecret">Stripe Webhook Secret</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={() => (showWebhookSecret = !showWebhookSecret)}
                class="h-auto p-1"
                disabled={data.isDemoMode}
              >
                {#if showWebhookSecret}
                  <EyeOffIcon class="w-4 h-4" />
                {:else}
                  <EyeIcon class="w-4 h-4" />
                {/if}
              </Button>
            </div>
            <Input
              id="stripeWebhookSecret"
              name="stripeWebhookSecret"
              type={showWebhookSecret ? "text" : "password"}
              placeholder="whsec_..."
              bind:value={stripeWebhookSecret}
              class="font-mono"
              disabled={data.isDemoMode}
            />
            <p class="text-xs text-muted-foreground">
              Used to verify webhook events from Stripe (encrypted)
            </p>
          </div>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Opaybd Configuration -->
    <Card.Root class={activeProvider === "opaybd" ? "border-primary/30" : ""}>
      <Card.Header>
        <div class="flex items-center justify-between">
          <div>
            <Card.Title class="flex items-center gap-2">
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                ></path>
              </svg>
              Opaybd Configuration
              {#if activeProvider === "opaybd"}
                <span
                  class="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full"
                  >Active</span
                >
              {/if}
            </Card.Title>
            <Card.Description
              >Configure Opaybd for local Bangladesh payment methods</Card.Description
            >
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onclick={() => (showOpayInstructions = !showOpayInstructions)}
          >
            {showOpayInstructions ? "Hide" : "Show"} Setup Guide
            <svg
              class="w-4 h-4 ml-1 transition-transform"
              class:rotate-180={showOpayInstructions}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              ></path>
            </svg>
          </Button>
        </div>
      </Card.Header>

      {#if showOpayInstructions}
        <Card.Content class="border-t bg-muted/30 space-y-4 py-2">
          <div class="text-sm space-y-3">
            <p class="font-medium">Quick Setup:</p>
            <ol
              class="list-decimal list-inside space-y-2 text-muted-foreground"
            >
              <li>
                Set up your callback URL: <code
                  class="bg-muted px-1 rounded text-xs"
                  >{getOpayCallbackUrl()}</code
                >
              </li>
            </ol>
            <div
              class="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md"
            >
              <p class="text-amber-700 dark:text-amber-400 text-xs">
                <strong>Note:</strong> Opaybd uses one-time payments. Subscriptions
                are managed by tracking expiry dates and prompting users to renew.
              </p>
            </div>
          </div>
        </Card.Content>
      {/if}

      <Card.Content class="space-y-4">
        <!-- Opaybd API Keys -->
        <div class="grid grid-cols-1 gap-4">
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <Label for="opayApiKey">Opaybd API Key</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={() => (showOpayApiKey = !showOpayApiKey)}
                class="h-auto p-1"
                disabled={data.isDemoMode}
              >
                {#if showOpayApiKey}
                  <EyeOffIcon class="w-4 h-4" />
                {:else}
                  <EyeIcon class="w-4 h-4" />
                {/if}
              </Button>
            </div>
            <Input
              id="opayApiKey"
              name="opayApiKey"
              type={showOpayApiKey ? "text" : "password"}
              placeholder="Your API key..."
              bind:value={opayApiKey}
              class="font-mono"
              disabled={data.isDemoMode}
            />
            <p class="text-xs text-muted-foreground">
              Your Opaybd API key (encrypted)
            </p>
          </div>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Submit Button -->
    <div class="space-y-2">
      <div class="flex justify-end">
        <Button type="submit" disabled={isSubmitting || data.isDemoMode}>
          {isSubmitting
            ? "Saving..."
            : data.isDemoMode
              ? "Demo Mode - Read Only"
              : "Save Payment Settings"}
        </Button>
      </div>
      {#if data.isDemoMode}
        <p class="text-xs text-muted-foreground text-right">
          Saving is disabled in demo mode. This is a read-only demonstration.
        </p>
      {/if}
    </div>
  </form>
</div>
