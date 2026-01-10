import type { Actions, PageServerLoad } from './$types'
import { fail } from '@sveltejs/kit'
import { getGeneralSettings, adminSettingsService } from '$lib/server/admin-settings'
import { settingsStore } from '$lib/server/settings-store'
import { isDemoModeEnabled, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js'

export const load: PageServerLoad = async () => {
  try {
    const [generalSettings, aiModelSettings] = await Promise.all([
      getGeneralSettings(),
      adminSettingsService.getSettingsByCategory('ai_models')
    ]);

    // Provide default values if settings don't exist
    return {
      settings: {
        siteName: generalSettings.site_name || "AI Chat Interface",
        siteTitle: generalSettings.site_title || "AI Chat Interface - 65+ Models",
        siteDescription: generalSettings.site_description || "A unified web application for interacting with 65+ AI models from 9 different providers through a single, intuitive interface.",
        defaultLanguage: generalSettings.default_language || "en",
        defaultTheme: generalSettings.default_theme || "dark",
        defaultPage: generalSettings.default_page || "landing",
        openrouterSystemPrompt: aiModelSettings.openrouter_system_prompt || ""
      },
      isDemoMode: isDemoModeEnabled()
    }
  } catch (error) {
    console.error('Failed to load general settings:', error);
    // Fallback to default values
    return {
      settings: {
        siteName: "AI Chat Interface",
        siteTitle: "AI Chat Interface - 65+ Models",
        siteDescription: "A unified web application for interacting with 65+ AI models from 9 different providers through a single, intuitive interface.",
        defaultLanguage: "en",
        defaultTheme: "dark",
        defaultPage: "landing",
        openrouterSystemPrompt: ""
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

    const siteName = data.get('siteName')?.toString()
    const siteTitle = data.get('siteTitle')?.toString()
    const siteDescription = data.get('siteDescription')?.toString()
    const defaultLanguage = data.get('defaultLanguage')?.toString()
    const defaultTheme = data.get('defaultTheme')?.toString()
    const defaultPage = data.get('defaultPage')?.toString()
    const openrouterSystemPrompt = data.get('openrouterSystemPrompt')?.toString()

    // Basic validation
    if (!siteName || !siteTitle) {
      return fail(400, {
        error: 'Site name and title are required',
        siteName,
        siteTitle,
        siteDescription,
        defaultLanguage,
        defaultTheme,
        defaultPage,
        openrouterSystemPrompt
      })
    }

    // Validate system prompt length (max 4000 characters)
    if (openrouterSystemPrompt && openrouterSystemPrompt.length > 4000) {
      return fail(400, {
        error: 'System prompt must be 4000 characters or less',
        siteName,
        siteTitle,
        siteDescription,
        defaultLanguage,
        defaultTheme,
        defaultPage,
        openrouterSystemPrompt
      })
    }

    // Validate language (must be 'en' or 'de')
    if (defaultLanguage && !['en', 'de'].includes(defaultLanguage)) {
      return fail(400, {
        error: 'Invalid language selection',
        siteName,
        siteTitle,
        siteDescription,
        defaultLanguage,
        defaultTheme,
        defaultPage,
        openrouterSystemPrompt
      })
    }

    // Validate theme (must be 'light', 'dark', or 'system')
    if (defaultTheme && !['light', 'dark', 'system'].includes(defaultTheme)) {
      return fail(400, {
        error: 'Invalid theme selection',
        siteName,
        siteTitle,
        siteDescription,
        defaultLanguage,
        defaultTheme,
        defaultPage,
        openrouterSystemPrompt
      })
    }

    // Validate default page (must be 'landing' or 'app')
    if (defaultPage && !['landing', 'app'].includes(defaultPage)) {
      return fail(400, {
        error: 'Invalid default page selection',
        siteName,
        siteTitle,
        siteDescription,
        defaultLanguage,
        defaultTheme,
        defaultPage,
        openrouterSystemPrompt
      })
    }

    try {
      // Get current values to compare and only save changed settings
      const [currentSettings, currentAISettings] = await Promise.all([
        getGeneralSettings(),
        adminSettingsService.getSettingsByCategory('ai_models')
      ]);

      // Helper function to check if value should be saved (for non-empty values)
      const shouldSaveValue = (newValue: string | undefined, currentValue: string | undefined) => {
        // Only save if we have a non-empty new value that's different from current
        const trimmedNew = (newValue || '').trim();
        const trimmedCurrent = (currentValue || '').trim();
        return trimmedNew && trimmedNew !== trimmedCurrent;
      };

      // Only save settings that have actually changed
      const settingsToSave = [];

      if (shouldSaveValue(siteName, currentSettings.site_name)) {
        settingsToSave.push({ key: 'site_name', value: siteName!.trim(), category: 'general', description: 'The name displayed in the browser tab and throughout the app' });
      }
      if (shouldSaveValue(siteTitle, currentSettings.site_title)) {
        settingsToSave.push({ key: 'site_title', value: siteTitle!.trim(), category: 'general', description: 'SEO title used in meta tags' });
      }
      if (shouldSaveValue(siteDescription, currentSettings.site_description)) {
        settingsToSave.push({ key: 'site_description', value: siteDescription!.trim(), category: 'general', description: 'Used for SEO meta descriptions and site information' });
      }
      if (shouldSaveValue(defaultLanguage, currentSettings.default_language)) {
        settingsToSave.push({ key: 'default_language', value: defaultLanguage!.trim(), category: 'general', description: 'Default language for new users' });
      }
      if (shouldSaveValue(defaultTheme, currentSettings.default_theme)) {
        settingsToSave.push({ key: 'default_theme', value: defaultTheme!.trim(), category: 'general', description: 'Default theme mode for new users' });
      }
      if (shouldSaveValue(defaultPage, currentSettings.default_page)) {
        settingsToSave.push({ key: 'default_page', value: defaultPage!.trim(), category: 'general', description: 'Default page when visiting the root URL' });
      }

      // Handle system prompt - stored in ai_models category (allows empty to clear/disable)
      const trimmedSystemPrompt = (openrouterSystemPrompt || '').trim();
      const currentSystemPrompt = (currentAISettings.openrouter_system_prompt || '').trim();

      if (trimmedSystemPrompt !== currentSystemPrompt) {
        if (trimmedSystemPrompt) {
          // Non-empty: save the new value
          settingsToSave.push({
            key: 'openrouter_system_prompt',
            value: trimmedSystemPrompt,
            category: 'ai_models',
            description: 'Global system prompt applied to all OpenRouter model conversations'
          });
        } else if (currentSystemPrompt) {
          // Empty but had a value before: delete the setting to clear it
          await adminSettingsService.deleteSetting('openrouter_system_prompt');
        }
      }

      // Only save if there are actual changes
      if (settingsToSave.length > 0) {
        await adminSettingsService.setSettings(settingsToSave);
      }

      // Clear the settings cache to force refresh on next request
      settingsStore.clearCache();

      console.log('General settings saved successfully');

      // Get updated settings to return current values
      const [updatedSettings, updatedAISettings] = await Promise.all([
        getGeneralSettings(),
        adminSettingsService.getSettingsByCategory('ai_models')
      ]);

      return {
        success: true,
        siteName: updatedSettings.site_name || '',
        siteTitle: updatedSettings.site_title || '',
        siteDescription: updatedSettings.site_description || '',
        defaultLanguage: updatedSettings.default_language || 'en',
        defaultTheme: updatedSettings.default_theme || 'dark',
        defaultPage: updatedSettings.default_page || 'landing',
        openrouterSystemPrompt: updatedAISettings.openrouter_system_prompt || ''
      }
    } catch (error) {
      console.error('Error saving general settings:', error)
      return fail(500, {
        error: 'Failed to save settings. Please try again.',
        siteName,
        siteTitle,
        siteDescription,
        defaultLanguage,
        defaultTheme,
        defaultPage,
        openrouterSystemPrompt
      })
    }
  }
}