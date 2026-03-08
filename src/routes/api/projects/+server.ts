import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { projects } from '$lib/server/db/schema.js';
import { eq, desc, sql } from 'drizzle-orm';
import { isDemoModeRestricted, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		const session = await locals.auth();
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userProjects = await db
			.select({
				id: projects.id,
				name: projects.name,
				description: projects.description,
				createdAt: projects.createdAt,
				updatedAt: projects.updatedAt,
				fileCount: sql<number>`(SELECT COUNT(*) FROM project_file WHERE project_file."projectId" = project.id)`.as('fileCount'),
				chatCount: sql<number>`(SELECT COUNT(*) FROM chat WHERE chat."projectId" = project.id)`.as('chatCount'),
			})
			.from(projects)
			.where(eq(projects.userId, session.user.id))
			.orderBy(desc(projects.updatedAt));

		return json({ projects: userProjects });
	} catch (error) {
		console.error('Get projects error:', error);
		return json({ error: 'Failed to fetch projects' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const session = await locals.auth();
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		if (isDemoModeRestricted(!!session?.user?.id)) {
			return json({ error: DEMO_MODE_MESSAGES.GENERAL_RESTRICTION }, { status: 403 });
		}

		const { name, description } = await request.json();

		if (!name || typeof name !== 'string' || !name.trim()) {
			return json({ error: 'Project name is required' }, { status: 400 });
		}

		if (name.trim().length > 100) {
			return json({ error: 'Project name must be 100 characters or less' }, { status: 400 });
		}

		if (description && typeof description === 'string' && description.trim().length > 500) {
			return json({ error: 'Project description must be 500 characters or less' }, { status: 400 });
		}

		const [newProject] = await db
			.insert(projects)
			.values({
				userId: session.user.id,
				name: name.trim(),
				description: description?.trim() || null,
			})
			.returning();

		return json({ project: newProject });
	} catch (error) {
		console.error('Create project error:', error);
		return json({ error: 'Failed to create project' }, { status: 500 });
	}
};
