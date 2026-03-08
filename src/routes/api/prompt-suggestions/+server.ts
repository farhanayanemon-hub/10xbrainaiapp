import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { PromptSuggestionsService } from '$lib/server/prompt-suggestions.js'

export const GET: RequestHandler = async () => {
  const suggestions = await PromptSuggestionsService.getSuggestions()
  return json(suggestions)
}
