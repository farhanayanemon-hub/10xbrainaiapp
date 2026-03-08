import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { projects, projectFiles } from '$lib/server/db/schema.js';
import { eq, and, count } from 'drizzle-orm';
import { isDemoModeRestricted, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js';
import { enforceFileUploadRateLimit } from '$lib/server/file-upload-rate-limiting.js';

const ALLOWED_MIME_TYPES = [
	'text/plain',
	'text/markdown',
	'text/csv',
	'application/json',
	'text/html',
	'text/css',
	'text/javascript',
	'application/javascript',
	'application/xml',
	'text/xml',
	'text/yaml',
	'application/x-yaml',
];

const MAX_FILE_SIZE = 100 * 1024; // 100KB
const MAX_FILES_PER_PROJECT = 10;

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

		const files = await db
			.select({
				id: projectFiles.id,
				filename: projectFiles.filename,
				mimeType: projectFiles.mimeType,
				fileSize: projectFiles.fileSize,
				createdAt: projectFiles.createdAt,
			})
			.from(projectFiles)
			.where(eq(projectFiles.projectId, params.id));

		return json({ files });
	} catch (error) {
		console.error('Get project files error:', error);
		return json({ error: 'Failed to fetch project files' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
	try {
		const session = await locals.auth();
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		if (isDemoModeRestricted(!!session?.user?.id)) {
			return json({ error: DEMO_MODE_MESSAGES.GENERAL_RESTRICTION }, { status: 403 });
		}

		enforceFileUploadRateLimit('textFileUpload', session.user.id);

		// Verify project ownership
		const [project] = await db
			.select({ id: projects.id })
			.from(projects)
			.where(and(eq(projects.id, params.id), eq(projects.userId, session.user.id)));

		if (!project) {
			return json({ error: 'Project not found' }, { status: 404 });
		}

		// Check file count limit
		const [fileCountResult] = await db
			.select({ value: count() })
			.from(projectFiles)
			.where(eq(projectFiles.projectId, params.id));

		if ((fileCountResult?.value ?? 0) >= MAX_FILES_PER_PROJECT) {
			return json({ error: `Maximum of ${MAX_FILES_PER_PROJECT} files per project` }, { status: 400 });
		}

		const { filename, content, mimeType } = await request.json();

		if (!filename || typeof filename !== 'string' || !filename.trim()) {
			return json({ error: 'Filename is required' }, { status: 400 });
		}

		if (!content || typeof content !== 'string') {
			return json({ error: 'File content is required' }, { status: 400 });
		}

		if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
			return json({ error: 'Only text-based files are supported' }, { status: 400 });
		}

		const fileSize = new TextEncoder().encode(content).length;
		if (fileSize > MAX_FILE_SIZE) {
			return json({ error: 'File must be smaller than 100KB' }, { status: 400 });
		}

		const [newFile] = await db
			.insert(projectFiles)
			.values({
				projectId: params.id,
				filename: filename.trim(),
				mimeType,
				fileSize,
				content,
			})
			.returning();

		return json({ file: newFile });
	} catch (error) {
		console.error('Upload project file error:', error);
		return json({ error: 'Failed to upload file' }, { status: 500 });
	}
};
