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
import { build, collapse, stripComments } from '../scripts/build.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = (name) => readFileSync(path.join(root, 'src', name), 'utf8');
const srcFile = (name) => path.join(root, 'src', name);

const PARTIALS = ['_tokens.css', '_layout.css', '_components.css', '_responsive.css'];
const MODULES = ['gldn-tabs.js', 'gldn-messages.js', 'gldn-dock.js'];
const LAYERS = ['reset', 'tokens', 'layout', 'components', 'responsive'];

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

/* --------------------------------------------------------------------------
 * 1. Repository structure per README.md architecture
 * ------------------------------------------------------------------------ */

test('src partials and entry point exist', () => {
	for (const name of [...PARTIALS, 'gldn.css']) {
		assert.ok(existsSync(srcFile(name)), `missing src/${name}`);
	}
	assert.ok(existsSync(path.join(root, 'dist', 'gldn.min.css')), 'missing dist/gldn.min.css');
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

test('gldn.css imports every partial', () => {
	for (const partial of PARTIALS) {
		assert.match(entry, new RegExp(`@import\\s+url\\('\\./${partial}'\\)\\s*;`),
			`gldn.css must import ${partial}`);
	}
});

test('every partial assigns its rules to a layer block', () => {
	for (const layer of LAYERS.slice(1)) {
		assert.match(src(`_${layer}.css`), new RegExp(`@layer\\s+${layer}\\s*\\{`),
			`_${layer}.css must wrap rules in @layer ${layer}`);
	}
	// The tokens file also hosts the global reset in its own layer.
	assert.match(src('_tokens.css'), /@layer\s+reset\s*\{/,
		'_tokens.css must wrap the reset in @layer reset');
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
		'border', 'primary-fg', 'link']) {
		assert.match(tokens, new RegExp(`--gldn-color-${name}:`), `missing --gldn-color-${name}`);
	}
	assert.match(tokens, /--gldn-radius-sm:/, 'missing --gldn-radius-sm');
	assert.match(tokens, /--gldn-radius-md:/, 'missing --gldn-radius-md');
	assert.match(tokens, /--gldn-shadow:/, 'missing --gldn-shadow');
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

test('layout and components define no custom properties; responsive only overrides tokens', () => {
	for (const layer of ['layout', 'components']) {
		const body = src(`_${layer}.css`);
		const defs = [...body.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]);
		assert.deepEqual(defs, [], `_${layer}.css must not define custom properties: ${defs}`);
	}
	const responsiveDefs = [...responsive.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]);
	const novel = responsiveDefs.filter((p) => !tokenDefs.has(p));
	assert.deepEqual(novel, [], `responsive layer may only override existing tokens: ${novel}`);
});

/* --------------------------------------------------------------------------
 * 6. Golden layout primitives and responsive reflow
 * ------------------------------------------------------------------------ */

test('fixed and fluid golden split primitives exist', () => {
	// Fixed splits deduct each column's golden share of the single gutter
	// from its basis; bases + gutter = exactly 100%, and the border-box
	// basis never shrinks, so padding cannot disturb the ratio.
	assert.match(layout, /\.gldn-major\s*\{[^}]*flex:\s*0 0 calc\(var\(--gldn-major\) - var\(--gldn-gutter\)[^}]*min-width:\s*0/s,
		'.gldn-major must hold the gutter-aware basis with a zero content floor');
	assert.match(layout, /\.gldn-minor\s*\{[^}]*flex:\s*0 0 calc\(var\(--gldn-minor\) - var\(--gldn-gutter\)[^}]*min-width:\s*0/s,
		'.gldn-minor must hold the gutter-aware basis with a zero content floor');
	// Fluid split: growing by phi and 1 keeps the 1:phi ratio at any width.
	assert.match(layout, /\.gldn-major-fluid\s*\{[^}]*flex:\s*var\(--gldn-phi\) 1 0/s,
		'.gldn-major-fluid must grow by phi');
	assert.match(layout, /\.gldn-minor-fluid\s*\{[^}]*flex:\s*1 1 0/s,
		'.gldn-minor-fluid must grow by 1');
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
	assert.match(components, /\.gldn-sidebar\s*\{[^}]*flex:\s*0 0 calc\(var\(--gldn-minor\) - var\(--gldn-gutter\)[^}]*min-width:\s*0/s,
		'.gldn-sidebar must compose the gutter-aware minor split');
	assert.match(components, /\.gldn-main\s*\{[^}]*flex:\s*0 0 calc\(var\(--gldn-major\) - var\(--gldn-gutter\)[^}]*min-width:\s*0/s,
		'.gldn-main must compose the gutter-aware major split');
});

test('responsive layer stacks golden splits to full width at the breakpoint', () => {
	assert.match(responsive, /@media\s*\(max-width:\s*48rem\)\s*\{[\s\S]*?flex:\s*1 1 100%/,
		'responsive layer must stack major/minor to 100% below 48rem');
	assert.match(responsive, /@media[\s\S]*?\.gldn-workspace[\s\S]*?flex-direction:\s*column/,
		'.gldn-workspace must stack vertically on small screens');
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
	assert.match(html, /id="plain-light"/);
	assert.match(html, /id="plain-dark"/);
});

test('the font specimen opts in and offers three pairings in both themes', () => {
	assert.match(fontHtml, /<link rel="stylesheet" href="gldn-fonts\.css">/);
	assert.equal((fontHtml.match(/data-pairing=/g) || []).length, 6);
	assert.equal((fontHtml.match(/data-theme="light"/g) || []).length, 1);
	assert.equal((fontHtml.match(/data-theme="dark"/g) || []).length, 1);
	assert.match(fontHtml, /Choice:\s*pending user review/);
	const specimenFaces = (fontHtml.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
	checkFontDirectory(path.join(root, 'docs', 'specimen', 'fonts'), specimenFaces);
});

test('every gldn- class used in the examples exists in src', () => {
	const examples = [html, fontHtml, readFileSync(
		path.join(root, 'docs', 'components', 'dock.html'), 'utf8')];
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

test('src is pure CSS', () => {
	assert.doesNotMatch(allSrc, /\$[\w-]+\s*:/, 'Sass-style variables are not pure CSS');
	assert.doesNotMatch(allSrc, /@import\s+url\(['"]?https?:/, 'no external imports allowed');
});

/* --------------------------------------------------------------------------
 * 9. dist bundle is in sync with src and minified
 * ------------------------------------------------------------------------ */

test('dist and docs bundles match a fresh build of src', () => {
	const fresh = build();
	for (const directory of ['dist', 'docs']) {
		const committed = readFileSync(path.join(root, directory, 'gldn.min.css'), 'utf8');
		assert.equal(committed, fresh, `${directory} is stale; run node scripts/build.mjs`);
	}
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

console.log(`\n${passed} contract tests passed`);
