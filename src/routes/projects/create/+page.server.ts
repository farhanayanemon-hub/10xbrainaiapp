import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) {
		redirect(302, '/login?callbackUrl=/projects/create');
	}
	return {};
};
