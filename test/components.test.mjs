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

	// A pointer opens and closes an item by its marker; Tab reaches only the current row's control.
	const center = (selector) => value(`(() => { const box = document.querySelector('${selector}').getBoundingClientRect();
		return [box.left + box.width / 2, box.top + box.height / 2]; })()`);
	await browser.click(...await center('#science > .gldn-tree-row > .gldn-tree-toggle'));
	const markerOpen = await value(`({ expanded: document.getElementById('science').getAttribute('aria-expanded'),
		focus: document.activeElement.id, group: getComputedStyle(document.querySelector('#science > [role="group"]')).display })`);
	await browser.click(...await center('#science > .gldn-tree-row > .gldn-tree-toggle'));
	const reclosed = await value(`document.getElementById('science').getAttribute('aria-expanded')`);
	await value(`document.getElementById('selection').focus()`);
	const order = [];
	for (let step = 0; step < 2; step++) {
		await browser.press('Tab');
		order.push(await value(`document.activeElement.getAttribute('aria-label') || document.activeElement.id
			|| document.activeElement.tagName`));
	}
	await value(`document.querySelector('[aria-label="Mark Selection by meaning"]').focus()`);
	await browser.press('Enter');
	const pressed = await value(`({ pressed: document.querySelector('[aria-label="Mark Selection by meaning"]').getAttribute('aria-pressed'),
		hash: location.hash, stops: [...document.querySelectorAll('#tree a, #tree button')].filter((control) => control.tabIndex >= 0)
			.map((control) => control.getAttribute('aria-label') || control.textContent) })`);

	test('a click on the marker opens or closes an item, and Tab reaches only the current row\'s control', () => {
		if (markerOpen.expanded !== 'true' || markerOpen.focus !== 'science' || markerOpen.group === 'none'
			|| reclosed !== 'false' || order[0] !== 'Mark Selection by meaning' || order[1].startsWith('Mark')
			|| order.some((stop) => stop === 'A') || pressed.pressed !== 'true' || pressed.hash !== ''
			|| pressed.stops.join() !== 'Mark Selection by meaning') {
			throw new Error(JSON.stringify({ markerOpen, reclosed, order, pressed }));
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
	const removeLetter = await value(`(() => { const box = document.querySelector('[aria-label="Remove Letter"]').getBoundingClientRect();
		return [box.left + box.width / 2, box.top + box.height / 2]; })()`);
	await browser.click(...removeLetter);
	const clicked = await value(`[...document.querySelectorAll('#chips .gldn-chip')].map((chip) => chip.firstChild.textContent)`);

	test('facets apply only on submit, and removing a chip by key or click moves focus to the next one', () => {
		if (before.join() !== 'Book,Letter' || unchanged !== 2 || chips.labels.join() !== 'Photograph,Letter'
			|| chips.focus !== 'Remove Photograph' || clicked.join() !== 'Photograph') {
			throw new Error(JSON.stringify({ before, unchanged, chips, clicked }));
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

	// Presses during a request wait for it; the last page makes the button unavailable, and a
	// failure keeps the items shown and offers Retry.
	await browser.press('Enter');
	await browser.press('Enter');
	await delay(400);
	const ended = await value(`({ items: document.querySelectorAll('#list > li').length,
		label: document.getElementById('more').textContent, unavailable: document.getElementById('more').getAttribute('aria-disabled'),
		shown: document.getElementById('shown').textContent, focus: document.activeElement.id })`);
	await browser.press('Enter');
	await delay(400);
	const after = await value(`document.querySelectorAll('#list > li').length`);
	await open('pagination.html?fail');
	await value(`document.getElementById('more').click()`);
	await delay(400);
	const failed = await value(`({ label: document.getElementById('more').textContent,
		shown: document.getElementById('shown').textContent, items: document.querySelectorAll('#list > li').length })`);
	await value(`document.getElementById('more').click()`);
	await delay(400);
	const retried = await value(`({ label: document.getElementById('more').textContent.trim(),
		items: document.querySelectorAll('#list > li').length, shown: document.getElementById('shown').textContent })`);

	test('Load more runs one request at a time, ends unavailable, and retries after a failure', () => {
		if (ended.items !== 8 || ended.label !== 'All shown' || ended.unavailable !== 'true'
			|| ended.shown !== '8 shown' || ended.focus !== 'more' || after !== 8
			|| failed.label !== 'Retry' || failed.shown !== 'Loading failed.' || failed.items !== 3
			|| retried.label !== 'Load more' || retried.items !== 6 || retried.shown !== '6 shown') {
			throw new Error(JSON.stringify({ ended, after, failed, retried }));
		}
	});

	/* C-08 */
	await open('panel.html');
	await value(`document.querySelector('#inactive .gldn-disclosure').click()`);
	const panels = await value(`({ active: getComputedStyle(document.getElementById('active')).boxShadow,
		collapsed: document.getElementById('inactive-body').hidden,
		expanded: document.querySelector('#inactive .gldn-disclosure').getAttribute('aria-expanded'),
		busy: getComputedStyle(document.getElementById('loading'), '::before').borderTopStyle })`);
	await value(`document.querySelector('#inactive .gldn-disclosure').click()`);
	const nested = await value(`(() => { const panel = getComputedStyle(document.getElementById('nested'));
		return { shadow: panel.boxShadow, border: panel.borderTopStyle, padding: parseFloat(panel.paddingTop),
			outer: parseFloat(getComputedStyle(document.getElementById('inactive')).paddingTop),
			startsHidden: document.getElementById('nested-body').hidden }; })()`);

	test('view panels mark the active one, collapse their body, and show loading', () => {
		if (!panels.active.includes('inset') || !panels.collapsed || panels.expanded !== 'false' || panels.busy !== 'solid') {
			throw new Error(JSON.stringify(panels));
		}
	});

	test('a nested panel has a hairline instead of a shadow, and its body starts as its button says', () => {
		if (nested.shadow !== 'none' || nested.border !== 'solid' || !(nested.padding < nested.outer)
			|| !nested.startsHidden) {
			throw new Error(JSON.stringify(nested));
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
	const shellState = () => value(`(() => {
		const display = (id) => getComputedStyle(document.getElementById(id)).display;
		return { toggle: display('toggle'), nav: display('shell-nav'), searchToggle: display('search-toggle'),
			search: display('search'), close: display('close'),
			navTop: document.getElementById('shell-nav').getBoundingClientRect().top,
			mainTop: document.getElementById('content').getBoundingClientRect().top,
			overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
	})()`);
	await open('shell.html', 375);
	const narrow = await shellState();
	await value(`document.getElementById('toggle').click(); document.getElementById('search-toggle').click()`);
	const opened = await shellState();
	await open('shell.html', 1200);
	const wide = await value(`({ toggle: getComputedStyle(document.getElementById('toggle')).display,
		nav: getComputedStyle(document.getElementById('shell-nav')).display,
		search: getComputedStyle(document.getElementById('search')).display,
		navWidth: document.getElementById('shell-nav').getBoundingClientRect().width,
		mainWidth: document.getElementById('content').getBoundingClientRect().width,
		reserve: parseFloat(getComputedStyle(document.body).paddingBottom),
		dock: document.querySelector('[data-gldn-dock]').getBoundingClientRect().height })`);
	await value(`document.getElementById('close').click()`);
	const closed = await value(`({ toggle: getComputedStyle(document.getElementById('toggle')).display,
		nav: getComputedStyle(document.getElementById('shell-nav')).display, focus: document.activeElement.id,
		fill: document.getElementById('content').getBoundingClientRect().width
			/ document.querySelector('.gldn-workspace').clientWidth })`);
	await value(`document.getElementById('toggle').click()`);
	const reopened = await value(`({ toggle: getComputedStyle(document.getElementById('toggle')).display,
		nav: getComputedStyle(document.getElementById('shell-nav')).display })`);

	test('the shell folds its search and navigation behind toggles at 375px, above the content in order', () => {
		if (narrow.toggle === 'none' || narrow.searchToggle === 'none' || narrow.nav !== 'none'
			|| narrow.search !== 'none' || opened.nav === 'none' || opened.search === 'none' || opened.close !== 'none'
			|| opened.navTop >= opened.mainTop || narrow.overflow > 0 || opened.overflow > 0) {
			throw new Error(JSON.stringify({ narrow, opened }));
		}
	});

	test('the wide shell sets navigation beside the larger content, closes it to widen the content, reopens it, and reserves the dock', () => {
		if (wide.toggle !== 'none' || wide.nav === 'none' || wide.search === 'none' || wide.mainWidth <= wide.navWidth
			|| Math.abs(wide.reserve - wide.dock) > 1 || closed.nav !== 'none' || closed.toggle === 'none'
			|| closed.focus !== 'toggle' || closed.fill < 0.9 || reopened.nav === 'none' || reopened.toggle !== 'none') {
			throw new Error(JSON.stringify({ wide, closed, reopened }));
		}
	});

	// Text in the tree, the chips and the shell bar keeps AA contrast on what lies behind it.
	const contrastExpression = (selector) => `(() => {
		const channels = (color) => color.match(/[\\d.]+/g).map(Number);
		const over = (top, bottom) => {
			const [r, g, b, a = 1] = channels(top);
			const [R, G, B] = channels(bottom);
			return 'rgb(' + (r * a + R * (1 - a)) + ', ' + (g * a + G * (1 - a)) + ', ' + (b * a + B * (1 - a)) + ')';
		};
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
		const behind = (element) => {
			const layers = [];
			for (let node = element; node; node = node.parentElement) layers.push(getComputedStyle(node).backgroundColor);
			return layers.reverse().reduce((below, layer) => over(layer, below), 'rgb(255, 255, 255)');
		};
		return [...document.querySelectorAll(${JSON.stringify(selector)})]
			.filter((element) => element.textContent.trim() && element.getClientRects().length)
			.map((element) => ({ text: element.textContent.trim().slice(0, 24),
				ratio: contrast(getComputedStyle(element).color, behind(element)) }));
	})()`;
	const ratios = [];
	for (const scheme of ['light', 'dark']) {
		await browser.media([{ name: 'prefers-color-scheme', value: scheme }]);
		await open('tree.html');
		await value(`document.querySelector('#tree [aria-pressed]').click()`);
		ratios.push(...(await value(contrastExpression('#tree a, #tree button'))).map((row) => ({ scheme, ...row })));
		await open('chips.html');
		ratios.push(...(await value(contrastExpression('#chips .gldn-chip, #chips button'))).map((row) => ({ scheme, ...row })));
		await open('shell.html');
		ratios.push(...(await value(contrastExpression('.gldn-shell-bar strong, .gldn-shell-bar label, .gldn-shell-bar a, .gldn-shell-bar button, #tree a')))
			.map((row) => ({ scheme, ...row })));
	}
	await browser.media([]);

	test('tree rows, chips and the shell bar keep AA text contrast in both schemes', () => {
		const low = ratios.filter((row) => row.ratio < 4.5);
		if (ratios.length < 20 || low.length) throw new Error(JSON.stringify(low.length ? low : ratios));
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
