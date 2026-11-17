/*
 * Rendered tests for golden splits: rows of golden columns against the intrinsic
 * threshold and default phone-width floor in --gldn-split-min, the workspace against
 * --gldn-bp-sm, and the split ratio at fractional row widths. Run through
 * test/layout.test.mjs.
 */
import { writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PHI = 1.61803398875;

const row = (id, fluid, style = '') => {
	const [major, minor] = fluid ? ['gldn-major-fluid', 'gldn-minor-fluid'] : ['gldn-major', 'gldn-minor'];
	return `<div class="gldn-row" id="${id}"${style ? ` style="${style}"` : ''}>`
		+ `<div class="${minor}">minor</div><div class="${major}">major</div></div>`;
};

const body = `
	<div style="overflow: hidden"><div id="probe" style="width: var(--gldn-split-min)"></div></div>
	<div class="gldn-workspace" id="workspace">
		<aside class="gldn-sidebar">${row('row-sidebar', false)}${row('fluid-sidebar', true)}</aside>
		<main class="gldn-main">${row('row-main', false)}${row('fluid-main', true)}</main>
	</div>
	<div class="gldn-container">${row('row-page', false)}${row('fluid-page', true)}</div>
	<div style="overflow: hidden">
		${row('row-threshold', false)}
		${row('fluid-threshold', true)}
		${row('row-retuned', false, '--gldn-split-min: 20rem; width: 330px')}
		${[801.3, 640.7, 1000.55, 523.9, 777.77].map((width, i) =>
			row(`row-fraction-${i}`, false, `width: ${width}px`)
			+ row(`fluid-fraction-${i}`, true, `width: ${width}px`)).join('\n')}
	</div>`;

const measure = `(() => {
	const columns = (id) => [...document.getElementById(id).children].map((child) => child.getBoundingClientRect());
	const split = (id) => {
		const [minor, major] = columns(id);
		const element = document.getElementById(id);
		const gap = parseFloat(getComputedStyle(element).columnGap);
		return {
			stacked: major.top > minor.top + 1,
			ratio: major.width / minor.width,
			fillError: Math.abs(major.width + minor.width + gap - element.clientWidth),
			fullWidth: Math.max(...columns(id).map((c) => Math.abs(c.width - element.clientWidth)))
		};
	};
	const threshold = document.getElementById('probe').getBoundingClientRect().width;
	const crossing = {};
	/* The phone floor is a viewport guard, not a row width worth simulating at
	 * hundreds of thousands of pixels. Real phone rows are measured below. */
	if (matchMedia('(min-width: 48rem)').matches) {
		for (const id of ['row-threshold', 'fluid-threshold']) {
			const element = document.getElementById(id);
			element.style.width = (threshold - 1) + 'px';
			const below = split(id);
			element.style.width = (threshold + 1) + 'px';
			const above = split(id);
			crossing[id] = { below, above };
		}
	}
	const workspace = document.getElementById('workspace');
	const [sidebar, main] = [...workspace.children].map((child) => child.getBoundingClientRect());
	const ids = [...document.querySelectorAll('.gldn-row')].map((element) => element.id);
	return {
		threshold,
		crossing,
		splits: Object.fromEntries(ids.filter((id) => !id.endsWith('threshold')).map((id) => [id, split(id)])),
		workspaceStacked: main.top > sidebar.top + 1,
		overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
	};
})()`;

export async function testSplits(browser, test, root) {
	const file = path.join(os.tmpdir(), 'gldn-splits.html');
	writeFileSync(file, `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">`
		+ `<link rel="stylesheet" href="file://${path.join(root, 'dist', 'gldn.min.css')}">`
		+ `</head><body>${body}</body></html>`);

	const states = {};
	for (const width of [320, 390, 430, 768, 1200]) {
		await browser.viewport(width);
		await browser.navigate('file://' + file, 16);
		states[width] = await browser.evaluate(measure);
	}
	const wide = states[1200];
	const holds = (split) => !split.stacked && Math.abs(split.ratio - PHI) / PHI <= 0.0001
		&& split.fillError <= 0.5;

	test('at 1200px a golden row stacks in the sidebar and splits in the main panel and the page', () => {
		const { splits } = wide;
		if (!splits['row-sidebar'].stacked || !splits['fluid-sidebar'].stacked
			|| splits['row-sidebar'].fullWidth > 0.5) {
			throw new Error(`sidebar: ${JSON.stringify(splits['row-sidebar'])}`);
		}
		for (const id of ['row-main', 'row-page', 'fluid-main', 'fluid-page']) {
			if (!holds(splits[id])) throw new Error(`${id}: ${JSON.stringify(splits[id])}`);
		}
	});

	test('default golden rows stack across common phone widths', () => {
		for (const width of [390, 430]) {
			for (const id of ['row-page', 'fluid-page']) {
				const current = states[width].splits[id];
				if (!current.stacked || current.fullWidth > 0.5) {
					throw new Error(`${width}px ${id}: ${JSON.stringify(current)}`);
				}
			}
		}
	});

	test('a golden row stacks 1px below --gldn-split-min and splits 1px above it', () => {
		for (const [width, current] of Object.entries(states)) {
			for (const [id, { below, above }] of Object.entries(current.crossing)) {
				if (!below.stacked || below.fullWidth > 0.5 || !holds(above)) {
					throw new Error(`${width}px ${id} at ${current.threshold}px: ${JSON.stringify({ below, above })}`);
				}
			}
		}
	});

	test('a row that retunes --gldn-split-min follows its own value', () => {
		const retuned = wide.splits['row-retuned'];
		if (!holds(retuned) || wide.threshold <= 330) {
			throw new Error(JSON.stringify({ retuned, threshold: wide.threshold }));
		}
	});

	test('the ratio and the row fill hold at fractional row widths', () => {
		for (const [id, split] of Object.entries(wide.splits)) {
			if (id.includes('fraction') && !holds(split)) {
				throw new Error(`${id}: ${JSON.stringify(split)}`);
			}
		}
	});

	test('a page-wide workspace is stacked at 320px and 768px and split at 1200px', () => {
		if (!states[320].workspaceStacked || !states[768].workspaceStacked || wide.workspaceStacked) {
			throw new Error(JSON.stringify(Object.fromEntries(
				Object.entries(states).map(([width, state]) => [width, state.workspaceStacked]))));
		}
	});

	test('golden splits cause no horizontal overflow at 320px, 768px or 1200px', () => {
		for (const [width, current] of Object.entries(states)) {
			if (current.overflow > 1) {
				throw new Error(`${width}px overflow ${current.overflow}`);
			}
		}
	});
}
