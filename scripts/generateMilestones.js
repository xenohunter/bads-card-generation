#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const { createCanvas } = require('canvas');
const { parse } = require('csv-parse/sync');
require('./utils/fontRegistry'); // Register fonts
const {
	CARD_SIZE,
	EDGE_THICKNESS,
	CONTENT_PADDING,
	BODY_TEXT_COLOR,
	MILESTONE_BACK_FILE_NAME
} = require('./utils/constants');
const { paintEdgesAndDividers } = require('./utils/edgePainter');
const { shouldIgnoreRecord } = require('./utils/recordFilters');
const { resolveOutputPath } = require('./utils/runtimeConfig');
const { getLocalizedText } = require('./utils/textHelpers');

const MILESTONE_FACE_BACKGROUND = '#dff6c2';
const SCORE_PANEL_COLOR = '#243c2c';
const SCORE_PANEL_LABEL_COLOR = '#f0e6d8';
const INFO_BADGE_RADIUS = 70;
const INFO_BADGE_GAP = 28;
const INFO_BADGE_VALUE_COLOR = '#ffffff';
const INFO_BADGE_VALUE_ALPHA = 0.35;
const DEADLINE_BADGE_COLOR = '#5b2324';
const MILESTONE_BACK_BASE = '#f7efe3';
const MILESTONE_BACK_GLOW = '#fefaf2';

async function main() {
	const csvPath = path.resolve(__dirname, '../data/milestones.csv');
	const outputDir = resolveOutputPath('milestones');
	const miscDir = resolveOutputPath('misc');

	await Promise.all([
		fs.mkdir(outputDir, { recursive: true }),
		fs.mkdir(miscDir, { recursive: true })
	]);

	const csvRaw = await fs.readFile(csvPath, 'utf8');
	const milestones = parse(csvRaw, {
		columns: true,
		skip_empty_lines: true,
		relax_quotes: true
	});

	const filteredMilestones = milestones.filter((record) => !shouldIgnoreRecord(record));

	await Promise.all(
		filteredMilestones.map(async (record) => {
			const baseName = sanitizeFileName(record.ID || record.Title || 'card');

			const frontPath = path.join(outputDir, `${baseName}.png`);
			await drawMilestoneFront(frontPath, record);
		})
	);

	const sharedBackPath = path.join(miscDir, MILESTONE_BACK_FILE_NAME);
	await drawMilestoneBack(sharedBackPath, {});

	console.log(
		`Generated ${filteredMilestones.length} milestone card faces in ${outputDir} and shared back at ${sharedBackPath}`
	);
}

function sanitizeFileName(value) {
	return value.replace(/[^a-z0-9._-]+/gi, '_');
}

function paintBackground(ctx) {
	ctx.fillStyle = MILESTONE_FACE_BACKGROUND;
	ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);

}


async function drawMilestoneFront(filePath, record, options = {}) {
	const canvas = createCanvas(CARD_SIZE, CARD_SIZE);
	const ctx = canvas.getContext('2d');
	const isBlank = options.blank === true || record.__blank === true;
	paintBackground(ctx);
	paintEdgesAndDividers(ctx, record);
	paintCopy(ctx, record, { isBlank });
	await fs.writeFile(filePath, canvas.toBuffer('image/png'));
}

async function drawMilestoneBack(filePath, record = {}, options = {}) {
	const canvas = createCanvas(CARD_SIZE, CARD_SIZE);
	const ctx = canvas.getContext('2d');
	const isBlank = options.blank === true || record.__blank === true;
	paintBack(ctx, { isBlank });
	await fs.writeFile(filePath, canvas.toBuffer('image/png'));
}

