/*
 * A disclosure, after the WAI-ARIA disclosure pattern: a button whose aria-expanded shows or
 * hides the region its aria-controls names. A hidden region takes no space and its controls
 * leave the Tab order, while the button, and anything beside it, such as a panel's header and
 * actions, stays usable. Use <details> where a summary can hold the whole header.
 */

/**
 * @typedef {object} Disclosure
 * @property {boolean} expanded - Whether the region shows; read-only.
 * @property {(expanded: boolean) => void} set - Shows or hides the region without reporting
 *   it, as when restoring a saved view.
 * @property {() => void} destroy - Removes the module's listener; the region stays as it is.
 */

/**
 * Connects a disclosure button to its region, which takes the button's starting state.
 * @param {HTMLButtonElement} button - The button, with `aria-controls` naming the region and
 *   `aria-expanded` its starting state.
 * @param {object} [options]
 * @param {(expanded: boolean) => void} [options.onToggle] - Receives the new state after the
 *   reader toggles the region.
 * @returns {Disclosure} The disclosure's state and controls.
 * @throws {Error} When `aria-controls` names no element.
 * @example
 * // <button class="gldn-disclosure" aria-expanded="true" aria-controls="body">Details</button>
 * createDisclosure(document.querySelector('.gldn-panel .gldn-disclosure'), {
 *   onToggle: (expanded) => saveView({ details: expanded })
 * });
 */
export function createDisclosure(button, { onToggle } = {}) {
	const region = button.ownerDocument.getElementById(button.getAttribute('aria-controls'));
	if (!region) throw new Error('a disclosure requires the region its aria-controls names');
	let expanded = button.getAttribute('aria-expanded') === 'true';

	function set(next) {
		expanded = Boolean(next);
		button.setAttribute('aria-expanded', String(expanded));
		region.hidden = !expanded;
	}

	function clicked() {
		set(!expanded);
		onToggle?.(expanded);
	}

	set(expanded);
	button.addEventListener('click', clicked);
	return {
		get expanded() {
			return expanded;
		},
		set,
		destroy() {
			button.removeEventListener('click', clicked);
		}
	};
}
