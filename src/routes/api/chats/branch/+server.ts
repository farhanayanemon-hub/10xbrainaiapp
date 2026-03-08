import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { chats } from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const session = await locals.auth();
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { sourceChatId, branchAtIndex } = await request.json();

		// Validate required fields
		if (!sourceChatId || typeof sourceChatId !== 'string') {
			return json({ error: 'sourceChatId is required' }, { status: 400 });
		}

		if (typeof branchAtIndex !== 'number' || branchAtIndex < 0) {
			return json({ error: 'branchAtIndex must be a non-negative number' }, { status: 400 });
		}

		// Fetch source chat and verify ownership
		const [sourceChat] = await db
			.select()
			.from(chats)
			.where(and(eq(chats.id, sourceChatId), eq(chats.userId, session.user.id)));

		if (!sourceChat) {
			return json({ error: 'Chat not found' }, { status: 404 });
		}

		// Validate branchAtIndex is within bounds
		if (branchAtIndex >= sourceChat.messages.length) {
			return json({ error: 'branchAtIndex is out of bounds' }, { status: 400 });
		}

		// Slice messages from 0 to branchAtIndex (inclusive)
		const branchedMessages = sourceChat.messages.slice(0, branchAtIndex + 1);

		// Get the model from the last message or use source chat model
		const lastMessage = branchedMessages[branchedMessages.length - 1];
		const branchModel = (lastMessage as any)?.model || sourceChat.model;

		// Create new branched chat (title stays same, icon indicates branch)
		const [newChat] = await db
			.insert(chats)
			.values({
				userId: session.user.id,
				title: sourceChat.title,
				model: branchModel,
				messages: branchedMessages,
				isBranch: true,
				branchAtIndex: branchAtIndex,
				branchSourceChatId: sourceChatId
			})
			.returning();

		return json({ chat: newChat });
	} catch (error) {
		console.error('Branch chat error:', error);
		return json({ error: 'Failed to create branch' }, { status: 500 });
	}
};
