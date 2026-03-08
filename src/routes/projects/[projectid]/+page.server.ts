import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	const session = await locals.auth();
	if (!session?.user?.id) {
		redirect(302, `/login?callbackUrl=/projects/${params.projectid}`);
	}
	return {};
};
