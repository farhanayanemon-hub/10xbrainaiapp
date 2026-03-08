import { adminSettingsService } from './admin-settings.js'
import { db } from './db/index.js'
import { adminSettings } from './db/schema.js'
import { eq, and } from 'drizzle-orm'

export interface PromptSuggestion {
  id: string
  text: string
  prompt: string
  order: number
  isActive: boolean
}

const SETTINGS_KEY = 'prompt_suggestions'
const SETTINGS_CATEGORY = 'prompt_suggestions'

const DEFAULT_SUGGESTIONS: PromptSuggestion[] = [
  { id: '1', text: 'Help me brainstorm creative ideas', prompt: 'Help me brainstorm creative ideas about a character who discovers they have super powers...', order: 0, isActive: true },
  { id: '2', text: 'Explain this code and suggest improvements', prompt: 'Explain this code and suggest improvements for better performance and readability', order: 1, isActive: true },
  { id: '3', text: 'Analyze the pros and cons of a topic', prompt: 'Analyze the pros and cons of using renewable energy sources like solar and wind power...', order: 2, isActive: true },
  { id: '4', text: 'Let\'s have a general discussion', prompt: 'I\'m curious about how artificial intelligence is changing the way we work and live...', order: 3, isActive: true },
]

export class PromptSuggestionsService {
  static async getSuggestions(): Promise<PromptSuggestion[]> {
    try {
      const [row] = await db
        .select({ value: adminSettings.value })
        .from(adminSettings)
        .where(and(eq(adminSettings.key, SETTINGS_KEY), eq(adminSettings.category, SETTINGS_CATEGORY)))
        .limit(1)

      if (row?.value) {
        const parsed = JSON.parse(row.value) as PromptSuggestion[]
        return parsed.filter(s => s.isActive).sort((a, b) => a.order - b.order)
      }
    } catch (e) {
      console.error('Error loading prompt suggestions:', e)
    }

    return DEFAULT_SUGGESTIONS.filter(s => s.isActive)
  }

  static async getAllSuggestions(): Promise<PromptSuggestion[]> {
    try {
      const [row] = await db
        .select({ value: adminSettings.value })
        .from(adminSettings)
        .where(and(eq(adminSettings.key, SETTINGS_KEY), eq(adminSettings.category, SETTINGS_CATEGORY)))
        .limit(1)

      if (row?.value) {
        return (JSON.parse(row.value) as PromptSuggestion[]).sort((a, b) => a.order - b.order)
      }
    } catch (e) {
      console.error('Error loading prompt suggestions:', e)
    }

    return DEFAULT_SUGGESTIONS
  }

  static async saveSuggestions(suggestions: PromptSuggestion[]): Promise<void> {
    const value = JSON.stringify(suggestions)
    await adminSettingsService.setSetting(SETTINGS_KEY, value, SETTINGS_CATEGORY, 'Prompt suggestions for new chat carousel')
  }

  static getDefaults(): PromptSuggestion[] {
    return [...DEFAULT_SUGGESTIONS]
  }
}
