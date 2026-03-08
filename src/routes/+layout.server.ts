import type { LayoutServerLoad } from './$types'
import { isDemoModeEnabled } from '$lib/constants/demo-mode.js'
import { toPublicSettings } from '$lib/server/settings-store'

export const load: LayoutServerLoad = async ({ locals }) => {
  const session = await locals.auth()

  // Get admin default settings from cached settings (loaded by settingsHandle in hooks)
  // This eliminates the database call on every page load
  const cachedSettings = locals.settings;
  const adminDefaults = {
    theme: cachedSettings?.defaultTheme || 'dark',
    language: cachedSettings?.defaultLanguage || 'en'
  };

  return {
    session,
    // SECURITY: Only pass client-safe fields to the browser.
    // Server secrets (API keys, OAuth secrets, storage credentials) are filtered out.
    settings: toPublicSettings(locals.settings),
    adminDefaults,
    isDemoMode: isDemoModeEnabled()
  }
}