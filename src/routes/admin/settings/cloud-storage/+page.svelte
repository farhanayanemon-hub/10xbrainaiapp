<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { enhance } from "$app/forms";

  // Import icons
  import {
    CloudIcon,
    AlertTriangleIcon,
    EyeIcon,
    EyeOffIcon,
  } from "$lib/icons/index.js";

  let { form, data } = $props();

  // Form state
  let isSubmitting = $state(false);
  let showAccountId = $state(false);
  let showAccessKeyId = $state(false);
  let showSecretAccessKey = $state(false);

  // Reactive form values - initialize with current settings or form data
  let r2AccountId = $state(
    form?.r2AccountId || data?.settings?.r2AccountId || ""
  );
  let r2AccessKeyId = $state(
    form?.r2AccessKeyId || data?.settings?.r2AccessKeyId || ""
  );
  let r2SecretAccessKey = $state(
    form?.r2SecretAccessKey || data?.settings?.r2SecretAccessKey || ""
  );
  let r2BucketName = $state(
    form?.r2BucketName || data?.settings?.r2BucketName || ""
  );
  let r2BrandingBucketName = $state(
    form?.r2BrandingBucketName || data?.settings?.r2BrandingBucketName || ""
  );
  let r2BrandingPublicUrl = $state(
    form?.r2BrandingPublicUrl || data?.settings?.r2BrandingPublicUrl || ""
  );

  // State sync effect
  $effect(() => {
    // Update reactive state when data changes (e.g., on page refresh or form reset)
    if (data?.settings && !form) {
      r2AccountId = data.settings.r2AccountId || "";
      r2AccessKeyId = data.settings.r2AccessKeyId || "";
      r2SecretAccessKey = data.settings.r2SecretAccessKey || "";
      r2BucketName = data.settings.r2BucketName || "";
      r2BrandingBucketName = data.settings.r2BrandingBucketName || "";
      r2BrandingPublicUrl = data.settings.r2BrandingPublicUrl || "";
    }

    // Update from form state if there was a validation error
    if (form) {
      r2AccountId = form.r2AccountId || "";
      r2AccessKeyId = form.r2AccessKeyId || "";
      r2SecretAccessKey = form.r2SecretAccessKey || "";
      r2BucketName = form.r2BucketName || "";
      r2BrandingBucketName = form.r2BrandingBucketName || "";
      r2BrandingPublicUrl = form.r2BrandingPublicUrl || "";
    }
  });

  // Check if all R2 credentials are configured (for status display)
  const hasCredentials = $derived(
    (r2AccountId &&
      r2AccessKeyId &&
      r2SecretAccessKey &&
      r2BucketName &&
      r2BrandingBucketName &&
      r2BrandingPublicUrl) ||
      (data?.settings?.r2AccountId &&
        data?.settings?.r2AccessKeyId &&
        data?.settings?.r2SecretAccessKey &&
        data?.settings?.r2BucketName &&
        data?.settings?.r2BrandingBucketName &&
        data?.settings?.r2BrandingPublicUrl)
  );
</script>

<svelte:head>
  <title>Cloud Storage Settings - Admin</title>
</svelte:head>

