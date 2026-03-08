import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

const EXCLUDE_PATHS = [
	'node_modules',
	'.git',
	'.cache',
	'.config',
	'.svelte-kit',
	'build',
	'uploads',
	'.env',
	'opaybd-backup',
	'opaybd-backup.tar.gz'
];

export const GET: RequestHandler = async ({ locals }) => {
	const session = await locals.auth();
	if (!session?.user) {
		throw error(401, 'Unauthorized');
	}

	const user = session.user as { isAdmin?: boolean };
	if (!user.isAdmin) {
		throw error(403, 'Forbidden: Admin access required');
	}

	const projectRoot = process.cwd();
	const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'app-backup-'));
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
	const zipFilename = `app-backup-${timestamp}.tar.gz`;
	const zipPath = path.join(tempDir, zipFilename);

	try {
		const excludeArgs = EXCLUDE_PATHS.map(p => `--exclude='${p}'`).join(' ');

		await execAsync(
			`tar czf "${zipPath}" ${excludeArgs} -C "${projectRoot}" .`,
			{ maxBuffer: 100 * 1024 * 1024, timeout: 120000 }
		);

		const fileBuffer = await fs.readFile(zipPath);
		const stat = await fs.stat(zipPath);

		return new Response(fileBuffer, {
			headers: {
				'Content-Type': 'application/gzip',
				'Content-Disposition': `attachment; filename="${zipFilename}"`,
				'Content-Length': stat.size.toString()
			}
		});
	} catch (err: any) {
		console.error('Backup creation error:', err);
		throw error(500, `Backup failed: ${err.message}`);
	} finally {
		try {
			await fs.rm(tempDir, { recursive: true, force: true });
		} catch {
			// cleanup non-critical
		}
	}
};
