import type { PageServerLoad } from './$types';
import { isDemoModeEnabled } from '$lib/constants/demo-mode.js';

export const load: PageServerLoad = async ({ locals }) => {
	const session = await locals.auth();

	return {
		session,
		isDemoMode: isDemoModeEnabled()
	};
};
