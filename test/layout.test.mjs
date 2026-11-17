/*
 * gldn-css layout regression tests.
 *
 * The contract suite checks source text; this suite renders the framework
 * in headless Chrome over the DevTools protocol (Node's built-in WebSocket,
 * zero dependencies) and pins the behavior the golden ratio promises:
 *
 *   1. no horizontal page overflow at phone, tablet, and desktop widths,
 *      at default and enlarged root font sizes;
 *   2. the padded fixed split and the fluid split hold phi within 0.01%;
 *   3. wide content cannot collapse or invert a split (min-width: 0);
 *   4. stacked columns fill the row when it is narrower than its threshold;
 *   5. the hero heading wraps instead of clipping at phone widths;
 *   6. mobile panels fill the workspace without row padding or shrinkage;
 *   7. links, controls, and muted text meet their color contracts;
 *   8. text controls have horizontal spacing before their contents;
 *   9. src/ and dist/ expose the same top-level cascade layers;
 *  10. the dock, tabs, and message pane meet their interaction contracts;
 *  11. plain HTML controls, focus and panel edges meet the reset's contract;
 *  12. the layout primitives and scopes meet their contracts;
 *  13. golden splits use their intrinsic threshold and default phone floor.
 *
 * Run: node test/layout.test.mjs
 * Skips with a notice when no Chrome/Chromium binary is available.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const exampleUrl = 'file://' + path.join(root, 'docs', 'index.html');
const fontExampleUrl = 'file://' + path.join(root, 'docs', 'fonts.html');
const PHI = 1.61803398875;
const EXAMPLE_WIDTHS = [320, 375, 390, 768, 1100, 1200, 1465, 1905];
const SCALE_WIDTHS = [320, 768, 1200];
const FONTS = [16, 20];

let passed = 0;

function test(name, fn) {
	try {
		fn();
		passed++;
		console.log(`ok - ${name}`);
	} catch (err) {
		console.error(`FAIL - ${name}`);
		console.error(err.message);
		process.exitCode = 1;
	}
}

function near(actual, expected, tolerance, label) {
	const deviation = Math.abs(actual - expected) / expected;
	if (deviation > tolerance) {
		throw new Error(`${label}: ${actual} vs ${expected} (${(deviation * 100).toFixed(3)}% off)`);
	}
}

function findChrome() {
	const candidates = [process.env.GLDN_CHROME, 'google-chrome', 'chromium', 'chromium-browser']
		.filter(Boolean);
	for (const name of candidates) {
		const found = spawnSync('which', [name], { encoding: 'utf8' }).stdout.trim();
		if (found) return found;
	}
	return null;
}

async function launch(browserPath) {
	const port = 9400 + Math.floor(Math.random() * 400);
	const udd = mkdtempSync(path.join(os.tmpdir(), 'gldn-layout-'));
	const proc = spawn(browserPath, [
		'--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${udd}`,
		'--no-first-run', '--no-default-browser-check', '--disable-gpu',
		'--allow-file-access-from-files', 'about:blank'
	], { stdio: 'ignore' });

	let target = null;
	for (let i = 0; i < 50 && !target; i++) {
		try {
			const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
			target = targets.find((t) => t.type === 'page');
		} catch {}
		if (!target) await new Promise((r) => setTimeout(r, 200));
	}
	if (!target) throw new Error('chrome did not expose a page target');

	const ws = new WebSocket(target.webSocketDebuggerUrl);
	await new Promise((r) => ws.addEventListener('open', r, { once: true }));

	let id = 0;
	const pending = new Map();
	let closed = false;
	ws.addEventListener('message', (ev) => {
		if (closed) return;
		let msg;
		try {
			msg = JSON.parse(ev.data);
		} catch {
			return;
		}
		if (!msg.id || !pending.has(msg.id)) return;
		const { resolve, reject } = pending.get(msg.id);
		pending.delete(msg.id);
		msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
	});
	const send = (method, params = {}) => new Promise((resolve, reject) => {
		const mid = ++id;
		pending.set(mid, { resolve, reject });
		ws.send(JSON.stringify({ id: mid, method, params }));
	});
	const evaluate = async (expression) => {
		const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
		if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails));
		return res.result.value;
	};
	const settle = () => evaluate(
		'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'
	);

	await send('Page.enable');
	await send('Runtime.enable');
	await send('DOM.enable');
	await send('CSS.enable');

	return {
		viewport: async (width) => {
			await send('Emulation.setDeviceMetricsOverride',
				{ width, height: 900, deviceScaleFactor: 1, mobile: false });
		},
		reducedMotion: async (reduce) => {
			await send('Emulation.setEmulatedMedia', {
				features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }]
			});
		},
		navigate: async (url, rootFont) => {
			await send('Page.navigate', { url });
			await settle();
			await evaluate(`document.documentElement.style.fontSize = '${rootFont}px'`);
			await settle();
		},
		layers: async () => {
			const { root: documentNode } = await send('DOM.getDocument', { depth: 0 });
			const { nodeId } = await send('DOM.querySelector',
				{ nodeId: documentNode.nodeId, selector: 'body' });
			const { rootLayer } = await send('CSS.getLayersForNode', { nodeId });
			const names = [];
			const visit = (layer, parent = '') => {
				const name = layer.name || '';
				const fullName = parent && name ? `${parent}.${name}` : name || parent;
				if (name) names.push(fullName);
				for (const child of layer.subLayers || []) visit(child, fullName);
			};
			for (const child of rootLayer.subLayers || []) visit(child);
			return names;
		},
		press: async (key) => {
			const code = { Tab: 9 }[key];
			for (const type of ['keyDown', 'keyUp']) {
				await send('Input.dispatchKeyEvent',
					{ type, key, code: key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code });
			}
			await settle();
		},
		evaluate,
		settle,
		close: async () => {
			closed = true;
			try { proc.kill(); } catch {}
			await new Promise((r) => setTimeout(r, 300));
			try { rmSync(udd, { recursive: true, force: true }); } catch {}
		}
	};
}

const pageState = `(() => {
	const de = document.documentElement;
	const w = (el) => el.getBoundingClientRect().width;
	const fixedMajor = document.getElementById('demo-fixed-major');
	const fixedMinor = document.getElementById('demo-fixed-minor');
	const fluidMajor = document.getElementById('demo-fluid-major');
	const fluidMinor = document.getElementById('demo-fluid-minor');
	const row = fixedMajor.parentElement;
	const hero = document.querySelector('.gldn-hero');
	const heading = hero.querySelector('.gldn-title-hero');
	return {
		scrollOverflow: de.scrollWidth - de.clientWidth,
		fixed: w(fixedMajor) / w(fixedMinor),
		fluid: w(fluidMajor) / w(fluidMinor),
		stacked: Math.abs(w(fixedMajor) - w(fixedMinor)) < 1.5,
		rowFillError: Math.abs(
			(w(fixedMajor) + w(fixedMinor) + parseFloat(getComputedStyle(row).columnGap))
			- row.clientWidth),
		headingOverflow: heading.scrollWidth - heading.clientWidth
	};
})()`;

const scaleState = `(() => {
	const probe = document.createElement('div');
	probe.style.position = 'absolute';
	probe.style.visibility = 'hidden';
	document.body.appendChild(probe);
	const values = {};
	for (const name of ['xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl']) {
		probe.style.fontSize = 'var(--gldn-text-' + name + ')';
		values['text-' + name] = parseFloat(getComputedStyle(probe).fontSize);
	}
	for (const name of ['xs', 'sm', 'md', 'lg', 'xl', '2xl']) {
		probe.style.width = 'var(--gldn-space-' + name + ')';
		values['space-' + name] = parseFloat(getComputedStyle(probe).width);
	}
	for (const name of ['sm', 'md', 'lg']) {
		probe.style.width = 'var(--gldn-radius-' + name + ')';
		values['radius-' + name] = parseFloat(getComputedStyle(probe).width);
	}
	probe.remove();
	return values;
})()`;

const colorState = `(() => {
	const channel = (value) => {
		value /= 255;
		return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	};
	const luminance = (color) => {
		const [r, g, b] = color.match(/[\\d.]+/g).map(Number).map(channel);
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	};
	const contrast = (a, b) => {
		const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
		return (light + 0.05) / (dark + 0.05);
	};
	const link = document.querySelector('.gldn-nav a');
	const muted = document.querySelector('#splits > .gldn-text');
	const body = getComputedStyle(document.body);
	const header = getComputedStyle(document.querySelector('.gldn-header'));
	return {
		linkContrast: contrast(getComputedStyle(link).color, header.backgroundColor),
		mutedContrast: contrast(getComputedStyle(muted).color, body.backgroundColor),
		colorScheme: getComputedStyle(document.documentElement).colorScheme
	};
})()`;

const chrome = findChrome();
if (!chrome) {
	console.log('SKIP - layout tests need Chrome or Chromium (set GLDN_CHROME)');
	process.exit(0);
}

const wideHarness = path.join(os.tmpdir(), 'gldn-wide-content.html');
writeFileSync(wideHarness, `<!DOCTYPE html><html><head>
<link rel="stylesheet" href="file://${path.join(root, 'dist', 'gldn.min.css')}">
</head><body>
<div class="gldn-row" id="row" style="width: 700px; margin: 1rem">
	<div class="gldn-minor" id="hmin"><div style="white-space: nowrap">${'x'.repeat(120)}</div></div>
	<div class="gldn-major" id="hmaj"><p>content</p></div>
</div>
</body></html>`);

const mobileHarness = path.join(os.tmpdir(), 'gldn-mobile-layout.html');
writeFileSync(mobileHarness, `<!DOCTYPE html><html><head>
<link rel="stylesheet" href="file://${path.join(root, 'dist', 'gldn.min.css')}">
</head><body>
<div class="gldn-workspace" id="mobile-workspace">
	<aside class="gldn-sidebar" id="mobile-sidebar">sidebar</aside>
	<main class="gldn-main" id="mobile-main">main</main>
</div>
<div class="gldn-row" id="mobile-row">
	<div class="gldn-minor">minor</div><div class="gldn-major">major</div>
</div>
<div class="gldn-row gldn-center" id="mobile-centered-row">
	<div class="gldn-minor" id="mobile-centered-minor">minor</div>
</div>
</body></html>`);

const formHarness = path.join(os.tmpdir(), 'gldn-form-controls.html');
writeFileSync(formHarness, `<!DOCTYPE html><html><head>
<link rel="stylesheet" href="file://${path.join(root, 'dist', 'gldn.min.css')}">
</head><body>
<input id="text-input" type="text" value="text">
<textarea id="text-area">text</textarea>
</body></html>`);

const srcLayerHarness = path.join(os.tmpdir(), 'gldn-src-layers.html');
writeFileSync(srcLayerHarness, `<!DOCTYPE html><html><head>
<link rel="stylesheet" href="file://${path.join(root, 'src', 'gldn.css')}">
</head><body><p class="gldn-text">layers</p></body></html>`);

const browser = await launch(chrome);
try {
	const states = [];
	for (const font of FONTS) {
		for (const width of EXAMPLE_WIDTHS) {
			await browser.viewport(width);
			await browser.navigate(exampleUrl, font);
			const state = await browser.evaluate(pageState);
			states.push({ font, width, state });
		}
	}

	test('no horizontal page overflow at any width or font size', () => {
		const bad = states.filter(({ state }) => state.scrollOverflow > 1);
		if (bad.length) {
			throw new Error(`overflow at ${bad.map((b) => `${b.width}px/${b.font}px`).join(', ')}`);
		}
	});

	const scales = [];
	for (const width of SCALE_WIDTHS) {
		await browser.viewport(width);
		await browser.navigate(exampleUrl, 16);
		scales.push({ width, values: await browser.evaluate(scaleState) });
	}

	test('fluid type, space and radius scales equal base times their powers of phi', () => {
		const typePowers = { xs: -1, sm: -0.5, base: 0, md: 0.5, lg: 1, xl: 1.5, '2xl': 2, '3xl': 2.5 };
		const spacePowers = { xs: -2, sm: -1, md: 0, lg: 1, xl: 2, '2xl': 3 };
		const radiusPowers = { sm: -2, md: -1, lg: 0 };
		for (const { width, values } of scales) {
			const base = 16 + Math.max(0, Math.min(880, width - 320)) * 2 / 880;
			for (const [group, powers] of [['text', typePowers], ['space', spacePowers], ['radius', radiusPowers]]) {
				for (const [name, power] of Object.entries(powers)) {
					const token = `${group}-${name}`;
					const expected = base * PHI ** power;
					if (Math.abs(values[token] - expected) > 0.5) {
						throw new Error(`${width}px ${token}: ${values[token]} vs ${expected}`);
					}
				}
			}
		}
	});

	test('no type step is below 12px except text-xs', () => {
		for (const { width, values } of scales) {
			for (const [name, size] of Object.entries(values)) {
				if (name.startsWith('text-') && name !== 'text-xs' && size < 12) {
					throw new Error(`${width}px ${name}: ${size}px`);
				}
			}
		}
	});

	const plainSpecimens = await browser.evaluate(`['plain-light', 'plain-dark'].map((id) => {
		const specimen = document.getElementById(id);
		const size = (selector) => parseFloat(getComputedStyle(specimen.querySelector(selector)).fontSize);
		const heading = document.createElement('h2');
		heading.innerHTML = 'heading <code>code</code>';
		specimen.appendChild(heading);
		const headingCode = parseFloat(getComputedStyle(heading.querySelector('code')).fontSize)
			/ parseFloat(getComputedStyle(heading).fontSize);
		heading.remove();
		const width = (selector) => specimen.querySelector(selector).getBoundingClientRect().width;
		const content = specimen.clientWidth - parseFloat(getComputedStyle(specimen).paddingLeft)
			- parseFloat(getComputedStyle(specimen).paddingRight);
		return {
			id,
			h1: size('h1'),
			p: size('p'),
			code: size('p code'),
			pre: size('pre'),
			table: size('table'),
			headingCode,
			pMeasure: getComputedStyle(specimen.querySelector('p')).maxWidth,
			listFill: width('ul') / content,
			tableFill: width('table') / content,
			headingWrap: getComputedStyle(specimen.querySelector('h1')).textWrap,
			proseWrap: getComputedStyle(specimen.querySelector('p')).textWrap
		};
	})`);

	test('plain HTML uses the scale, text wrapping and a prose-only measure in both themes', () => {
		const wide = scales.find(({ width }) => width === 1200).values;
		for (const specimen of plainSpecimens) {
			if (Math.abs(specimen.h1 - wide['text-2xl']) > 0.5
				|| Math.abs(specimen.p - wide['text-base']) > 0.5
				|| Math.abs(specimen.code - specimen.p) > 0.5
				|| Math.abs(specimen.headingCode - 1) > 0.01
				|| Math.abs(specimen.pre - wide['text-sm']) > 0.5
				|| Math.abs(specimen.table - wide['text-sm']) > 0.5
				|| specimen.pMeasure === 'none'
				|| Math.abs(specimen.listFill - 1) > 0.01 || Math.abs(specimen.tableFill - 1) > 0.01
				|| specimen.headingWrap !== 'balance' || specimen.proseWrap !== 'pretty') {
				throw new Error(JSON.stringify(specimen));
			}
		}
	});

	const mainFontFaces = await browser.evaluate('document.fonts.size');
	await browser.navigate(fontExampleUrl, 16);
	await browser.evaluate('document.fonts.ready.then(() => true)');
	const fontPageState = await browser.evaluate(`({
		faces: [...document.fonts].map((face) => ({ family: face.family, style: face.style, status: face.status }))
	})`);

	// Three bundled and two specimen-only families, each with a normal and an italic face.
	test('only the opt-in font specimen declares and loads the bundled fonts', () => {
		if (mainFontFaces !== 0 || fontPageState.faces.length !== 10
			|| fontPageState.faces.some((face) => face.status !== 'loaded')) {
			throw new Error(JSON.stringify({ mainFontFaces, fontPageState }));
		}
	});

	test('padded fixed split holds phi within 0.01% when side by side', () => {
		const bad = states.filter(({ state }) => !state.stacked && state.rowFillError > 0.5);
		if (bad.length) {
			throw new Error(`row fill error at ${bad.map((b) => `${b.width}px/${b.font}px`).join(', ')}`);
		}
		const tilted = states.filter(({ state }) => !state.stacked
			&& Math.abs(state.fixed - PHI) / PHI > 0.0001);
		if (tilted.length) {
			throw new Error(`ratio off at ${tilted.map((t) =>
				`${t.width}px/${t.font}px=${t.state.fixed.toFixed(5)}`).join(', ')}`);
		}
	});

	test('fluid split holds phi within 0.01% when side by side', () => {
		const tilted = states.filter(({ state }) => !state.stacked
			&& Math.abs(state.fluid - PHI) / PHI > 0.0001);
		if (tilted.length) {
			throw new Error(`ratio off at ${tilted.map((t) =>
				`${t.width}px/${t.font}px=${t.state.fluid.toFixed(5)}`).join(', ')}`);
		}
	});

	// The tour's fixed split is gldn-sidebar and gldn-main, which stack below --gldn-bp-sm.
	test('workspace panels stack to full width when their row is narrower than 48rem', () => {
		const phone = states.filter(({ width }) => width <= 390);
		const sideBySide = states.filter(({ width }) => width > 768);
		if (!phone.every(({ state }) => state.stacked)) {
			throw new Error('columns did not stack at 320/390 px');
		}
		if (!sideBySide.every(({ state }) => !state.stacked)) {
			throw new Error('columns stacked above the breakpoint');
		}
	});

	test('hero heading wraps instead of clipping at phone widths', () => {
		const clipped = states.filter(({ width, state }) =>
			width <= 390 && state.headingOverflow > 1);
		if (clipped.length) throw new Error('heading clipped at phone width');
	});

	await browser.viewport(1100);
	await browser.navigate('file://' + wideHarness, 16);
	const wide = await browser.evaluate(`(() => {
		const w = (el) => el.getBoundingClientRect().width;
		const minor = document.getElementById('hmin');
		return {
			ratio: w(document.getElementById('hmaj')) / w(minor),
			rowWidth: document.getElementById('row').clientWidth,
			contentOverflow: minor.scrollWidth - minor.clientWidth
		};
	})()`);

	test('wide content cannot collapse or invert a split', () => {
		if (wide.rowWidth !== 700) throw new Error(`row grew to ${wide.rowWidth}px`);
		near(wide.ratio, PHI, 0.0001, 'split ratio with wide content');
		if (wide.contentOverflow <= 0) {
			throw new Error('harness content did not overflow its column; test invalid');
		}
	});

	await browser.viewport(320);
	await browser.navigate('file://' + mobileHarness, 16);
	const mobile = await browser.evaluate(`(() => {
		const rect = (id) => document.getElementById(id).getBoundingClientRect();
		const style = (id) => getComputedStyle(document.getElementById(id));
		const workspace = rect('mobile-workspace');
		const workspaceStyle = style('mobile-workspace');
		const sidebar = rect('mobile-sidebar');
		const main = rect('mobile-main');
		const row = rect('mobile-row');
		const rowStyle = style('mobile-row');
		return {
			panelHeightError: Math.abs(sidebar.height - main.height),
			panelFillError: Math.abs(sidebar.height + main.height
				+ parseFloat(workspaceStyle.rowGap)
				+ parseFloat(workspaceStyle.paddingTop)
				+ parseFloat(workspaceStyle.paddingBottom) - workspace.height),
			shortestPanel: Math.min(sidebar.height, main.height),
			rowPadding: ['Top', 'Right', 'Bottom', 'Left'].reduce((sum, side) =>
				sum + parseFloat(rowStyle['padding' + side]), 0),
			rowWidthError: Math.max(...['mobile-row'].flatMap((id) =>
				[...document.getElementById(id).children].map((child) =>
					Math.abs(child.getBoundingClientRect().width - row.width)))),
			centeredWidthError: Math.abs(rect('mobile-centered-minor').width
				- rect('mobile-centered-row').width)
		};
	})()`);

	test('stacked panels fill the workspace and stacked rows stay full width without padding', () => {
		if (mobile.shortestPanel < 100 || mobile.panelHeightError > 1
			|| mobile.panelFillError > 1) {
			throw new Error(`invalid mobile panel sizes: ${JSON.stringify(mobile)}`);
		}
		if (mobile.rowPadding !== 0 || mobile.rowWidthError > 1
			|| mobile.centeredWidthError > 1) {
			throw new Error(`invalid mobile row sizes: ${JSON.stringify(mobile)}`);
		}
	});

	await browser.viewport(1100);
	await browser.navigate(exampleUrl, 16);
	const lightColors = await browser.evaluate(colorState);
	await browser.evaluate(`document.documentElement.classList.add('gldn-theme-dark')`);
	await browser.settle();
	const darkColors = await browser.evaluate(colorState);

	test('links and native controls meet the dark theme contract', () => {
		for (const [theme, colors] of [['light', lightColors], ['dark', darkColors]]) {
			if (colors.linkContrast < 4.5) {
				throw new Error(`${theme} link contrast is ${colors.linkContrast.toFixed(2)}:1`);
			}
		}
		if (lightColors.colorScheme !== 'light' || darkColors.colorScheme !== 'dark') {
			throw new Error(`color schemes: ${lightColors.colorScheme}, ${darkColors.colorScheme}`);
		}
	});

	test('muted text meets WCAG AA on the page background', () => {
		for (const [theme, colors] of [['light', lightColors], ['dark', darkColors]]) {
			if (colors.mutedContrast < 4.5) {
				throw new Error(`${theme} muted contrast is ${colors.mutedContrast.toFixed(2)}:1`);
			}
		}
	});

	await browser.navigate('file://' + formHarness, 16);
	const formPadding = await browser.evaluate(`['text-input', 'text-area'].map((id) => {
		const style = getComputedStyle(document.getElementById(id));
		return [parseFloat(style.paddingLeft), parseFloat(style.paddingRight)];
	})`);

	test('text controls have horizontal spacing before their contents', () => {
		for (const [left, right] of formPadding) {
			if (left <= 0 || right <= 0) {
				throw new Error(`invalid horizontal padding: ${left}px ${right}px`);
			}
		}
	});

	const distLayers = await browser.layers();
	await browser.navigate('file://' + srcLayerHarness, 16);
	const srcLayers = await browser.layers();

	test('src and dist expose the same top-level cascade layers', () => {
		const expected = ['reset', 'tokens', 'layout', 'components', 'responsive'];
		if (distLayers.join(',') !== expected.join(',')) {
			throw new Error(`dist layers: ${distLayers.join(', ')}`);
		}
		if (srcLayers.join(',') !== distLayers.join(',')) {
			throw new Error(`src layers: ${srcLayers.join(', ')}`);
		}
	});

	const { testDock } = await import('./dock.test.mjs');
	await testDock(browser, test, root);

	const { testPlainHtml } = await import('./plain-html.test.mjs');
	await testPlainHtml(browser, test, root);

	const { testPrimitives } = await import('./primitives.test.mjs');
	await testPrimitives(browser, test, root);

	const { testSplits } = await import('./splits.test.mjs');
	await testSplits(browser, test, root);
} finally {
	await browser.close();
}

console.log(`\n${passed} layout tests passed`);
