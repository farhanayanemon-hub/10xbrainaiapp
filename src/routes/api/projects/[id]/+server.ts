import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { projects, projectFiles, chats } from '$lib/server/db/schema.js';
import { eq, and, count, sql } from 'drizzle-orm';
import { isDemoModeRestricted, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js';

export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		const session = await locals.auth();
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const [project] = await db
			.select()
			.from(projects)
			.where(and(eq(projects.id, params.id), eq(projects.userId, session.user.id)));

		if (!project) {
			return json({ error: 'Project not found' }, { status: 404 });
		}

		const [fileCountResult] = await db
			.select({ value: count() })
			.from(projectFiles)
			.where(eq(projectFiles.projectId, project.id));

		const [chatCountResult] = await db
			.select({ value: count() })
			.from(chats)
			.where(eq(chats.projectId, project.id));

		return json({
			project: {
				...project,
				fileCount: fileCountResult?.value ?? 0,
				chatCount: chatCountResult?.value ?? 0,
			}
		});
	} catch (error) {
		console.error('Get project error:', error);
		return json({ error: 'Failed to fetch project' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	try {
		const session = await locals.auth();
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		if (isDemoModeRestricted(!!session?.user?.id)) {
			return json({ error: DEMO_MODE_MESSAGES.GENERAL_RESTRICTION }, { status: 403 });
		}

		const { name, description, customInstructions } = await request.json();

		const updateData: Record<string, unknown> = {
			updatedAt: sql`NOW()`
		};

		if (name !== undefined) {
			if (typeof name !== 'string' || !name.trim()) {
				return json({ error: 'Project name cannot be empty' }, { status: 400 });
			}
			if (name.trim().length > 100) {
				return json({ error: 'Project name must be 100 characters or less' }, { status: 400 });
			}
			updateData.name = name.trim();
		}

		if (description !== undefined) {
			if (description && typeof description === 'string' && description.trim().length > 500) {
				return json({ error: 'Project description must be 500 characters or less' }, { status: 400 });
			}
			updateData.description = description?.trim() || null;
		}

		if (customInstructions !== undefined) {
			if (customInstructions && typeof customInstructions === 'string' && customInstructions.trim().length > 4000) {
				return json({ error: 'Custom instructions must be 4000 characters or less' }, { status: 400 });
			}
			updateData.customInstructions = customInstructions?.trim() || null;
		}

		const [updatedProject] = await db
			.update(projects)
			.set(updateData)
			.where(and(eq(projects.id, params.id), eq(projects.userId, session.user.id)))
			.returning();

		if (!updatedProject) {
			return json({ error: 'Project not found' }, { status: 404 });
		}

		return json({ project: updatedProject });
	} catch (error) {
		console.error('Update project error:', error);
		return json({ error: 'Failed to update project' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	try {
		const session = await locals.auth();
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		if (isDemoModeRestricted(!!session?.user?.id)) {
			return json({ error: DEMO_MODE_MESSAGES.GENERAL_RESTRICTION }, { status: 403 });
		}

		const [deletedProject] = await db
			.delete(projects)
			.where(and(eq(projects.id, params.id), eq(projects.userId, session.user.id)))
			.returning();

		if (!deletedProject) {
			return json({ error: 'Project not found' }, { status: 404 });
		}

		return json({ message: 'Project deleted successfully' });
	} catch (error) {
		console.error('Delete project error:', error);
		return json({ error: 'Failed to delete project' }, { status: 500 });
	}
};
