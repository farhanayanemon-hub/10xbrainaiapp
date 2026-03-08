import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { chats, projects } from '$lib/server/db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { isDemoModeRestricted, isModelAllowedForDemo, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js';

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const session = await locals.auth();
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userChats = await db
			.select({
				id: chats.id,
				title: chats.title,
				model: chats.model,
				pinned: chats.pinned,
				isBranch: chats.isBranch,
				projectId: chats.projectId,
				createdAt: chats.createdAt,
				updatedAt: chats.updatedAt
			})
			.from(chats)
			.where(eq(chats.userId, session.user.id))
			.orderBy(desc(chats.updatedAt));

		return json({ chats: userChats });
	} catch (error) {
		console.error('Get chats error:', error);
		return json({ error: 'Failed to fetch chats' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const session = await locals.auth();
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { title, model, messages, projectId } = await request.json();

		if (!title || !model || !messages) {
			return json({ error: 'Title, model, and messages are required' }, { status: 400 });
		}

		// Check demo mode restrictions - only allow saving chats with demo-approved models
		if (isDemoModeRestricted(!!session?.user?.id)) {
			if (!isModelAllowedForDemo(model)) {
				return json({ error: DEMO_MODE_MESSAGES.MODEL_RESTRICTED, type: 'demo_model_restricted' }, { status: 403 });
			}
		}

		// Validate projectId ownership if provided
		if (projectId) {
			const [project] = await db
				.select({ id: projects.id })
				.from(projects)
				.where(and(eq(projects.id, projectId), eq(projects.userId, session.user.id)));

			if (!project) {
				return json({ error: 'Project not found' }, { status: 404 });
			}
		}

		const [newChat] = await db
			.insert(chats)
			.values({
				userId: session.user.id,
				title,
				model,
				messages,
				projectId: projectId || null,
			})
			.returning();

		return json({ chat: newChat });
	} catch (error) {
		console.error('Create chat error:', error);
		return json({ error: 'Failed to create chat' }, { status: 500 });
	}
};