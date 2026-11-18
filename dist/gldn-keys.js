/*
 * Keyboard shortcuts the application registers, each beside a reachable button or link. A
 * shortcut needs Ctrl, Alt or Meta (Mod is Meta on Apple systems and Ctrl elsewhere), or is a
 * function key; single printable keys are refused. Keys typed into a field, a list of options
 * or editable content belong to it, unless a shortcut is registered with { editable: true }
 * and uses Ctrl, Alt or Meta. list() returns the shortcuts for a hint panel.
 */

const MODIFIERS = ['ctrl', 'alt', 'shift', 'meta'];

function parse(combo, apple) {
	const parts = combo.split('+').map((part) => part.trim().toLowerCase()).filter(Boolean);
	const key = parts.pop();
	const mods = new Set(parts.map((part) => (part === 'mod' ? (apple ? 'meta' : 'ctrl') : part)));
	for (const mod of mods) {
		if (!MODIFIERS.includes(mod)) throw new RangeError(`unknown modifier in ${combo}`);
	}
	const command = mods.has('ctrl') || mods.has('alt') || mods.has('meta');
	if (!command && !/^f\d{1,2}$/.test(key ?? '')) {
		throw new RangeError(`shortcut ${combo} needs Ctrl, Alt or Meta`);
	}
	return { key, mods };
}

function matches({ key, mods }, event) {
	return event.key.toLowerCase() === key && MODIFIERS.every((mod) => mods.has(mod) === event[`${mod}Key`]);
}

function editable(element) {
	return element?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
}

/**
 * @typedef {object} Shortcut
 * @property {string} combo - The keys joined by `+`, such as `Ctrl+K`, with `Mod` resolved.
 * @property {string} description - What the shortcut does.
 */

/**
 * @typedef {object} Shortcuts
 * @property {(combo: string, handler: (event: KeyboardEvent) => void,
 *   options?: { description?: string, editable?: boolean }) => void} register - Registers a
 *   shortcut such as `Mod+K` or `F2`. With `editable: true`, it also acts in fields. Throws a
 *   `RangeError` for an unknown modifier or a key without Ctrl, Alt or Meta that is not a
 *   function key.
 * @property {(combo: string) => void} unregister - Removes a shortcut by the combo it was
 *   registered with.
 * @property {() => Shortcut[]} list - The registered shortcuts, for a hint panel.
 * @property {() => void} destroy - Removes the module's listener.
 */

/**
 * Listens for registered shortcuts. The first matching shortcut runs and its key press is
 * prevented; repeats and already prevented presses are ignored.
 * @param {Document | HTMLElement} [target=document] - Where key presses are heard.
 * @returns {Shortcuts} The registry.
 * @example
 * const keys = createShortcuts();
 * keys.register('Mod+K', () => search.focus(), { description: 'Search' });
 * renderHints(document.querySelector('.gldn-hints'), keys.list());
 */
export function createShortcuts(target = document) {
	const owner = target.ownerDocument || target;
	const apple = /Mac|iPhone|iPad/.test(owner.defaultView.navigator.platform);
	const shortcuts = new Map();

	function keydown(event) {
		if (event.defaultPrevented || event.repeat) return;
		for (const shortcut of shortcuts.values()) {
			if (!matches(shortcut.parsed, event)) continue;
			if (editable(event.target) && !shortcut.editable) return;
			event.preventDefault();
			shortcut.handler(event);
			return;
		}
	}

	target.addEventListener('keydown', keydown);
	return {
		register(combo, handler, { description = '', editable: inEditable = false } = {}) {
			const parsed = parse(combo, apple);
			shortcuts.set(combo, { combo, parsed, handler, description, editable: inEditable });
		},
		unregister(combo) {
			shortcuts.delete(combo);
		},
		list() {
			return [...shortcuts.values()].map(({ combo, description }) => ({
				combo: combo.replace(/\bMod\b/i, apple ? 'Meta' : 'Ctrl'),
				description
			}));
		},
		destroy() {
			target.removeEventListener('keydown', keydown);
		}
	};
}

/**
 * Writes shortcuts into a `<dl>`, such as a `gldn-hints` list: each combo as `<kbd>` keys, and
 * its description, as text.
 * @param {HTMLDListElement} list - The list; its children are replaced.
 * @param {Shortcut[]} shortcuts - The shortcuts, usually from `list()`.
 */
export function renderHints(list, shortcuts) {
	const owner = list.ownerDocument;
	list.replaceChildren(...shortcuts.flatMap(({ combo, description }) => {
		const term = owner.createElement('dt');
		combo.split('+').forEach((key, index) => {
			if (index) term.append('+');
			const kbd = owner.createElement('kbd');
			kbd.textContent = key;
			term.append(kbd);
		});
		const detail = owner.createElement('dd');
		detail.textContent = description;
		return [term, detail];
	}));
}
