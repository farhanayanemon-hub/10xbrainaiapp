import type { Actions, PageServerLoad } from './$types'
import { fail } from '@sveltejs/kit'
import { db } from '$lib/server/db/index.js'
import { users } from '$lib/server/db/schema.js'
import { eq } from 'drizzle-orm'
import { isDemoModeEnabled, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js'

export const load: PageServerLoad = async ({ parent }) => {
  const { user } = await parent()
  return {
    profession: user.profession || '',
    personalInstructions: user.personalInstructions || '',
    userName: user.name || ''
  }
}

export const actions: Actions = {
  save: async ({ request, locals }) => {
    if (isDemoModeEnabled()) {
      return fail(403, { error: DEMO_MODE_MESSAGES.ADMIN_SAVE_DISABLED })
    }

    const session = await locals.auth()
    if (!session?.user?.id) {
      return fail(401, { error: 'Not authenticated' })
    }

    const data = await request.formData()
    const profession = data.get('profession')?.toString().trim() || null
    const personalInstructions = data.get('personalInstructions')?.toString().trim() || null

    if (personalInstructions && personalInstructions.length > 2000) {
      return fail(400, { error: 'Custom instructions must be 2000 characters or less' })
    }

    if (profession && profession.length > 100) {
      return fail(400, { error: 'Profession must be 100 characters or less' })
    }

    try {
      await db.update(users)
        .set({ profession, personalInstructions })
        .where(eq(users.id, session.user.id))

      return { success: true }
    } catch (e) {
      console.error('Error saving AI personalization:', e)
      return fail(500, { error: 'Failed to save personalization settings' })
    }
  }
}
