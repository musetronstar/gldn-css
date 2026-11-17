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

/** Applies a theme choice to root: "system", "light" or "dark". */
export function applyTheme(root, value) {
	root.classList.toggle('gldn-theme-light', value === 'light');
	root.classList.toggle('gldn-theme-dark', value === 'dark');
}

/** Connects a theme control. Returns { value, set, destroy }. */
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
