import type { Actions, PageServerLoad } from './$types'
import { fail } from '@sveltejs/kit'
import { getPaymentSettings, adminSettingsService } from '$lib/server/admin-settings'
import { settingsStore, getOpaySettings, getActivePaymentProvider } from '$lib/server/settings-store'
import { isDemoModeEnabled, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js'

export const load: PageServerLoad = async () => {
  try {
    const settings = await getPaymentSettings();
    const opaySettings = await getOpaySettings();
    const activeProvider = await getActivePaymentProvider();

    return {
      settings: {
        // Active provider selection
        activeProvider: activeProvider || "stripe",
        // Stripe settings
        environment: settings.environment || "test",
        stripePublishableKey: settings.stripe_publishable_key || "",
        stripeSecretKey: settings.stripe_secret_key || "",
        stripeWebhookSecret: settings.stripe_webhook_secret || "",
        // Opaybd settings
        opayApiKey: opaySettings.apiKey || ""
      },
      isDemoMode: isDemoModeEnabled()
    }
  } catch (error) {
    console.error('Failed to load payment settings:', error);
    // Fallback to default values
    return {
      settings: {
        activeProvider: "stripe",
        environment: "test",
        stripePublishableKey: "",
        stripeSecretKey: "",
        stripeWebhookSecret: "",
        opayApiKey: ""
      },
      isDemoMode: isDemoModeEnabled()
    }
  }
}

export const actions: Actions = {
  update: async ({ request }) => {
    // Check demo mode - block modifications
    if (isDemoModeEnabled()) {
      return fail(403, {
        error: DEMO_MODE_MESSAGES.ADMIN_SAVE_DISABLED
      });
    }

    const data = await request.formData()

    // Get all form values
    const activeProvider = data.get('activeProvider')?.toString()
    const environment = data.get('environment')?.toString()
    const stripePublishableKey = data.get('stripePublishableKey')?.toString()
    const stripeSecretKey = data.get('stripeSecretKey')?.toString()
    const stripeWebhookSecret = data.get('stripeWebhookSecret')?.toString()
    const opayApiKey = data.get('opayApiKey')?.toString()

    // Validate active provider
    if (!activeProvider || !['stripe', 'opaybd'].includes(activeProvider)) {
      return fail(400, {
        error: 'Invalid payment provider selection'
      })
    }

    // Basic validation for Stripe environment
    if (!environment || !['test', 'live'].includes(environment)) {
      return fail(400, {
        error: 'Invalid Stripe environment selection'
      })
    }

    // Validate Stripe keys format (only if provided)
    if (stripePublishableKey && !stripePublishableKey.startsWith(environment === 'test' ? 'pk_test_' : 'pk_live_')) {
      return fail(400, {
        error: `Stripe publishable key must start with ${environment === 'test' ? 'pk_test_' : 'pk_live_'}`
      })
    }

    if (stripeSecretKey && !stripeSecretKey.startsWith(environment === 'test' ? 'sk_test_' : 'sk_live_')) {
      return fail(400, {
        error: `Stripe secret key must start with ${environment === 'test' ? 'sk_test_' : 'sk_live_'}`
      })
    }

    if (stripeWebhookSecret && !stripeWebhookSecret.startsWith('whsec_')) {
      return fail(400, {
        error: 'Stripe webhook secret must start with whsec_'
      })
    }

    // Validate that Opaybd credentials are provided if Opaybd is selected as active provider
    if (activeProvider === 'opaybd') {
      if (!opayApiKey) {
        return fail(400, {
          error: 'Opaybd API Key is required when Opaybd is the active provider'
        })
      }
    }

    try {
      // Get current decrypted values to compare and prevent double encryption
      const currentSettings = await getPaymentSettings();
      const currentOpaySettings = await getOpaySettings();
      const currentActiveProvider = await getActivePaymentProvider();

      // Helper function to check if value should be saved
      const shouldSaveValue = (newValue: string | undefined, currentValue: string | undefined) => {
        const trimmedNew = (newValue || '').trim();
        const trimmedCurrent = (currentValue || '').trim();
        return trimmedNew && trimmedNew !== trimmedCurrent;
      };

      // Only save settings that have actually changed to prevent double encryption
      const settingsToSave = [];

      // Save active provider if changed
      if (activeProvider && activeProvider !== currentActiveProvider) {
        settingsToSave.push({ key: 'active_payment_provider', value: activeProvider, category: 'payment', description: 'Active payment provider (stripe or opaybd)' });
      }

      // Save Stripe environment if changed
      if (environment && environment !== (currentSettings.environment || '')) {
        settingsToSave.push({ key: 'environment', value: environment, category: 'payment', description: 'Stripe environment (test or live)' });
      }

      // Save Stripe keys that have changed
      if (shouldSaveValue(stripePublishableKey, currentSettings.stripe_publishable_key)) {
        settingsToSave.push({ key: 'stripe_publishable_key', value: stripePublishableKey!.trim(), category: 'payment', description: 'Stripe publishable key for frontend' });
      }
      if (shouldSaveValue(stripeSecretKey, currentSettings.stripe_secret_key)) {
        settingsToSave.push({ key: 'stripe_secret_key', value: stripeSecretKey!.trim(), category: 'payment', description: 'Stripe secret key for server-side API calls (encrypted)' });
      }
      if (shouldSaveValue(stripeWebhookSecret, currentSettings.stripe_webhook_secret)) {
        settingsToSave.push({ key: 'stripe_webhook_secret', value: stripeWebhookSecret!.trim(), category: 'payment', description: 'Stripe webhook secret for event verification (encrypted)' });
      }

      // Save Opaybd API key if changed
      if (shouldSaveValue(opayApiKey, currentOpaySettings.apiKey)) {
        settingsToSave.push({ key: 'opay_api_key', value: opayApiKey!.trim(), category: 'payment', description: 'Opaybd API key (encrypted)' });
      }

      // Only save if there are actual changes
      if (settingsToSave.length > 0) {
        await adminSettingsService.setSettings(settingsToSave);
      }

      // Clear the settings cache to force refresh on next request
      settingsStore.clearCache();

      console.log('Payment settings saved successfully');

      // Get updated settings to return current values
      const updatedSettings = await getPaymentSettings();
      const updatedOpaySettings = await getOpaySettings();
      const updatedActiveProvider = await getActivePaymentProvider();

      return {
        success: true,
        activeProvider: updatedActiveProvider,
        environment: updatedSettings.environment || 'test',
        stripePublishableKey: updatedSettings.stripe_publishable_key || '',
        stripeSecretKey: updatedSettings.stripe_secret_key || '',
        stripeWebhookSecret: updatedSettings.stripe_webhook_secret || '',
        opayApiKey: updatedOpaySettings.apiKey || ''
      }
    } catch (error) {
      console.error('Error saving payment settings:', error)
      return fail(500, {
        error: 'Failed to save payment settings. Please try again.'
      })
    }
  }
}