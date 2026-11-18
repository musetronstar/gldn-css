/*
 * gldn-css contract tests.
 *
 * These tests are the executable contract for the framework: they pin the
 * file layout from README.md, the cascade layer order, the gldn- namespace,
 * the golden-ratio token math, cross-file reference integrity, and that the
 * committed dist bundle is in sync with src/. Run: node test/contract.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, buildTokens, collapse, stripComments } from '../scripts/build.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = (name) => readFileSync(path.join(root, 'src', name), 'utf8');
const srcFile = (name) => path.join(root, 'src', name);

const PARTIALS = ['_reset.css', '_tokens.css', '_layout.css', '_components.css', '_responsive.css'];
const MODULES = ['gldn-tabs.js', 'gldn-messages.js', 'gldn-dock.js', 'gldn-popover.js',
	'gldn-dialog.js', 'gldn-roving.js', 'gldn-form.js', 'gldn-files.js', 'gldn-theme.js',
	'gldn-keys.js', 'gldn-media.js', 'gldn-menu.js', 'gldn-unavailable.js', 'gldn-more.js',
	'gldn-disclosure.js'];
const LAYERS = ['reset', 'tokens', 'layout', 'components', 'responsive'];
const TOKEN_SELECTORS = [':root', '.gldn-theme-light', '.gldn-theme-dark', '.gldn-scope', '.gldn-compact', '.gldn-spacious'];
const STATE_CLASSES = ['gldn-btn-icon', 'gldn-btn-group', 'gldn-icon', 'gldn-disclosure', 'gldn-empty', 'gldn-alert', 'gldn-scroll'];
const PRIMITIVES = ['gldn-cluster', 'gldn-grid', 'gldn-switcher', 'gldn-frame', 'gldn-frame-portrait'];

let passed = 0;
let failed = 0;

function test(name, fn) {
	try {
		fn();
		passed++;
		console.log(`ok - ${name}`);
	} catch (err) {
		console.error(`FAIL - ${name}`);
		console.error(err.message);
		failed++;
		process.exitCode = 1;
	}
}

/* --------------------------------------------------------------------------
 * 1. Repository structure per README.md architecture
 * ------------------------------------------------------------------------ */

test('src partials and entry point exist', () => {
	for (const name of [...PARTIALS, 'gldn.css']) {
		assert.ok(existsSync(srcFile(name)), `missing src/${name}`);
	}
	for (const directory of ['dist', 'docs']) {
		for (const name of ['gldn.min.css', 'gldn-tokens.min.css']) {
			assert.ok(existsSync(path.join(root, directory, name)), `missing ${directory}/${name}`);
		}
	}
	assert.ok(existsSync(path.join(root, 'docs', 'index.html')), 'missing docs/index.html');
	assert.ok(existsSync(path.join(root, 'docs', 'gldn.js')), 'missing docs/gldn.js');
	for (const name of MODULES) {
		for (const directory of ['src', 'dist', 'docs']) {
			assert.ok(existsSync(path.join(root, directory, name)),
				`missing ${directory}/${name}`);
		}
	}
	assert.ok(existsSync(path.join(root, 'docs', 'components', 'dock.html')),
		'missing dock example');
	assert.ok(existsSync(path.join(root, 'docs', 'fonts.html')), 'missing font specimen');
	for (const directory of ['src', 'dist', 'docs']) {
		assert.ok(existsSync(path.join(root, directory, 'gldn-fonts.css')),
			`missing ${directory}/gldn-fonts.css`);
		assert.ok(existsSync(path.join(root, directory, 'fonts', 'LICENSE.txt')),
			`missing ${directory}/fonts/LICENSE.txt`);
	}
});

/* --------------------------------------------------------------------------
 * 2. Cascade layer architecture
 *
 * Layer order is the specificity contract: reset < tokens < layout <
 * components < responsive, so responsive overrides always win without
 * !important. Each partial assigns its own rules to a layer, which keeps
 * src/ and the dist bundle identical layer trees.
 * ------------------------------------------------------------------------ */

const entry = src('gldn.css');

test('gldn.css declares the layer order reset through responsive', () => {
	assert.match(entry,
		/@layer\s+reset\s*,\s*tokens\s*,\s*layout\s*,\s*components\s*,\s*responsive\s*;/,
		'layer declaration missing or out of order');
});

test('gldn.css imports every partial in layer order', () => {
	const imports = [...entry.matchAll(/@import\s+url\('\.\/([\w-]+\.css)'\)\s*;/g)].map((m) => m[1]);
	assert.deepEqual(imports, PARTIALS, 'gldn.css must import each partial once, in layer order');
});

test('every partial assigns its rules to its own layer block', () => {
	for (const layer of LAYERS) {
		const body = src(`_${layer}.css`);
		const layers = [...body.matchAll(/@layer\s+([\w-]+)\s*\{/g)].map((m) => m[1]);
		assert.deepEqual([...new Set(layers)], [layer], `_${layer}.css must wrap its rules in @layer ${layer} only`);
	}
});

/*
 * Walks a stylesheet's blocks. Each declaration and each block comes with the headers of the
 * blocks around it, innermost last, so a check can ask which selector or at-rule holds it.
 */
function walk(css) {
	const text = stripComments(css);
	const declarations = [];
	const blocks = [];
	const stack = [];
	let start = 0;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (ch === '{') {
			stack.push(text.slice(start, i).trim());
			blocks.push([...stack]);
			start = i + 1;
		} else if (ch === ';' || ch === '}') {
			const chunk = text.slice(start, i).trim();
			const colon = chunk.indexOf(':');
			if (stack.length && colon > 0 && !chunk.startsWith('@')) {
				declarations.push({
					headers: [...stack],
					property: chunk.slice(0, colon).trim(),
					value: chunk.slice(colon + 1).trim()
				});
			}
			if (ch === '}') stack.pop();
			start = i + 1;
		}
	}
	return { declarations, blocks };
}

const shippedSheets = () => [
	...['gldn.css', ...PARTIALS, 'gldn-fonts.css'].map((name) => [`src/${name}`, src(name)]),
	...['gldn.min.css', 'gldn-tokens.min.css', 'gldn-fonts.css'].map((name) =>
		[`dist/${name}`, readFileSync(path.join(root, 'dist', name), 'utf8')])
];

test('no style rule in a shipped stylesheet sits outside a layer', () => {
	for (const [name, css] of shippedSheets()) {
		const unlayered = walk(css).blocks
			.filter((headers) => !headers.at(-1).startsWith('@'))
			.filter((headers) => !headers.some((header) => header.startsWith('@layer')))
			.map((headers) => headers.at(-1));
		assert.deepEqual(unlayered, [], `${name} has rules outside a layer`);
	}
});

/* --------------------------------------------------------------------------
 * 3. gldn- namespace purity (collision-free integration contract)
 * ------------------------------------------------------------------------ */

const allSrc = ['gldn.css', ...PARTIALS].map((n) => src(n)).join('\n');

function missingClasses(used, css) {
	const defined = new Set([...css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)]
		.map((match) => match[1]));
	return [...used].filter((name) => !defined.has(name));
}

test('example class lookup requires complete identifiers', () => {
	assert.deepEqual(missingClasses(['gldn-ma'], '.gldn-major {}'), ['gldn-ma']);
});

