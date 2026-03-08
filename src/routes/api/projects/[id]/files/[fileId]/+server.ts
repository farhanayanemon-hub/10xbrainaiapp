import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { projects, projectFiles } from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { isDemoModeRestricted, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	try {
		const session = await locals.auth();
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		if (isDemoModeRestricted(!!session?.user?.id)) {
			return json({ error: DEMO_MODE_MESSAGES.GENERAL_RESTRICTION }, { status: 403 });
		}

		// Verify project ownership
		const [project] = await db
			.select({ id: projects.id })
			.from(projects)
			.where(and(eq(projects.id, params.id), eq(projects.userId, session.user.id)));

		if (!project) {
			return json({ error: 'Project not found' }, { status: 404 });
		}

		const [deletedFile] = await db
			.delete(projectFiles)
			.where(and(
				eq(projectFiles.id, params.fileId),
				eq(projectFiles.projectId, params.id)
			))
			.returning();

		if (!deletedFile) {
			return json({ error: 'File not found' }, { status: 404 });
		}

		return json({ message: 'File deleted successfully' });
	} catch (error) {
		console.error('Delete project file error:', error);
		return json({ error: 'Failed to delete file' }, { status: 500 });
	}
};
