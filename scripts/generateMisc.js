#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const { createCanvas } = require('canvas');
const {
	CARD_SIZE,
	EDGE_THICKNESS,
	CONTENT_PADDING,
	BODY_TEXT_COLOR,
	MISC_CARD_TYPES
} = require('./utils/constants');

async function main() {
	const outputDir = path.resolve(__dirname, '../outputs/misc');
	await fs.rm(outputDir, { recursive: true, force: true });
	await fs.mkdir(outputDir, { recursive: true });

	await Promise.all(
		MISC_CARD_TYPES.map(async (card) => {
			const canvas = createCanvas(CARD_SIZE, CARD_SIZE);
			const ctx = canvas.getContext('2d');
			paintCardBack(ctx, card);
			const targetPath = path.join(outputDir, `${card.key}.png`);
			await fs.writeFile(targetPath, canvas.toBuffer('image/png'));
		})
	);

	console.log(`Generated ${MISC_CARD_TYPES.length} misc card backs in ${outputDir}`);
}

function paintCardBack(ctx, card) {
	ctx.fillStyle = card.background;
	ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);

	ctx.strokeStyle = '#d4cdc3';
	ctx.lineWidth = 4;
	ctx.strokeRect(EDGE_THICKNESS / 2, EDGE_THICKNESS / 2, CARD_SIZE - EDGE_THICKNESS, CARD_SIZE - EDGE_THICKNESS);

	const safeLeft = EDGE_THICKNESS + CONTENT_PADDING;
	const safeRight = CARD_SIZE - EDGE_THICKNESS - CONTENT_PADDING;
	const safeWidth = safeRight - safeLeft;
	const top = EDGE_THICKNESS + CONTENT_PADDING;

	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = '#ffffff18';
	ctx.font = '900 220px "Montserrat", sans-serif';
	ctx.fillText(card.label.slice(0, 1), CARD_SIZE / 2, CARD_SIZE / 2);

	ctx.fillStyle = BODY_TEXT_COLOR;
	ctx.font = '800 60px "Montserrat", sans-serif';
	ctx.fillText(card.label, CARD_SIZE / 2, CARD_SIZE / 2);
}

if (require.main === module) {
	main().catch((error) => {
		console.error('Failed to generate misc cards:', error);
		process.exitCode = 1;
	});
}
