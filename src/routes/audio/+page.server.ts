import type { PageServerLoad } from './$types';
import { isDemoModeEnabled } from '$lib/constants/demo-mode.js';

export const load: PageServerLoad = async () => {
	return {
		isDemoMode: isDemoModeEnabled()
	};
};
