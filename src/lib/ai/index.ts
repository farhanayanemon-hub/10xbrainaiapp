import type { AIProvider, AIModelConfig } from './types.js';
import { openRouterProvider } from './providers/openrouter.js';
import { replicateProvider } from './providers/replicate.js';
import { elevenlabsProvider } from './providers/elevenlabs.js';

export const AI_PROVIDERS: AIProvider[] = [
	openRouterProvider,
	replicateProvider,
	elevenlabsProvider
];

export function getAllModels(): AIModelConfig[] {
	return AI_PROVIDERS.flatMap(provider => provider.models);
}

export function getProvider(providerName: string): AIProvider | undefined {
	return AI_PROVIDERS.find(provider => provider.name === providerName);
}

export function getModelProvider(modelName: string): AIProvider | undefined {
	return AI_PROVIDERS.find(provider =>
		provider.models.some(model => model.name === modelName)
	);
}

export * from './types.js';
export { openRouterProvider } from './providers/openrouter.js';
export { replicateProvider } from './providers/replicate.js';
export { elevenlabsProvider } from './providers/elevenlabs.js';
// Re-export client-safe constants from the constants file (single source of truth)
export { ELEVENLABS_VOICES } from '$lib/constants/elevenlabs.js';