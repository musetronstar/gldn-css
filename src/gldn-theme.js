/*
 * Theme preference: system, light or dark. Pages follow the system scheme without this module;
 * it adds an explicit choice, applied as gldn-theme-light or gldn-theme-dark on the root and
 * remembered in local storage when storage is available. The control is a <select> or a group
 * of radio buttons whose values are "system", "light" and "dark".
 */

const CHOICES = ['system', 'light', 'dark'];

function read(storage, key) {
	try {
		const value = storage?.getItem(key);
		return CHOICES.includes(value) ? value : 'system';
	} catch {
		return 'system';
	}
}

function write(storage, key, value) {
	try {
		if (value === 'system') storage?.removeItem(key);
		else storage?.setItem(key, value);
	} catch {
		// Without storage the choice lasts for this page.
	}
}

/**
 * Applies a theme choice: `gldn-theme-light` or `gldn-theme-dark` on `root`, or neither, so the
 * page follows the system scheme.
 * @param {Element} root - The element whose subtree takes the scheme, usually `<html>`.
 * @param {'system' | 'light' | 'dark'} value - The choice.
 */
export function applyTheme(root, value) {
	root.classList.toggle('gldn-theme-light', value === 'light');
	root.classList.toggle('gldn-theme-dark', value === 'dark');
}

/**
 * @typedef {object} ThemeControl
 * @property {'system' | 'light' | 'dark'} value - The current choice; read-only.
 * @property {(value: 'system' | 'light' | 'dark') => void} set - Applies, remembers and shows a
 *   choice. Throws a `RangeError` for any other value.
 * @property {() => void} destroy - Removes the module's listener; the scheme stays applied.
 */

/**
 * Connects a theme control and applies the remembered choice, or `system`.
 * @param {HTMLSelectElement | HTMLElement} control - A `<select>`, or an element holding radio
 *   buttons, whose values are `system`, `light` and `dark`.
 * @param {object} [options]
 * @param {Element} [options.root=document.documentElement] - The element that takes the theme
 *   class.
 * @param {string} [options.storageKey='gldn-theme'] - The local storage key for the choice.
 * @returns {ThemeControl} The control's state and controls.
 * @example
 * // <select id="theme"><option value="system">System</option>…</select>
 * createThemeControl(document.querySelector('#theme'));
 */
export function createThemeControl(control, { root = control.ownerDocument.documentElement,
	storageKey = 'gldn-theme' } = {}) {
	const view = control.ownerDocument.defaultView;
	let storage = null;
	try {
		storage = view.localStorage;
	} catch {
		storage = null;
	}
	let value = read(storage, storageKey);

	function show() {
		if (control.localName === 'select') control.value = value;
		for (const radio of control.querySelectorAll('input[type="radio"]')) radio.checked = radio.value === value;
	}

	function set(next) {
		if (!CHOICES.includes(next)) throw new RangeError(`unknown theme: ${next}`);
		value = next;
		applyTheme(root, value);
		write(storage, storageKey, value);
		show();
	}

	function changed(event) {
		if (CHOICES.includes(event.target.value)) set(event.target.value);
	}

	control.addEventListener('change', changed);
	set(value);
	return {
		get value() {
			return value;
		},
		set,
		destroy() {
			control.removeEventListener('change', changed);
		}
	};
}
