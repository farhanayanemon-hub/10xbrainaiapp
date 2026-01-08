import type { LayoutServerLoad } from './$types'
import { isDemoModeEnabled } from '$lib/constants/demo-mode.js'
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

  // Check if user needs to renew their Opaybd subscription
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
    // Pass settings from locals to all pages
    settings: locals.settings,
    adminDefaults,
    isDemoMode: isDemoModeEnabled(),
    renewalInfo
  }
}