import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import AdmZip from 'adm-zip';

const execAsync = promisify(exec);

const PROTECTED_PATHS = [
        '.env',
        '.replit',
        'replit.md',
        '.local',
        'node_modules',
        'uploads',
        'drizzle.config.ts',
        'vite.config.ts',
        'svelte.config.js',
        'opaybd-backup',
        'opaybd-backup.tar.gz',
        '.git',
        '.cache',
        '.config',
        'build',
        '.svelte-kit'
];

function isProtected(filePath: string): boolean {
        const normalized = filePath.replace(/\\/g, '/');
        return PROTECTED_PATHS.some(p => {
                return normalized === p || normalized.startsWith(p + '/');
        });
}

function isSafePath(basePath: string, targetPath: string): boolean {
        const resolved = path.resolve(basePath, targetPath);
        return resolved.startsWith(path.resolve(basePath) + path.sep) || resolved === path.resolve(basePath);
}

async function isSymlink(filePath: string): Promise<boolean> {
        try {
                const stat = await fs.lstat(filePath);
                return stat.isSymbolicLink();
        } catch {
                return false;
        }
}

async function rollbackFromBackup(backupDir: string, projectRoot: string, filesToRestore: string[]) {
        for (const relPath of filesToRestore) {
                const backupPath = path.join(backupDir, relPath);
                const destPath = path.join(projectRoot, relPath);
                try {
                        await fs.access(backupPath);
                        await fs.mkdir(path.dirname(destPath), { recursive: true });
                        await fs.copyFile(backupPath, destPath);
                } catch {
                        // backup file doesn't exist, nothing to restore
                }
        }
}

export const POST: RequestHandler = async ({ request, locals }) => {
        const session = await locals.auth();
        if (!session?.user) {
                throw error(401, 'Unauthorized');
        }

        const user = session.user as { isAdmin?: boolean };
        if (!user.isAdmin) {
                throw error(403, 'Forbidden: Admin access required');
        }

        const formData = await request.formData();
        const file = formData.get('zipFile') as File | null;

        if (!file) {
                throw error(400, 'No file uploaded');
        }

        if (!file.name.endsWith('.zip')) {
                throw error(400, 'Only .zip files are accepted');
        }

        const maxSize = 500 * 1024 * 1024;
        if (file.size > maxSize) {
                throw error(400, 'File too large. Maximum size is 500MB');
        }

        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'app-update-'));
        const zipPath = path.join(tempDir, 'upload.zip');
        const extractDir = path.join(tempDir, 'extracted');
        const backupDir = path.join(tempDir, 'backup');
        const projectRoot = process.cwd();

        try {
                const buffer = Buffer.from(await file.arrayBuffer());
                await fs.writeFile(zipPath, buffer);

                await fs.mkdir(extractDir, { recursive: true });

                const zip = new AdmZip(zipPath);
                const zipEntries = zip.getEntries();

                for (const entry of zipEntries) {
                        const entryName = entry.entryName;
                        if (entryName.includes('..') || path.isAbsolute(entryName)) {
                                throw error(400, 'Zip file contains unsafe paths (path traversal detected). Upload rejected.');
                        }
                }

                zip.extractAllTo(extractDir, true);

                let sourceDir = extractDir;
                const entries = await fs.readdir(extractDir);
                if (entries.length === 1) {
                        const singleEntry = path.join(extractDir, entries[0]);
                        const stat = await fs.stat(singleEntry);
                        if (stat.isDirectory()) {
                                sourceDir = singleEntry;
                        }
                }

                const sourceEntries = await fs.readdir(sourceDir);
                const hasPackageJson = sourceEntries.includes('package.json');
                const hasSrcDir = sourceEntries.includes('src');

                if (!hasPackageJson || !hasSrcDir) {
                        throw error(400, 'Invalid project structure. The zip must contain a valid SvelteKit project with package.json and src/ directory.');
                }

                await fs.mkdir(backupDir, { recursive: true });

                const filesToCopy: string[] = [];
                const skippedFiles: string[] = [];

                async function collectFiles(dir: string, relativeTo: string) {
                        const items = await fs.readdir(dir, { withFileTypes: true });
                        for (const item of items) {
                                const fullPath = path.join(dir, item.name);
                                const relativePath = path.relative(relativeTo, fullPath);

                                if (!isSafePath(relativeTo, relativePath)) {
                                        skippedFiles.push(relativePath + ' (unsafe path)');
                                        continue;
                                }

                                if (await isSymlink(fullPath)) {
                                        skippedFiles.push(relativePath + ' (symlink)');
                                        continue;
                                }

                                if (isProtected(relativePath)) {
                                        skippedFiles.push(relativePath);
                                        continue;
                                }

                                if (item.isDirectory()) {
                                        await collectFiles(fullPath, relativeTo);
                                } else {
                                        filesToCopy.push(relativePath);
                                }
                        }
                }

                await collectFiles(sourceDir, sourceDir);

                for (const relPath of filesToCopy) {
                        const resolvedDest = path.resolve(projectRoot, relPath);
                        if (!resolvedDest.startsWith(path.resolve(projectRoot) + path.sep)) {
                                throw error(400, `Path traversal detected in file: ${relPath}`);
                        }
                }

                const backedUpFiles: string[] = [];
                for (const relPath of filesToCopy) {
                        const destPath = path.join(projectRoot, relPath);
                        const backupPath = path.join(backupDir, relPath);

                        try {
                                await fs.access(destPath);
                                await fs.mkdir(path.dirname(backupPath), { recursive: true });
                                await fs.copyFile(destPath, backupPath);
                                backedUpFiles.push(relPath);
                        } catch {
                                // File doesn't exist yet, no backup needed
                        }
                }

                for (const relPath of filesToCopy) {
                        const srcPath = path.join(sourceDir, relPath);
                        const destPath = path.join(projectRoot, relPath);
                        await fs.mkdir(path.dirname(destPath), { recursive: true });
                        await fs.copyFile(srcPath, destPath);
                }

                let npmOutput = '';
                let npmFailed = false;
                try {
                        const { stdout, stderr } = await execAsync('npm install', {
                                cwd: projectRoot,
                                maxBuffer: 50 * 1024 * 1024,
                                timeout: 120000
                        });
                        npmOutput = stdout + (stderr ? '\n' + stderr : '');
                } catch (npmError: any) {
                        npmFailed = true;
                        npmOutput = npmError.message;

                        console.error('npm install failed, rolling back...', npmError.message);
                        await rollbackFromBackup(backupDir, projectRoot, backedUpFiles);

                        throw error(500, 'npm install failed. All changes have been rolled back. Please check your zip file contains compatible dependencies.');
                }

                return json({
                        success: true,
                        message: 'App updated successfully! Please restart the application to apply changes.',
                        details: {
                                filesUpdated: filesToCopy.length,
                                filesSkipped: skippedFiles.length,
                                skippedPaths: [...new Set(skippedFiles.map(f => f.split('/')[0]))],
                                npmInstall: npmOutput.slice(-500)
                        }
                });

        } catch (err: any) {
                if (err.status) throw err;
                console.error('App update error:', err);
                throw error(500, `Update failed: ${err.message}`);
        } finally {
                try {
                        await fs.rm(tempDir, { recursive: true, force: true });
                } catch {
                        // cleanup failure is non-critical
                }
        }
};
