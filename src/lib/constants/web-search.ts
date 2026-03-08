// Models that support OpenRouter's :online web search feature
// These models have built-in web search capabilities when accessed via OpenRouter
export const WEB_SEARCH_MODELS = [
  'anthropic/claude-opus-4.6',
  'anthropic/claude-opus-4.5',
  'anthropic/claude-haiku-4.5',
  'google/gemini-3-pro-preview',
  'google/gemini-3-flash-preview',
  'x-ai/grok-4.1-fast',
  'x-ai/grok-4',
  'x-ai/grok-code-fast-1',
  'openai/gpt-5.2-chat',
  'moonshotai/kimi-k2.5',
  'minimax/minimax-m2.5',
  'minimax/minimax-m2.1',
  'z-ai/glm-5',
  'z-ai/glm-4.7',
  'z-ai/glm-4.7-flash',
] as const;

export type WebSearchModel = typeof WEB_SEARCH_MODELS[number];

/**
 * Check if a model supports OpenRouter's web search feature.
 * @param modelName - The model name to check
 * @returns true if the model supports web search
 */
export function supportsWebSearch(modelName: string): boolean {
  // Check if the base model (without any suffix) is in the list
  const baseModel = modelName.replace(/:online$/, '');
  return WEB_SEARCH_MODELS.some(m => baseModel === m || baseModel.startsWith(m + ':'));
}

/**
 * Append the :online suffix to enable web search for a model.
 * @param modelName - The model name to modify
 * @returns The model name with :online suffix
 */
export function appendWebSearchSuffix(modelName: string): string {
  // Don't double-append if already has :online
  if (modelName.endsWith(':online')) return modelName;
  return `${modelName}:online`;
}

/**
 * Remove the :online suffix from a model name.
 * @param modelName - The model name to modify
 * @returns The model name without :online suffix
 */
export function removeWebSearchSuffix(modelName: string): string {
  return modelName.replace(/:online$/, '');
}
