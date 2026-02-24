import type { Actions, PageServerLoad } from './$types'
import { db, pricingPlans } from '$lib/server/db'
import { count } from 'drizzle-orm'
import { isDemoModeEnabled, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js'
import { fail, redirect } from '@sveltejs/kit'

const PLANS_PER_PAGE = 15

export const load: PageServerLoad = async ({ url }) => {
  // Get page number from URL params, default to 1
  const page = parseInt(url.searchParams.get('page') || '1')
  const offset = (page - 1) * PLANS_PER_PAGE

  // Get total count of plans
  const totalPlansResult = await db
    .select({ count: count() })
    .from(pricingPlans)

  const totalPlans = totalPlansResult[0].count

  // Fetch paginated plans
  const paginatedPlans = await db
    .select({
      id: pricingPlans.id,
      name: pricingPlans.name,
      tier: pricingPlans.tier,
      priceAmount: pricingPlans.priceAmount,
      currency: pricingPlans.currency,
      billingInterval: pricingPlans.billingInterval,
      textGenerationLimit: pricingPlans.textGenerationLimit,
      imageGenerationLimit: pricingPlans.imageGenerationLimit,
      videoGenerationLimit: pricingPlans.videoGenerationLimit,
      audioGenerationLimit: pricingPlans.audioGenerationLimit,
      features: pricingPlans.features,
      isActive: pricingPlans.isActive,
      createdAt: pricingPlans.createdAt,
      updatedAt: pricingPlans.updatedAt
    })
    .from(pricingPlans)
    .orderBy(pricingPlans.tier, pricingPlans.name) // Sort by tier first, then name
    .limit(PLANS_PER_PAGE)
    .offset(offset)

  return {
    plans: paginatedPlans,
    totalPlans,
    currentPage: page,
    plansPerPage: PLANS_PER_PAGE,
    totalPages: Math.ceil(totalPlans / PLANS_PER_PAGE),
    isDemoMode: isDemoModeEnabled()
  }
}

export const actions: Actions = {
  seedFreePlan: async () => {
    // Check demo mode - block modifications
    if (isDemoModeEnabled()) {
      return fail(403, {
        error: DEMO_MODE_MESSAGES.ADMIN_SAVE_DISABLED
      });
    }

    try {
      await db.insert(pricingPlans).values({
        name: 'Free plan',
        tier: 'free',
        stripePriceId: 'free_plan_default',
        priceAmount: 0,
        currency: 'usd',
        billingInterval: 'month',
        textGenerationLimit: 50,
        imageGenerationLimit: 25,
        videoGenerationLimit: 10,
        audioGenerationLimit: 10,
        features: ['Free plan'],
        isActive: true
      });

      throw redirect(303, '/admin/settings/plans');
    } catch (error) {
      // Check if this is a redirect response
      if (error instanceof Response || (error && typeof error === 'object' && 'status' in error && error.status === 303)) {
        throw error;
      }

      console.error('Error seeding free plan:', error);
      return fail(500, {
        error: 'Failed to seed free plan'
      });
    }
  }
}