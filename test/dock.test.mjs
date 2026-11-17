import path from 'node:path';

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function testDock(browser, test, root) {
	const url = 'file://' + path.join(root, 'docs', 'components', 'dock.html');
	const click = (id) => browser.evaluate(`document.getElementById('${id}').click()`);
	const stateExpression = `(() => {
		const dock = document.querySelector('[data-gldn-dock]');
		const strip = document.querySelector('.gldn-dock-strip');
		const log = document.querySelector('[data-gldn-messages]');
		const popin = document.querySelector('[data-gldn-popin]');
		const mark = document.querySelector('[data-gldn-tab-mark]');
		return {
			active: window.demoDock.tabs.state.active,
			expanded: window.demoDock.tabs.state.expanded,
			dockHeight: dock.getBoundingClientRect().height,
			stripHeight: strip.getBoundingClientRect().height,
			reserve: parseFloat(getComputedStyle(document.documentElement)
				.getPropertyValue('--gldn-dock-reserve')),
			bodyPadding: parseFloat(getComputedStyle(document.body).paddingBottom),
			popinHidden: popin.hidden,
			popinRole: popin.getAttribute('role'),
			headers: [...log.querySelectorAll('.gldn-message-header')].map((node) => node.textContent),
			entries: log.querySelectorAll('.gldn-message').length,
			markHidden: mark.hidden,
			markCount: mark.querySelector('[data-gldn-tab-count]').textContent,
			markErrorHidden: mark.querySelector('[data-gldn-tab-error]').hidden,
			pageWidth: document.documentElement.scrollWidth
		};
	})()`;
	const state = () => browser.evaluate(stateExpression);

	await browser.viewport(1100);
	await browser.navigate(url, 16);
	const initial = await browser.evaluate(`(() => {
		const dock = document.querySelector('[data-gldn-dock]');
		const main = document.getElementById('dock-example').getBoundingClientRect();
		const state = ${stateExpression};
		return {
			...state,
			position: getComputedStyle(dock).position,
			mainBottom: main.bottom,
			dockTop: dock.getBoundingClientRect().top,
			logRole: document.querySelector('[data-gldn-messages]').getAttribute('role'),
			inputHidden: document.getElementById('demo-input-panel').hidden,
			messagesHidden: document.getElementById('demo-messages-panel').hidden
		};
	})()`);

	test('the wide dock reserves its height and exposes tabs and a log', () => {
		if (initial.position !== 'fixed' || initial.logRole !== 'log'
			|| initial.active !== 'input' || !initial.expanded
			|| initial.inputHidden || !initial.messagesHidden) {
			throw new Error(JSON.stringify(initial));
		}
		if (Math.abs(initial.bodyPadding - initial.dockHeight) > 1
			|| Math.abs(initial.reserve - initial.dockHeight) > 1
			|| initial.mainBottom > initial.dockTop) {
			throw new Error(`dock reservation mismatch: ${JSON.stringify(initial)}`);
		}
	});

	await browser.evaluate(`document.getElementById('demo-add-info').focus()`);
	await click('demo-add-info');
	await click('demo-add-error');
	const errorArrival = await browser.evaluate(`(() => {
		const popin = document.querySelector('[data-gldn-popin]').getBoundingClientRect();
		const input = document.getElementById('demo-input-panel').getBoundingClientRect();
		return {
			state: ${stateExpression},
			focus: document.activeElement.id,
			coversInput: popin.top < input.bottom && popin.bottom > input.top
		};
	})()`);

	test('new entries are newest first and an error pops over the active tab without focus theft', () => {
		const current = errorArrival.state;
		if (current.headers[0] !== 'Request failed with status 503'
			|| current.headers[1] !== 'Information entry'
			|| current.markCount !== '2' || current.markHidden || current.markErrorHidden) {
			throw new Error(JSON.stringify(current));
		}
		if (current.popinHidden || current.popinRole !== 'alert'
			|| !errorArrival.coversInput || errorArrival.focus !== 'demo-add-info') {
			throw new Error(JSON.stringify(errorArrival));
		}
	});

	await browser.evaluate(`document.querySelector('[data-gldn-popin-dismiss]').click()`);
	await delay(200);
	const closeRestored = await state();
	await click('demo-add-error');
	await browser.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',
		{ key: 'Escape', bubbles: true, cancelable: true }))`);
	await delay(200);
	const escapeRestored = await state();
	await click('demo-add-error');
	await browser.evaluate(`document.querySelector('#dock-example h1').click()`);
	await delay(200);
	const outsideRestored = await state();

	test('close, Escape, and outside click dismiss the pop-in but retain its log entry', () => {
		for (const current of [closeRestored, escapeRestored, outsideRestored]) {
			if (!current.popinHidden || current.active !== 'input'
				|| current.headers[0] !== 'Request failed with status 503') {
				throw new Error(JSON.stringify(current));
			}
		}
	});

	await click('demo-messages-tab');
	const openedMessages = await state();
	const fixedBefore = await browser.evaluate(`(() => ({
		dock: document.querySelector('[data-gldn-dock]').getBoundingClientRect().height,
		log: document.querySelector('[data-gldn-messages]').getBoundingClientRect().height
	}))()`);
	await click('demo-add-long');
	await click('demo-add-info');
	const fixedAfter = await browser.evaluate(`(() => ({
		dock: document.querySelector('[data-gldn-dock]').getBoundingClientRect().height,
		log: document.querySelector('[data-gldn-messages]').getBoundingClientRect().height
	}))()`);

	test('opening Messages clears its mark and arrivals keep fixed panel heights', () => {
		if (openedMessages.active !== 'messages' || !openedMessages.markHidden
			|| openedMessages.markCount !== '0' || openedMessages.markErrorHidden !== true) {
			throw new Error(JSON.stringify(openedMessages));
		}
		if (JSON.stringify(fixedBefore) !== JSON.stringify(fixedAfter)) {
			throw new Error(`panel height moved: ${JSON.stringify({ fixedBefore, fixedAfter })}`);
		}
	});

	await browser.evaluate(`(() => {
		const log = document.querySelector('[data-gldn-messages]');
		log.scrollTop = 100;
	})()`);
	const scrollBefore = await browser.evaluate(`(() => {
		const log = document.querySelector('[data-gldn-messages]');
		return { top: log.scrollTop, height: log.scrollHeight };
	})()`);
	await click('demo-add-long');
	const scrollAfter = await browser.evaluate(`(() => {
		const log = document.querySelector('[data-gldn-messages]');
		return { top: log.scrollTop, height: log.scrollHeight };
	})()`);

	test('prepending preserves the position of a reader scrolled into history', () => {
		const expected = scrollBefore.top + scrollAfter.height - scrollBefore.height;
		if (scrollBefore.top <= 0 || Math.abs(scrollAfter.top - expected) > 1) {
			throw new Error(JSON.stringify({ scrollBefore, scrollAfter, expected }));
		}
	});

	await browser.evaluate(`document.querySelector('[data-gldn-messages-expand]').click()`);
	await browser.settle();
	const expanded = await browser.evaluate(`(() => ({
		state: ${stateExpression},
		aria: document.querySelector('[data-gldn-messages-expand]').getAttribute('aria-expanded')
	}))()`);
	await browser.evaluate(`document.querySelector('[data-gldn-messages-expand]').click()`);
	await browser.settle();
	const collapsedPane = await browser.evaluate(`(() => ({
		state: ${stateExpression},
		aria: document.querySelector('[data-gldn-messages-expand]').getAttribute('aria-expanded')
	}))()`);

	test('the message pane expands within half the viewport and collapses to its fixed height', () => {
		if (expanded.aria !== 'true' || expanded.state.dockHeight <= collapsedPane.state.dockHeight
			|| expanded.state.dockHeight > 451
			|| Math.abs(expanded.state.bodyPadding - expanded.state.dockHeight) > 1) {
			throw new Error(JSON.stringify(expanded));
		}
		if (collapsedPane.aria !== 'false'
			|| Math.abs(collapsedPane.state.dockHeight - fixedBefore.dock) > 1) {
			throw new Error(JSON.stringify(collapsedPane));
		}
	});

	await click('demo-replace');
	const replaced = await state();
	await browser.evaluate(`document.querySelector('[data-gldn-messages-clear]').click()`);
	const cleared = await state();

	test('the pane replaces and clears entries without owning storage', () => {
		if (replaced.entries !== 2 || replaced.headers.join(',')
			!== 'Restored newest entry,Restored older entry') {
			throw new Error(JSON.stringify(replaced));
		}
		if (cleared.entries !== 0) throw new Error('clear left entries behind');
	});

	await browser.evaluate(`document.getElementById('demo-messages-tab').focus()`);
	const key = async (value) => {
		await browser.evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown',
			{ key: '${value}', bubbles: true, cancelable: true }))`);
		return browser.evaluate(`({
			active: window.demoDock.tabs.state.active,
			focus: document.activeElement.id
		})`);
	};
	const arrowRight = await key('ArrowRight');
	const end = await key('End');
	const home = await key('Home');
	const arrowLeft = await key('ArrowLeft');

	test('arrow keys, Home, and End select and focus tabs in a loop', () => {
		const expected = [
			[arrowRight, 'input', 'demo-input-tab'],
			[end, 'messages', 'demo-messages-tab'],
			[home, 'input', 'demo-input-tab'],
			[arrowLeft, 'messages', 'demo-messages-tab']
		];
		for (const [actual, active, focus] of expected) {
			if (actual.active !== active || actual.focus !== focus) {
				throw new Error(JSON.stringify({ actual, active, focus }));
			}
		}
	});

	await browser.evaluate(`document.querySelector('[data-gldn-tabs-collapse]').click()`);
	await browser.settle();
	const collapsedDock = await state();
	await click('demo-input-tab');
	await browser.settle();
	const selectedExpanded = await state();

	test('the collapse control leaves only the strip and selecting a tab expands it', () => {
		if (collapsedDock.expanded || Math.abs(collapsedDock.dockHeight - collapsedDock.stripHeight) > 1
			|| Math.abs(collapsedDock.bodyPadding - collapsedDock.stripHeight) > 1) {
			throw new Error(JSON.stringify(collapsedDock));
		}
		if (!selectedExpanded.expanded || selectedExpanded.active !== 'input'
			|| selectedExpanded.dockHeight <= selectedExpanded.stripHeight) {
			throw new Error(JSON.stringify(selectedExpanded));
		}
	});

	await browser.evaluate(`window.demoDock.messages.add({
		kind: 'error', time: new Date().toISOString(),
		header: '<img src=x onerror="window.injected = true">',
		body: '<b>literal body</b>'
	})`);
	const literal = await browser.evaluate(`(() => ({
		header: document.querySelector('.gldn-message-header').textContent,
		images: document.querySelectorAll('[data-gldn-dock] img').length,
		injected: Boolean(window.injected)
	}))()`);

	test('entry headers and bodies are rendered as literal text', () => {
		if (literal.header !== '<img src=x onerror="window.injected = true">'
			|| literal.images !== 0 || literal.injected) {
			throw new Error(JSON.stringify(literal));
		}
	});
	await browser.evaluate(`document.querySelector('[data-gldn-popin-dismiss]').click()`);
	await delay(200);

	const contrastProbe = `(() => {
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
		const entry = document.querySelector('[data-gldn-messages] .gldn-message');
		return {
			label: contrast(getComputedStyle(entry.querySelector('.gldn-message-kind')).color,
				getComputedStyle(entry).backgroundColor),
			icon: contrast(getComputedStyle(entry.querySelector('.gldn-message-icon')).color,
				getComputedStyle(entry.querySelector('.gldn-message-icon')).backgroundColor),
			header: contrast(getComputedStyle(entry.querySelector('.gldn-message-header')).color,
				getComputedStyle(entry).backgroundColor)
		};
	})()`;
	await click('demo-messages-tab');
	const contrasts = [];
	for (const theme of ['light', 'dark']) {
		await browser.evaluate(`document.documentElement.classList.toggle('gldn-theme-dark',
			${theme === 'dark'})`);
		for (const kind of ['info', 'success', 'warning', 'error']) {
			await browser.evaluate(`window.demoDock.messages.add({
				kind: '${kind}', time: new Date().toISOString(), header: '${kind}'
			}, { popIn: false })`);
			contrasts.push({ theme, kind, values: await browser.evaluate(contrastProbe) });
		}
	}

	test('message color pairs meet WCAG AA in both themes', () => {
		for (const { theme, kind, values } of contrasts) {
			for (const [pair, ratio] of Object.entries(values)) {
				if (ratio < 4.5) {
					throw new Error(`${theme} ${kind} ${pair} contrast is ${ratio.toFixed(2)}:1`);
				}
			}
		}
	});

	await browser.reducedMotion(true);
	await browser.navigate(url, 16);
	const reduced = await browser.evaluate(`(() => {
		document.getElementById('demo-add-error').click();
		const popin = document.querySelector('[data-gldn-popin]');
		const animations = popin.getAnimations().length;
		popin.querySelector('[data-gldn-popin-dismiss]').click();
		return { animations, hidden: popin.hidden };
	})()`);
	await browser.reducedMotion(false);
	await browser.navigate(url, 16);
	const motion = await browser.evaluate(`(() => {
		document.getElementById('demo-add-error').click();
		const popin = document.querySelector('[data-gldn-popin]');
		const animations = popin.getAnimations().length;
		popin.querySelector('[data-gldn-popin-dismiss]').click();
		return {
			animations,
			leaving: popin.classList.contains('gldn-dock-popin-leaving'),
			hidden: popin.hidden
		};
	})()`);
	await delay(200);

	test('pop-in motion runs only when reduced motion is not requested', () => {
		if (reduced.animations !== 0 || !reduced.hidden) {
			throw new Error(JSON.stringify(reduced));
		}
		if (motion.animations === 0 || !motion.leaving || motion.hidden) {
			throw new Error(JSON.stringify(motion));
		}
	});

	await browser.viewport(375);
	await browser.navigate(url, 16);
	const narrowInitial = await state();
	const targets = await browser.evaluate(`[...document.querySelectorAll(
		'.gldn-tab, .gldn-dock-control')].filter((node) => node.offsetParent !== null)
		.map((node) => ({ text: node.textContent.trim(), width: node.getBoundingClientRect().width,
			height: node.getBoundingClientRect().height }))`);
	await click('demo-messages-tab');
	await browser.settle();
	const narrowSheet = await state();
	await click('demo-messages-tab');
	const reselected = await state();
	await click('demo-messages-tab');
	await browser.evaluate(`document.querySelector('#dock-example h2').click()`);
	const contentClosed = await state();
	await click('demo-add-error');
	await delay(200);
	const narrowError = await browser.evaluate(`(() => {
		const popin = document.querySelector('[data-gldn-popin]').getBoundingClientRect();
		const strip = document.querySelector('.gldn-dock-strip').getBoundingClientRect();
		return {
			state: ${stateExpression},
			height: popin.height,
			popinBottom: popin.bottom,
			stripTop: strip.top,
			dockTop: document.querySelector('[data-gldn-dock]').getBoundingClientRect().top,
			aboveStrip: popin.bottom <= strip.top + 1
		};
	})()`);

	test('narrow screens reserve only the strip and use closable sheets with 44px targets', () => {
		if (narrowInitial.expanded || Math.abs(narrowInitial.dockHeight - narrowInitial.stripHeight) > 1
			|| Math.abs(narrowInitial.bodyPadding - narrowInitial.stripHeight) > 1) {
			throw new Error(JSON.stringify(narrowInitial));
		}
		for (const target of targets) {
			if (target.width < 44 || target.height < 44) {
				throw new Error(`small target: ${JSON.stringify(target)}`);
			}
		}
		if (!narrowSheet.expanded || narrowSheet.dockHeight > 451
			|| Math.abs(narrowSheet.bodyPadding - narrowInitial.bodyPadding) > 1
			|| narrowSheet.pageWidth > 375 || reselected.expanded || contentClosed.expanded) {
			throw new Error(JSON.stringify({ narrowSheet, reselected, contentClosed }));
		}
		if (narrowError.state.popinHidden || narrowError.height <= 0
			|| narrowError.height > 450 || !narrowError.aboveStrip
			|| narrowError.state.pageWidth > 375) {
			throw new Error(JSON.stringify(narrowError));
		}
	});
}
