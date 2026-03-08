import type { Actions, PageServerLoad } from './$types'
import { db, creditPlans } from '$lib/server/db/index.js'
import { eq, desc } from 'drizzle-orm'
import { fail, redirect } from '@sveltejs/kit'
import { isDemoModeEnabled, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js'

export const load: PageServerLoad = async () => {
  try {
    const allPlans = await db
      .select()
      .from(creditPlans)
      .orderBy(creditPlans.creditType, desc(creditPlans.createdAt))

    return {
      creditPlans: allPlans,
      isDemoMode: isDemoModeEnabled()
    }
  } catch (error) {
    console.error('Error loading credit plans (table may not exist yet):', error)
    return {
      creditPlans: [],
      isDemoMode: isDemoModeEnabled()
    }
  }
}

export const actions: Actions = {
  create: async ({ request }) => {
    if (isDemoModeEnabled()) {
      return fail(403, {
        error: DEMO_MODE_MESSAGES.ADMIN_SAVE_DISABLED
      });
    }

    const data = await request.formData()

    const name = data.get('name')?.toString()
    const description = data.get('description')?.toString() || null
    const creditType = data.get('creditType')?.toString()
    const creditAmount = data.get('creditAmount')?.toString()
    const priceAmount = data.get('priceAmount')?.toString()
    const priceAmountBdt = data.get('priceAmountBdt')?.toString()
    const currency = data.get('currency')?.toString() || 'usd'

    if (!name || !creditType || !creditAmount || !priceAmount) {
      return fail(400, {
        error: 'Required fields are missing',
        name, description, creditType, creditAmount, priceAmount, priceAmountBdt, currency
      })
    }

    if (!['text', 'image', 'video', 'audio'].includes(creditType)) {
      return fail(400, {
        error: 'Invalid credit type selected',
        name, description, creditType, creditAmount, priceAmount, priceAmountBdt, currency
      })
    }

    const creditAmountNum = parseInt(creditAmount)
    if (isNaN(creditAmountNum) || creditAmountNum <= 0) {
      return fail(400, {
        error: 'Credit amount must be a positive number',
        name, description, creditType, creditAmount, priceAmount, priceAmountBdt, currency
      })
    }

    const priceAmountNum = parseInt(priceAmount)
    if (isNaN(priceAmountNum) || priceAmountNum < 0) {
      return fail(400, {
        error: 'Price amount must be a valid positive number',
        name, description, creditType, creditAmount, priceAmount, priceAmountBdt, currency
      })
    }

    const priceAmountBdtNum = priceAmountBdt ? parseInt(priceAmountBdt) : null
    if (priceAmountBdtNum !== null && (isNaN(priceAmountBdtNum) || priceAmountBdtNum < 0)) {
      return fail(400, {
        error: 'BDT price must be a valid positive number',
        name, description, creditType, creditAmount, priceAmount, priceAmountBdt, currency
      })
    }

    try {
      await db.insert(creditPlans).values({
        name,
        description,
        creditType: creditType as 'text' | 'image' | 'video' | 'audio',
        creditAmount: creditAmountNum,
        priceAmount: priceAmountNum,
        priceAmountBdt: priceAmountBdtNum,
        currency,
        isActive: true
      })

      throw redirect(303, '/admin/settings/credit-plans')
    } catch (error) {
      if (error instanceof Response || (error && typeof error === 'object' && 'status' in error && error.status === 303)) {
        throw error
      }

      console.error('Error creating credit plan:', error)
      return fail(500, {
        error: 'Failed to create credit plan',
        name, description, creditType, creditAmount, priceAmount, priceAmountBdt, currency
      })
    }
  },

  toggleActive: async ({ request }) => {
    if (isDemoModeEnabled()) {
      return fail(403, {
        error: DEMO_MODE_MESSAGES.ADMIN_SAVE_DISABLED
      });
    }

    const data = await request.formData()
    const planId = data.get('planId')?.toString()

    if (!planId) {
      return fail(400, { error: 'Plan ID is required' })
    }

    try {
      const existing = await db
        .select({ isActive: creditPlans.isActive })
        .from(creditPlans)
        .where(eq(creditPlans.id, planId))
        .limit(1)

      if (existing.length === 0) {
        return fail(404, { error: 'Credit plan not found' })
      }

      await db
        .update(creditPlans)
        .set({
          isActive: !existing[0].isActive,
          updatedAt: new Date()
        })
        .where(eq(creditPlans.id, planId))

      return { success: true }
    } catch (error) {
      console.error('Error toggling credit plan status:', error)
      return fail(500, { error: 'Failed to toggle credit plan status' })
    }
  }
}
