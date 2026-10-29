/*
 * gldn-css build: inline the src/ partials into a single minified bundle.
 *
 * Zero-dependency on purpose: the framework ships pure CSS, so its build
 * tooling must not require a package install. The minifier is deliberately
 * conservative — it splits the source into quoted strings and code, touches
 * only the code, and never removes spaces around calc() operators, where
 * whitespace is significant. Malformed input fails the build loudly instead
 * of shipping a broken bundle.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const srcDir = path.join(root, 'src');

/* Split CSS into alternating code and quoted-string segments so string
 * content survives minification byte for byte. */
function splitStrings(css) {
	const segments = [];
	let quote = null;
	let cur = '';

	for (let i = 0; i < css.length; i++) {
		const ch = css[i];
		if (quote) {
			cur += ch;
			if (ch === '\\' && i + 1 < css.length) {
				cur += css[++i];
			} else if (ch === quote) {
				segments.push([cur, true]);
				cur = '';
				quote = null;
			}
		} else if (ch === '"' || ch === "'") {
			if (cur) segments.push([cur, false]);
			cur = ch;
			quote = ch;
		} else {
			cur += ch;
		}
	}
	// An unterminated trailing quote stays a string so the build never hangs.
	if (cur) segments.push([cur, quote !== null]);
	return segments;
}

/* Remove comments without touching comment-like text inside quotes. */
export function stripComments(css) {
	let out = '';
	let quote = null;
	for (let i = 0; i < css.length; i++) {
		const ch = css[i];
		if (quote) {
			out += ch;
			if (ch === '\\' && i + 1 < css.length) {
				out += css[++i];
			} else if (ch === quote) {
				quote = null;
			}
		} else if (ch === '"' || ch === "'") {
			quote = ch;
			out += ch;
		} else if (ch === '/' && css[i + 1] === '*') {
			const end = css.indexOf('*/', i + 2);
			if (end === -1) {
				throw new Error('unterminated comment in src/');
			}
			i = end + 1;
		} else {
			out += ch;
		}
	}
	return out;
}

/* Collapse whitespace and drop spaces that CSS tokenizes unambiguously. */
export function collapse(css) {
	const collapseCode = (code) => code
		.replace(/\s+/g, ' ')
		.replace(/\s*([{};,])\s*/g, '$1')
		.replace(/;}/g, '}')
		.trim();

	return splitStrings(css)
		.map(([segment, isString]) => (isString ? segment : collapseCode(segment)))
		.join(' ');
}

export function build() {
	const entry = readFileSync(path.join(srcDir, 'gldn.css'), 'utf8');
	const bundle = entry.replace(
		/@import\s+url\('([^']+)'\)\s*;/g,
		(_match, file) => readFileSync(path.join(srcDir, file), 'utf8')
	);
	if (/@import/.test(bundle)) {
		throw new Error('unsupported @import form in src/gldn.css');
	}
	const min = collapse(stripComments(bundle));
	return `/* gldn-css - generated from src/, do not edit */\n${min}\n`;
}

const invokedDirectly = process.argv[1]
	&& fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
	const outDir = path.join(root, 'dist');
	mkdirSync(outDir, { recursive: true });
	writeFileSync(path.join(outDir, 'gldn.min.css'), build());
	console.log('built dist/gldn.min.css');
}
