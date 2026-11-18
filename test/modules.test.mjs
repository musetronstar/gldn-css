/*
 * Rendered tests for the optional behavior modules, each in a small harness page that imports
 * the built module from dist/ and is driven by real key presses and clicks. Run through
 * test/layout.test.mjs.
 */
import { writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function testModules(browser, test, root) {
	const dist = (name) => 'file://' + path.join(root, 'dist', name);
	const page = (name, body, script) => {
		const file = path.join(os.tmpdir(), `gldn-module-${name}.html`);
		writeFileSync(file, `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">`
			+ `<link rel="stylesheet" href="${dist('gldn.min.css')}"></head><body>${body}`
			+ `<script type="module">${script}</script></body></html>`);
		return 'file://' + file;
	};
	const ready = () => browser.evaluate(`new Promise((resolve) => {
		const check = () => (window.ready ? resolve(true) : setTimeout(check, 20));
		check();
	})`);
	const active = () => browser.evaluate('document.activeElement.id');

	/* J-01 popover */
	await browser.viewport(800);
	await browser.navigate(page('popover', `
		<p><button id="open" popovertarget="tip" type="button">Open</button></p>
		<div id="tip" popover><button id="inside" type="button">Inside</button></div>
		<p style="position: fixed; bottom: 4px; left: 4px"><button id="low" popovertarget="tip2" type="button">Low</button></p>
		<div id="tip2" popover>Above the opener</div>`, `
		import { anchorPopover } from '${dist('gldn-popover.js')}';
		anchorPopover(document.getElementById('tip'), document.getElementById('open'));
		anchorPopover(document.getElementById('tip2'), document.getElementById('low'));
		window.ready = true;`), 16);
	await ready();
	await browser.evaluate(`document.getElementById('open').focus()`);
	await browser.press('Enter');
	const opened = await browser.evaluate(`({
		open: document.getElementById('tip').matches(':popover-open'),
		top: document.getElementById('tip').getBoundingClientRect().top,
		below: document.getElementById('open').getBoundingClientRect().bottom
	})`);
	await browser.evaluate(`document.getElementById('inside').focus()`);
	await browser.press('Escape');
	const closed = { open: await browser.evaluate(`document.getElementById('tip').matches(':popover-open')`), focus: await active() };
	await browser.evaluate(`document.getElementById('low').click()`);
	// Measure after the opening rise, which translates the popover while it runs.
	await delay(400);
	const low = await browser.evaluate(`({
		bottom: document.getElementById('tip2').getBoundingClientRect().bottom,
		opener: document.getElementById('low').getBoundingClientRect().top,
		placement: document.getElementById('tip2').dataset.gldnPlacement
	})`);

	test('a popover opens beside its opener, above it near the bottom, and returns focus on Escape', () => {
		if (!opened.open || opened.top < opened.below || closed.open || closed.focus !== 'open'
			|| low.bottom > low.opener || low.placement !== 'above') {
			throw new Error(JSON.stringify({ opened, closed, low }));
		}
	});

	/* J-02 dialog */
	await browser.navigate(page('dialog', `
		<p><button id="opener" type="button">Open</button></p>
		<dialog id="dialog"><p>Confirm?</p><form method="dialog"><button id="cancel" value="cancel">Cancel</button>
			<button id="confirm" value="confirm" autofocus>Confirm</button></form></dialog>`, `
		import { createDialog } from '${dist('gldn-dialog.js')}';
		window.closes = [];
		const dialog = createDialog(document.getElementById('dialog'), { onClose: (value) => window.closes.push(value) });
		document.getElementById('opener').addEventListener('click', (event) => dialog.open(event.currentTarget));
		window.ready = true;`), 16);
	await ready();
	await browser.evaluate(`document.getElementById('opener').focus()`);
	await browser.press('Enter');
	// A person clicks the backdrop once the dialog has risen into place, centered.
	await browser.evaluate(`Promise.all(document.getElementById('dialog').getAnimations().map((animation) => animation.finished))`);
	const shown = { open: await browser.evaluate(`document.getElementById('dialog').open`), focus: await active(),
		offset: await browser.evaluate(`(() => { const box = document.getElementById('dialog').getBoundingClientRect();
			return [box.left + box.width / 2 - innerWidth / 2, box.top + box.height / 2 - innerHeight / 2]; })()`) };
	await browser.click(5, 5);
	const dismissed = await browser.evaluate(`({ open: document.getElementById('dialog').open, closes: window.closes, focus: document.activeElement.id })`);
	await browser.press('Enter');
	await browser.press('Enter');
	const confirmed = await browser.evaluate(`({ open: document.getElementById('dialog').open, closes: window.closes, focus: document.activeElement.id })`);

	test('a centered dialog focuses its autofocus control, closes on a backdrop click and returns focus', () => {
		if (!shown.open || shown.focus !== 'confirm' || shown.offset.some((axis) => Math.abs(axis) > 1) || dismissed.open || dismissed.focus !== 'opener'
			|| dismissed.closes.join() !== 'cancel' || confirmed.open || confirmed.closes.join() !== 'cancel,confirm'
			|| confirmed.focus !== 'opener') {
			throw new Error(JSON.stringify({ shown, dismissed, confirmed }));
		}
	});

	/* J-03 roving focus in a tree */
	await browser.navigate(page('roving', `
		<p><a id="before" href="#">before</a></p>
		<ul role="tree" aria-label="Essay" id="tree">
			<li role="treeitem" id="one" aria-expanded="false">One<ul role="group">
				<li role="treeitem" id="one-a">Alpha</li><li role="treeitem" id="one-b">Beta</li></ul></li>
			<li role="treeitem" id="two" aria-selected="true">Two</li>
			<li role="treeitem" id="gamma">Gamma</li>
		</ul>
		<p><a id="after" href="#">after</a></p>`, `
		import { createRoving } from '${dist('gldn-roving.js')}';
		window.events = [];
		const tree = document.getElementById('tree');
		for (const name of ['gldn-expand', 'gldn-collapse', 'gldn-activate']) {
			tree.addEventListener(name, (event) => window.events.push(name + ':' + event.detail.item.id));
		}
		createRoving(tree);
		window.ready = true;`), 16);
	await ready();
	await browser.evaluate(`document.getElementById('before').focus()`);
	const walk = [];
	for (const key of ['Tab', 'ArrowUp', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowLeft',
		'End', 'Home', 'g', 'Enter', 'Tab']) {
		await browser.press(key);
		walk.push(await active());
	}
	const roving = await browser.evaluate(`({
		events: window.events,
		stops: [...document.querySelectorAll('[role="treeitem"]')].filter((item) => item.tabIndex === 0).length
	})`);

	test('a tree has one Tab stop and follows the tree keys, typeahead included', () => {
		const expected = 'two,one,one,one-a,one-b,one,one,gamma,one,gamma,gamma,after';
		if (walk.join() !== expected || roving.stops !== 1
			|| roving.events.join() !== 'gldn-expand:one,gldn-collapse:one,gldn-activate:gamma') {
			throw new Error(JSON.stringify({ walk, roving }));
		}
	});

	/* J-04 deliberate form submission */
	await browser.navigate(page('form', `
		<form id="form">
			<p><label for="name">Name</label> <input id="name" name="name" required>
				<small data-gldn-error-for="name" hidden></small></p>
			<fieldset><legend>Kind</legend>
				<label><input id="kind-a" type="radio" name="kind" value="a"> A</label>
				<label><input id="kind-b" type="radio" name="kind" value="b"> B</label>
				<small data-gldn-error-for="kind" hidden></small></fieldset>
			<fieldset><legend>Tags</legend>
				<label><input id="tag-a" type="checkbox" name="tags" value="a" disabled> A</label>
				<label><input id="tag-b" type="checkbox" name="tags" value="b"> B</label>
				<small data-gldn-error-for="tags" hidden></small></fieldset>
			<p><button id="send" type="submit">Send</button></p>
		</form>`, `
		import { enhanceForm } from '${dist('gldn-form.js')}';
		const form = document.getElementById('form');
		window.api = enhanceForm(form);
		window.events = [];
		form.addEventListener('gldn-submit', (event) => window.events.push('submit:' + event.detail.data.get('name')));
		form.addEventListener('gldn-cancel', () => window.events.push('cancel'));
		form.addEventListener('gldn-invalid', () => window.events.push('invalid'));
		window.ready = true;`), 16);
	await ready();
	await browser.evaluate(`document.getElementById('send').click()`);
	const invalid = await browser.evaluate(`(() => {
		const name = document.getElementById('name');
		const message = document.querySelector('[data-gldn-error-for]');
		return { invalid: name.getAttribute('aria-invalid'), focus: document.activeElement.id,
			message: message.textContent, hidden: message.hidden,
			described: name.getAttribute('aria-describedby') === message.id };
	})()`);
	await browser.press('v');
	await browser.evaluate(`document.getElementById('send').click(); document.getElementById('send').click()`);
	const pending = await browser.evaluate(`({
		form: document.getElementById('form').getAttribute('aria-busy'),
		button: document.getElementById('send').getAttribute('aria-busy'),
		cleared: document.getElementById('name').hasAttribute('aria-invalid'),
		events: [...window.events]
	})`);
	await browser.press('Escape');
	await browser.evaluate(`document.getElementById('send').click(); window.api.fail({ name: 'That name is taken.' })`);
	const failed = await browser.evaluate(`({
		busy: document.getElementById('form').hasAttribute('aria-busy'),
		message: document.querySelector('[data-gldn-error-for]').textContent,
		events: window.events
	})`);

	// A server error for a same-name radio or checkbox group marks the group, shows its message
	// and focuses an eligible member: the checked one, or else the first that is enabled.
	const grouped = await browser.evaluate(`(() => {
		document.getElementById('kind-b').checked = true;
		document.getElementById('send').click();
		let thrown = null;
		try {
			window.api.fail({ tags: 'Choose fewer tags.', kind: 'That kind is closed.' });
		} catch (error) {
			thrown = String(error);
		}
		const message = (name) => document.querySelector('[data-gldn-error-for="' + name + '"]');
		const invalid = (id) => document.getElementById(id).getAttribute('aria-invalid');
		return { thrown, focus: document.activeElement.id,
			kind: message('kind').textContent, kindHidden: message('kind').hidden,
			tags: message('tags').textContent,
			marked: ['kind-a', 'kind-b', 'tag-a', 'tag-b'].map(invalid),
			described: document.getElementById('kind-a').getAttribute('aria-describedby') === message('kind').id };
	})()`);

	test('a server error for a radio or checkbox group marks the group and focuses a member', () => {
		if (grouped.thrown || grouped.focus !== 'tag-b' || grouped.kind !== 'That kind is closed.'
			|| grouped.kindHidden || grouped.tags !== 'Choose fewer tags.'
			|| grouped.marked.join() !== 'true,true,true,true' || !grouped.described) {
			throw new Error(JSON.stringify(grouped));
		}
	});

	test('a form shows each field message beside it, ignores a second submit while busy and can cancel', () => {
		if (invalid.invalid !== 'true' || invalid.focus !== 'name' || !invalid.message || invalid.hidden
			|| !invalid.described || pending.form !== 'true' || pending.button !== 'true' || pending.cleared
			|| pending.events.join() !== 'invalid,submit:v' || failed.busy
			|| failed.message !== 'That name is taken.'
			|| failed.events.join() !== 'invalid,submit:v,cancel,submit:v') {
			throw new Error(JSON.stringify({ invalid, pending, failed }));
		}
	});

	/* J-05 file selection by drop */
	await browser.navigate(page('files', `
		<form id="files-form"><label class="gldn-dropzone" id="zone">Choose or drop files
			<input id="input" type="file" name="files" multiple>
			<output data-gldn-file-count>0 files</output>
			<ul data-gldn-files></ul></label></form>`, `
		import { createFileDrop } from '${dist('gldn-files.js')}';
		window.api = createFileDrop(document.getElementById('zone'));
		window.ready = true;`), 16);
	await ready();
	const dropped = await browser.evaluate(`(() => {
		const zone = document.getElementById('zone');
		const transfer = new DataTransfer();
		transfer.items.add(new File(['a record'], 'record.txt', { type: 'text/plain' }));
		transfer.items.add(new File(['a trail'], 'notes.txt', { type: 'text/plain' }));
		zone.dispatchEvent(new DragEvent('dragenter', { dataTransfer: transfer, bubbles: true }));
		const over = new DragEvent('dragover', { dataTransfer: transfer, bubbles: true, cancelable: true });
		zone.dispatchEvent(over);
		const dragging = zone.dataset.gldnDragging;
		const drop = new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true });
		zone.dispatchEvent(drop);
		const afterDrop = { items: zone.querySelectorAll('[data-gldn-files] li').length,
			input: document.getElementById('input').files.length,
			count: zone.querySelector('[data-gldn-file-count]').textContent };
		zone.querySelector('[data-gldn-files] button').click();
		return { dragging, prevented: over.defaultPrevented && drop.defaultPrevented,
			stillDragging: 'gldnDragging' in zone.dataset, afterDrop,
			afterRemove: [...document.getElementById('input').files].map((file) => file.name),
			label: zone.querySelector('[data-gldn-files] button').getAttribute('aria-label') };
	})()`);

	// A cancelled form reset keeps the pending files; an ordinary reset empties the list with the
	// input, and a later selection does not bring the discarded files back.
	const reset = await browser.evaluate(`(async () => {
		const form = document.getElementById('files-form');
		const input = document.getElementById('input');
		const zone = document.getElementById('zone');
		const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
		const state = () => ({ items: zone.querySelectorAll('[data-gldn-files] li').length,
			input: [...input.files].map((file) => file.name), api: window.api.files.map((file) => file.name),
			count: zone.querySelector('[data-gldn-file-count]').textContent });
		form.addEventListener('reset', (event) => { if (window.cancelReset) event.preventDefault(); });
		window.cancelReset = true;
		form.reset();
		await settle();
		const cancelled = state();
		window.cancelReset = false;
		form.reset();
		await settle();
		const cleared = state();
		const transfer = new DataTransfer();
		transfer.items.add(new File(['new'], 'new.txt', { type: 'text/plain' }));
		input.files = transfer.files;
		input.dispatchEvent(new Event('change', { bubbles: true }));
		return { cancelled, cleared, chosen: state() };
	})()`);

	test('a form reset empties the pending list with its input, unless the reset is cancelled', () => {
		if (reset.cancelled.items !== 1 || reset.cancelled.input.join() !== 'notes.txt'
			|| reset.cleared.items !== 0 || reset.cleared.input.length !== 0 || reset.cleared.api.length !== 0
			|| reset.cleared.count !== '0 files' || reset.chosen.input.join() !== 'new.txt'
			|| reset.chosen.api.join() !== 'new.txt' || reset.chosen.items !== 1) {
			throw new Error(JSON.stringify(reset));
		}
	});

	test('dropped files join the pending list and the file input, and each can be removed', () => {
		if (dropped.dragging !== 'true' || !dropped.prevented || dropped.stillDragging
			|| dropped.afterDrop.items !== 2 || dropped.afterDrop.input !== 2 || dropped.afterDrop.count !== '2 files'
			|| dropped.afterRemove.join() !== 'notes.txt' || dropped.label !== 'Remove notes.txt') {
			throw new Error(JSON.stringify(dropped));
		}
	});

	/* J-06 theme preference */
	const themeBody = `<select id="theme" aria-label="Theme"><option value="system">System</option>
		<option value="light">Light</option><option value="dark">Dark</option></select>`;
	const themeUrl = page('theme', themeBody, `
		import { createThemeControl } from '${dist('gldn-theme.js')}';
		window.api = createThemeControl(document.getElementById('theme'));
		window.ready = true;`);
	await browser.navigate(themeUrl, 16);
	await ready();
	await browser.evaluate(`localStorage.clear(); window.api.set('system')`);
	await browser.evaluate(`(() => { const select = document.getElementById('theme'); select.value = 'dark';
		select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
	const chosen = await browser.evaluate(`({ dark: document.documentElement.classList.contains('gldn-theme-dark'),
		stored: localStorage.getItem('gldn-theme'), bg: getComputedStyle(document.body).backgroundColor })`);
	await browser.navigate(themeUrl, 16);
	await ready();
	const restored = await browser.evaluate(`({ dark: document.documentElement.classList.contains('gldn-theme-dark'),
		value: document.getElementById('theme').value })`);
	await browser.evaluate(`window.api.set('system')`);
	const system = await browser.evaluate(`({ classes: document.documentElement.className,
		stored: localStorage.getItem('gldn-theme') })`);
	const blocked = page('theme-blocked', themeBody, `
		Object.defineProperty(window, 'localStorage', { get() { throw new Error('denied'); } });
		const { createThemeControl } = await import('${dist('gldn-theme.js')}');
		window.api = createThemeControl(document.getElementById('theme'));
		window.api.set('light');
		window.ready = true;`);
	await browser.navigate(blocked, 16);
	await ready();
	const denied = await browser.evaluate(`document.documentElement.classList.contains('gldn-theme-light')`);

	test('a theme choice applies, persists, returns to the system, and works without storage', () => {
		if (!chosen.dark || chosen.stored !== 'dark' || chosen.bg !== 'rgb(15, 23, 42)' || !restored.dark
			|| restored.value !== 'dark' || system.classes !== '' || system.stored !== null || !denied) {
			throw new Error(JSON.stringify({ chosen, restored, system, denied }));
		}
	});

	/* J-07 keyboard shortcuts */
	await browser.navigate(page('keys', `<p><input id="field"> <textarea id="area"></textarea></p>
		<dl id="hints"></dl>`, `
		import { createShortcuts, renderHints } from '${dist('gldn-keys.js')}';
		const keys = createShortcuts(document);
		window.hits = [];
		keys.register('Mod+K', () => window.hits.push('search'), { description: 'Search' });
		keys.register('Ctrl+Enter', () => window.hits.push('submit'), { description: 'Submit', editable: true });
		try { keys.register('k', () => {}); } catch (error) { window.refused = error instanceof RangeError; }
		renderHints(document.getElementById('hints'), keys.list());
		window.ready = true;`), 16);
	await ready();
	await browser.evaluate(`document.body.focus()`);
	await browser.press('k', ['Ctrl']);
	await browser.evaluate(`document.getElementById('field').focus()`);
	await browser.press('k', ['Ctrl']);
	await browser.evaluate(`document.getElementById('area').focus()`);
	await browser.press('Enter', ['Ctrl']);
	const keys = await browser.evaluate(`({ hits: window.hits, refused: window.refused,
		kbd: [...document.querySelectorAll('#hints kbd')].map((key) => key.textContent).join(' '),
		value: document.getElementById('field').value })`);

	test('shortcuts need a modifier, leave fields alone unless allowed, and render as hints', () => {
		if (keys.hits.join() !== 'search,submit' || !keys.refused || keys.kbd !== 'Ctrl K Ctrl Enter') {
			throw new Error(JSON.stringify(keys));
		}
	});

	/* J-08 media navigation, paged and timed */
	await browser.navigate(page('media', `
		<section id="paged">
			<div data-gldn-page>First</div><div data-gldn-page hidden>Second</div><div data-gldn-page hidden>Third</div>
			<button id="prev" data-gldn-page-prev type="button">Previous</button>
			<output data-gldn-page-status></output>
			<button id="next" data-gldn-page-next type="button">Next</button>
			<button id="note" data-gldn-annotate type="button">Annotate</button>
		</section>
		<section id="timed"><audio id="audio"></audio>
			<button id="cue-0" data-gldn-time="0" type="button">Start</button>
			<button id="cue-4" data-gldn-time="4" type="button">Four seconds</button></section>`, `
		import { createMediaNav } from '${dist('gldn-media.js')}';
		// One second of silence per 8000 samples, ten seconds long, as a WAV blob.
		const rate = 8000, samples = rate * 10, bytes = new DataView(new ArrayBuffer(44 + samples));
		const text = (offset, value) => [...value].forEach((ch, i) => bytes.setUint8(offset + i, ch.charCodeAt(0)));
		text(0, 'RIFF'); bytes.setUint32(4, 36 + samples, true); text(8, 'WAVEfmt ');
		bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true); bytes.setUint16(22, 1, true);
		bytes.setUint32(24, rate, true); bytes.setUint32(28, rate, true); bytes.setUint16(32, 1, true);
		bytes.setUint16(34, 8, true); text(36, 'data'); bytes.setUint32(40, samples, true);
		for (let i = 0; i < samples; i++) bytes.setUint8(44 + i, 128);
		const audio = document.getElementById('audio');
		audio.src = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
		window.notes = [];
		document.addEventListener('gldn-annotate', (event) => window.notes.push(event.detail));
		createMediaNav(document.getElementById('paged'));
		window.timed = createMediaNav(document.getElementById('timed'));
		audio.addEventListener('loadedmetadata', () => { window.ready = true; });`), 16);
	await ready();
	await browser.evaluate(`document.getElementById('next').click(); document.getElementById('note').click()`);
	const paged = await browser.evaluate(`({
		shown: [...document.querySelectorAll('[data-gldn-page]')].filter((p) => !p.hidden).map((p) => p.textContent),
		status: document.querySelector('[data-gldn-page-status]').textContent,
		notes: window.notes
	})`);
	await browser.evaluate(`document.getElementById('next').click()`);
	const last = await browser.evaluate(`({ next: document.getElementById('next').disabled,
		prev: document.getElementById('prev').disabled })`);
	await browser.evaluate(`document.getElementById('cue-4').click()`);
	await delay(200);
	const timed = await browser.evaluate(`({ time: document.getElementById('audio').currentTime,
		current: [...document.querySelectorAll('[data-gldn-time]')].filter((cue) => cue.getAttribute('aria-current') === 'time').map((cue) => cue.id) })`);

	test('media navigation pages with a status, seeks cues, marks the current cue and reports annotations', () => {
		if (paged.shown.join() !== 'Second' || paged.status !== 'Page 2 of 3' || paged.notes[0]?.page !== 2
			|| !last.next || last.prev || Math.abs(timed.time - 4) > 0.01 || timed.current.join() !== 'cue-4') {
			throw new Error(JSON.stringify({ paged, last, timed }));
		}
	});
}
