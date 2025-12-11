const path = require('path');
const fs = require('fs');
const { registerFont } = require('canvas');

const FONTS_DIR = path.resolve(__dirname, '../../fonts');

// Register all fonts once at module load
function registerFonts() {
	try {
		// Noto Sans (regular and bold weights)
		const notoRegular = path.join(FONTS_DIR, 'NotoSans-Regular.ttf');
		const notoBold = path.join(FONTS_DIR, 'NotoSans-Bold.ttf');

		if (fs.existsSync(notoRegular)) {
			registerFont(notoRegular, { family: 'Noto Sans', weight: '400' });
			registerFont(notoRegular, { family: 'Noto Sans', weight: '500' });
			registerFont(notoRegular, { family: 'Noto Sans', weight: '600' });
		}

		if (fs.existsSync(notoBold)) {
			registerFont(notoBold, { family: 'Noto Sans', weight: '700' });
			registerFont(notoBold, { family: 'Noto Sans', weight: '800' });
		}

		// Noto Color Emoji - CRITICAL for emoji support
		const emojiFont = path.join(FONTS_DIR, 'NotoColorEmoji.ttf');
		if (fs.existsSync(emojiFont)) {
			registerFont(emojiFont, { family: 'Noto Color Emoji' });
			console.log('✓ Emoji font registered successfully');
		} else {
			console.warn('⚠ Warning: NotoColorEmoji.ttf not found - emojis may not render');
		}

		console.log('✓ Fonts registered');
	} catch (error) {
		console.error('Error registering fonts:', error.message);
	}
}

// Register fonts immediately when module is loaded
registerFonts();

module.exports = {
	registerFonts
};