function paintCopy(ctx, record, { isBlank = false } = {}) {
	const safeZoneLeft = EDGE_THICKNESS + CONTENT_PADDING;
	const safeZoneRight = CARD_SIZE - EDGE_THICKNESS - CONTENT_PADDING;
	const contentWidth = safeZoneRight - safeZoneLeft;
	const safeZoneBottom = CARD_SIZE - EDGE_THICKNESS - CONTENT_PADDING;

// Title (smaller font)
	if (!isBlank) {
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		ctx.fillStyle = BODY_TEXT_COLOR;
		ctx.font = '700 28px "Noto Sans", "Noto Color Emoji", "Montserrat", "Noto Color Emoji", sans-serif';
		ctx.fillText((record.Title || '').trim(), CARD_SIZE / 2, EDGE_THICKNESS + 16);
	}

	// Divider line
	ctx.strokeStyle = '#d9cbbd';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(safeZoneLeft, EDGE_THICKNESS + 56);
	ctx.lineTo(safeZoneRight, EDGE_THICKNESS + 56);
	ctx.stroke();

	if (isBlank) {
		return;
	}

	// Body copy (smaller font)
	ctx.textAlign = 'left';
	const bodyFont = '500 18px "Noto Sans", "Noto Color Emoji", "Montserrat", "Noto Color Emoji", sans-serif';
	ctx.font = bodyFont;

	let cursorY = EDGE_THICKNESS + 90;
	const minimumScore = formatMinimumScore(record['Minimum Score']);
	const deadlineValue = formatDeadlineValue(record.Deadline);

	const bodyLineHeight = 24;
	const blankLineHeight = 22;
	const bodyCopy = getLocalizedText(record, ['Text']);
	cursorY = drawTextBlock(ctx, bodyCopy, {
		x: safeZoneLeft,
		y: cursorY,
		maxWidth: contentWidth,
		lineHeight: bodyLineHeight,
		blankLineHeight
	});

	const funny = record['Funny text'];
	if (funny && funny.trim()) {
		cursorY += 18;
		ctx.font = 'italic 500 18px "Noto Sans", "Noto Color Emoji", "Montserrat", "Noto Color Emoji", sans-serif';
		cursorY = drawTextBlock(ctx, funny, {
			x: safeZoneLeft,
			y: cursorY,
			maxWidth: contentWidth,
			lineHeight: 22,
			blankLineHeight: 20
		});
	}

	drawInfoBadges(ctx, {
		scoreValue: minimumScore,
		deadlineValue,
		safeZoneBottom
	});
}

function drawInfoBadges(ctx, { scoreValue, deadlineValue, safeZoneBottom }) {
	const badges = [];
	if (scoreValue) {
		badges.push({ label: 'SCORE', value: scoreValue, fill: SCORE_PANEL_COLOR });
	}
	if (deadlineValue) {
		badges.push({ label: 'DEADLINE', value: deadlineValue, fill: DEADLINE_BADGE_COLOR });
	}
	if (!badges.length) {
		return;
	}
	const radius = INFO_BADGE_RADIUS;
	const diameter = radius * 2;
	const gap = INFO_BADGE_GAP;
	const totalWidth = badges.length * diameter + Math.max(badges.length - 1, 0) * gap;
	let centerX = CARD_SIZE / 2 - totalWidth / 2 + radius;
	const centerY = safeZoneBottom - radius - 16;
	badges.forEach((badge) => {
		drawInfoBadge(ctx, {
			...badge,
			centerX,
			centerY,
			radius
		});
		centerX += diameter + gap;
	});
}

function drawInfoBadge(ctx, { label, value, centerX, centerY, radius, fill = SCORE_PANEL_COLOR }) {
	ctx.save();
	ctx.beginPath();
	ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
	ctx.closePath();
	ctx.fillStyle = fill;
	ctx.fill();

	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = SCORE_PANEL_LABEL_COLOR;
	ctx.font = '700 20px "Noto Sans", "Noto Color Emoji", "Montserrat", "Noto Color Emoji", sans-serif';
	ctx.fillText(label, centerX, centerY);

	ctx.save();
	ctx.fillStyle = INFO_BADGE_VALUE_COLOR;
	ctx.globalAlpha = INFO_BADGE_VALUE_ALPHA;
	const valueFontSize = fitBadgeValueFont(ctx, value, radius);
	ctx.font = `900 ${valueFontSize}px "Montserrat", "Noto Color Emoji", sans-serif`;
	ctx.fillText(value, centerX, centerY);
	ctx.restore();
	ctx.restore();
}

