import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types.js';

export const load: PageLoad = async ({ params, fetch, parent }) => {
	const { session } = await parent();

	if (!session?.user?.id) {
		throw error(401, 'Unauthorized');
	}

	const response = await fetch(`/api/projects/${params.projectid}`);
	if (!response.ok) {
		if (response.status === 404) {
			throw error(404, 'Project not found');
		}
		throw error(response.status, 'Failed to load project');
	}

	const data = await response.json();
	return {
		project: data.project,
		projectId: params.projectid
	};
};
