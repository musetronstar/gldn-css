/*
 * A fixed bottom dock: a strip of tabs over panels, one of which holds a message log. The
 * module measures the dock, or only its strip on narrow screens, and writes the height to
 * --gldn-dock-reserve on the root, which a gldn-has-dock body uses as bottom padding, so the
 * dock never covers the page. Narrow screens start collapsed: tabs open panels as sheets over
 * the content, a click outside the dock closes them, and the visual viewport keeps the dock
 * above an on-screen keyboard. docs/components/dock.html shows the markup.
 */

import { createTabs } from './gldn-tabs.js';
import { createMessages } from './gldn-messages.js';

/**
 * @typedef {object} Dock
 * @property {import('./gldn-tabs.js').Tabs} tabs - The dock's tabs.
 * @property {import('./gldn-messages.js').Messages} messages - The dock's message log.
 * @property {() => void} updateViewport - Places the dock above the visual viewport's bottom
 *   edge and measures it again.
 * @property {() => void} destroy - Removes the module's listeners and observer.
 */

/**
 * Connects a dock.
 * @param {HTMLElement} root - The `[data-gldn-dock]` element, holding a `.gldn-dock-strip`, a
 *   `[data-gldn-tabs]` element and a `[data-gldn-messages]` log.
 * @param {object} [options]
 * @param {string} [options.active] - The tab to select first.
 * @param {boolean} [options.expanded] - Whether the panels show at first; narrow screens start
 *   collapsed.
 * @param {(state: import('./gldn-tabs.js').TabsState) => void} [options.onStateChange] -
 *   Receives the tabs' state after each change, for the application to remember.
 * @returns {Dock} The dock's tabs, messages and controls.
 * @throws {Error} When the strip, the tabs or the log is missing.
 * @example
 * const dock = createDock(document.querySelector('[data-gldn-dock]'), {
 *   active: 'input',
 *   onStateChange: ({ active, expanded }) => saveView(active, expanded)
 * });
 * dock.messages.add({ kind: 'error', time: new Date().toISOString(), header: 'Request failed' });
 * dock.tabs.mark('messages', { error: true });
 */
export function createDock(root, options = {}) {
	const document = root.ownerDocument;
	const view = document.defaultView;
	const strip = root.querySelector('.gldn-dock-strip');
	const tabsRoot = root.querySelector('[data-gldn-tabs]');
	const log = root.querySelector('[data-gldn-messages]');
	const narrow = view.matchMedia('(max-width: 48rem)');
	if (!strip || !tabsRoot || !log) throw new Error('dock requires tabs, a strip, and a message log');

	function reserve() {
		const height = narrow.matches ? strip.getBoundingClientRect().height
			: root.getBoundingClientRect().height;
		document.documentElement.style.setProperty('--gldn-dock-reserve', `${height}px`);
	}

	const tabs = createTabs(tabsRoot, {
		active: options.active,
		expanded: narrow.matches ? false : options.expanded,
		onStateChange(state) {
			options.onStateChange?.(state);
			reserve();
		}
	});
	const messages = createMessages(log);
	root.dataset.gldnExpanded = String(tabs.state.expanded);

	function updateViewport() {
		const viewport = view.visualViewport;
		const bottom = viewport
			? Math.max(0, view.innerHeight - viewport.height - viewport.offsetTop) : 0;
		root.style.bottom = `${bottom}px`;
		reserve();
	}

	function mediaChanged() {
		if (narrow.matches) tabs.collapse();
		updateViewport();
	}
	function outsideClick(event) {
		if (narrow.matches && tabs.state.expanded && !root.contains(event.target)) tabs.collapse();
	}

	const observer = new ResizeObserver(reserve);
	observer.observe(root);
	observer.observe(strip);
	narrow.addEventListener('change', mediaChanged);
	view.visualViewport?.addEventListener('resize', updateViewport);
	view.visualViewport?.addEventListener('scroll', updateViewport);
	document.addEventListener('click', outsideClick, { capture: true });
	updateViewport();

	return {
		tabs,
		messages,
		updateViewport,
		destroy() {
			observer.disconnect();
			narrow.removeEventListener('change', mediaChanged);
			view.visualViewport?.removeEventListener('resize', updateViewport);
			view.visualViewport?.removeEventListener('scroll', updateViewport);
			document.removeEventListener('click', outsideClick, { capture: true });
		}
	};
}
