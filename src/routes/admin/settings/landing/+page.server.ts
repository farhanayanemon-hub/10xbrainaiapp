import type { PageServerLoad, Actions } from './$types';
import { adminSettingsService } from '$lib/server/admin-settings.js';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
	const settings = await adminSettingsService.getSettingsByCategory('landing');
	return { landingSettings: settings };
};

export const actions: Actions = {
	update: async ({ request }) => {
		const formData = await request.formData();
		const entries = Array.from(formData.entries());

		const settingsToSave: Array<{ key: string; value: string; category: string; description?: string }> = [];

		for (const [key, value] of entries) {
			if (typeof value === 'string' && value.trim() !== '') {
				settingsToSave.push({
					key,
					value: value.trim(),
					category: 'landing',
				});
			}
		}

		try {
			await adminSettingsService.setSettings(settingsToSave);

			const { settingsStore } = await import('$lib/server/settings-store.js');
			settingsStore.clearCache();

			return { success: true };
		} catch (error) {
			console.error('Error saving landing settings:', error);
			return fail(500, { error: 'Failed to save settings' });
		}
	}
};