function fitBadgeValueFont(ctx, value, radius) {
	const maxWidth = radius * 1.6;
	let size = Math.min(radius * 1.5, 120);
	const minSize = 28;
	while (size >= minSize) {
		ctx.font = `900 ${size}px "Montserrat", "Noto Color Emoji", sans-serif`;
		if (ctx.measureText(String(value)).width <= maxWidth) {
			return size;
		}
		size -= 4;
	}
	return minSize;
}

function formatMinimumScore(value) {
	const raw = String(value ?? '').trim();
	if (!raw) {
		return '';
	}
	const numeric = Number(raw);
	if (Number.isFinite(numeric)) {
		return `${numeric}`;
	}
	return raw;
}

function formatDeadlineValue(value) {
	const raw = String(value ?? '').trim();
	if (!raw) {
		return '';
	}
	const numeric = Number(raw);
	if (Number.isFinite(numeric)) {
		return `${numeric}`;
	}
	return raw;
}

function paintBack(ctx, { isBlank = false } = {}) {
	ctx.fillStyle = MILESTONE_BACK_BASE;
	ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);

	const gradient = ctx.createLinearGradient(EDGE_THICKNESS, EDGE_THICKNESS, CARD_SIZE - EDGE_THICKNESS, CARD_SIZE - EDGE_THICKNESS);
	gradient.addColorStop(0, MILESTONE_BACK_GLOW);
	gradient.addColorStop(1, '#ecdcc4');
	ctx.fillStyle = gradient;
	ctx.fillRect(EDGE_THICKNESS, EDGE_THICKNESS, CARD_SIZE - EDGE_THICKNESS * 2, CARD_SIZE - EDGE_THICKNESS * 2);

	ctx.strokeStyle = `${SCORE_PANEL_COLOR}33`;
	ctx.lineWidth = 6;
	ctx.strokeRect(
		EDGE_THICKNESS + 12,
		EDGE_THICKNESS + 12,
		CARD_SIZE - (EDGE_THICKNESS + 12) * 2,
		CARD_SIZE - (EDGE_THICKNESS + 12) * 2
	);

	ctx.fillStyle = `${SCORE_PANEL_COLOR}10`;
	ctx.beginPath();
	ctx.arc(CARD_SIZE / 2, CARD_SIZE / 2, 140, 0, Math.PI * 2);
	ctx.fill();

	if (isBlank) {
		return;
	}

	ctx.fillStyle = SCORE_PANEL_COLOR;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = '800 48px "Montserrat", "Noto Color Emoji", sans-serif';
	ctx.fillText('MILESTONE', CARD_SIZE / 2, CARD_SIZE / 2);
}

function drawTextBlock(ctx, raw = '', options) {
	const { x, y, maxWidth, lineHeight, blankLineHeight = lineHeight } = options;
	const normalized = String(raw ?? '')
		.replace(/\r/g, '')
		.replace(/\t/g, '    ');
	if (!normalized.trim()) {
		return y;
	}

	const lines = normalized.split('\n');
	let cursorY = y;
	lines.forEach((line) => {
		if (!line.trim()) {
			cursorY += blankLineHeight;
			return;
		}
		cursorY = drawWrappedLine(ctx, line, x, cursorY, maxWidth, lineHeight);
	});
	return cursorY;
}

function drawWrappedLine(ctx, text, x, startY, maxWidth, lineHeight) {
	const tokens = text.match(/\S+\s*/g) || [];
	let line = '';
	let cursorY = startY;

	tokens.forEach((token, index) => {
		const testLine = line + token;
		const metrics = ctx.measureText(testLine);
		if (metrics.width > maxWidth && line) {
			ctx.fillText(line.trimEnd(), x, cursorY);
			line = token.trimStart();
			cursorY += lineHeight;
		} else {
			line = testLine;
		}

		if (index === tokens.length - 1) {
			ctx.fillText(line.trimEnd(), x, cursorY);
			cursorY += lineHeight;
		}
	});

	if (!tokens.length) {
		ctx.fillText('', x, cursorY);
		cursorY += lineHeight;
	}

	return cursorY;
}

if (require.main === module) {
	main().catch((error) => {
		console.error('Failed to generate milestone cards:', error);
		process.exitCode = 1;
	});
}

module.exports = {
	drawMilestoneFront,
	drawMilestoneBack
};