test('example class lookup finds compound and element-qualified classes', () => {
	assert.deepEqual(missingClasses(['gldn-row', 'gldn-centered'], '.gldn-row.gldn-centered {}'), []);
	assert.deepEqual(missingClasses(['gldn-card'], 'div.gldn-card {}'), []);
});

test('all custom properties use the --gldn- prefix', () => {
	const props = [...allSrc.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]);
	const foreign = props.filter((p) => !p.startsWith('--gldn-'));
	assert.deepEqual(foreign, [], `non-gldn custom properties: ${foreign}`);
});

test('all class selectors use the gldn- prefix', () => {
	// A class selector's dot is never preceded by a word char (which would
	// make it a decimal or a filename like _tokens.css).
	const classes = [...allSrc.matchAll(/(?<![\w.])\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]);
	const foreign = classes.filter((c) => !c.startsWith('gldn-'));
	assert.deepEqual(foreign, [], `non-gldn classes: ${foreign}`);
});

/*
 * Every measure comes from a token. A literal length is allowed only where an entry below names
 * its place and the reason the scale cannot supply it.
 */
const LENGTH_ALLOWLIST = [
	{ property: /^--gldn-fluid-base$/, literals: ['1rem', '100vw'],
		reason: 'turns the base and viewport numbers into lengths and reads the viewport width' },
	{ property: /^--gldn-(?:measure|grid-min|switch-min)$/, literals: ['100ch'],
		reason: 'the measure and the primitive thresholds are 100ch divided by powers of phi' },
	{ property: /^--gldn-split-min$/, literals: ['100ch', '100vw'],
		reason: 'the intrinsic threshold and the phone-width viewport floor' },
	{ property: /^--gldn-bp-(?:sm|lg)$/, literals: ['48rem', '75rem'], reason: 'the breakpoints' },
	{ header: /^@media/, literals: ['48rem'], reason: 'media queries cannot read --gldn-bp-sm' },
	{ property: /^--gldn-touch-target$/, literals: ['44px'],
		reason: 'the minimum touch target (WCAG 2.5.5)' },
	{ property: /^--gldn-dock-expanded-height$/, literals: ['50vh'], reason: 'half the viewport' },
	{ property: /^(?:min-|max-)?height$/, literals: ['100vh', '100dvh'], reason: 'the full viewport' },
	{ property: /^--gldn-shadow(?:-sm|-lg)?$/, literals: ['1px', '2px', '4px', '6px', '-1px', '12px', '24px', '-4px'],
		reason: 'shadow offsets, blurs and spreads' },
	{ property: /^--gldn-target-min$/, literals: ['24px'], reason: 'the minimum target (WCAG 2.5.8)' },
	{ property: /^--gldn-tracking-caps$/, literals: ['1em'], reason: 'tracking is a share of the type size' },
	{ selector: /\.gldn-visually-hidden/, literals: ['1px', '-1px'],
		reason: 'a one-pixel box that screen readers still read' },
	{ property: /^font-size$/, literals: ['1em'], reason: 'inline code keeps the size of its text' },
	{ selector: /\.gldn-icon|aria-busy|\.gldn-tree-(?:row|toggle)|role="switch"/, literals: ['1em'], reason: 'icons, markers, switches and the busy ring take the size of their text' },
	{ property: /^--gldn-control-height$/, literals: ['1lh'], reason: 'a control is one line of its own text tall' },
	{ selector: /^\.gldn-(?:sidebar|main)$/, property: /^flex$/, literals: ['1px'],
		reason: 'the workspace stacks at --gldn-bp-sm itself, as max-width: 48rem includes it' }
];

