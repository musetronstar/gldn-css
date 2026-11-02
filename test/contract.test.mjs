/*
 * gldn-css contract tests.
 *
 * These tests are the executable contract for the framework: they pin the
 * file layout from README.md, the cascade layer order, the gldn- namespace,
 * the golden-ratio token math, cross-file reference integrity, and that the
 * committed dist bundle is in sync with src/. Run: node test/contract.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, collapse, stripComments } from '../scripts/build.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = (name) => readFileSync(path.join(root, 'src', name), 'utf8');
const srcFile = (name) => path.join(root, 'src', name);

const PARTIALS = ['_tokens.css', '_layout.css', '_components.css', '_responsive.css'];
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

test('spacing and typography scales are defined', () => {
	for (const name of ['base', 'xs', 'sm', 'md', 'lg', 'xl', '2xl']) {
		assert.match(tokens, new RegExp(`--gldn-space-${name}:`), `missing --gldn-space-${name}`);
	}
	for (const name of ['base', 'sm', 'md', 'lg', 'xl']) {
		assert.match(tokens, new RegExp(`--gldn-text-${name}:`), `missing --gldn-text-${name}`);
	}
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

test('example links the docs bundle and the example script', () => {
	assert.match(html, /<link rel="stylesheet" href="gldn\.min\.css">/);
	assert.match(html, /<script src="gldn\.js"><\/script>/);
});

test('every gldn- class used in the example exists in src', () => {
	const used = new Set([...html.matchAll(/class="([^"]*)"/g)]
		.flatMap((m) => m[1].split(/\s+/))
		.filter((c) => c.startsWith('gldn-')));
	const missing = [...used].filter((c) => !allSrc.includes(`.${c}`));
	assert.deepEqual(missing, [], `classes used but not defined: ${missing}`);
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
