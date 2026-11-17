/*
 * Rendered tests for the component examples in docs/components/: every page loads its modules
 * and fits 320px and 1200px in both schemes, and each component keeps its contract when driven
 * by real keys and clicks. Run through test/layout.test.mjs.
 */
import { readdirSync } from 'node:fs';
import path from 'node:path';

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function testComponents(browser, test, root) {
	const directory = path.join(root, 'docs', 'components');
	const url = (name) => 'file://' + path.join(directory, name);
	const pages = readdirSync(directory).filter((name) => name.endsWith('.html') && name !== 'dock.html');
	const ready = () => browser.evaluate(`new Promise((resolve, reject) => {
		const start = Date.now();
		const check = () => window.ready ? resolve(true)
			: Date.now() - start > 3000 ? reject(new Error('page script did not finish')) : setTimeout(check, 20);
		check();
	})`);
	const open = async (name, width = 1200) => {
		await browser.viewport(width);
		await browser.navigate(url(name), 16);
		await ready();
	};
	const value = (expression) => browser.evaluate(expression);

	const fits = [];
	for (const name of pages) {
		for (const width of [320, 1200]) {
			for (const scheme of ['light', 'dark']) {
				await browser.media([{ name: 'prefers-color-scheme', value: scheme }]);
				let loaded = true;
				try {
					await open(name, width);
				} catch {
					loaded = false;
				}
				const overflow = await value('document.documentElement.scrollWidth - document.documentElement.clientWidth');
				fits.push({ name, width, scheme, loaded, overflow });
			}
		}
	}
	await browser.media([]);

	test('every component example loads its modules and fits 320px and 1200px in both schemes', () => {
		const bad = fits.filter((fit) => !fit.loaded || fit.overflow > 1);
		if (bad.length) throw new Error(JSON.stringify(bad));
	});

	/* C-01 */
	await open('field.html');
	await value(`document.getElementById('save').click()`);
	const empty = await value(`({ focus: document.activeElement.id,
		title: document.getElementById('title').getAttribute('aria-invalid'),
		described: document.getElementById('title').getAttribute('aria-describedby'),
		kind: document.getElementById('kind').getAttribute('aria-invalid') })`);
	await browser.press('t');
	await value(`document.getElementById('title').value = 'taken'; document.getElementById('kind').value = 'Book';
		document.getElementById('save').click()`);
	await delay(400);
	const taken = await value(`({ message: document.querySelector('[data-gldn-error-for="title"]').textContent,
		kept: document.getElementById('title').value, focus: document.activeElement.id })`);

	test('form fields show linked messages, keep the reader\'s input, and report service errors beside the field', () => {
		if (empty.focus !== 'title' || empty.title !== 'true' || empty.kind !== 'true'
			|| !empty.described.includes('title-hint') || !empty.described.includes('title-error')
			|| taken.message !== 'An entry with this title exists.' || taken.kept !== 'taken' || taken.focus !== 'title') {
			throw new Error(JSON.stringify({ empty, taken }));
		}
	});

	/* C-02 */
	await open('code.html');
	await value(`document.getElementById('code').focus()`);
	await browser.press('Enter', ['Ctrl']);
	const output = await value(`({ text: document.getElementById('result').textContent,
		elements: document.getElementById('result').children.length })`);

	test('code input submits on Ctrl+Enter and shows the result as literal text', () => {
		if (!output.text.includes('record <photograph> "film"') || output.elements !== 0) {
			throw new Error(JSON.stringify(output));
		}
	});

	/* C-03 */
	await open('search.html', 320);
	const search = await value(`(() => {
		const boxes = ['query', 'scope', 'go'].map((id) => document.getElementById(id).getBoundingClientRect());
		return { visible: boxes.every((box) => box.width > 0 && box.right <= innerWidth),
			wrapped: boxes[2].top > boxes[0].top };
	})()`);

	test('the search bar wraps on a narrow screen and hides none of its controls', () => {
		if (!search.visible || !search.wrapped) throw new Error(JSON.stringify(search));
	});

	/* C-04 */
	await open('tree.html');
	await value(`document.getElementById('selection').focus()`);
	await browser.press('ArrowUp');
	await browser.press('ArrowRight');
	const busy = await value(`document.getElementById('photography').getAttribute('aria-busy')`);
	await delay(400);
	await browser.press('ArrowRight');
	const tree = await value(`(() => {
		const row = document.activeElement.querySelector('.gldn-tree-row');
		return { focus: document.activeElement.id, ring: getComputedStyle(row).outlineStyle,
			itemRing: getComputedStyle(document.activeElement).outlineStyle,
			children: document.querySelectorAll('#photography [role="treeitem"]').length,
			hidden: getComputedStyle(document.querySelector('#science > [role="group"]')).display };
	})()`);
	await value(`document.getElementById('science').focus()`);
	await browser.press('ArrowLeft');
	const collapsed = await value(`getComputedStyle(document.querySelector('#science > [role="group"]')).display`);

	test('the tree loads children with a busy ring, rings the focused row, and hides closed groups', () => {
		if (busy !== 'true' || tree.focus !== 'dry' || tree.ring !== 'solid' || tree.itemRing !== 'none'
			|| tree.children !== 2 || tree.hidden === 'none' || collapsed !== 'none') {
			throw new Error(JSON.stringify({ busy, tree, collapsed }));
		}
	});

	/* C-05 */
	await open('results.html');
	await value(`(() => { const input = document.getElementById('filter-text'); input.value = 'nothing like this';
		input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
	const results = await value(`({ empty: document.getElementById('empty').hidden,
		shown: [...document.querySelectorAll('#results > li')].filter((li) => !li.hidden).length,
		current: getComputedStyle(document.getElementById('r1')).boxShadow,
		marks: document.querySelectorAll('#results mark').length })`);

	test('results mark the current entry and matches, and an empty filter says so', () => {
		if (results.empty || results.shown !== 0 || !results.current.includes('inset') || results.marks !== 2) {
			throw new Error(JSON.stringify(results));
		}
	});

	/* C-06 */
	await open('chips.html');
	const before = await value(`[...document.querySelectorAll('#chips .gldn-chip')].map((chip) => chip.firstChild.textContent)`);
	await value(`document.querySelector('[value="Photograph"]').checked = true`);
	const unchanged = await value(`document.querySelectorAll('#chips .gldn-chip').length`);
	await value(`document.getElementById('apply').click()`);
	await value(`document.querySelector('[aria-label="Remove Book"]').focus()`);
	await browser.press('Enter');
	const chips = await value(`({ labels: [...document.querySelectorAll('#chips .gldn-chip')].map((chip) => chip.firstChild.textContent),
		focus: document.activeElement.getAttribute('aria-label') })`);

	test('facets apply only on submit, and removing a chip moves focus to the next one', () => {
		if (before.join() !== 'Book,Letter' || unchanged !== 2 || chips.labels.join() !== 'Photograph,Letter'
			|| chips.focus !== 'Remove Photograph') {
			throw new Error(JSON.stringify({ before, unchanged, chips }));
		}
	});

	/* C-07 */
	await open('pagination.html');
	await value(`document.getElementById('more').focus()`);
	await browser.press('Enter');
	const loading = await value(`document.getElementById('more').getAttribute('aria-busy')`);
	await delay(400);
	const paging = await value(`({ items: document.querySelectorAll('#list > li').length, focus: document.activeElement.id,
		current: getComputedStyle(document.querySelector('[aria-current="page"]')).backgroundColor,
		other: getComputedStyle(document.querySelector('[href="#page-2"]')).backgroundColor,
		previous: document.querySelector('.gldn-pagination [aria-disabled]').localName })`);

	test('pagination marks the current page, shows the unavailable end as text, and loads more in place', () => {
		if (loading !== 'true' || paging.items !== 6 || paging.focus !== 'more' || paging.current === paging.other
			|| paging.previous !== 'span') {
			throw new Error(JSON.stringify({ loading, paging }));
		}
	});

	/* C-08 */
	await open('panel.html');
	await value(`document.querySelector('#inactive .gldn-disclosure').click()`);
	const panels = await value(`({ active: getComputedStyle(document.getElementById('active')).boxShadow,
		collapsed: document.getElementById('inactive-body').hidden,
		expanded: document.querySelector('#inactive .gldn-disclosure').getAttribute('aria-expanded'),
		busy: getComputedStyle(document.getElementById('loading'), '::before').borderTopStyle })`);

	test('view panels mark the active one, collapse their body, and show loading', () => {
		if (!panels.active.includes('inset') || !panels.collapsed || panels.expanded !== 'false' || panels.busy !== 'solid') {
			throw new Error(JSON.stringify(panels));
		}
	});

	/* C-09 */
	await open('meta.html', 320);
	const meta = await value(`(() => { const identity = document.getElementById('identity');
		return { columns: getComputedStyle(document.getElementById('meta')).gridTemplateColumns.split(' ').length,
			cut: identity.scrollWidth > identity.clientWidth, full: identity.textContent.startsWith('https://') }; })()`);

	test('metadata reads as two columns, and a cut identity keeps its full text', () => {
		if (meta.columns !== 2 || !meta.cut || !meta.full) throw new Error(JSON.stringify(meta));
	});

	/* C-11 */
	await open('shell.html', 320);
	const narrow = await value(`({ toggle: getComputedStyle(document.getElementById('toggle')).display,
		nav: getComputedStyle(document.getElementById('shell-nav')).display })`);
	await value(`document.getElementById('toggle').click()`);
	const opened = await value(`getComputedStyle(document.getElementById('shell-nav')).display`);
	await open('shell.html', 1200);
	const wide = await value(`({ toggle: getComputedStyle(document.getElementById('toggle')).display,
		nav: getComputedStyle(document.getElementById('shell-nav')).display,
		reserve: parseFloat(getComputedStyle(document.body).paddingBottom),
		dock: document.querySelector('[data-gldn-dock]').getBoundingClientRect().height })`);

	test('the shell folds its navigation behind a toggle on narrow screens and reserves the dock', () => {
		if (narrow.toggle === 'none' || narrow.nav !== 'none' || opened === 'none' || wide.toggle !== 'none'
			|| wide.nav === 'none' || Math.abs(wide.reserve - wide.dock) > 1) {
			throw new Error(JSON.stringify({ narrow, opened, wide }));
		}
	});

	/* C-12 */
	await open('controls.html');
	await value(`localStorage.clear(); window.theme.set('system')`);
	await value(`document.body.focus()`);
	await browser.press('S', ['Alt', 'Shift']);
	const controls = await value(`({ light: document.documentElement.classList.contains('gldn-theme-light'),
		select: document.querySelector('[data-gldn-theme]').value,
		hints: [...document.querySelectorAll('#hints dt')].map((dt) => dt.textContent) })`);
	await value(`window.theme.set('system')`);

	test('the theme control and its shortcut agree, and the hints list every shortcut', () => {
		if (!controls.light || controls.select !== 'light' || controls.hints.join() !== 'Ctrl+K,Alt+Shift+S') {
			throw new Error(JSON.stringify(controls));
		}
	});

	/* C-13 */
	await open('media.html');
	await value(`document.getElementById('next').click(); document.getElementById('annotate').click()`);
	const media = await value(`(() => { const frame = document.querySelector('.gldn-frame').getBoundingClientRect();
		return { status: document.querySelector('[data-gldn-page-status]').textContent,
			notes: document.querySelectorAll('#notes li').length, ratio: frame.width / frame.height }; })()`);

	test('the media viewer pages with a status, reports annotations, and frames images at phi', () => {
		if (media.status !== 'Page 2 of 3' || media.notes !== 1 || Math.abs(media.ratio - 1.618) > 0.01) {
			throw new Error(JSON.stringify(media));
		}
	});

	/* C-14 */
	await open('timeline.html');
	await value(`document.querySelector('[value="error"]').click()`);
	const filtered = await value(`({ shown: [...document.querySelectorAll('#log .gldn-message')].filter((m) => !m.hidden).length,
		kept: document.querySelectorAll('#log .gldn-message').length })`);
	await value(`document.getElementById('older').click()`);
	const timeline = await value(`({ last: [...document.querySelectorAll('#log .gldn-message-header')].at(-1).textContent,
		details: document.querySelectorAll('#log details.gldn-message-detail').length })`);

	test('the timeline filters without losing entries, folds details, and loads older entries at the end', () => {
		if (filtered.shown !== 3 || filtered.kept !== 4 || timeline.last !== 'Device switched on' || timeline.details !== 3) {
			throw new Error(JSON.stringify({ filtered, timeline }));
		}
	});
}
