/*
 * Load more: a button that asks the application for the next items of a list, after a page or
 * in place of pagination. One request runs at a time; further presses wait for it. While it
 * runs the button is busy and keeps the focus. A failed request keeps the items already shown
 * and turns the button into Retry; the last page turns it into an unavailable "All shown". An
 * optional status element says how many items are shown, out of the total when the
 * application knows it. The application fetches, appends and counts.
 */

const STRINGS = { retry: 'Retry', end: 'All shown', failed: 'Loading failed.' };

function count({ shown, total }, numbers) {
	if (shown === undefined) return '';
	return total === undefined || total === null
		? `${numbers.format(shown)} shown`
		: `${numbers.format(shown)} of ${numbers.format(total)} shown`;
}

/**
 * @typedef {object} LoadResult
 * @property {boolean} [done] - Whether no more items remain.
 * @property {number} [shown] - How many items the list now shows.
 * @property {number | null} [total] - How many there are in all, when known.
 */

/**
 * @typedef {object} LoadMore
 * @property {() => Promise<void>} load - Loads the next items, as a press does; does nothing
 *   while a request runs or after the last page.
 * @property {(result?: LoadResult) => void} reset - Makes the button available again, as for a
 *   new query, and shows a count. A request still running is ignored when it settles; the
 *   application cancels its fetch.
 * @property {boolean} pending - Whether a request runs; read-only.
 * @property {() => void} destroy - Removes the module's listener; a pending result is ignored.
 */

/**
 * Connects a Load more button.
 * @param {HTMLButtonElement} button - The button; its text is the label to restore.
 * @param {object} options
 * @param {() => Promise<LoadResult | void>} options.load - Fetches and appends the next items.
 *   A rejected promise means the request failed.
 * @param {HTMLElement} [options.status] - A `role="status"` element for the count and failures.
 * @param {{ retry?: string, end?: string, failed?: string }} [options.strings] - Labels in
 *   place of the English defaults.
 * @param {(result: LoadResult) => string} [options.format] - Writes the count, by default with
 *   the page's locale: "20 shown" or "20 of 134 shown".
 * @returns {LoadMore} The button's controls.
 * @example
 * createLoadMore(document.querySelector('#more'), {
 *   status: document.querySelector('#shown'),
 *   load: async () => {
 *     const page = await nextPage();
 *     list.append(...page.items);
 *     return { done: page.last, shown: list.children.length };
 *   }
 * });
 */
export function createLoadMore(button, { load, status, strings = {}, format } = {}) {
	const words = { ...STRINGS, ...strings };
	const label = button.textContent;
	const numbers = new Intl.NumberFormat(button.ownerDocument.documentElement.lang || undefined);
	const write = format || ((result) => count(result, numbers));
	let pending = null;
	let done = false;
	// Each request and each reset starts a new generation; a result from an older one is ignored.
	let generation = 0;

	function show(result = {}) {
		const text = write(result);
		if (status && text) status.textContent = text;
	}

	function finish(result = {}) {
		done = Boolean(result.done);
		button.textContent = done ? words.end : label;
		if (done) button.setAttribute('aria-disabled', 'true');
		else button.removeAttribute('aria-disabled');
		show(result);
	}

	function run() {
		if (pending || done) return pending ?? Promise.resolve();
		const own = ++generation;
		const current = () => own === generation;
		button.setAttribute('aria-busy', 'true');
		// The callback runs after pending is set, so a synchronous throw is a failed request too.
		const attempt = Promise.resolve()
			.then(() => load())
			.then((result) => {
				if (current()) finish(result || {});
			}, () => {
				if (!current()) return;
				button.textContent = words.retry;
				if (status) status.textContent = words.failed;
			})
			.finally(() => {
				if (!current()) return;
				button.removeAttribute('aria-busy');
				pending = null;
			});
		pending = attempt;
		return attempt;
	}

	function clicked(event) {
		if (pending || done) {
			event.preventDefault();
			return;
		}
		run();
	}

	button.addEventListener('click', clicked);
	return {
		load: run,
		reset(result = {}) {
			generation++;
			pending = null;
			button.removeAttribute('aria-busy');
			finish({ ...result, done: false });
		},
		get pending() {
			return Boolean(pending);
		},
		destroy() {
			generation++;
			button.removeEventListener('click', clicked);
		}
	};
}
