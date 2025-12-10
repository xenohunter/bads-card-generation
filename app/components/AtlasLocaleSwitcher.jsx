"use client";

import { useMemo, useState } from 'react';

export default function AtlasLocaleSwitcher({ assetsByLocale }) {
	const localeOptions = useMemo(() => Object.keys(assetsByLocale || {}).sort(), [assetsByLocale]);
	const [selectedLocale, setSelectedLocale] = useState(localeOptions[0] || 'default');

	if (!localeOptions.length) {
		return (
			<>
				<section>
					<h2>Atlases</h2>
					<p>No atlases have been generated yet.</p>
				</section>
				<section>
					<h2>Misc Assets</h2>
					<p>No misc files have been generated yet.</p>
				</section>
			</>
		);
	}

	const currentLocale = assetsByLocale[selectedLocale] ?? { atlases: [], misc: [] };

	return (
		<>
			<div className="locale-switcher">
				<label htmlFor="locale-select">Locale</label>
				<select
					id="locale-select"
					value={selectedLocale}
					onChange={(event) => setSelectedLocale(event.target.value)}
				>
					{localeOptions.map((locale) => (
						<option key={locale} value={locale}>
							{locale.toUpperCase()}
						</option>
					))}
				</select>
			</div>

			<section>
				<h2>Atlases</h2>
				{currentLocale.atlases.length ? (
					<ul>
						{currentLocale.atlases.map((file) => (
							<li key={file.name}>
								<a href={`/atlases/${selectedLocale}/${file.name}`} target="_blank" rel="noopener noreferrer">
									{file.name}
								</a>{' '}
								<span className="badge">
									{file.cardCount ? `${file.cardCount} cards` : 'card count unknown'}
								</span>
							</li>
						))}
					</ul>
				) : (
					<p>No atlases for this locale yet.</p>
				)}
			</section>

			<section>
				<h2>Misc Assets</h2>
				{currentLocale.misc.length ? (
					<ul>
						{currentLocale.misc.map((file) => (
							<li key={file}>
								<a href={`/misc/${selectedLocale}/${file}`} target="_blank" rel="noopener noreferrer">
									{file}
								</a>
							</li>
						))}
					</ul>
				) : (
					<p>No misc assets for this locale yet.</p>
				)}
			</section>
		</>
	);
}
