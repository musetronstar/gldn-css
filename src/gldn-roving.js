/*
 * Roving focus for one composite widget: a listbox, a menu, or a tree. One item is in the Tab
 * order; arrows, Home, End and typeahead move among the visible items. In a tree, Right opens
 * a closed item (dispatching gldn-expand, so the application can load its children) or enters
 * it, and Left closes an open item or moves to its parent. Enter or Space dispatch
 * gldn-activate. Ordinary links and buttons outside the widget keep the normal Tab order.
 */

const ITEMS = '[role="option"], [role="menuitem"], [role="treeitem"]';
const TYPEAHEAD_RESET = 500;

function isEditable(element) {
	return element.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
}

/** Adds roving focus to root. Returns { items, focus, destroy }. */
export function createRoving(root, { selectFollowsFocus = false } = {}) {
	let typed = '';
	let typedAt = 0;

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

	function focus(item) {
		for (const other of root.querySelectorAll(ITEMS)) other.tabIndex = other === item ? 0 : -1;
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
		const current = event.target.closest(ITEMS);
		if (!current || !root.contains(current) || isEditable(event.target)) return;
		if (event.altKey || event.ctrlKey || event.metaKey) return;
		const list = items();
		const index = list.indexOf(current);
		const expandable = current.hasAttribute('aria-expanded');
		const expanded = current.getAttribute('aria-expanded') === 'true';
		let next = null;
		switch (event.key) {
		case 'ArrowDown': next = list[index + 1]; break;
		case 'ArrowUp': next = list[index - 1]; break;
		case 'Home': next = list[0]; break;
		case 'End': next = list.at(-1); break;
		case 'ArrowRight':
			if (current.getAttribute('role') !== 'treeitem' || !expandable) return;
			if (!expanded) setExpanded(current, true);
			else next = items()[index + 1];
			break;
		case 'ArrowLeft': {
			if (current.getAttribute('role') !== 'treeitem') return;
			if (expandable && expanded) setExpanded(current, false);
			else next = current.parentElement?.closest(ITEMS);
			break;
		}
		case 'Enter':
		case ' ':
			dispatch('gldn-activate', current);
			current.querySelector('a[href]')?.click();
			break;
		default:
			if (event.key.length !== 1 || event.key === ' ') return;
			typed = Date.now() - typedAt > TYPEAHEAD_RESET ? event.key : typed + event.key;
			typedAt = Date.now();
			next = list.slice(index + 1).concat(list.slice(0, index + 1))
				.find((item) => item.textContent.trim().toLowerCase().startsWith(typed.toLowerCase()));
		}
		event.preventDefault();
		if (next && root.contains(next)) focus(next);
	}

	function clicked(event) {
		const item = event.target.closest(ITEMS);
		if (item && root.contains(item)) focus(item);
	}

	const initial = items().find((item) => item.getAttribute('aria-selected') === 'true'
		|| item.hasAttribute('aria-current')) || items()[0];
	for (const item of root.querySelectorAll(ITEMS)) item.tabIndex = item === initial ? 0 : -1;
	root.addEventListener('keydown', keydown);
	root.addEventListener('click', clicked);
	return {
		items,
		focus,
		destroy() {
			root.removeEventListener('keydown', keydown);
			root.removeEventListener('click', clicked);
		}
	};
}
