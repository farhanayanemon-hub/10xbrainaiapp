import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getAllModels } from '$lib/ai/index.js';
import { waitForEnrichmentCompletion } from '$lib/ai/providers/openrouter.js';
import { isModelAllowedForGuests } from '$lib/constants/guest-limits.js';
import { isDemoModeEnabled, isModelAllowedForDemo, isDemoModeRestricted } from '$lib/constants/demo-mode.js';

export const GET: RequestHandler = async ({ locals, url }) => {
	try {
		// Wait for OpenRouter architecture enrichment to complete (with 10s timeout)
		const enrichmentSuccess = await waitForEnrichmentCompletion(10000);

		if (!enrichmentSuccess) {
			console.warn('Architecture enrichment timed out, returning basic models');
		}

		const allModels = getAllModels();

		// Filter models based on type query parameter
		// - type=image: only image generation models
		// - type=video: only video generation models
		// - type=all: all models (no filter)
		// - default (no param): only text/LLM models (for chat interface)
		const typeFilter = url.searchParams.get('type');

		let filteredModels = allModels;
		if (typeFilter === 'image') {
			filteredModels = allModels.filter(model => model.supportsImageGeneration);
		} else if (typeFilter === 'video') {
			filteredModels = allModels.filter(model => model.supportsVideoGeneration);
		} else if (typeFilter === 'all') {
			filteredModels = allModels;
		} else {
			// Default: filter to only text/LLM models for the chat interface
			// Image, video, and audio models have their own dedicated pages (/image-video and /audio)
			filteredModels = allModels.filter(model =>
				!model.supportsImageGeneration &&
				!model.supportsVideoGeneration &&
				!model.supportsAudioGeneration
			);
		}

		// Check if user is logged in
		const session = await locals.getSession();
		const isLoggedIn = !!session?.user?.id;

		// Check demo mode status
		const demoModeEnabled = isDemoModeEnabled();
		const userDemoRestricted = isDemoModeRestricted(isLoggedIn);

		// Add guest access and demo mode flags to all models
		const models = filteredModels.map(model => {
			const guestAllowed = isModelAllowedForGuests(model.name);
			const demoAllowed = isModelAllowedForDemo(model.name);

			let isLocked = false;

			// Determine if model is locked based on user status and demo mode
			if (!isLoggedIn) {
				// Guest users - check guest restrictions
				isLocked = !guestAllowed;
			} else if (userDemoRestricted) {
				// Logged-in users in demo mode - check demo restrictions
				isLocked = !demoAllowed;
			}
			// Logged-in users in normal mode - no restrictions (isLocked = false)

			return {
				...model,
				isGuestAllowed: guestAllowed,
				isDemoAllowed: demoAllowed,
				isLocked,
				isDemoMode: demoModeEnabled
			};
		});

		return json({ models });
	} catch (error) {
		console.error('Models API error:', error);
		return json(
			{ error: 'Failed to fetch models' },
			{ status: 500 }
		);
	}
};