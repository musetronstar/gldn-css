/*
 * gldn-css examples: proves the golden contract live in the page.
 *
 * 1. The theme toggle flips .gldn-theme-dark on <html>; the tokens layer
 *    re-skins every component because all colors are custom properties.
 * 2. The ratio reporters measure the rendered major/minor widths and
 *    compare them against the phi token, demonstrating that both the
 *    fixed and the fluid split hold the golden ratio at any viewport.
 */
(function () {
	const phi = parseFloat(
		getComputedStyle(document.documentElement).getPropertyValue('--gldn-phi')
	);

	const themeToggle = document.getElementById('gldn-theme-toggle');
	themeToggle.addEventListener('click', function () {
		const dark = document.documentElement.classList.toggle('gldn-theme-dark');
		themeToggle.textContent = dark ? 'light theme' : 'dark theme';
		themeToggle.setAttribute('aria-pressed', String(dark));
	});

	function reportRatio(majorId, minorId, outputId) {
		const major = document.getElementById(majorId);
		const minor = document.getElementById(minorId);
		const output = document.getElementById(outputId);

		// Boxes carry no borders, so bounding widths are the layout widths.
		const majorWidth = major.getBoundingClientRect().width;
		const minorWidth = minor.getBoundingClientRect().width;

		// Below the breakpoint both columns stack to full width; report the
		// reflow honestly instead of showing a meaningless deviation.
		if (Math.abs(majorWidth - minorWidth) < 1.5) {
			output.textContent = 'stacked: columns reflowed to full width';
			return;
		}

		const measured = majorWidth / minorWidth;
		const deviation = 100 * (measured - phi) / phi;
		output.textContent = 'major/minor = ' + measured.toFixed(4)
			+ ' (phi = ' + phi.toFixed(4) + ', deviation ' + deviation.toFixed(2) + '%)';
	}

	const pairs = [
		['demo-fixed-major', 'demo-fixed-minor', 'gldn-ratio-fixed'],
		['demo-fluid-major', 'demo-fluid-minor', 'gldn-ratio-fluid']
	];

	for (const [majorId, minorId, outputId] of pairs) {
		// Re-measure on reflow so the readout tracks the live layout.
		new ResizeObserver(function () {
			reportRatio(majorId, minorId, outputId);
		}).observe(document.getElementById(majorId));
	}
}());
