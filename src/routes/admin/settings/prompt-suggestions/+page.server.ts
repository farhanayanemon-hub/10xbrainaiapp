import type { Actions, PageServerLoad } from './$types'
import { fail } from '@sveltejs/kit'
import { PromptSuggestionsService } from '$lib/server/prompt-suggestions.js'
import { isDemoModeEnabled, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js'

export const load: PageServerLoad = async () => {
  const suggestions = await PromptSuggestionsService.getAllSuggestions()

  return {
    suggestions,
    isDemoMode: isDemoModeEnabled()
  }
}

export const actions: Actions = {
  save: async ({ request }) => {
    if (isDemoModeEnabled()) {
      return fail(403, { error: DEMO_MODE_MESSAGES.ADMIN_SAVE_DISABLED })
    }

    const data = await request.formData()
    const suggestionsJson = data.get('suggestions')?.toString()

    if (!suggestionsJson) {
      return fail(400, { error: 'Suggestions data is required' })
    }

    try {
      const suggestions = JSON.parse(suggestionsJson)
      if (!Array.isArray(suggestions)) {
        return fail(400, { error: 'Invalid suggestions format' })
      }

      await PromptSuggestionsService.saveSuggestions(suggestions)
      return { success: true }
    } catch (e) {
      console.error('Error saving prompt suggestions:', e)
      return fail(500, { error: 'Failed to save prompt suggestions' })
    }
  },

  reset: async () => {
    if (isDemoModeEnabled()) {
      return fail(403, { error: DEMO_MODE_MESSAGES.ADMIN_SAVE_DISABLED })
    }

    try {
      const defaults = PromptSuggestionsService.getDefaults()
      await PromptSuggestionsService.saveSuggestions(defaults)
      return { success: true, reset: true }
    } catch (e) {
      console.error('Error resetting prompt suggestions:', e)
      return fail(500, { error: 'Failed to reset prompt suggestions' })
    }
  }
}
