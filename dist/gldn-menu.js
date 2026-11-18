/*
 * A menu button, after the WAI-ARIA menu button pattern, built on a native popover. The button
 * names the menu with popovertarget, so without this module the menu still opens, closes and
 * acts. The module adds aria-expanded, focus on the first item when the menu opens (the last
 * for ArrowUp), the arrow keys, Home, End and typeahead through gldn-roving.js, placement
 * beside the button through gldn-popover.js, and closing when an item is chosen or focus
 * leaves by Tab or Shift+Tab. An unavailable button, marked aria-disabled, does not open it. Escape and a click outside close the menu natively, and focus returns to the button.
 * Items are buttons for commands, or links that keep their native and modified clicks.
 */

import { anchorPopover } from './gldn-popover.js';
import { createRoving } from './gldn-roving.js';

const ITEM = '[role="menuitem"]';

/**
 * @typedef {object} MenuButton
 * @property {(focus?: 'first' | 'last') => void} open - Opens the menu and focuses its first
 *   or last item.
 * @property {() => void} close - Closes the menu; focus returns to the button when it was in
 *   the menu.
 * @property {() => void} destroy - Removes the module's listeners, its roving focus and its
 *   placement.
 */

/**
 * Connects a menu button to its menu.
 * @param {HTMLButtonElement} button - The button, with `popovertarget` naming the menu.
 * @param {object} [options]
 * @param {HTMLElement} [options.menu] - The `role="menu"` element with the `popover`
 *   attribute; by default the element `popovertarget` names.
 * @returns {MenuButton} The menu's controls.
 * @throws {Error} When there is no menu, or it has no `popover` attribute.
 * @fires gldn-select - On the chosen item, bubbling, before the menu closes; `detail.item` is
 *   the item. Cancelling the event keeps the menu open.
 * @example
 * // <button popovertarget="row-actions" aria-haspopup="menu">Actions</button>
 * // <div id="row-actions" popover role="menu" aria-label="Actions">
 * //   <button role="menuitem" type="button">Rename</button> …</div>
 * createMenuButton(document.querySelector('[popovertarget="row-actions"]'));
 */
export function createMenuButton(button, { menu = button.popoverTargetElement } = {}) {
	if (!menu?.hasAttribute('popover')) throw new Error('a menu button requires a [popover] menu');
	const roving = createRoving(menu);
	const anchor = anchorPopover(menu, button);
	let first = 'first';

	button.setAttribute('aria-haspopup', 'menu');
	button.setAttribute('aria-expanded', 'false');
	if (!button.hasAttribute('aria-controls') && menu.id) button.setAttribute('aria-controls', menu.id);

	const isOpen = () => menu.matches(':popover-open');

	function focusItem() {
		const items = roving.items();
		const item = first === 'last' ? items.at(-1) : items[0];
		first = 'first';
		if (item) roving.focus(item);
	}

	function toggled(event) {
		const open = event.newState === 'open';
		button.setAttribute('aria-expanded', String(open));
		if (open) focusItem();
	}

	function buttonKeydown(event) {
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		if (button.getAttribute('aria-disabled') === 'true') return;
		event.preventDefault();
		api.open(event.key === 'ArrowUp' ? 'last' : 'first');
	}

	// A chosen item acts first, then the menu closes; a cancelled gldn-select keeps it open.
	function chosen(event) {
		const item = event.target.closest(ITEM);
		if (!item || !menu.contains(item) || item.getAttribute('aria-disabled') === 'true') return;
		const select = new CustomEvent('gldn-select', { bubbles: true, cancelable: true, detail: { item } });
		if (item.dispatchEvent(select)) api.close();
	}

	/* Tab and Shift+Tab, or a click elsewhere that keeps focus, move focus out: the menu closes
	 * behind it. A pointer press on the button is left to the button, which closes the menu
	 * itself; closing here too would let that press open it again. */
	let pressing = false;
	const pressed = () => {
		pressing = true;
	};
	const released = () => {
		pressing = false;
	};

	function focusout(event) {
		const to = event.relatedTarget;
		const byPointer = pressing;
		pressing = false;
		if (!isOpen() || !to || menu.contains(to) || (to === button && byPointer)) return;
		menu.hidePopover();
	}

	menu.addEventListener('toggle', toggled);
	menu.addEventListener('click', chosen);
	menu.addEventListener('focusout', focusout);
	button.addEventListener('keydown', buttonKeydown);
	button.addEventListener('pointerdown', pressed);
	button.addEventListener('click', released);
	const api = {
		open(focus = 'first') {
			first = focus;
			if (isOpen()) focusItem();
			else menu.showPopover();
		},
		close() {
			if (isOpen()) menu.hidePopover();
		},
		destroy() {
			menu.removeEventListener('toggle', toggled);
			menu.removeEventListener('click', chosen);
			menu.removeEventListener('focusout', focusout);
			button.removeEventListener('keydown', buttonKeydown);
			button.removeEventListener('pointerdown', pressed);
			button.removeEventListener('click', released);
			roving.destroy();
			anchor.destroy();
		}
	};
	return api;
}
