import { createTabs } from './gldn-tabs.js';
import { createMessages } from './gldn-messages.js';

/** A fixed bottom dock with page reservation and narrow visual-viewport sheets. */
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
