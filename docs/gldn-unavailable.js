/*
 * Unavailable actions: a control marked aria-disabled="true" stays focusable so its reason
 * can be read, and this module keeps it from acting. Within its root it stops the control's
 * clicks, modified and middle clicks included, its Enter and Space presses, the arrow keys
 * that open a popup button's menu, and a form submitted through it, before other handlers see
 * them. Each stopped attempt announces the
 * control's reason, the text its aria-describedby names, in an optional status element. The
 * guard presents availability; the application still checks it before acting.
 */

const UNAVAILABLE = '[aria-disabled="true"]';

/**
 * @typedef {object} UnavailableGuard
 * @property {() => void} destroy - Removes the guard's listeners.
 */

/**
 * Guards the unavailable controls inside `root`, including controls added later.
 * @param {Document | HTMLElement} [root=document] - Where controls are guarded.
 * @param {object} [options]
 * @param {HTMLElement} [options.status] - A `role="status"` element that receives the reason
 *   of each stopped attempt, as text.
 * @returns {UnavailableGuard} The guard's controls.
 * @fires gldn-unavailable - On the control, bubbling, for each stopped attempt; `detail.reason`
 *   is its reason, or an empty string.
 * @example
 * // <button aria-disabled="true" aria-describedby="why">Delete</button> <small id="why">…</small>
 * guardUnavailable(document, { status: document.querySelector('#status') });
 */
export function guardUnavailable(root = document, { status } = {}) {
	const owner = root.ownerDocument || root;

	function reasonOf(control) {
		const ids = (control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
		return ids.map((id) => owner.getElementById(id)?.textContent.trim() || '').filter(Boolean).join(' ');
	}

	function stop(event, control) {
		event.preventDefault();
		event.stopImmediatePropagation();
		const reason = reasonOf(control);
		if (status) status.textContent = reason;
		control.dispatchEvent(new CustomEvent('gldn-unavailable', { bubbles: true, detail: { reason } }));
	}

	function clicked(event) {
		const control = event.target.closest?.(UNAVAILABLE);
		if (control && root.contains(control)) stop(event, control);
	}

	// Enter and Space press buttons and follow links, and the arrows open a popup button's menu;
	// editable fields keep their keys.
	function keydown(event) {
		const control = event.target.closest?.(UNAVAILABLE);
		if (!control || !root.contains(control) || control !== event.target) return;
		const arrow = (event.key === 'ArrowDown' || event.key === 'ArrowUp') && control.hasAttribute('aria-haspopup');
		if (event.key === 'Enter' || event.key === ' ' || arrow) stop(event, control);
	}

	// Enter in a field submits through the form's default button, its submitter.
	function submitted(event) {
		const control = event.submitter?.closest(UNAVAILABLE);
		if (control && root.contains(control)) stop(event, control);
	}

	root.addEventListener('click', clicked, true);
	root.addEventListener('auxclick', clicked, true);
	root.addEventListener('keydown', keydown, true);
	root.addEventListener('submit', submitted, true);
	return {
		destroy() {
			root.removeEventListener('click', clicked, true);
			root.removeEventListener('auxclick', clicked, true);
			root.removeEventListener('keydown', keydown, true);
			root.removeEventListener('submit', submitted, true);
		}
	};
}
