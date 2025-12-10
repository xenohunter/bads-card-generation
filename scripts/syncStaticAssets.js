#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const { resolveOutputPath, PROJECT_ROOT, LOCALE } = require('./utils/runtimeConfig');

const PUBLIC_ROOT = path.join(PROJECT_ROOT, 'public');
const localeTag = (LOCALE || 'default').toLowerCase();
const PAIRS = [
	{ src: resolveOutputPath('atlases'), dest: path.join(PUBLIC_ROOT, 'atlases', localeTag) },
	{ src: resolveOutputPath('misc'), dest: path.join(PUBLIC_ROOT, 'misc', localeTag) }
];

async function main() {
	await Promise.all(
		PAIRS.map(async ({ src, dest }) => {
			await copyDirectory(src, dest);
		})
	);

	console.log('Synced static atlases and misc assets into /public.');
}

async function copyDirectory(src, dest) {
	try {
		await fs.access(src);
	} catch (error) {
		if (error.code === 'ENOENT') {
			console.warn(`Source directory not found: ${src}. Skipping.`);
			return;
		}
		throw error;
	}

	await fs.rm(dest, { recursive: true, force: true });
	await fs.mkdir(dest, { recursive: true });

	await fs.cp(src, dest, { recursive: true });
}

if (require.main === module) {
	main().catch((error) => {
		console.error('Failed to sync static assets:', error);
		process.exitCode = 1;
	});
}
