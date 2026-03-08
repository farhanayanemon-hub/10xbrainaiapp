import type { LayoutServerLoad } from './$types'
import { isDemoModeEnabled } from '$lib/constants/demo-mode.js'
import { toPublicSettings } from '$lib/server/settings-store'
import { PaymentRouter } from '$lib/server/payment-router.js'

export const load: LayoutServerLoad = async ({ locals }) => {
  const session = await locals.auth()

  // Get admin default settings from cached settings (loaded by settingsHandle in hooks)
  // This eliminates the database call on every page load
  const cachedSettings = locals.settings;
  const adminDefaults = {
    theme: cachedSettings?.defaultTheme || 'dark',
    language: cachedSettings?.defaultLanguage || 'en'
  };

  let renewalInfo = null;
  if (session?.user?.id) {
    try {
      const renewal = await PaymentRouter.checkRenewalRequired(session.user.id);
      if (renewal) {
        renewalInfo = {
          needsRenewal: true,
          planTier: renewal.planTier,
          daysRemaining: renewal.daysRemaining,
          expiresAt: renewal.expiresAt
        };
      }
    } catch (error) {
      console.error('Error checking renewal status:', error);
    }
  }

  return {
    session,
    // SECURITY: Only pass client-safe fields to the browser.
    // Server secrets (API keys, OAuth secrets, storage credentials) are filtered out.
    settings: toPublicSettings(locals.settings),
    adminDefaults,
    isDemoMode: isDemoModeEnabled(),
    renewalInfo
  }
}