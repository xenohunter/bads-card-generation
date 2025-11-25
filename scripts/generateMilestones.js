#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const { createCanvas } = require('canvas');
const { parse } = require('csv-parse/sync');

const CARD_SIZE = 490;
const EDGE_THICKNESS = 50;
const CONTENT_PADDING = 30;
const BACKGROUND_COLOR = '#fdf7f2';
const BODY_TEXT_COLOR = '#1f1f1f';
const EDGE_COLORS = {
	A: '#ff6b6b',
	B: '#4ecdc4',
	C: '#ffd166'
};
const STRIPE_COLORS = [EDGE_COLORS.A, EDGE_COLORS.B, EDGE_COLORS.C];

async function main() {
	const csvPath = path.resolve(__dirname, '../data/milestones.csv');
	const outputDir = path.resolve(__dirname, '../outputs/milestones');

	await fs.rm(outputDir, { recursive: true, force: true });
	await fs.mkdir(outputDir, { recursive: true });

	const csvRaw = await fs.readFile(csvPath, 'utf8');
	const milestones = parse(csvRaw, {
		columns: true,
		skip_empty_lines: true,
		relax_quotes: true
	});

	await Promise.all(
		milestones.map(async (record) => {
			const canvas = createCanvas(CARD_SIZE, CARD_SIZE);
			const ctx = canvas.getContext('2d');

			paintBackground(ctx);
			paintEdges(ctx, record);
			paintCopy(ctx, record);

			const fileName = `${sanitizeFileName(record.ID || record.Title || 'card')}.png`;
			const filePath = path.join(outputDir, fileName);
			await fs.writeFile(filePath, canvas.toBuffer('image/png'));
		})
	);

	console.log(`Generated ${milestones.length} milestone card(s) in ${outputDir}`);
}

function sanitizeFileName(value) {
	return value.replace(/[^a-z0-9._-]+/gi, '_');
}

function paintBackground(ctx) {
	ctx.fillStyle = BACKGROUND_COLOR;
	ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);

	ctx.strokeStyle = '#d4cdc3';
	ctx.lineWidth = 4;
	ctx.strokeRect(EDGE_THICKNESS / 2, EDGE_THICKNESS / 2, CARD_SIZE - EDGE_THICKNESS, CARD_SIZE - EDGE_THICKNESS);
}

function paintEdges(ctx, record) {
	const edges = [
		{ key: 'North edge', position: 'north' },
		{ key: 'East edge', position: 'east' },
		{ key: 'South edge', position: 'south' },
		{ key: 'West edge', position: 'west' }
	];

	edges.forEach(({ key, position }) => {
		const value = (record[key] || '').trim();
		if (!value) return;
		drawEdge(ctx, position, value);
	});
}

function drawEdge(ctx, position, code) {
	const rect = edgeRect(position);
	if (code === '*') {
		drawStripedEdge(ctx, rect, position);
		return;
	}

	const color = EDGE_COLORS[code] || '#cbd5e0';
	ctx.fillStyle = color;
	ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
}

function drawStripedEdge(ctx, rect, position) {
	if (position === 'north' || position === 'south') {
		const stripeWidth = rect.width / STRIPE_COLORS.length;
		STRIPE_COLORS.forEach((color, index) => {
			ctx.fillStyle = color;
			const x = rect.x + index * stripeWidth;
			ctx.fillRect(x, rect.y, stripeWidth, rect.height);
		});
	} else {
		const stripeHeight = rect.height / STRIPE_COLORS.length;
		STRIPE_COLORS.forEach((color, index) => {
			ctx.fillStyle = color;
			const y = rect.y + index * stripeHeight;
			ctx.fillRect(rect.x, y, rect.width, stripeHeight);
		});
	}
}

function edgeRect(position) {
	switch (position) {
		case 'north':
			return { x: 0, y: 0, width: CARD_SIZE, height: EDGE_THICKNESS };
		case 'south':
			return { x: 0, y: CARD_SIZE - EDGE_THICKNESS, width: CARD_SIZE, height: EDGE_THICKNESS };
		case 'east':
			return { x: CARD_SIZE - EDGE_THICKNESS, y: 0, width: EDGE_THICKNESS, height: CARD_SIZE };
		case 'west':
			return { x: 0, y: 0, width: EDGE_THICKNESS, height: CARD_SIZE };
		default:
			throw new Error(`Unknown edge position: ${position}`);
	}
}

function paintCopy(ctx, record) {
	const safeZoneLeft = EDGE_THICKNESS + CONTENT_PADDING;
	const safeZoneRight = CARD_SIZE - EDGE_THICKNESS - CONTENT_PADDING;
	const contentWidth = safeZoneRight - safeZoneLeft;

	// Title
	ctx.textAlign = 'center';
	ctx.textBaseline = 'top';
	ctx.fillStyle = BODY_TEXT_COLOR;
	ctx.font = '700 34px "Noto Sans", "Montserrat", sans-serif';
	ctx.fillText((record.Title || '').trim(), CARD_SIZE / 2, EDGE_THICKNESS + 20);

	// Divider line
	ctx.strokeStyle = '#d9cbbd';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(safeZoneLeft, EDGE_THICKNESS + 70);
	ctx.lineTo(safeZoneRight, EDGE_THICKNESS + 70);
	ctx.stroke();

	// Body copy
	ctx.textAlign = 'left';
	ctx.font = '500 22px "Noto Sans", "Montserrat", sans-serif';

	const paragraphs = toParagraphs(record.Text);
	let cursorY = EDGE_THICKNESS + 90;
	paragraphs.forEach((paragraph, index) => {
		cursorY = drawParagraph(ctx, paragraph, safeZoneLeft, cursorY, contentWidth, 30);
		if (index !== paragraphs.length - 1) {
			cursorY += 16;
		}
	});
}

function toParagraphs(raw = '') {
	const normalized = raw.replace(/\r/g, '').trim();
	if (!normalized) return [];
	return normalized
		.split(/\n\s*\n/)
		.map((section) => section.replace(/\s+/g, ' ').trim())
		.filter(Boolean);
}

function drawParagraph(ctx, text, x, startY, maxWidth, lineHeight) {
	const words = text.split(/\s+/);
	let line = '';
	let cursorY = startY;

	words.forEach((word, index) => {
		const testLine = line ? `${line} ${word}` : word;
		const metrics = ctx.measureText(testLine);
		if (metrics.width > maxWidth && line) {
			ctx.fillText(line, x, cursorY);
			line = word;
			cursorY += lineHeight;
		} else {
			line = testLine;
		}

		if (index === words.length - 1) {
			ctx.fillText(line, x, cursorY);
		}
	});

	return cursorY + lineHeight;
}

if (require.main === module) {
	main().catch((error) => {
		console.error('Failed to generate milestone cards:', error);
		process.exitCode = 1;
	});
}
