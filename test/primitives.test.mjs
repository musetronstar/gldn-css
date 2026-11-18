/*
 * Rendered tests for the layout primitives: grid and switcher thresholds, cluster wrapping,
 * golden frames, stack spacing, and scopes that re-derive the scales. Run through
 * test/layout.test.mjs.
 */
import { writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PHI = 1.61803398875;

/* A tall image, so a frame must crop rather than grow to fit it. */
const tallImage = 'data:image/svg+xml,' + encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="400">'
	+ '<rect width="100" height="400" fill="#888"/></svg>');

const cells = (count) => Array.from({ length: count }, (_, i) => `<div>cell ${i + 1}</div>`).join('');

const body = `
	<div class="gldn-container"><div class="gldn-grid" id="grid-page">${cells(6)}</div></div>
	<div class="gldn-workspace">
		<aside class="gldn-sidebar">
			<div class="gldn-switcher" id="switcher-sidebar"><div>one</div><div>two</div></div>
		</aside>
		<main class="gldn-main">
			<div class="gldn-switcher" id="switcher-main"><div>one</div><div>two</div></div>
			<div class="gldn-grid" id="grid-main">${cells(6)}</div>
		</main>
	</div>
	<div class="gldn-cluster" id="cluster">
		<button type="button">golden</button><button type="button">ratio</button><button type="button">scale</button>
	</div>
	<div class="gldn-frame" id="frame"><img id="frame-image" src="${tallImage}" alt=""></div>
	<div class="gldn-frame gldn-frame-portrait" id="portrait" style="width: 50%"></div>
	<div class="gldn-stack" id="stack"><p>paragraph</p><div>division</div><h2>heading</h2><p>paragraph</p></div>
	<div id="outer"><div class="gldn-compact" id="compact"><div class="gldn-row" id="compact-row">
		<div>a</div><div>b</div></div></div></div>
	<div class="gldn-spacious" id="spacious"></div>
	<div class="gldn-scope" id="scope" style="--gldn-text-base: 0.875rem"></div>
	<div class="gldn-sided" id="sided"><div id="side">side</div><div id="sided-content">content</div></div>
	<div class="gldn-sided gldn-sided-end" id="sided-end"><div id="end-content">content</div><div id="end-side">side</div></div>
	<div class="gldn-stack" id="stack-tight" style="--gldn-stack-space: 10px"><p>a</p><p>b</p></div>
	<div class="gldn-cluster" id="cluster-end" style="--gldn-cluster-justify: flex-end"><button type="button" id="cluster-end-item">one</button></div>
	<style>@container gldn (min-width: 40rem) { .context-probe { outline-style: dashed } }</style>
	<section class="gldn-context" id="context"><p class="context-probe" id="context-wide">probe</p></section>
	<section class="gldn-context" style="width: 300px"><p class="context-probe" id="context-narrow">probe</p></section>`;

