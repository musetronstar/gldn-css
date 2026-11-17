/*
 * Rendered tests for class-less semantic HTML: docs/semantic.html is composed by the stylesheet
 * alone, in both schemes and from 320px to 1200px, and the class-less rules leave pages that
 * lay themselves out with classes untouched. Run through test/layout.test.mjs.
 */
import { writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const contrastFunctions = `
	const channels = (color) => color.match(/[\\d.]+/g).map(Number);
	const luminance = (color) => {
		const [r, g, b] = channels(color).slice(0, 3).map((value) => {
			value /= 255;
			return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
		});
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	};
	const contrast = (a, b) => {
		const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
		return (light + 0.05) / (dark + 0.05);
	};
`;

const look = `(() => {
	${contrastFunctions}
	const style = (selector, pseudo) => getComputedStyle(document.querySelector(selector), pseudo);
	const box = (selector) => document.querySelector(selector).getBoundingClientRect();
	const article = style('#essay');
	const main = box('body > main');
	const group = [...document.querySelectorAll('#group > *')].map((child) => child.getBoundingClientRect());
	const form = box('#form form fieldset');
	return {
		mainWidth: main.width,
		mainCentered: Math.abs(main.left - (document.documentElement.clientWidth - main.right)) < 1,
		navRow: style('header nav ul').display + ' ' + style('header nav ul').listStyleType,
		card: article.backgroundColor + ' ' + article.paddingTop,
		surface: (() => { const probe = document.createElement('span'); probe.style.color = 'var(--gldn-color-surface)';
			document.body.append(probe); const color = getComputedStyle(probe).color; probe.remove(); return color; })(),
		subtitle: style('hgroup > p').color !== style('hgroup > h1').color,
		markContrast: contrast(style('mark').color, style('mark').backgroundColor),
		abbr: style('abbr').textDecorationStyle,
		del: style('del').textDecorationLine,
		ins: style('ins').textDecorationLine,
		kbd: parseFloat(style('kbd').borderBottomWidth) > parseFloat(style('kbd').borderTopWidth),
		sup: parseFloat(style('sup').fontSize) < parseFloat(style('#essay p').fontSize),
		tableBorder: style('#data td').borderLeftWidth + ' ' + style('#data table').borderTopWidth,
		caption: style('caption').textAlign,
		quoteFooter: parseFloat(style('blockquote > footer').fontSize) < parseFloat(style('blockquote').fontSize),
		summary: style('details > summary').fontWeight,
		progress: Math.abs(box('#reading').width - document.getElementById('reading').parentElement.getBoundingClientRect().width) < 1,
		field: Math.abs(box('#title').width - (form.width - parseFloat(style('#form fieldset').paddingLeft)
			- parseFloat(style('#form fieldset').paddingRight) - 2 * parseFloat(style('#form fieldset').borderLeftWidth))) < 1,
		fileLine: box('#scale').top > box('#file').bottom,
		hint: style('#title + small').display,
		checkbox: style('label:has(> [name="public"])').display,
		switchOn: style('#switch-on').backgroundPositionX + ' ' + style('#switch-on').backgroundColor,
		switchOff: style('#switch-off').backgroundPositionX,
		switchShape: box('#switch-on').width > box('#switch-on').height * 2,
		groupLine: group.every((item) => Math.abs(item.top - group[0].top) < 1),
		groupJoined: group[0].right - group[1].left,
		buttonWidth: group[1].width < group[0].width,
		fieldset: style('#form fieldset').borderTopStyle,
		sections: parseFloat(style('#essay > section').marginBottom) > parseFloat(style('#essay p').marginBottom)
	};
})()`;

export async function testSemantic(browser, test, root) {
	const url = 'file://' + path.join(root, 'docs', 'semantic.html');
	const ready = () => browser.evaluate(`new Promise((resolve) => {
		const check = () => (window.ready ? resolve(true) : setTimeout(check, 20));
		check();
	})`);

	const fits = [];
	for (const scheme of ['light', 'dark']) {
		await browser.media([{ name: 'prefers-color-scheme', value: scheme }]);
		for (const width of [320, 390, 768, 1200]) {
			await browser.viewport(width);
			await browser.navigate(url, 16);
			await ready();
			fits.push({ scheme, width,
				overflow: await browser.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth') });
		}
	}
	await browser.media([]);

	test('the class-less page fits 320px to 1200px in both schemes', () => {
		const bad = fits.filter((fit) => fit.overflow > 1);
		if (bad.length) throw new Error(JSON.stringify(bad));
	});

	const looks = {};
	for (const scheme of ['light', 'dark']) {
		await browser.media([{ name: 'prefers-color-scheme', value: scheme }]);
		await browser.viewport(1600);
		await browser.navigate(url, 16);
		await ready();
		looks[scheme] = await browser.evaluate(look);
	}
	await browser.media([]);

	test('landmarks are centered columns, the header nav is a row, and an article is a card', () => {
		for (const [scheme, page] of Object.entries(looks)) {
			if (page.mainWidth > 1200 || !page.mainCentered || page.navRow !== 'flex none'
				|| page.card !== `${page.surface} ${page.card.split(' ').at(-1)}` || page.card.endsWith(' 0px')
				|| !page.subtitle || !page.sections) {
				throw new Error(`${scheme}: ${JSON.stringify(page)}`);
			}
		}
	});

	test('text-level elements each carry a cue, with AA text on a mark in both schemes', () => {
		for (const [scheme, page] of Object.entries(looks)) {
			if (page.markContrast < 4.5 || page.abbr !== 'dotted' || page.del !== 'line-through'
				|| page.ins !== 'underline' || !page.kbd || !page.sup || page.tableBorder !== '0px 0px'
				|| page.caption !== 'start' || !page.quoteFooter || page.summary !== '600' || !page.progress) {
				throw new Error(`${scheme}: ${JSON.stringify(page)}`);
			}
		}
	});

	test('forms set fields in a column, switches move their knob, and groups join on one line', () => {
		for (const [scheme, page] of Object.entries(looks)) {
			if (!page.field || !page.fileLine || page.hint !== 'block' || page.checkbox !== 'inline-flex'
				|| !page.switchOn.startsWith('100%') || !page.switchOn.endsWith('rgb(37, 99, 235)')
				|| !page.switchOff.startsWith('0%') || !page.switchShape || !page.groupLine
				|| page.groupJoined <= 0 || page.groupJoined > 2 || !page.buttonWidth || page.fieldset !== 'solid') {
				throw new Error(`${scheme}: ${JSON.stringify(page)}`);
			}
		}
	});

	await browser.viewport(1200);
	await browser.navigate(url, 16);
	await ready();
	await browser.evaluate(`document.getElementById('open-dialog').click()`);
	const dialog = await browser.evaluate(`({ open: document.getElementById('dialog').open,
		backdrop: getComputedStyle(document.getElementById('dialog'), '::backdrop').backgroundColor,
		padding: getComputedStyle(document.getElementById('dialog')).paddingTop })`);

	test('a dialog holding an article opens over a dimmed backdrop and lets the article be its surface', () => {
		if (!dialog.open || !dialog.backdrop.startsWith('rgba') || dialog.padding !== '0px') {
			throw new Error(JSON.stringify(dialog));
		}
	});

	// A page laid out with classes, shaped like an application: none of the class-less rules apply.
	const file = path.join(os.tmpdir(), 'gldn-semantic-classed.html');
	writeFileSync(file, `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
		<link rel="stylesheet" href="file://${path.join(root, 'dist', 'gldn.min.css')}"></head><body>
		<header class="gldn-header" id="header"><form class="gldn-search" id="search"><input id="query" type="search">
			<select id="scope"><option>All</option></select><button class="gldn-btn">Search</button></form></header>
		<main class="gldn-workspace" id="main">
			<aside class="gldn-sidebar"><nav aria-label="tree"><ul id="tree"><li>one</li><li>two</li></ul></nav></aside>
			<article class="gldn-main" id="article"><section id="section"><p>text</p></section><p>after</p></article>
		</main></body></html>`);
	await browser.navigate('file://' + file, 16);
	const classed = await browser.evaluate(`({
		header: getComputedStyle(document.getElementById('header')).maxWidth,
		main: getComputedStyle(document.getElementById('main')).maxWidth,
		tree: getComputedStyle(document.getElementById('tree')).display,
		article: getComputedStyle(document.getElementById('article')).paddingTop
			=== getComputedStyle(document.querySelector('.gldn-sidebar')).paddingTop,
		query: document.getElementById('scope').getBoundingClientRect().width < 200
	})`);

	test('pages laid out with classes keep their own layout', () => {
		if (classed.header !== 'none' || classed.main !== 'none' || classed.tree !== 'block' || !classed.article
			|| !classed.query) {
			throw new Error(JSON.stringify(classed));
		}
	});
}
