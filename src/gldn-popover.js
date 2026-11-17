/*
 * Anchored popover: places a native [popover] beside the button that opens it, keeps it inside
 * the viewport, and returns focus to that button when it closes. The browser owns opening,
 * Escape and light dismiss (popover="auto" with popovertarget); this module only places it.
 */

const GAP = 6;

function place(popover, opener) {
	const view = popover.ownerDocument.defaultView;
	// Measure the popover at its own size, free of the browser's centering.
	popover.style.inset = 'auto';
	popover.style.margin = '0';
	popover.style.top = '0';
	popover.style.left = '0';
	const anchor = opener.getBoundingClientRect();
	const box = popover.getBoundingClientRect();
	const below = view.innerHeight - anchor.bottom;
	// Open below the opener, or above it when only the space above is enough.
	const top = below >= box.height + GAP || anchor.top < box.height + GAP
		? anchor.bottom + GAP : anchor.top - box.height - GAP;
	const left = Math.min(Math.max(GAP, anchor.left), Math.max(GAP, view.innerWidth - box.width - GAP));
	popover.style.top = `${Math.max(GAP, top)}px`;
	popover.style.left = `${left}px`;
	popover.dataset.gldnPlacement = top >= anchor.bottom ? 'below' : 'above';
}

/** Anchors a native popover to its opener. Returns { update, destroy }. */
export function anchorPopover(popover, opener) {
	if (!popover.hasAttribute('popover')) throw new Error('anchorPopover requires a [popover] element');
	const view = popover.ownerDocument.defaultView;
	const update = () => {
		if (popover.matches(':popover-open')) place(popover, opener);
	};

	function toggled(event) {
		if (event.newState === 'open') {
			update();
			return;
		}
		const active = popover.ownerDocument.activeElement;
		if (!active || active === popover.ownerDocument.body || popover.contains(active)) opener.focus();
	}

	popover.addEventListener('toggle', toggled);
	view.addEventListener('resize', update);
	view.addEventListener('scroll', update, true);
	return {
		update,
		destroy() {
			popover.removeEventListener('toggle', toggled);
			view.removeEventListener('resize', update);
			view.removeEventListener('scroll', update, true);
		}
	};
}
