import type { Actions, PageServerLoad } from './$types'
import { db, creditPlans } from '$lib/server/db/index.js'
import { eq } from 'drizzle-orm'
import { fail, redirect, error } from '@sveltejs/kit'
import { isDemoModeEnabled, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js'

export const load: PageServerLoad = async ({ params }) => {
  const planId = params.id

  if (!planId) {
    throw error(404, 'Credit plan not found')
  }

  const plan = await db
    .select()
    .from(creditPlans)
    .where(eq(creditPlans.id, planId))
    .limit(1)

  if (plan.length === 0) {
    throw error(404, 'Credit plan not found')
  }

  return {
    plan: plan[0],
    isDemoMode: isDemoModeEnabled()
  }
}

export const actions: Actions = {
  update: async ({ request, params }) => {
    if (isDemoModeEnabled()) {
      return fail(403, {
        error: DEMO_MODE_MESSAGES.ADMIN_SAVE_DISABLED
      });
    }

    const planId = params.id

    if (!planId) {
      throw error(404, 'Credit plan not found')
    }

    const data = await request.formData()

    const name = data.get('name')?.toString()
    const description = data.get('description')?.toString() || null
    const creditType = data.get('creditType')?.toString()
    const creditAmount = data.get('creditAmount')?.toString()
    const priceAmount = data.get('priceAmount')?.toString()
    const priceAmountBdt = data.get('priceAmountBdt')?.toString()
    const currency = data.get('currency')?.toString() || 'usd'
    const isActive = data.get('isActive') === 'on'

    if (!name || !creditType || !creditAmount || !priceAmount) {
      return fail(400, {
        error: 'Required fields are missing',
        name, description, creditType, creditAmount, priceAmount, priceAmountBdt, currency, isActive
      })
    }

    if (!['text', 'image', 'video', 'audio'].includes(creditType)) {
      return fail(400, {
        error: 'Invalid credit type selected',
        name, description, creditType, creditAmount, priceAmount, priceAmountBdt, currency, isActive
      })
    }

    const creditAmountNum = parseInt(creditAmount)
    if (isNaN(creditAmountNum) || creditAmountNum <= 0) {
      return fail(400, {
        error: 'Credit amount must be a positive number',
        name, description, creditType, creditAmount, priceAmount, priceAmountBdt, currency, isActive
      })
    }

    const priceAmountNum = parseInt(priceAmount)
    if (isNaN(priceAmountNum) || priceAmountNum < 0) {
      return fail(400, {
        error: 'Price amount must be a valid positive number',
        name, description, creditType, creditAmount, priceAmount, priceAmountBdt, currency, isActive
      })
    }

    const priceAmountBdtNum = priceAmountBdt ? parseInt(priceAmountBdt) : null
    if (priceAmountBdtNum !== null && (isNaN(priceAmountBdtNum) || priceAmountBdtNum < 0)) {
      return fail(400, {
        error: 'BDT price must be a valid positive number',
        name, description, creditType, creditAmount, priceAmount, priceAmountBdt, currency, isActive
      })
    }

    try {
      await db
        .update(creditPlans)
        .set({
          name,
          description,
          creditType: creditType as 'text' | 'image' | 'video' | 'audio',
          creditAmount: creditAmountNum,
          priceAmount: priceAmountNum,
          priceAmountBdt: priceAmountBdtNum,
          currency,
          isActive,
          updatedAt: new Date()
        })
        .where(eq(creditPlans.id, planId))

      throw redirect(303, '/admin/settings/credit-plans')
    } catch (error) {
      if (error instanceof Response || (error && typeof error === 'object' && 'status' in error && error.status === 303)) {
        throw error
      }

      console.error('Error updating credit plan:', error)
      return fail(500, {
        error: 'Failed to update credit plan',
        name, description, creditType, creditAmount, priceAmount, priceAmountBdt, currency, isActive
      })
    }
  },

  delete: async ({ params }) => {
    if (isDemoModeEnabled()) {
      return fail(403, {
        error: DEMO_MODE_MESSAGES.ADMIN_SAVE_DISABLED
      });
    }

    const planId = params.id

    if (!planId) {
      throw error(404, 'Credit plan not found')
    }

    try {
      await db
        .delete(creditPlans)
        .where(eq(creditPlans.id, planId))

      throw redirect(303, '/admin/settings/credit-plans')
    } catch (error) {
      if (error instanceof Response || (error && typeof error === 'object' && 'status' in error && error.status === 303)) {
        throw error
      }

      console.error('Error deleting credit plan:', error)
      return fail(500, {
        error: 'Failed to delete credit plan'
      })
    }
  }
}
