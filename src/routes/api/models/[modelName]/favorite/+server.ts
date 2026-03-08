import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { favoriteModels } from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';

export const PATCH: RequestHandler = async ({ params, locals }) => {
	try {
		const session = await locals.auth();
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const modelName = decodeURIComponent(params.modelName);

		// Check if already favorited
		const [existing] = await db
			.select()
			.from(favoriteModels)
			.where(and(
				eq(favoriteModels.userId, session.user.id),
				eq(favoriteModels.modelName, modelName)
			));

		if (existing) {
			// Remove favorite
			await db.delete(favoriteModels)
				.where(and(
					eq(favoriteModels.userId, session.user.id),
					eq(favoriteModels.modelName, modelName)
				));
			return json({ isFavorite: false, modelName });
		} else {
			// Add favorite
			await db.insert(favoriteModels).values({
				userId: session.user.id,
				modelName
			});
			return json({ isFavorite: true, modelName });
		}
	} catch (error) {
		console.error('Toggle favorite error:', error);
		return json({ error: 'Failed to toggle favorite status' }, { status: 500 });
	}
};
