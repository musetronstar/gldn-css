/*
 * Roving focus for one composite widget: a listbox, a menu, or a tree. One item is in the Tab
 * order; arrows, Home, End and typeahead move among the visible items. In a tree, Right opens
 * a closed item (dispatching gldn-expand, so the application can load its children) or enters
 * it, and Left closes an open item or moves to its parent; a click on an item's
 * gldn-tree-toggle opens or closes it. Enter or Space dispatch gldn-activate and follow the
 * item's link. Links inside items leave the Tab order; other controls in the current item's
 * own row follow it, so Tab reaches them and Enter or Space press them. Items added later,
 * such as loaded children, join the widget.
 */

const ITEMS = '[role="option"], [role="menuitem"], [role="treeitem"]';
const CONTROLS = 'a[href], button, input, select, textarea, [tabindex]';
// An item's own row: its children other than a nested group.
const ROW = ':scope > :not([role="group"])';
const TYPEAHEAD_RESET = 500;

function isEditable(element) {
	return element.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
}

/**
 * @typedef {object} Roving
 * @property {() => HTMLElement[]} items - The visible items, in document order.
 * @property {(item: HTMLElement) => void} focus - Makes `item` the widget's Tab stop and focuses
 *   it.
 * @property {() => void} destroy - Removes the module's listeners and observer.
 */

/**
 * Adds roving focus to a listbox, menu or tree. The Tab stop starts on the first visible item
 * that is selected or current, or else on the first visible item.
 * @param {HTMLElement} root - The element with `role="listbox"`, `"menu"` or `"tree"`.
 * @param {object} [options]
 * @param {boolean} [options.selectFollowsFocus=false] - Whether moving focus also sets
 *   `aria-selected` on the focused item and clears it on the others.
 * @returns {Roving} The widget's controls.
 * @fires gldn-expand - On a tree item, bubbling, when it opens; `detail.item` is the item.
 * @fires gldn-collapse - On a tree item, bubbling, when it closes; `detail.item` is the item.
 * @fires gldn-activate - On an item, bubbling, for Enter or Space; `detail.item` is the item.
 * @example
 * const tree = document.querySelector('.gldn-tree');
 * createRoving(tree);
 * tree.addEventListener('gldn-expand', ({ detail }) => loadChildren(detail.item));
 */
export function createRoving(root, { selectFollowsFocus = false } = {}) {
	let typed = '';
	let typedAt = 0;
	let current = null;

	// An item is visible when no ancestor item between it and the root is closed.
	function items() {
		return [...root.querySelectorAll(ITEMS)].filter((item) => {
			for (let parent = item.parentElement?.closest(ITEMS); parent && root.contains(parent);
				parent = parent.parentElement?.closest(ITEMS)) {
				if (parent.getAttribute('aria-expanded') === 'false') return false;
			}
			return !item.closest('[hidden]');
		});
	}

	// The item that owns a control: its nearest item ancestor.
	function owner(control) {
		return control.parentElement?.closest(ITEMS);
	}

	// One Tab stop: the current item, then the controls in its own row other than links.
	function settle() {
		if (!current || !root.contains(current)) current = initial();
		for (const item of root.querySelectorAll(ITEMS)) item.tabIndex = item === current ? 0 : -1;
		for (const control of root.querySelectorAll(CONTROLS)) {
			if (control.matches(ITEMS)) continue;
			const follows = owner(control) === current && !control.matches('a[href]');
			control.tabIndex = follows ? 0 : -1;
		}
	}

	function initial() {
		const visible = items();
		return visible.find((item) => item.getAttribute('aria-selected') === 'true'
			|| item.hasAttribute('aria-current')
			|| item.querySelector(`:scope > [aria-current]:not([aria-current="false"]),
				${ROW} [aria-current]:not([aria-current="false"])`))
			|| visible[0] || null;
	}

	function focus(item) {
		current = item;
		settle();
		item.focus();
		if (selectFollowsFocus) {
			for (const other of root.querySelectorAll(ITEMS)) {
				other.setAttribute('aria-selected', String(other === item));
			}
		}
	}

	function dispatch(name, item) {
		item.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: { item } }));
	}

	function setExpanded(item, expanded) {
		item.setAttribute('aria-expanded', String(expanded));
		if (expanded) dispatch('gldn-expand', item);
		else dispatch('gldn-collapse', item);
	}

	function keydown(event) {
		const item = event.target.closest(ITEMS);
		if (!item || !root.contains(item) || isEditable(event.target)) return;
		if (event.altKey || event.ctrlKey || event.metaKey) return;
		// A control in the row presses natively.
		if (event.target !== item && (event.key === 'Enter' || event.key === ' ')) return;
		const list = items();
		const index = list.indexOf(item);
		const expandable = item.hasAttribute('aria-expanded');
		const expanded = item.getAttribute('aria-expanded') === 'true';
		let next = null;
		switch (event.key) {
		case 'ArrowDown': next = list[index + 1]; break;
		case 'ArrowUp': next = list[index - 1]; break;
		case 'Home': next = list[0]; break;
		case 'End': next = list.at(-1); break;
		case 'ArrowRight':
			if (item.getAttribute('role') !== 'treeitem' || !expandable) return;
			if (!expanded) setExpanded(item, true);
			else next = items()[index + 1];
			break;
		case 'ArrowLeft': {
			if (item.getAttribute('role') !== 'treeitem') return;
			if (expandable && expanded) setExpanded(item, false);
			else next = item.parentElement?.closest(ITEMS);
			break;
		}
		case 'Enter':
		case ' ':
			dispatch('gldn-activate', item);
			item.querySelector(`:scope > a[href], ${ROW} a[href]`)?.click();
			break;
		default:
			if (event.key.length !== 1 || event.key === ' ') return;
			typed = Date.now() - typedAt > TYPEAHEAD_RESET ? event.key : typed + event.key;
			typedAt = Date.now();
			next = list.slice(index + 1).concat(list.slice(0, index + 1))
				.find((candidate) => candidate.textContent.trim().toLowerCase().startsWith(typed.toLowerCase()));
		}
		event.preventDefault();
		if (next && root.contains(next)) focus(next);
	}

	function clicked(event) {
		const item = event.target.closest(ITEMS);
		if (!item || !root.contains(item)) return;
		const toggle = event.target.closest('.gldn-tree-toggle');
		if (toggle && owner(toggle) === item && item.hasAttribute('aria-expanded')) {
			event.preventDefault();
			setExpanded(item, item.getAttribute('aria-expanded') !== 'true');
		}
		// A control keeps the focus it took; a click elsewhere on the row focuses the item.
		const control = event.target.closest(CONTROLS);
		if (control && control !== item && item.contains(control)) {
			current = item;
			settle();
		} else {
			focus(item);
		}
	}

	// Focus the application moves to an item makes it current too.
	function focused(event) {
		if (event.target !== current && event.target.matches(ITEMS) && root.contains(event.target)) {
			current = event.target;
			settle();
		}
	}

	const observer = new MutationObserver(settle);
	settle();
	observer.observe(root, { childList: true, subtree: true });
	root.addEventListener('keydown', keydown);
	root.addEventListener('click', clicked);
	root.addEventListener('focusin', focused);
	return {
		items,
		focus,
		destroy() {
			observer.disconnect();
			root.removeEventListener('keydown', keydown);
			root.removeEventListener('click', clicked);
			root.removeEventListener('focusin', focused);
		}
	};
}