export async function testPrimitives(browser, test, root) {
	const file = path.join(os.tmpdir(), 'gldn-primitives.html');
	writeFileSync(file, `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">`
		+ `<link rel="stylesheet" href="file://${path.join(root, 'dist', 'gldn.min.css')}">`
		+ `</head><body>${body}</body></html>`);

	const state = `(() => {
		// A DOMRect does not cross the test bridge by value; copy its fields.
		const rect = (id) => document.getElementById(id).getBoundingClientRect().toJSON();
		const columns = (id) => getComputedStyle(document.getElementById(id))
			.gridTemplateColumns.split(' ').length;
		const stacked = (id) => {
			const [a, b] = document.getElementById(id).children;
			return b.getBoundingClientRect().top > a.getBoundingClientRect().top + 1;
		};
		const token = (id, name) => {
			const probe = document.createElement('div');
			probe.style.position = 'absolute';
			probe.style.width = 'var(--gldn-' + name + ')';
			document.getElementById(id).appendChild(probe);
			const width = probe.getBoundingClientRect().width;
			probe.remove();
			return width;
		};
		const cluster = document.getElementById('cluster');
		const items = [...cluster.children].map((child) => child.getBoundingClientRect());
		const stackChildren = [...document.getElementById('stack').children]
			.map((child) => child.getBoundingClientRect());
		return {
			overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
			gridPage: columns('grid-page'),
			gridPageWidth: rect('grid-page').width,
			gridMain: columns('grid-main'),
			gridMainWidth: rect('grid-main').width,
			switcherSidebar: stacked('switcher-sidebar'),
			switcherMain: stacked('switcher-main'),
			clusterOneLine: items.every((item) => Math.abs(item.top - items[0].top) < 1),
			clusterNarrowest: Math.max(...items.map((item) => item.width)) < cluster.clientWidth / 2,
			frame: rect('frame'),
			image: rect('frame-image'),
			portrait: rect('portrait'),
			stackGaps: stackChildren.slice(1).map((child, i) => child.top - stackChildren[i].bottom),
			stackGap: parseFloat(getComputedStyle(document.getElementById('stack')).rowGap),
			outerMd: token('outer', 'space-md'),
			outerLg: token('outer', 'space-lg'),
			compactLg: token('compact', 'space-lg'),
			compactGutter: parseFloat(getComputedStyle(document.getElementById('compact-row')).columnGap),
			compactText: token('compact', 'text-lg'),
			outerText: token('outer', 'text-lg'),
			spaciousMd: token('spacious', 'space-md'),
			scopeText: token('scope', 'text-lg'),
			sided: rect('sided'),
			side: rect('side'),
			sidedContent: rect('sided-content'),
			endSide: rect('end-side'),
			endContent: rect('end-content'),
			sideWidth: token('outer', 'side-width'),
			tightGap: parseFloat(getComputedStyle(document.getElementById('stack-tight')).rowGap),
			clusterEnd: rect('cluster-end').right - rect('cluster-end-item').right,
			contextWide: getComputedStyle(document.getElementById('context-wide')).outlineStyle,
			contextNarrow: getComputedStyle(document.getElementById('context-narrow')).outlineStyle
		};
	})()`;

	const states = {};
	for (const width of [320, 1200]) {
		await browser.viewport(width);
		await browser.navigate('file://' + file, 16);
		states[width] = await browser.evaluate(state);
	}
	const wide = states[1200];
	const narrow = states[320];

	test('the grid fits four columns in the container and two in the main panel at 1200px', () => {
		if (wide.gridPage !== 4 || wide.gridMain !== 2 || narrow.gridPage !== 1 || narrow.gridMain !== 1) {
			throw new Error(JSON.stringify({ wide, narrow }));
		}
	});

	test('the switcher is a row in the main panel and a stack in the sidebar at 1200px', () => {
		if (wide.switcherMain || !wide.switcherSidebar) {
			throw new Error(JSON.stringify(wide));
		}
	});

	test('cluster items share a line and keep their own width at 320px', () => {
		if (!narrow.clusterOneLine || !narrow.clusterNarrowest) {
			throw new Error(JSON.stringify(narrow));
		}
	});

	test('frames hold phi to 1 and 1 to phi and their media covers them', () => {
		for (const [width, current] of Object.entries(states)) {
			const { frame, image, portrait } = current;
			if (Math.abs(frame.height - frame.width / PHI) > 0.5
				|| Math.abs(portrait.height - portrait.width * PHI) > 0.5
				|| Math.abs(image.width - frame.width) > 0.5 || Math.abs(image.height - frame.height) > 0.5) {
				throw new Error(`${width}px: ${JSON.stringify({ frame, image, portrait })}`);
			}
		}
	});

	test('a stack leaves the same space between any children', () => {
		for (const [width, current] of Object.entries(states)) {
			if (current.stackGaps.some((gap) => Math.abs(gap - current.stackGap) > 0.5)) {
				throw new Error(`${width}px: ${JSON.stringify(current.stackGaps)} vs ${current.stackGap}`);
			}
		}
	});

	test('a compact scope steps space and the gutter down one power of phi, but not type', () => {
		for (const [width, current] of Object.entries(states)) {
			if (Math.abs(current.compactLg - current.outerMd) > 0.5
				|| (width === '1200' && Math.abs(current.compactGutter - current.outerMd) > 0.5)
				|| Math.abs(current.compactText - current.outerText) > 0.5
				|| Math.abs(current.spaciousMd - current.outerLg) > 0.5) {
				throw new Error(`${width}px: ${JSON.stringify(current)}`);
			}
		}
	});

	test('a scope with its own text base re-derives the type scale', () => {
		if (Math.abs(wide.scopeText - 14 * PHI) > 0.5) {
			throw new Error(`text-lg in the scope is ${wide.scopeText}px`);
		}
	});

	test('a sided composition keeps its side beside the content and wraps below 61.8%', () => {
		const beside = (side, content) => Math.abs(side.top - content.top) < 1;
		if (!beside(wide.side, wide.sidedContent) || wide.side.right > wide.sidedContent.left
			|| Math.abs(wide.side.width - wide.sideWidth) > 2
			|| wide.sidedContent.width < wide.sided.width * (1 / PHI) - 0.5
			|| !beside(wide.endSide, wide.endContent) || wide.endSide.left < wide.endContent.right
			|| Math.abs(wide.endSide.width - wide.sideWidth) > 2
			|| narrow.sidedContent.top < narrow.side.bottom
			|| Math.abs(narrow.side.width - narrow.sided.width) > 0.5
			|| Math.abs(narrow.sidedContent.width - narrow.sided.width) > 0.5) {
			throw new Error(JSON.stringify({ wide, narrow }));
		}
	});

	test('stack space and cluster alignment follow their custom properties', () => {
		if (Math.abs(wide.tightGap - 10) > 0.1 || Math.abs(wide.clusterEnd) > 0.5) {
			throw new Error(JSON.stringify({ tightGap: wide.tightGap, clusterEnd: wide.clusterEnd }));
		}
	});

	test('a context answers queries by its own width, not the viewport', () => {
		if (wide.contextWide !== 'dashed' || wide.contextNarrow !== 'none' || narrow.contextWide !== 'none') {
			throw new Error(JSON.stringify({ wide: [wide.contextWide, wide.contextNarrow], narrow: narrow.contextWide }));
		}
	});

	test('the primitives page has no horizontal overflow at 320px or 1200px', () => {
		if (narrow.overflow > 1 || wide.overflow > 1) {
			throw new Error(JSON.stringify({ narrow: narrow.overflow, wide: wide.overflow }));
		}
	});
}
