import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { favoriteModels } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		const session = await locals.auth();

		// Return empty array for guests (no error, just empty favorites)
		if (!session?.user?.id) {
			return json({ favorites: [] });
		}

		const favorites = await db
			.select({ modelName: favoriteModels.modelName })
			.from(favoriteModels)
			.where(eq(favoriteModels.userId, session.user.id));

		return json({ favorites: favorites.map(f => f.modelName) });
	} catch (error) {
		console.error('Favorites API error:', error);
		return json({ error: 'Failed to fetch favorites' }, { status: 500 });
	}
};