<div class="max-w-4xl">
  <!-- Demo Mode Banner -->
  {#if data.isDemoMode}
    <div
      class="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-md mb-4"
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

  <!-- Header -->
  <div class="space-y-4">
    <div>
      <h1 class="text-xl font-semibold tracking-tight flex items-center gap-2">
        <CloudIcon class="w-6 h-6" />
        Cloud Storage Settings
      </h1>
      <p class="text-muted-foreground">
        Configure Cloudflare R2 object storage for media files.
      </p>
    </div>
  </div>

  <!-- Storage Status Info -->
  <Card.Root class="my-4">
    <Card.Header>
      <Card.Title class="text-lg">Current Storage Configuration</Card.Title>
    </Card.Header>
    <Card.Content>
      <div class="space-y-2">
        <div class="text-sm">
          <strong>Fallback Order:</strong>
        </div>
        <ol
          class="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-4"
        >
          <li>
            Admin Dashboard Settings (this page) - {hasCredentials
              ? "✅ Configured"
              : "❌ Not configured"}
          </li>
          <li>Environment Variables (.env file)</li>
          <li>
            Local Storage (static folder) - Always enabled (not available for
            serverless platforms e.g. Vercel)
          </li>
        </ol>
      </div>
    </Card.Content>
  </Card.Root>

  <!-- Success/Error Messages -->
  {#if form?.success}
    <Card.Root class="mb-6 border-green-200 bg-green-50">
      <Card.Content class="pt-6">
        <p class="text-green-800">
          Cloud storage settings saved successfully! Changes will take effect on
          the next file upload.
        </p>
      </Card.Content>
    </Card.Root>
  {/if}

  {#if form?.error}
    <Card.Root class="mb-6 border-red-200 bg-red-50">
      <Card.Content class="pt-6">
        <div class="flex items-center gap-2">
          <AlertTriangleIcon class="h-4 w-4 text-red-600" />
          <p class="text-red-800 font-semibold">Error</p>
        </div>
        <p class="text-red-700 mt-2">{form.error}</p>
      </Card.Content>
    </Card.Root>
  {/if}

  <!-- Cloud Storage Settings Form -->
  <form
    method="POST"
    action="?/update"
    use:enhance={() => {
      isSubmitting = true;
      return ({ update }) => {
        update().finally(() => {
          isSubmitting = false;
        });
      };
    }}
  >
    <Card.Root>
      <Card.Header>
        <Card.Title>Cloudflare R2 Configuration</Card.Title>
        <Card.Description>
          Configure your Cloudflare R2 credentials. Get these from your
          Cloudflare dashboard > R2 Object Storage > Manage R2 API tokens.
        </Card.Description>
      </Card.Header>
      <Card.Content class="space-y-6">
        <!-- Account ID -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label for="r2AccountId">Account ID *</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onclick={() => (showAccountId = !showAccountId)}
              class="h-auto p-1"
              disabled={data.isDemoMode}
            >
              {#if showAccountId}
                <EyeOffIcon class="w-4 h-4" />
              {:else}
                <EyeIcon class="w-4 h-4" />
              {/if}
            </Button>
          </div>
          <Input
            id="r2AccountId"
            name="r2AccountId"
            type={showAccountId ? "text" : "password"}
            bind:value={r2AccountId}
            placeholder="your-cloudflare-account-id"
            required
            disabled={data.isDemoMode}
          />
          <p class="text-xs text-muted-foreground">
            Your Cloudflare Account ID (stored encrypted in database)
          </p>
        </div>

        <!-- Access Key ID -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label for="r2AccessKeyId">Access Key ID *</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onclick={() => (showAccessKeyId = !showAccessKeyId)}
              class="h-auto p-1"
              disabled={data.isDemoMode}
            >
              {#if showAccessKeyId}
                <EyeOffIcon class="w-4 h-4" />
              {:else}
                <EyeIcon class="w-4 h-4" />
              {/if}
            </Button>
          </div>
          <Input
            id="r2AccessKeyId"
            name="r2AccessKeyId"
            type={showAccessKeyId ? "text" : "password"}
            bind:value={r2AccessKeyId}
            placeholder="your-r2-access-key-id"
            required
            disabled={data.isDemoMode}
          />
          <p class="text-xs text-muted-foreground">
            R2 API token Access Key ID (stored encrypted in database)
          </p>
        </div>

        <!-- Secret Access Key -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label for="r2SecretAccessKey">Secret Access Key *</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onclick={() => (showSecretAccessKey = !showSecretAccessKey)}
              class="h-auto p-1"
              disabled={data.isDemoMode}
            >
              {#if showSecretAccessKey}
                <EyeOffIcon class="w-4 h-4" />
              {:else}
                <EyeIcon class="w-4 h-4" />
              {/if}
            </Button>
          </div>
          <Input
            id="r2SecretAccessKey"
            name="r2SecretAccessKey"
            type={showSecretAccessKey ? "text" : "password"}
            bind:value={r2SecretAccessKey}
            placeholder="your-r2-secret-access-key"
            required
            disabled={data.isDemoMode}
          />
          <p class="text-xs text-muted-foreground">
            R2 API token Secret Access Key (stored encrypted in database)
          </p>
        </div>

        <!-- Bucket Name -->
        <div class="space-y-2">
          <Label for="r2BucketName">Bucket Name *</Label>
          <Input
            id="r2BucketName"
            name="r2BucketName"
            type="text"
            bind:value={r2BucketName}
            placeholder="your-r2-bucket-name"
            required
            disabled={data.isDemoMode}
          />
          <p class="text-xs text-muted-foreground">
            The name of your R2 bucket where files will be stored
          </p>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Public Branding Bucket Section -->
    <Card.Root class="mt-4">
      <Card.Header>
        <Card.Title>Public Branding Bucket</Card.Title>
        <Card.Description>
          Configure a separate public bucket for logo and favicon files.
        </Card.Description>
      </Card.Header>
      <Card.Content class="space-y-6">
        <!-- Branding Bucket Info -->
        <div class="p-4 bg-muted/50 rounded-lg">
          <div class="flex items-start gap-2">
            <svg
              class="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clip-rule="evenodd"
              ></path>
            </svg>
            <div class="space-y-1 text-sm text-muted-foreground">
              <p class="font-medium">
                Why is a separate branding bucket required?
              </p>
              <ul class="list-disc list-inside space-y-0.5 ml-2">
                <li>Logo and favicon URLs are not pre-signed</li>
                <li>Bucket must have public access enabled in Cloudflare R2</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Branding Bucket Name -->
        <div class="space-y-2">
          <Label for="r2BrandingBucketName">Branding Bucket Name *</Label>
          <Input
            id="r2BrandingBucketName"
            name="r2BrandingBucketName"
            type="text"
            bind:value={r2BrandingBucketName}
            placeholder="your-branding-bucket-name"
            required
            disabled={data.isDemoMode}
          />
          <p class="text-xs text-muted-foreground">
            The name of your public R2 bucket
          </p>
        </div>

        <!-- Branding Public URL -->
        <div class="space-y-2">
          <Label for="r2BrandingPublicUrl">Branding Public URL *</Label>
          <Input
            id="r2BrandingPublicUrl"
            name="r2BrandingPublicUrl"
            type="url"
            bind:value={r2BrandingPublicUrl}
            placeholder="https://your-branding-domain-url"
            required
            disabled={data.isDemoMode}
          />
          <p class="text-xs text-muted-foreground">
            The public URL for accessing the branding files (app logo & favicon)
          </p>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Button positioned outside the card -->
    <div class="mt-4 space-y-2">
      <div class="flex justify-end">
        <Button
          type="submit"
          disabled={isSubmitting || data.isDemoMode}
          class="w-full sm:w-auto"
        >
          {isSubmitting
            ? "Saving..."
            : data.isDemoMode
              ? "Demo Mode - Read Only"
              : "Save Cloud Storage Settings"}
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