const LENGTH = /(?<![\w.#-])-?\d*\.?\d+(?:px|rem|em|ch|ex|lh|vh|vw|dvh|svh|lvh|vmin|vmax|cm|mm|in|pt|pc)\b/g;

function allowedLength(literal, { headers, property }) {
	return LENGTH_ALLOWLIST.some((entry) => entry.literals.includes(literal)
		&& (!entry.property || (property !== undefined && entry.property.test(property)))
		&& (!entry.selector || headers.some((header) => entry.selector.test(header)))
		&& (!entry.header || (property === undefined && entry.header.test(headers.at(-1)))));
}

test('every literal length in src is on the allowlist', () => {
	const found = [];
	for (const name of ['gldn.css', ...PARTIALS, 'gldn-fonts.css']) {
		const { declarations, blocks } = walk(src(name));
		for (const declaration of declarations) {
			for (const [literal] of declaration.value.matchAll(LENGTH)) {
				if (!allowedLength(literal, declaration)) {
					found.push(`${name}: ${declaration.property}: ${declaration.value}`);
				}
			}
		}
		for (const headers of blocks) {
			for (const [literal] of headers.at(-1).matchAll(LENGTH)) {
				if (!allowedLength(literal, { headers })) found.push(`${name}: ${headers.at(-1)}`);
			}
		}
	}
	assert.deepEqual(found, [], 'literal lengths must come from a token or the allowlist');
});

test('the length guard rejects a literal border and accepts an allowed one', () => {
	const declaration = (css) => walk(css).declarations[0];
	const literals = (css) => [...declaration(css).value.matchAll(LENGTH)].map((m) => m[0]);
	assert.deepEqual(literals('.a { border: 1px solid #1e293b; }'), ['1px']);
	assert.ok(!allowedLength('1px', declaration('.a { border: 1px solid red; }')));
	assert.ok(allowedLength('1px', declaration('.gldn-visually-hidden { width: 1px; }')));
	assert.ok(allowedLength('48rem', { headers: ['@layer responsive', '@media (max-width: 48rem)'] }));
});

/* --------------------------------------------------------------------------
 * 4. Golden ratio token math
 * ------------------------------------------------------------------------ */

const tokens = src('_tokens.css');
const layout = src('_layout.css');
const components = src('_components.css');
const responsive = src('_responsive.css');
const fonts = src('gldn-fonts.css');

// Names defined in the tokens layer: the single source of truth that
// var() references and responsive overrides resolve against.
const tokenDefs = new Set([...tokens.matchAll(/(--gldn-[\w-]+)\s*:/g)].map((m) => m[1]));

test('--gldn-phi is the golden ratio constant', () => {
	assert.match(tokens, /--gldn-phi:\s*1\.61803398875\s*;/);
});

test('golden split derives from the first two cascade terms', () => {
	// 1/phi + 1/phi^2 = 1, so the derivation is exact; a rounded literal
	// would be the only source of ratio error.
	assert.match(tokens, /--gldn-major:\s*var\(--gldn-phi-1\)/);
	assert.match(tokens, /--gldn-minor:\s*var\(--gldn-phi-2\)/);
});

test('golden division cascade phi^-1 .. phi^-10 is defined', () => {
	// The cascade recursively divides the remainder by phi, yielding
	// phi^-n as a percentage scale for sizes and proportions.
	for (let n = 1; n <= 10; n++) {
		assert.match(tokens, new RegExp(`--gldn-phi-${n}:`), `missing --gldn-phi-${n}`);
	}
	assert.match(tokens, /--gldn-phi-1:\s*calc\(100% \/ var\(--gldn-phi\)\)/,
		'--gldn-phi-1 must derive from the phi constant');
});

test('one clamped fluid base feeds the type and space scales', () => {
	// The endpoints are numbers, so no step divides one length by another.
	assert.match(tokens, /--gldn-base-min:\s*1;/);
	assert.match(tokens, /--gldn-base-max:\s*1\.125;/);
	assert.match(tokens, /--gldn-viewport-min:\s*20;/);
	assert.match(tokens, /--gldn-viewport-max:\s*75;/);
	const fluid = tokens.match(/--gldn-fluid-base:\s*clamp\(([\s\S]*?)\);/);
	assert.ok(fluid, 'missing --gldn-fluid-base');
	assert.match(fluid[1], /\(100vw - var\(--gldn-viewport-min\) \* 1rem\) \* var\(--gldn-fluid-slope\)/,
		'fluid interpolation must multiply a length by the token-derived numeric slope');
	const slope = tokens.match(/--gldn-fluid-slope:\s*calc\(([\s\S]*?)\);/);
	assert.ok(slope && !/rem|px|vw/.test(slope[1]), 'the slope must be computed from numbers');
	assert.match(tokens, /--gldn-space-base:\s*var\(--gldn-fluid-base\)/);
	assert.match(tokens, /--gldn-text-base:\s*var\(--gldn-fluid-base\)/);
});

test('every type and space step uses its declared power of phi', () => {
	const typePowers = { xs: -1, sm: -0.5, md: 0.5, lg: 1, xl: 1.5, '2xl': 2, '3xl': 2.5 };
	const spacePowers = { xs: -2, sm: -1, lg: 1, xl: 2, '2xl': 3 };
	for (const [name, power] of Object.entries(typePowers)) {
		assert.match(tokens, new RegExp(`--gldn-text-${name}:\\s*calc\\(var\\(--gldn-text-base\\) \\* pow\\(var\\(--gldn-phi\\), ${power}\\)\\)`),
			`text-${name} must use pow(phi, ${power})`);
	}
	for (const [name, power] of Object.entries(spacePowers)) {
		assert.match(tokens, new RegExp(`--gldn-space-${name}:\\s*calc\\(var\\(--gldn-space-base\\) \\* pow\\(var\\(--gldn-phi\\), ${power}\\)\\)`),
			`space-${name} must use pow(phi, ${power})`);
	}
	assert.match(tokens, /--gldn-space-md:\s*var\(--gldn-space-base\)/);
	assert.match(tokens, /--gldn-leading-heading:\s*calc\(1 \+ pow\(var\(--gldn-phi\), -3\)\)/);
	assert.match(tokens, /--gldn-measure:\s*calc\(100ch \/ var\(--gldn-phi\)\)/);
});

test('responsive rules do not override the base or type scale', () => {
	assert.doesNotMatch(responsive, /--gldn-(?:space|text)-base\s*:/);
	assert.doesNotMatch(responsive, /font-size:\s*var\(--gldn-text-/);
});

test('system font stacks and the display stack are defined', () => {
	for (const name of ['sans', 'serif', 'mono', 'display']) {
		assert.match(tokens, new RegExp(`--gldn-font-${name}:`), `missing --gldn-font-${name}`);
	}
	assert.match(tokens, /--gldn-font-serif:\s*Palatino, 'Palatino Linotype', P052, 'URW Palladio L', Georgia, serif/);
	assert.match(tokens, /--gldn-font-display:\s*var\(--gldn-font-sans\)/,
		'headings use the sans stack until a project chooses otherwise');
	assert.doesNotMatch(tokens, /Times New Roman|Roboto/);
});

/*
 * Every bundled font is a woff2 file with a normal and an italic face, and one
 * LICENSE.txt per directory names each file beside the full SIL OFL text.
 */
function checkFontDirectory(directory, faceCss) {
	const names = readdirSync(directory);
	const woff2 = names.filter((name) => name.endsWith('.woff2'));
	assert.deepEqual(names.filter((name) => !name.endsWith('.woff2')), ['LICENSE.txt'],
		`${directory} holds only woff2 files and LICENSE.txt`);
	const license = readFileSync(path.join(directory, 'LICENSE.txt'), 'utf8');
	assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
	assert.match(license, /PREAMBLE[\s\S]*PERMISSION & CONDITIONS[\s\S]*TERMINATION[\s\S]*DISCLAIMER/,
		'LICENSE.txt must carry the full license text');
	// The OFL defines reserved names; the notices before it must not reserve one,
	// because a subset is a modified version and may not carry a reserved name.
	const notices = license.slice(0, license.indexOf('SIL OPEN FONT LICENSE'));
	assert.doesNotMatch(notices, /Reserved Font Name/i, 'subset fonts must not reserve their names');
	const urls = [...faceCss.matchAll(/url\('\.\/(?:specimen\/)?fonts\/([\w-]+\.woff2)'\) format\('woff2'\)/g)]
		.map((match) => match[1]);
	for (const name of woff2) {
		assert.ok(license.includes(name), `LICENSE.txt must name ${name}`);
		assert.ok(urls.includes(name), `no @font-face uses ${name}`);
	}
	for (const url of urls) {
		assert.ok(woff2.includes(url), `@font-face names missing file ${url}`);
	}
	const entries = license.split(/\n\n/).filter((entry) => /\n  Files: /.test(entry));
	assert.ok(entries.length > 0, 'LICENSE.txt must list its fonts');
	for (const entry of entries) {
		assert.match(entry, /\n  Copyright /);
		assert.match(entry, /\n  Upstream: https:\/\//);
		assert.match(entry, /\n  Subset: @fontsource-variable\/[\w-]+ \d+\.\d+\.\d+/);
	}
	const families = new Map();
	for (const face of faceCss.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
		const family = face[1].match(/font-family:\s*'([^']+)'/)[1];
		const style = face[1].match(/font-style:\s*(\w+)/)[1];
		assert.match(face[1], /font-weight:\s*\d+ \d+/, `${family} must declare its weight range`);
		families.set(family, [...(families.get(family) || []), style]);
	}
	for (const [family, styles] of families) {
		assert.deepEqual(styles.sort(), ['italic', 'normal'], `${family} needs normal and italic faces`);
	}
}

test('the opt-in font sheet declares licensed woff2 fonts and redefines every stack', () => {
	for (const name of ['sans', 'serif', 'mono', 'display']) {
		assert.match(fonts, new RegExp(`--gldn-font-${name}:`));
	}
	assert.doesNotMatch(allSrc, /@font-face|gldn-fonts\.css/, 'the main bundle must not load fonts');
	checkFontDirectory(path.join(root, 'src', 'fonts'), fonts);
});

test('surface, color, radius, and shadow tokens are defined', () => {
	for (const name of ['bg', 'surface', 'text', 'muted', 'primary', 'primary-hover',
		'border', 'control-border', 'primary-fg', 'link', 'link-hover', 'link-visited']) {
		assert.match(tokens, new RegExp(`--gldn-color-${name}:`), `missing --gldn-color-${name}`);
	}
	// Colors follow the scheme: each is a light-dark() pair, except those equal in both.
	const unpaired = [...tokens.matchAll(/(--gldn-color-[\w-]+):\s*(#[0-9a-f]{3,8});/g)].map((m) => m[1]);
	assert.deepEqual(unpaired, ['--gldn-color-primary', '--gldn-color-primary-fg']);
	assert.match(tokens, /:root\s*\{[^}]*color-scheme:\s*light dark/s, 'pages follow the system scheme');
	assert.match(tokens, /\.gldn-theme-light\s*\{\s*color-scheme:\s*light;\s*\}/);
	assert.match(tokens, /\.gldn-theme-dark\s*\{\s*color-scheme:\s*dark;\s*\}/);
	for (const name of ['tint', 'active', 'selected', 'valid', 'invalid', 'overlay']) {
		assert.match(tokens, new RegExp(`--gldn-color-${name}:`), `missing --gldn-color-${name}`);
	}
	for (const name of ['opacity-disabled', 'edge-width', 'control-height']) {
		assert.match(tokens, new RegExp(`--gldn-${name}:`), `missing --gldn-${name}`);
	}
	assert.match(tokens, /--gldn-shadow:/, 'missing --gldn-shadow');
});

test('radii and the hairline are steps of the space scale', () => {
	// phi^n = phi^(n-1) + phi^(n-2): a radius-lg panel padded by space-xs holds radius-md
	// children with concentric corners, and padded by space-sm holds radius-sm children.
	assert.match(tokens, /--gldn-radius-sm:\s*calc\(var\(--gldn-space-base\) \* pow\(var\(--gldn-phi\), -2\)\)/);
	assert.match(tokens, /--gldn-radius-md:\s*calc\(var\(--gldn-space-base\) \* pow\(var\(--gldn-phi\), -1\)\)/);
	assert.match(tokens, /--gldn-radius-lg:\s*var\(--gldn-space-base\)/);
	assert.match(tokens, /--gldn-hairline:\s*calc\(var\(--gldn-space-base\) \* pow\(var\(--gldn-phi\), -5\)\)/);
	assert.doesNotMatch(allSrc, /\b1px solid/, 'borders use --gldn-hairline');
});

test('status, accessibility, dock, and stacking tokens are defined', () => {
	for (const name of ['info', 'success', 'warning', 'error']) {
		for (const suffix of ['', '-fg', '-surface']) {
			assert.match(tokens, new RegExp(`--gldn-color-${name}${suffix}:`),
				`missing --gldn-color-${name}${suffix}`);
		}
	}
	for (const name of ['focus-ring', 'z-popover', 'z-dock', 'motion-duration',
		'touch-target', 'dock-height', 'dock-panel-height', 'dock-expanded-height',
		'dock-strip-height', 'dock-reserve', 'bp-sm']) {
		assert.match(tokens, new RegExp(`--gldn-${name}:`), `missing --gldn-${name}`);
	}
	assert.match(tokens, /--gldn-motion-duration:\s*\d+(?:\.\d+)?m?s;/);
	assert.match(layout, /\.gldn-visually-hidden\s*\{/,
		'missing visually hidden utility');
});

/* --------------------------------------------------------------------------
 * 5. Reference integrity: var() uses resolve, and only against tokens
 * ------------------------------------------------------------------------ */

test('every var() reference resolves to a token defined in the tokens layer', () => {
	const refs = [...allSrc.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]);
	const missing = refs.filter((r) => !tokenDefs.has(r));
	assert.deepEqual(missing, [], `undefined custom properties: ${missing}`);
});

test('reset, layout and components define no custom properties; responsive only overrides tokens', () => {
	for (const layer of ['reset', 'layout', 'components']) {
		// Examples in comments may set a token on an element; only rules count.
		const body = stripComments(src(`_${layer}.css`));
		const defs = [...body.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]);
		assert.deepEqual(defs, [], `_${layer}.css must not define custom properties: ${defs}`);
	}
	const responsiveDefs = [...responsive.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]);
	const novel = responsiveDefs.filter((p) => !tokenDefs.has(p));
	assert.deepEqual(novel, [], `responsive layer may only override existing tokens: ${novel}`);
});

test('buttons share the controls\' size and offer four variants', () => {
	// Block padding and boundary match the reset's controls, so a gldn-btn beside a field or a
	// bare button has the same height.
	assert.match(components, /\.gldn-btn\s*\{[^}]*padding:\s*var\(--gldn-space-xs\)[^}]*border:\s*var\(--gldn-hairline\) solid/s);
	for (const variant of ['secondary', 'quiet', 'danger']) {
		assert.match(components, new RegExp(`\\.gldn-btn-${variant}\\s*\\{`), `missing .gldn-btn-${variant}`);
	}
	assert.match(src('_reset.css'), /:is\([\s\S]*?button[\s\S]*?\)\s*\{[^}]*padding:\s*var\(--gldn-space-xs\)[^}]*border:\s*var\(--gldn-hairline\) solid/s);
});

test('one reset rule gives every focusable element the focus ring', () => {
	assert.match(src('_reset.css'), /:focus-visible\s*\{[^}]*outline:\s*var\(--gldn-focus-ring\)/s);
	// Only the tree repeats the ring: its focused item holds its subtree, so the row carries it.
	for (const name of PARTIALS.filter((partial) => partial !== '_reset.css')) {
		const repeats = walk(src(name)).declarations
			.filter((d) => d.property === 'outline' && d.value === 'var(--gldn-focus-ring)')
			.filter((d) => !d.headers.at(-1).startsWith('.gldn-tree [role="treeitem"]:focus-visible'));
		assert.deepEqual(repeats.map((d) => d.headers.at(-1)), [], `${name} must not repeat the focus ring`);
	}
});

test('motion runs only when reduced motion is not requested', () => {
	for (const name of ['gldn.css', ...PARTIALS]) {
		const moving = walk(src(name)).declarations
			.filter((d) => /^(?:animation|animation-name|transition)$/.test(d.property))
			.filter((d) => !d.headers.some((header) => /prefers-reduced-motion:\s*no-preference/.test(header)));
		assert.deepEqual(moving.map((d) => `${name}: ${d.headers.at(-1)}`), []);
	}
});

test('links gain contrast on hover, and only content links and results show visited', () => {
	// Browsers apply only color properties to :visited, and hide them from scripts, so the
	// visited rules are checked here rather than rendered.
	const colorProperty = /^(?:color|background-color|border(?:-[\w-]+)?-color|outline-color|text-decoration-color|column-rule-color|fill|stroke)$/;
	const declarations = PARTIALS.flatMap((name) => walk(src(name)).declarations);
	const visited = declarations.filter((d) => d.headers.at(-1).includes(':visited'));
	assert.ok(visited.length >= 2, 'content links and results must style :visited');
	for (const d of visited) {
		const selector = d.headers.at(-1);
		assert.match(d.property, colorProperty, `${selector} sets ${d.property}`);
		assert.equal(d.value, 'var(--gldn-color-link-visited)');
		if (selector.startsWith('.gldn-results')) continue;
		for (const excluded of ['nav', 'header', '[role="tree"]', '[role="menu"]', '[aria-current]']) {
			assert.ok(selector.includes(excluded), `${selector} must exclude ${excluded}`);
		}
		assert.match(selector, /^a:visited:where\(:not\(/, 'the visited rule keeps the specificity of a:visited');
	}
	const hovered = declarations.filter((d) => /\ba(?::where\()?:hover/.test(d.headers.at(-1)));
	assert.ok(hovered.length >= 2, 'links and results must style :hover');
	for (const d of hovered) {
		assert.ok(d.headers.some((header) => /@media \(hover: hover\)/.test(header)),
			`${d.headers.at(-1)} must apply only where a pointer hovers`);
		assert.equal(d.value, 'var(--gldn-color-link-hover)');
	}
});

test('states carry a cue beside color, also in forced colors', () => {
	const reset = src('_reset.css');
	for (const state of ['aria-invalid="true"', 'aria-invalid="false"', 'aria-busy="true"',
		'aria-current', 'aria-selected="true"']) {
		assert.ok(reset.includes(`[${state}`), `the reset must style [${state}]`);
	}
	assert.match(reset, /\[aria-invalid="true"\]\s*\{[^}]*border-inline-start-width:\s*var\(--gldn-edge-width\)/s);
	assert.match(reset, /@media \(forced-colors: active\)/);
	assert.match(components, /@media \(forced-colors: active\)/);
	for (const cls of STATE_CLASSES) {
		assert.match(components, new RegExp(`\\.${cls}(?![\\w-])`), `missing .${cls}`);
	}
	assert.match(responsive, /@media \(pointer: coarse\)[\s\S]*min-block-size:\s*var\(--gldn-touch-target\)/);
});

test('icons in the examples are hidden or named, and icon buttons have a name', () => {
	for (const file of exampleFiles()) {
		const text = readFileSync(file, 'utf8');
		for (const [tag] of text.matchAll(/<[^>]*class="[^"]*\bgldn-icon\b[^"]*"[^>]*>/g)) {
			assert.match(tag, /aria-hidden="true"/, `${path.relative(root, file)}: decorative icon ${tag}`);
		}
		for (const [tag] of text.matchAll(/<[^>]*class="[^"]*\bgldn-btn-icon\b[^"]*"[^>]*>/g)) {
			assert.match(tag, /aria-label="[^"]+"/, `${path.relative(root, file)}: icon button without a name`);
		}
	}
});

test('the semantic example uses no classes or inline styles, and the reset covers its elements', () => {
	const page = readFileSync(path.join(root, 'docs', 'semantic.html'), 'utf8');
	assert.doesNotMatch(page, /\sclass="|\sstyle="/, 'the semantic example is class-less');
	assert.match(page, /<link rel="stylesheet" href="gldn\.min\.css">/);
	const reset = src('_reset.css');
	for (const selector of ['hgroup', 'header nav', 'figcaption', 'caption', 'mark', 'abbr[title]', 'del', 'ins',
		'sub', 'sup', 'kbd', 'var', 'address', 'blockquote > footer', 'details:not([class])', 'progress', 'meter',
		'fieldset', 'legend', 'fieldset[role="group"]', '[role="switch"]', '::file-selector-button',
		'input[type="color"]', 'dialog', 'article:not([class])', 'body > :is(header, main, footer):not([class])']) {
		assert.ok(reset.includes(selector), `the reset must style ${selector}`);
	}
});

test('the reset styles the plain elements apps write', () => {
	const reset = src('_reset.css');
	for (const element of ['textarea', 'select', 'button', 'dt', 'dd', 'hr', 'small', 'summary']) {
		assert.match(reset, new RegExp(`(?<![\\w-])${element}(?![\\w-])[^{]*\\{`), `the reset must style ${element}`);
	}
	assert.match(reset, /::placeholder/);
	assert.match(reset, /accent-color:\s*var\(--gldn-color-primary\)/);
	assert.match(reset, /font-variant-numeric:\s*tabular-nums/);
});

/* --------------------------------------------------------------------------
 * 6. Golden layout primitives and responsive reflow
 * ------------------------------------------------------------------------ */

test('fixed and fluid golden split primitives exist', () => {
	// Fixed splits deduct each column's golden share of the single gutter
	// from its basis; bases + gutter = exactly 100%, and the border-box
	// basis never shrinks, so padding cannot disturb the ratio. Below the
	// threshold the second term of max() wins and each column takes its line.
	const stackTerm = (token) => `calc\\(\\(var\\(${token}\\) - 100%\\) \\* 999\\)`;
	assert.match(layout, new RegExp(`\\.gldn-major\\s*\\{[^}]*flex:\\s*0 0 max\\(calc\\(var\\(--gldn-major\\) - var\\(--gldn-gutter\\)[^}]*${stackTerm('--gldn-split-min')}[^}]*min-width:\\s*0`, 's'),
		'.gldn-major must hold the gutter-aware basis, stack below the threshold, and have a zero content floor');
	assert.match(layout, new RegExp(`\\.gldn-minor\\s*\\{[^}]*flex:\\s*0 0 max\\(calc\\(var\\(--gldn-minor\\) - var\\(--gldn-gutter\\)[^}]*${stackTerm('--gldn-split-min')}[^}]*min-width:\\s*0`, 's'),
		'.gldn-minor must hold the gutter-aware basis, stack below the threshold, and have a zero content floor');
	// Fluid split: growing by phi and 1 keeps the 1:phi ratio at any width.
	assert.match(layout, new RegExp(`\\.gldn-major-fluid\\s*\\{[^}]*flex:\\s*var\\(--gldn-phi\\) 1 max\\(0%, ${stackTerm('--gldn-split-min')}\\)`, 's'),
		'.gldn-major-fluid must grow by phi');
	assert.match(layout, new RegExp(`\\.gldn-minor-fluid\\s*\\{[^}]*flex:\\s*1 1 max\\(0%, ${stackTerm('--gldn-split-min')}\\)`, 's'),
		'.gldn-minor-fluid must grow by 1');
	assert.match(tokens, /--gldn-split-min:\s*max\(calc\(100ch \/ pow\(var\(--gldn-phi\), 2\)\),\s*calc\(\(var\(--gldn-bp-sm\) - 100vw\) \* 999\)\)/,
		'golden rows stack below their intrinsic threshold or on a phone-width viewport');
	assert.match(layout, /\.gldn-row:has\([^{]*\)\s*\{[^}]*flex-wrap:\s*wrap/s,
		'only rows of golden columns wrap');
});

test('the layout primitives exist and their thresholds are tokens', () => {
	for (const cls of PRIMITIVES) {
		assert.match(layout, new RegExp(`\\.${cls}\\s*\\{`), `missing .${cls}`);
	}
	assert.match(tokens, /--gldn-grid-min:\s*calc\(100ch \/ pow\(var\(--gldn-phi\), 3\)\)/);
	assert.match(tokens, /--gldn-switch-min:\s*calc\(100ch \/ pow\(var\(--gldn-phi\), 2\)\)/);
	assert.match(layout, /\.gldn-grid\s*\{[^}]*var\(--gldn-grid-min\)/s);
	assert.match(layout, /\.gldn-switcher > \*\s*\{[^}]*var\(--gldn-switch-min\)/s);
	assert.match(layout, /\.gldn-stack > \*\s*\{[^}]*margin-block:\s*0/s,
		'the gap alone separates a stack\'s children');
	assert.doesNotMatch(layout, /(?:^|[\s;{])(?:color|background(?:-color)?|border-radius|box-shadow)\s*:/m,
		'layout primitives set no color, radius or shadow');
	for (const cls of [...PRIMITIVES, 'gldn-stack']) {
		assert.doesNotMatch(responsive, new RegExp(`\\.${cls}(?![\\w-])`), `.${cls} must not need a breakpoint`);
	}
});

test('scopes re-derive the scales from one set of derivations', () => {
	for (const name of ['--gldn-space-xs', '--gldn-text-lg', '--gldn-gutter', '--gldn-radius-md', '--gldn-hairline']) {
		assert.equal((tokens.match(new RegExp(`${name}:`, 'g')) || []).length, 1, `${name} is derived once`);
	}
	const derivations = walk(tokens).declarations.find((d) => d.property === '--gldn-space-xs').headers.at(-1);
	for (const selector of [':root', '.gldn-scope', '.gldn-compact', '.gldn-spacious']) {
		assert.ok(derivations.split(',').map((part) => part.trim()).includes(selector),
			`the derivations must apply to ${selector}`);
	}
	assert.match(tokens, /\.gldn-compact\s*\{[^}]*--gldn-space-base:\s*calc\(var\(--gldn-fluid-base\) \/ var\(--gldn-phi\)\)/s);
	assert.match(tokens, /\.gldn-spacious\s*\{[^}]*--gldn-space-base:\s*calc\(var\(--gldn-fluid-base\) \* var\(--gldn-phi\)\)/s);
});

test('rows carry exactly one gutter between split columns', () => {
	assert.match(tokens, /--gldn-gutter:/, 'missing --gldn-gutter token');
	assert.match(layout, /\.gldn-row\s*\{[^}]*gap:\s*var\(--gldn-gutter\)/s,
		'.gldn-row must gap by the gutter token so retunes stay in sync');
});

test('semantic workspace components exist', () => {
	for (const cls of ['gldn-workspace', 'gldn-sidebar', 'gldn-main']) {
		assert.match(components, new RegExp(`\\.${cls}\\s*\\{`), `missing .${cls}`);
	}
	assert.match(components, /\.gldn-sidebar\s*\{[^}]*flex:\s*0 0 max\(calc\(var\(--gldn-minor\) - var\(--gldn-gutter\)[^}]*var\(--gldn-bp-sm\)[^}]*min-width:\s*0/s,
		'.gldn-sidebar must compose the gutter-aware minor split and stack below --gldn-bp-sm');
	assert.match(components, /\.gldn-main\s*\{[^}]*flex:\s*0 0 max\(calc\(var\(--gldn-major\) - var\(--gldn-gutter\)[^}]*var\(--gldn-bp-sm\)[^}]*min-width:\s*0/s,
		'.gldn-main must compose the gutter-aware major split and stack below --gldn-bp-sm');
	assert.match(components, /\.gldn-workspace\s*\{[^}]*flex-wrap:\s*wrap/s);
});

test('no responsive rule stacks a row, a split, the sidebar or the main panel', () => {
	assert.doesNotMatch(responsive,
		/\.gldn-(?:row|major|minor|major-fluid|minor-fluid|sidebar|main)(?![\w-])/,
		'golden splits stack by their own width');
	assert.doesNotMatch(responsive, /flex-direction|flex:\s*1 1 100%/);
});

/* --------------------------------------------------------------------------
 * 7. Example page integrity
 * ------------------------------------------------------------------------ */

const htmlPath = path.join(root, 'docs', 'index.html');
const html = existsSync(htmlPath) ? readFileSync(htmlPath, 'utf8') : '';
const fontHtmlPath = path.join(root, 'docs', 'fonts.html');
const fontHtml = existsSync(fontHtmlPath) ? readFileSync(fontHtmlPath, 'utf8') : '';

test('example links the docs bundle and the example script', () => {
	assert.match(html, /<link rel="stylesheet" href="gldn\.min\.css">/);
	assert.match(html, /<script src="gldn\.js"><\/script>/);
});

test('the tour shows both full scales, fluid endpoints, and plain HTML in both themes', () => {
	for (const name of ['xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl']) {
		assert.match(html, new RegExp(`id="scale-text-${name}"`));
	}
	for (const name of ['xs', 'sm', 'md', 'lg', 'xl', '2xl']) {
		assert.match(html, new RegExp(`id="scale-space-${name}"`));
	}
	assert.match(html, /id="fluid-base"/);
	assert.match(html, /320px/);
	assert.match(html, /1200px/);
	for (const id of ['plain-light', 'plain-dark']) {
		const start = html.indexOf(`id="${id}"`);
		assert.ok(start > 0, `missing ${id}`);
		const specimen = html.slice(start, html.indexOf('</article>', start));
		for (const element of ['form', 'input', 'select', 'textarea', 'button', 'dl', 'hr', 'small', 'details']) {
			assert.match(specimen, new RegExp(`<${element}[\\s>]`), `${id} must show <${element}>`);
		}
	}
	for (const cls of [...PRIMITIVES, 'gldn-stack', 'gldn-compact', 'gldn-spacious',
		'gldn-btn-secondary', 'gldn-btn-quiet', 'gldn-btn-danger']) {
		assert.match(html, new RegExp(`class="[^"]*\\b${cls}\\b`), `the tour must show .${cls}`);
	}
});

test('the font specimen records pairing B and still offers three pairings in both themes', () => {
	assert.match(fontHtml, /<link rel="stylesheet" href="gldn-fonts\.css">/);
	assert.equal((fontHtml.match(/data-pairing=/g) || []).length, 6);
	assert.equal((fontHtml.match(/data-theme="light"/g) || []).length, 1);
	assert.equal((fontHtml.match(/data-theme="dark"/g) || []).length, 1);
	assert.match(fontHtml, /Selected: pairing B/);
	assert.doesNotMatch(fontHtml, /pending/i, 'the font choice is settled');
	assert.equal((fontHtml.match(/data-pairing="B" data-selected/g) || []).length, 2,
		'both themes mark pairing B as the selected pairing');
	// The opt-in sheet bundles exactly the selected pairing.
	const families = [...new Set([...fonts.matchAll(/font-family:\s*'([^']+)'/g)].map((m) => m[1]))];
	assert.deepEqual(families, ['gldn Inter', 'gldn Literata', 'gldn JetBrains Mono']);
	const specimenFaces = (fontHtml.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
	checkFontDirectory(path.join(root, 'docs', 'specimen', 'fonts'), specimenFaces);
});

/*
 * gldn-css is a generic framework: no project names in its sources, examples, scripts or
 * README, and no project-domain copy outside cited quotations. Examples quote their sources
 * verbatim, in <q cite> or <blockquote cite>.
 */
function exampleFiles() {
	return [
		...readdirSync(path.join(root, 'docs')).filter((name) => name.endsWith('.html'))
			.map((name) => path.join(root, 'docs', name)),
		...readdirSync(path.join(root, 'docs', 'components')).filter((name) => name.endsWith('.html'))
			.map((name) => path.join(root, 'docs', 'components', name))
	];
}
const QUOTATION = /<(q|blockquote)\b([^>]*)>([\s\S]*?)<\/\1>/g;

test('sources and examples carry no project names, and project-domain words only in quotations', () => {
	const projectNames = /\b(?:tagd|tagl|tagsh|httagd|tagspaces?|filepile|recordstack|record views?)\b/i;
	const domainWords = /\b(?:memex|trails?|associations?)\b/i;
	const files = [
		...readdirSync(path.join(root, 'src')).filter((name) => /\.(?:css|js)$/.test(name))
			.map((name) => path.join(root, 'src', name)),
		...readdirSync(path.join(root, 'docs')).filter((name) => /\.(?:html|js)$/.test(name))
			.map((name) => path.join(root, 'docs', name)),
		...readdirSync(path.join(root, 'docs', 'components')).map((name) => path.join(root, 'docs', 'components', name)),
		path.join(root, 'scripts', 'build.mjs'),
		path.join(root, 'README.md')
	];
	const found = [];
	for (const file of files) {
		const text = readFileSync(file, 'utf8');
		const unquoted = text.replace(QUOTATION, '');
		const where = path.relative(root, file);
		const name = text.match(projectNames);
		if (name) found.push(`${where}: ${name[0]}`);
		const word = unquoted.match(domainWords);
		if (word) found.push(`${where}: ${word[0]} outside a quotation`);
	}
	assert.deepEqual(found, []);
});

test('every quotation in the examples names its source', () => {
	for (const file of exampleFiles()) {
		for (const [, element, attributes] of readFileSync(file, 'utf8').matchAll(QUOTATION)) {
			assert.match(attributes, /\bcite="https?:\/\/[^"]+"/,
				`${path.relative(root, file)}: <${element}> needs a cite URL`);
		}
	}
});

/*
 * Quotations are verbatim. GLDN_QUOTE_SOURCES names plain-text copies of the quoted works
 * (separated by the path delimiter); without it this check is skipped.
 */
test('every quotation appears verbatim in its source text, when the sources are given', () => {
	const sources = (process.env.GLDN_QUOTE_SOURCES || '').split(path.delimiter).filter(Boolean);
	if (sources.length === 0) {
		console.log('  (skipped: set GLDN_QUOTE_SOURCES to check quotations verbatim)');
		return;
	}
	// Inline markup inside a quotation (a <mark>, say) adds no space; block markup ends a line.
	const normalize = (text) => text.replace(/<\/?(?:mark|em|strong|i|b|a|span|code|q)\b[^>]*>/g, '')
		.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&')
		.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
	const corpus = sources.map((file) => normalize(readFileSync(file, 'utf8'))).join('\n');
	const missing = [];
	for (const file of exampleFiles()) {
		for (const [, , , inner] of readFileSync(file, 'utf8').matchAll(QUOTATION)) {
			const quoted = normalize(inner.replace(/<footer>[\s\S]*?<\/footer>/, ''));
			if (!corpus.includes(quoted)) missing.push(`${path.relative(root, file)}: ${quoted.slice(0, 60)}`);
		}
	}
	assert.deepEqual(missing, []);
});

test('every gldn- class used in the examples exists in src', () => {
	const examples = exampleFiles().map((file) => readFileSync(file, 'utf8'));
	const used = new Set(examples.flatMap((example) =>
		[...example.matchAll(/class="([^"]*)"/g)]
			.flatMap((m) => m[1].split(/\s+/))
			.filter((c) => c.startsWith('gldn-'))));
	const missing = missingClasses(used, allSrc);
	assert.deepEqual(missing, [], `classes used but not defined: ${missing}`);
});

test('dock example includes tabs, a polite log, and an alert pop-in', () => {
	const example = readFileSync(path.join(root, 'docs', 'components', 'dock.html'), 'utf8');
	assert.match(example, /role="tablist"/);
	assert.equal((example.match(/role="tab"/g) || []).length, 2);
	assert.equal((example.match(/role="tabpanel"/g) || []).length, 2);
	assert.match(example, /data-gldn-messages[^>]*role="log"[^>]*aria-live="polite"/s);
	assert.match(example, /data-gldn-popin[^>]*role="alert"/s);
	assert.match(example, /data-gldn-popin-dismiss[^>]*aria-label="Dismiss"/s);
});

test('the notification module, rules, and example are removed', () => {
	for (const directory of ['src', 'dist', 'docs']) {
		assert.ok(!existsSync(path.join(root, directory, 'gldn-notify.js')),
			`${directory}/gldn-notify.js remains`);
	}
	assert.ok(!existsSync(path.join(root, 'docs', 'components', 'notifications.html')));
	assert.ok(!existsSync(path.join(root, 'docs', 'components', 'notifications.js')));
	assert.doesNotMatch(allSrc, /gldn-notify/);
});

/* --------------------------------------------------------------------------
 * 8. Pure CSS guarantee: no preprocessor constructs, no external imports
 * ------------------------------------------------------------------------ */

/*
 * Optional modules have zero dependencies and stay inside their contract: they insert text,
 * never HTML, do no requests, and only the theme control touches storage.
 */
test('modules import only each other, insert text only, and send nothing', () => {
	for (const name of MODULES) {
		const code = src(name);
		for (const [, from] of code.matchAll(/\bfrom\s+'([^']+)'/g)) {
			assert.match(from, /^\.\/gldn-[\w-]+\.js$/, `${name} imports ${from}`);
		}
		assert.doesNotMatch(code, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/, `${name} inserts HTML`);
		assert.doesNotMatch(code, /\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon/, `${name} sends requests`);
		if (name !== 'gldn-theme.js') {
			assert.doesNotMatch(code, /localStorage|sessionStorage|indexedDB/, `${name} uses storage`);
		}
	}
});

test('src is pure CSS', () => {
	assert.doesNotMatch(allSrc, /\$[\w-]+\s*:/, 'Sass-style variables are not pure CSS');
	assert.doesNotMatch(allSrc, /@import\s+url\(['"]?https?:/, 'no external imports allowed');
});

/* --------------------------------------------------------------------------
 * 9. dist bundle is in sync with src and minified
 * ------------------------------------------------------------------------ */

test('dist and docs bundles match a fresh build of src', () => {
	for (const [name, fresh] of [['gldn.min.css', build()], ['gldn-tokens.min.css', buildTokens()]]) {
		for (const directory of ['dist', 'docs']) {
			const committed = readFileSync(path.join(root, directory, name), 'utf8');
			assert.equal(committed, fresh, `${directory}/${name} is stale; run node scripts/build.mjs`);
		}
	}
});

test('the tokens bundle holds the tokens layer alone', () => {
	const bundle = readFileSync(path.join(root, 'dist', 'gldn-tokens.min.css'), 'utf8');
	const { blocks } = walk(bundle);
	assert.deepEqual([...new Set(blocks.map((headers) => headers[0]))], ['@layer tokens']);
	const selectors = [...new Set(blocks.filter((headers) => headers.length > 1)
		.flatMap((headers) => headers.at(-1).split(',').map((selector) => selector.trim())))];
	assert.deepEqual(selectors.filter((selector) => !TOKEN_SELECTORS.includes(selector)), [],
		'the tokens bundle may only set tokens on :root, theme classes and scope classes');
	assert.doesNotMatch(bundle, /@layer reset|@layer layout|@layer components|@layer responsive/);
});

test('dist and docs modules match src', () => {
	for (const name of MODULES) {
		const source = readFileSync(path.join(root, 'src', name), 'utf8');
		for (const directory of ['dist', 'docs']) {
			const committed = readFileSync(path.join(root, directory, name), 'utf8');
			assert.equal(committed, source, `${directory}/${name} is stale; run node scripts/build.mjs`);
		}
	}
});

test('dist and docs font assets match src', () => {
	for (const directory of ['dist', 'docs']) {
		assert.equal(readFileSync(path.join(root, directory, 'gldn-fonts.css'), 'utf8'), fonts,
			`${directory}/gldn-fonts.css is stale; run node scripts/build.mjs`);
		const sources = readdirSync(path.join(root, 'src', 'fonts')).sort();
		assert.deepEqual(readdirSync(path.join(root, directory, 'fonts')).sort(), sources,
			`${directory}/fonts is stale; run node scripts/build.mjs`);
		for (const name of sources) {
			assert.deepEqual(readFileSync(path.join(root, directory, 'fonts', name)),
				readFileSync(path.join(root, 'src', 'fonts', name)),
				`${directory}/fonts/${name} is stale; run node scripts/build.mjs`);
		}
	}
});

test('dist bundle is minified and structurally valid', () => {
	const dist = readFileSync(path.join(root, 'dist', 'gldn.min.css'), 'utf8');
	assert.ok(!dist.includes('\n\n'), 'dist must not contain blank lines');
	const open = (dist.match(/\{/g) || []).length;
	const close = (dist.match(/\}/g) || []).length;
	assert.equal(open, close, 'unbalanced braces');
	assert.match(dist, /@layer reset,tokens,layout,components,responsive;/);
	// The bundle must be the same layer tree a browser builds from src/:
	// each layer assigned once, the reset riding in its own layer.
	assert.match(dist, /@layer reset\{/);
	assert.doesNotMatch(dist, /\.tokens\{|\.layout\{|\.components\{|\.responsive\{/,
		'dist must not contain nested duplicate layers');
});

/* --------------------------------------------------------------------------
 * 10. Build robustness
 * ------------------------------------------------------------------------ */

test('the minifier never rewrites quoted strings', () => {
	const min = collapse('a { content: "a  ;  b , c" }');
	assert.ok(min.includes('"a  ;  b , c"'), `string was rewritten: ${min}`);
});

test('unterminated comments fail the build loudly', () => {
	assert.throws(() => stripComments('a { color: red } /* oops'), /unterminated/);
});

/* --------------------------------------------------------------------------
 * 11. Documentation as Code
 *
 * The stylesheets carry their reference as KSS blocks: a title, a description,
 * optional modifier lines (`.class - meaning`, `:state - meaning`, or for tokens
 * `--gldn-token - meaning`), optional Markup: and Example: sections, and a
 * closing Styleguide reference. The modules carry theirs as JSDoc. The README
 * introduces the project and points to both.
 * ------------------------------------------------------------------------ */

// A KSS block is a comment whose last line is its Styleguide reference.
function kssBlocks(css) {
	return [...css.matchAll(/\/\*\n((?:(?!\*\/)[\s\S])*?)\n\s*Styleguide ([^\n]+)\n\s*\*\//g)]
		.map(([, body, reference]) => {
			const lines = body.split('\n').map((line) => line.trim());
			return { title: lines.find(Boolean), body, reference: reference.trim(),
				example: /^\s*Example: (\S+)$/m.exec(body)?.[1] };
		});
}

const names = (text, pattern) => new Set([...text.matchAll(pattern)].map((m) => m[1]));
const WORD = (name) => new RegExp(`(?<![\\w-])${name}(?![\\w-])`);

test('every KSS block has a title, a description and a unique Styleguide reference', () => {
	const blocks = PARTIALS.flatMap((name) => kssBlocks(src(name)).map((block) => ({ name, ...block })));
	assert.ok(blocks.length >= 50, `only ${blocks.length} KSS blocks`);
	const references = new Set();
	for (const { name, title, body, reference, example } of blocks) {
		assert.match(reference, /^(?:Reset|Tokens|Layout|Components|Responsive)\.[A-Z]/, `${name}: ${reference}`);
		assert.equal(reference.split('.').at(-1), title, `${name}: ${reference} is titled ${title}`);
		assert.ok(body.split('\n').filter((line) => line.trim()).length >= 2, `${reference} has no description`);
		assert.ok(!references.has(reference), `${reference} is used twice`);
		references.add(reference);
		if (example) assert.ok(existsSync(path.join(root, example)), `${reference}: missing ${example}`);
	}
});

test('every gldn- class in the stylesheets is documented in a KSS block', () => {
	const css = PARTIALS.map(src).join('\n');
	const documented = kssBlocks(css).map((block) => block.body).join('\n');
	const classes = names(stripComments(css), /\.(gldn-[\w-]+)/g);
	const missing = [...classes].filter((name) => !WORD(name).test(documented));
	assert.deepEqual(missing, [], `classes without a KSS block: ${missing}`);
});

test('every token is documented in a KSS block of the tokens layer', () => {
	const documented = kssBlocks(tokens).map((block) => block.body).join('\n');
	const missing = [...names(stripComments(tokens), /(--gldn-[\w-]+)\s*:/g)]
		.filter((name) => !new RegExp(`^\\s*${name}\\s+- `, 'm').test(documented));
	assert.deepEqual(missing, [], `tokens without a documented line: ${missing}`);
});

test('a component example page shows the component it documents', () => {
	for (const block of kssBlocks(components)) {
		if (!block.example) continue;
		const page = readFileSync(path.join(root, block.example), 'utf8');
		const classes = [...names(block.body, /(gldn-[\w-]+)/g)];
		assert.ok(classes.some((name) => WORD(name).test(page)), `${block.example} shows none of ${block.reference}`);
	}
});

// Splits a parameter list on its top-level commas, leaving destructured defaults whole.
function topLevel(params) {
	const parts = [''];
	let depth = 0;
	for (const ch of params) {
		if ('{[('.includes(ch)) depth++;
		else if ('}])'.includes(ch)) depth--;
		if (ch === ',' && depth === 0) parts.push('');
		else parts[parts.length - 1] += ch;
	}
	return parts.map((part) => part.trim()).filter(Boolean);
}

test('every module opens with a description, and every export has JSDoc', () => {
	for (const name of MODULES) {
		const source = src(name);
		assert.match(source, /^\/\*\n \* \S/, `${name} must open with a block comment`);
		for (const match of source.matchAll(/(\/\*\*(?:(?!\*\/)[\s\S])*\*\/)?\nexport function (\w+)\(([^)]*(?:\([^)]*\)[^)]*)*)\) \{\n([\s\S]*?)\n\}/g)) {
			const [, doc, fn, params, body] = match;
			assert.ok(doc, `${name}: ${fn} has no JSDoc`);
			for (const param of topLevel(params)) {
				const id = param.startsWith('{') ? 'options' : param.split('=')[0].trim();
				assert.match(doc, new RegExp(`@param \\{[^}]+\\} \\[?${id}\\b`), `${name}: ${fn} lacks @param ${id}`);
			}
			if (/^\treturn\b/m.test(body)) assert.match(doc, /@returns \{/, `${name}: ${fn} lacks @returns`);
			for (const event of names(body, /new CustomEvent\('([\w-]+)'/g)) {
				assert.match(doc, new RegExp(`@fires ${event}\\b`), `${name}: ${fn} lacks @fires ${event}`);
			}
		}
	}
});

test('README lines fit in 100 columns', () => {
	const long = readFileSync(path.join(root, 'README.md'), 'utf8').split('\n')
		.map((line, index) => ({ line: index + 1, width: line.replace(/\t/g, '    ').length }))
		.filter(({ width }) => width > 100);
	assert.deepEqual(long, [], 'README lines wider than 100 columns');
});

console.log(`\n${passed} contract tests passed${failed ? `, ${failed} failed` : ''}`);
