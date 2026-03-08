import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { projects, chats } from '$lib/server/db/schema.js';
import { eq, and, desc } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		const session = await locals.auth();
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Verify project ownership
		const [project] = await db
			.select({ id: projects.id })
			.from(projects)
			.where(and(eq(projects.id, params.id), eq(projects.userId, session.user.id)));

		if (!project) {
			return json({ error: 'Project not found' }, { status: 404 });
		}

		const projectChats = await db
			.select({
				id: chats.id,
				title: chats.title,
				model: chats.model,
				createdAt: chats.createdAt,
				updatedAt: chats.updatedAt,
			})
			.from(chats)
			.where(and(eq(chats.projectId, params.id), eq(chats.userId, session.user.id)))
			.orderBy(desc(chats.updatedAt));

		return json({ chats: projectChats });
	} catch (error) {
		console.error('Get project chats error:', error);
		return json({ error: 'Failed to fetch project chats' }, { status: 500 });
	}
};
