import type { Actions, PageServerLoad } from './$types'
import { db, pricingPlans } from '$lib/server/db'
import { eq } from 'drizzle-orm'
import { fail, redirect, error } from '@sveltejs/kit'
import { isDemoModeEnabled, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js'

export const load: PageServerLoad = async ({ params }) => {
  const planId = params.id
  
  if (!planId) {
    throw error(404, 'Plan not found')
  }

  const plan = await db
    .select()
    .from(pricingPlans)
    .where(eq(pricingPlans.id, planId))
    .limit(1)

  if (plan.length === 0) {
    throw error(404, 'Plan not found')
  }

  return {
    plan: plan[0],
    isDemoMode: isDemoModeEnabled()
  }
}

export const actions: Actions = {
  update: async ({ request, params }) => {
    // Check demo mode - block modifications
    if (isDemoModeEnabled()) {
      return fail(403, {
        error: DEMO_MODE_MESSAGES.ADMIN_SAVE_DISABLED
      });
    }

    const planId = params.id

    if (!planId) {
      throw error(404, 'Plan not found')
    }

    const data = await request.formData()
    
    const name = data.get('name')?.toString()
    const tier = data.get('tier')?.toString()
    const stripePriceId = data.get('stripePriceId')?.toString()
    const priceAmount = data.get('priceAmount')?.toString()
    const priceAmountBdt = data.get('priceAmountBdt')?.toString()
    const currency = data.get('currency')?.toString() || 'usd'
    const billingInterval = data.get('billingInterval')?.toString()
    const textGenerationLimit = data.get('textGenerationLimit')?.toString()
    const imageGenerationLimit = data.get('imageGenerationLimit')?.toString()
    const videoGenerationLimit = data.get('videoGenerationLimit')?.toString()
    const audioGenerationLimit = data.get('audioGenerationLimit')?.toString()
    const features = data.get('features')?.toString()
    const isActive = data.get('isActive') === 'on'

    // Validation
    if (!name || !tier || !stripePriceId || !priceAmount || !billingInterval) {
      return fail(400, {
        error: 'Required fields are missing',
        name,
        tier,
        stripePriceId,
        priceAmount,
        priceAmountBdt,
        currency,
        billingInterval,
        textGenerationLimit,
        imageGenerationLimit,
        videoGenerationLimit,
        audioGenerationLimit,
        features,
        isActive
      })
    }

    if (!['free', 'starter', 'pro', 'advanced'].includes(tier)) {
      return fail(400, {
        error: 'Invalid tier selected',
        name,
        tier,
        stripePriceId,
        priceAmount,
        priceAmountBdt,
        currency,
        billingInterval,
        textGenerationLimit,
        imageGenerationLimit,
        videoGenerationLimit,
        audioGenerationLimit,
        features,
        isActive
      })
    }

    if (!['month', 'year'].includes(billingInterval)) {
      return fail(400, {
        error: 'Invalid billing interval selected',
        name,
        tier,
        stripePriceId,
        priceAmount,
        priceAmountBdt,
        currency,
        billingInterval,
        textGenerationLimit,
        imageGenerationLimit,
        videoGenerationLimit,
        audioGenerationLimit,
        features,
        isActive
      })
    }

    const priceAmountNum = parseInt(priceAmount)
    if (isNaN(priceAmountNum) || priceAmountNum < 0) {
      return fail(400, {
        error: 'Price amount must be a valid positive number',
        name,
        tier,
        stripePriceId,
        priceAmount,
        priceAmountBdt,
        currency,
        billingInterval,
        textGenerationLimit,
        imageGenerationLimit,
        videoGenerationLimit,
        audioGenerationLimit,
        features,
        isActive
      })
    }

    // Parse BDT price (optional - can be null)
    let priceAmountBdtNum: number | null = null
    if (priceAmountBdt && priceAmountBdt.trim() !== '') {
      priceAmountBdtNum = parseInt(priceAmountBdt)
      if (isNaN(priceAmountBdtNum) || priceAmountBdtNum < 0) {
        return fail(400, {
          error: 'BDT price amount must be a valid positive number',
          name,
          tier,
          stripePriceId,
          priceAmount,
          priceAmountBdt,
          currency,
          billingInterval,
          textGenerationLimit,
          imageGenerationLimit,
          videoGenerationLimit,
          audioGenerationLimit,
          features,
          isActive
        })
      }
    }

    try {
      // Parse limits (null for unlimited, 0 for no access)
      const textLimit = textGenerationLimit === '' || textGenerationLimit === undefined || textGenerationLimit === null ? null : parseInt(textGenerationLimit)
      const imageLimit = imageGenerationLimit === '' || imageGenerationLimit === undefined || imageGenerationLimit === null ? null : parseInt(imageGenerationLimit)
      const videoLimit = videoGenerationLimit === '' || videoGenerationLimit === undefined || videoGenerationLimit === null ? null : parseInt(videoGenerationLimit)
      const audioLimit = audioGenerationLimit === '' || audioGenerationLimit === undefined || audioGenerationLimit === null ? null : parseInt(audioGenerationLimit)

      // Parse features array
      let featuresArray: string[] = []
      if (features) {
        try {
          featuresArray = features.split('\n').map(f => f.trim()).filter(f => f.length > 0)
        } catch (error) {
          featuresArray = []
        }
      }

      // Update the plan
      await db
        .update(pricingPlans)
        .set({
          name,
          tier: tier as 'free' | 'starter' | 'pro' | 'advanced',
          stripePriceId,
          priceAmount: priceAmountNum,
          priceAmountBdt: priceAmountBdtNum,
          currency,
          billingInterval: billingInterval as 'month' | 'year',
          textGenerationLimit: textLimit !== null && !isNaN(textLimit) ? textLimit : null,
          imageGenerationLimit: imageLimit !== null && !isNaN(imageLimit) ? imageLimit : null,
          videoGenerationLimit: videoLimit !== null && !isNaN(videoLimit) ? videoLimit : null,
          audioGenerationLimit: audioLimit !== null && !isNaN(audioLimit) ? audioLimit : null,
          features: featuresArray,
          isActive,
          updatedAt: new Date()
        })
        .where(eq(pricingPlans.id, planId))

      throw redirect(303, '/admin/settings/plans')
    } catch (error) {
      // Check if this is a redirect response (SvelteKit redirects are Response objects)
      if (error instanceof Response || (error && typeof error === 'object' && 'status' in error && error.status === 303)) {
        throw error
      }
      
      console.error('Error updating plan:', error)
      return fail(500, {
        error: 'Failed to update plan',
        name,
        tier,
        stripePriceId,
        priceAmount,
        priceAmountBdt,
        currency,
        billingInterval,
        textGenerationLimit,
        imageGenerationLimit,
        videoGenerationLimit,
        audioGenerationLimit,
        features,
        isActive
      })
    }
  }
}