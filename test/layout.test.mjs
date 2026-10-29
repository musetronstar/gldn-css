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
 *   4. stacked columns fill the row below the breakpoint;
 *   5. the hero heading wraps instead of clipping at phone widths.
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
const exampleUrl = 'file://' + path.join(root, 'examples', 'gldn.html');
const PHI = 1.61803398875;
const EXAMPLE_WIDTHS = [320, 390, 768, 1100, 1465, 1905];
const FONTS = [16, 20];

/* ------------------------------------------------------------------ */
/* minimal tap runner                                                   */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* chrome discovery                                                     */
/* ------------------------------------------------------------------ */

function findChrome() {
	const candidates = [process.env.GLDN_CHROME, 'google-chrome', 'chromium', 'chromium-browser']
		.filter(Boolean);
	for (const name of candidates) {
		const found = spawnSync('which', [name], { encoding: 'utf8' }).stdout.trim();
		if (found) return found;
	}
	return null;
}

/* ------------------------------------------------------------------ */
/* minimal CDP driver                                                   */
/* ------------------------------------------------------------------ */

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
		// Chrome may send stray events while the browser tears down; ignore.
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

	return {
		viewport: async (width) => {
			await send('Emulation.setDeviceMetricsOverride',
				{ width, height: 900, deviceScaleFactor: 1, mobile: false });
		},
		navigate: async (url, rootFont) => {
			await send('Page.navigate', { url });
			await settle();
			// A root font-size emulates a browser default-font preference,
			// which is how the enlarged-font cases surface in the wild.
			await evaluate(`document.documentElement.style.fontSize = '${rootFont}px'`);
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

/* ------------------------------------------------------------------ */
/* probes: expressions evaluated inside the page                        */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* suite                                                                */
/* ------------------------------------------------------------------ */

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
	<div class="gldn-minor" id="hmin"><pre style="white-space: pre">${
		'x'.repeat(120)
	}</pre></div>
	<div class="gldn-major" id="hmaj"><p>content</p></div>
</div>
</body></html>`);

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

	test('columns stack to full width below the breakpoint', () => {
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
		const clipped = states.filter(({ width }) => width <= 390 && stateClip(width));
		if (clipped.length) throw new Error('heading clipped at phone width');
	});

	function stateClip(width) {
		const found = states.find((s) => s.width === width && s.font === 16);
		return found && found.state.headingOverflow > 1;
	}

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
		if (wide.rowWidth !== 700) {
			throw new Error(`row grew to ${wide.rowWidth}px`);
		}
		near(wide.ratio, PHI, 0.0001, 'split ratio with wide content');
		if (wide.contentOverflow <= 0) {
			throw new Error('harness content did not overflow its column; test invalid');
		}
	});
} finally {
	await browser.close();
	browser.close();
}

console.log(`\n${passed} layout tests passed`);
