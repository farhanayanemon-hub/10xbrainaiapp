import type { PageServerLoad } from './$types'
import { redirect } from '@sveltejs/kit'
import { getLandingSettings } from '$lib/server/admin-settings.js'
import { getPricingPlans } from '$lib/server/pricing-plans-seeder.js'

export const load: PageServerLoad = async ({ locals }) => {
  const defaultPage = locals.settings?.defaultPage || 'landing'

  if (defaultPage === 'app') {
    throw redirect(302, '/newchat')
  }

  const [landing, plans] = await Promise.all([
    getLandingSettings(),
    getPricingPlans('month')
  ])

  return { landing, plans }
}
