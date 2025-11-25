#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const { createCanvas } = require('canvas');
const { parse } = require('csv-parse/sync');

const CARD_SIZE = 490;
const EDGE_THICKNESS = 40;
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

	// Draw diagonal dividers at corners
	drawCornerDividers(ctx);
}

function drawCornerDividers(ctx) {
	const dividerColor = '#333';
	ctx.save();
	ctx.strokeStyle = dividerColor;
	ctx.lineWidth = 4;
	const lines = [
		[
			{ x: 0, y: 0 },
			{ x: EDGE_THICKNESS, y: EDGE_THICKNESS }
		],
		[
			{ x: CARD_SIZE - EDGE_THICKNESS, y: EDGE_THICKNESS },
			{ x: CARD_SIZE, y: 0 }
		],
		[
			{ x: 0, y: CARD_SIZE },
			{ x: EDGE_THICKNESS, y: CARD_SIZE - EDGE_THICKNESS }
		],
		[
			{ x: CARD_SIZE - EDGE_THICKNESS, y: CARD_SIZE - EDGE_THICKNESS },
			{ x: CARD_SIZE, y: CARD_SIZE }
		]
	];

	lines.forEach(([start, end]) => {
		ctx.beginPath();
		ctx.moveTo(start.x, start.y);
		ctx.lineTo(end.x, end.y);
		ctx.stroke();
	});
	ctx.restore();
}

function drawEdge(ctx, position, code) {
	const rect = edgeRect(position);
	withEdgeClip(ctx, position, () => {
		if (code === '*') {
			drawStripedEdge(ctx, rect, position);
			return;
		}

		const color = EDGE_COLORS[code] || '#cbd5e0';
		ctx.fillStyle = color;
		ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
	});
}

function drawStripedEdge(ctx, rect, position) {
	// Draw stripes as 10px wide, repeating, with diagonal dividers at corners
	const stripeWidth = 10;
	const stripesCount = Math.ceil((position === 'north' || position === 'south' ? rect.width : rect.height) / stripeWidth);
	for (let i = 0; i < stripesCount; i++) {
		const color = STRIPE_COLORS[i % STRIPE_COLORS.length];
		ctx.fillStyle = color;
		if (position === 'north') {
			ctx.fillRect(rect.x + i * stripeWidth, rect.y, stripeWidth, rect.height);
		} else if (position === 'south') {
			ctx.fillRect(rect.x + i * stripeWidth, rect.y, stripeWidth, rect.height);
		} else if (position === 'east') {
			ctx.fillRect(rect.x, rect.y + i * stripeWidth, rect.width, stripeWidth);
		} else if (position === 'west') {
			ctx.fillRect(rect.x, rect.y + i * stripeWidth, rect.width, stripeWidth);
		}
	}
}

function withEdgeClip(ctx, position, drawFn) {
	ctx.save();
	ctx.beginPath();
	createEdgePath(ctx, position);
	ctx.closePath();
	ctx.clip();
	drawFn();
	ctx.restore();
}

function createEdgePath(ctx, position) {
	switch (position) {
		case 'north':
			ctx.moveTo(0, 0);
			ctx.lineTo(CARD_SIZE, 0);
			ctx.lineTo(CARD_SIZE - EDGE_THICKNESS, EDGE_THICKNESS);
			ctx.lineTo(EDGE_THICKNESS, EDGE_THICKNESS);
			break;
		case 'south':
			ctx.moveTo(EDGE_THICKNESS, CARD_SIZE - EDGE_THICKNESS);
			ctx.lineTo(CARD_SIZE - EDGE_THICKNESS, CARD_SIZE - EDGE_THICKNESS);
			ctx.lineTo(CARD_SIZE, CARD_SIZE);
			ctx.lineTo(0, CARD_SIZE);
			break;
		case 'east':
			ctx.moveTo(CARD_SIZE - EDGE_THICKNESS, EDGE_THICKNESS);
			ctx.lineTo(CARD_SIZE, 0);
			ctx.lineTo(CARD_SIZE, CARD_SIZE);
			ctx.lineTo(CARD_SIZE - EDGE_THICKNESS, CARD_SIZE - EDGE_THICKNESS);
			break;
		case 'west':
			ctx.moveTo(0, 0);
			ctx.lineTo(EDGE_THICKNESS, EDGE_THICKNESS);
			ctx.lineTo(EDGE_THICKNESS, CARD_SIZE - EDGE_THICKNESS);
			ctx.lineTo(0, CARD_SIZE);
			break;
		default:
			throw new Error(`Unknown edge position for clip path: ${position}`);
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

	// Title (smaller font)
	ctx.textAlign = 'center';
	ctx.textBaseline = 'top';
	ctx.fillStyle = BODY_TEXT_COLOR;
	ctx.font = '700 28px "Noto Sans", "Montserrat", sans-serif';
	ctx.fillText((record.Title || '').trim(), CARD_SIZE / 2, EDGE_THICKNESS + 16);

	// Divider line
	ctx.strokeStyle = '#d9cbbd';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(safeZoneLeft, EDGE_THICKNESS + 56);
	ctx.lineTo(safeZoneRight, EDGE_THICKNESS + 56);
	ctx.stroke();

	// Body copy (smaller font)
	ctx.textAlign = 'left';
	ctx.font = '500 18px "Noto Sans", "Montserrat", sans-serif';

	const paragraphs = toParagraphs(record.Text);
	let cursorY = EDGE_THICKNESS + 70;
	paragraphs.forEach((paragraph, index) => {
		cursorY = drawParagraph(ctx, paragraph, safeZoneLeft, cursorY, contentWidth, 24);
		if (index !== paragraphs.length - 1) {
			cursorY += 12;
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
