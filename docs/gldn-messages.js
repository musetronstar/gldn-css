/*
 * A newest-first message log (role="log") and the error pop-in over its dock. Entries are text
 * only: the module never parses HTML from a message. Showing an entry or an error never moves
 * focus; Escape, the Dismiss button or a click elsewhere dismisses the pop-in and leaves the
 * entry in the log. The pop-in animates only under prefers-reduced-motion: no-preference. The
 * application owns storage, channels and how many entries to keep.
 */

const KINDS = {
	info: { label: 'Information', icon: 'i' },
	success: { label: 'Success', icon: '✓' },
	warning: { label: 'Warning', icon: '!' },
	error: { label: 'Error', icon: '!' }
};

function durationToken(element) {
	const text = getComputedStyle(element).getPropertyValue('--gldn-motion-duration').trim();
	const match = /^(\d+(?:\.\d+)?)(ms|s)$/.exec(text);
	if (!match) return 0;
	return Number(match[1]) * (match[2] === 's' ? 1000 : 1);
}

function renderEntry(entry) {
	const kind = entry.kind || 'info';
	if (!KINDS[kind]) throw new RangeError(`unknown message kind: ${kind}`);
	const document = entry.document;
	const article = document.createElement('article');
	article.className = 'gldn-message';
	article.dataset.gldnKind = kind;
	if (entry.id) article.dataset.gldnMessageId = String(entry.id);

	const meta = document.createElement('div');
	meta.className = 'gldn-message-meta';
	const icon = document.createElement('span');
	icon.className = 'gldn-message-icon';
	icon.setAttribute('aria-hidden', 'true');
	icon.textContent = KINDS[kind].icon;
	const label = document.createElement('strong');
	label.className = 'gldn-message-kind';
	label.textContent = KINDS[kind].label;
	const time = document.createElement('time');
	time.className = 'gldn-message-time';
	const date = new Date(entry.time);
	time.dateTime = Number.isNaN(date.getTime()) ? String(entry.time) : date.toISOString();
	time.textContent = Number.isNaN(date.getTime()) ? String(entry.time) : date.toLocaleTimeString();
	meta.append(icon, label, time);

	const header = document.createElement('h3');
	header.className = 'gldn-message-header';
	header.textContent = String(entry.header);
	article.append(meta, header);
	if (entry.body !== undefined && entry.body !== null && String(entry.body).length > 0) {
		const body = document.createElement('pre');
		body.className = 'gldn-message-body';
		body.textContent = String(entry.body);
		if (entry.details) {
			const details = document.createElement('details');
			details.className = 'gldn-message-detail';
			const summary = document.createElement('summary');
			summary.textContent = 'Details';
			details.append(summary, body);
			article.appendChild(details);
		} else {
			article.appendChild(body);
		}
	}
	return article;
}

/**
 * @typedef {object} MessageEntry
 * @property {'info' | 'success' | 'warning' | 'error'} [kind='info'] - The kind, which the entry
 *   names in words as well as by color.
 * @property {string | number | Date} time - When it happened; shown as a local time.
 * @property {string} header - A one-line summary.
 * @property {string} [body] - Preformatted detail.
 * @property {string | number} [id] - Recorded as `data-gldn-message-id`.
 */

/**
 * @typedef {object} Messages
 * @property {(entry: MessageEntry, options?: { popIn?: boolean }) => void} add - Prepends an
 *   entry, keeping the reader's scroll position. An error also shows in the pop-in unless
 *   `popIn` is false. Throws a `RangeError` for an unknown kind.
 * @property {(entries: MessageEntry[]) => void} replace - Restores a newest-first list.
 * @property {() => void} clear - Empties the log.
 * @property {(entries: MessageEntry[]) => void} append - Adds older entries at the end.
 * @property {(options?: { text?: string, kinds?: string[] | null }) => void} filter - Hides
 *   entries whose kind is not in `kinds` or whose text lacks `text`, without removing them. The
 *   error pop-in is not filtered.
 * @property {() => void} dismissError - Dismisses the error pop-in.
 * @property {() => void} destroy - Removes the module's listeners and pending timer; the log
 *   and its entries stay. Calling it again does nothing.
 */

/**
 * Connects a message log. Controls in its panel or timeline: `[data-gldn-messages-expand]`
 * lets the dock grow to `--gldn-dock-expanded-height`, `[data-gldn-messages-clear]` empties the
 * log, and `[data-gldn-messages-older]` asks for older entries.
 * @param {HTMLElement} log - The `[data-gldn-messages]` element.
 * @param {object} [options]
 * @param {boolean} [options.details=false] - Whether each body folds into a `<details>`.
 * @returns {Messages} The log's controls.
 * @fires gldn-older - On `log`, bubbling, when `[data-gldn-messages-older]` is clicked.
 * @example
 * const messages = createMessages(document.querySelector('[data-gldn-messages]'));
 * messages.add({ kind: 'success', time: Date.now(), header: 'Stored' });
 */
export function createMessages(log, { details = false } = {}) {
	const document = log.ownerDocument;
	const view = document.defaultView;
	const panel = log.closest('[data-gldn-panel]');
	const dock = log.closest('[data-gldn-dock]');
	const popin = dock?.querySelector('[data-gldn-popin]');
	const popinContent = popin?.querySelector('[data-gldn-popin-content]');
	const expandButton = panel?.querySelector('[data-gldn-messages-expand]');
	let activePopin = null;
	let finishTimer = 0;
	let shown = { text: '', kinds: null };
	const removers = [];

	function listen(target, type, handler, options) {
		if (!target) return;
		target.addEventListener(type, handler, options);
		removers.push(() => target.removeEventListener(type, handler, options));
	}

	function applyFilter(element) {
		const text = shown.text.trim().toLowerCase();
		element.hidden = Boolean((shown.kinds && !shown.kinds.includes(element.dataset.gldnKind))
			|| (text && !element.textContent.toLowerCase().includes(text)));
		return element;
	}

	function render(entry) {
		return applyFilter(renderEntry({ ...entry, details, document }));
	}

	function dismissError() {
		const record = activePopin;
		if (!record || record.dismissed) return;
		record.dismissed = true;
		popin.classList.remove('gldn-dock-popin-entering');
		popin.classList.add('gldn-dock-popin-leaving');
		const reduced = view.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const finish = () => {
			if (activePopin !== record) return;
			popin.hidden = true;
			popin.classList.remove('gldn-dock-popin-entering', 'gldn-dock-popin-leaving');
			activePopin = null;
		};
		const duration = reduced ? 0 : durationToken(popin);
		if (duration === 0) finish();
		else finishTimer = view.setTimeout(finish, duration);
	}

	function showError(entry) {
		if (!popin || !popinContent) throw new Error('an error pop-in requires dock pop-in markup');
		activePopin = { dismissed: false };
		// The pop-in shows the error whatever the log's filter hides.
		popinContent.replaceChildren(renderEntry({ ...entry, kind: 'error', details, document }));
		popin.classList.remove('gldn-dock-popin-entering', 'gldn-dock-popin-leaving');
		popin.hidden = false;
		void popin.offsetWidth;
		popin.classList.add('gldn-dock-popin-entering');
	}

	listen(popin?.querySelector('[data-gldn-popin-dismiss]'), 'click', dismissError);
	listen(popin, 'animationend', (event) => {
		if (event.animationName === 'gldn-dock-popin-enter') {
			popin.classList.remove('gldn-dock-popin-entering');
		}
	});
	listen(document, 'keydown', (event) => {
		if (event.key === 'Escape' && !event.defaultPrevented) dismissError();
	});
	listen(document, 'click', (event) => {
		if (activePopin && !popin.contains(event.target)) dismissError();
	}, { capture: true });

	listen(expandButton, 'click', () => {
		const expanded = expandButton.getAttribute('aria-expanded') !== 'true';
		expandButton.setAttribute('aria-expanded', String(expanded));
		expandButton.textContent = expanded ? 'Collapse' : 'Expand';
		dock.dataset.gldnMessagesExpanded = String(expanded);
	});
	const timeline = log.closest('.gldn-timeline') || panel;
	listen(timeline?.querySelector('[data-gldn-messages-older]'), 'click', () => {
		log.dispatchEvent(new CustomEvent('gldn-older', { bubbles: true }));
	});
	listen(panel?.querySelector('[data-gldn-messages-clear]'), 'click', () => {
		log.replaceChildren();
		log.scrollTop = 0;
	});

	return {
		add(entry, { popIn = true } = {}) {
			const previousHeight = log.scrollHeight;
			const previousTop = log.scrollTop;
			log.prepend(render(entry));
			if (previousTop > 0) log.scrollTop = previousTop + log.scrollHeight - previousHeight;
			if (entry.kind === 'error' && popIn) showError(entry);
		},
		replace(entries) {
			log.replaceChildren(...entries.map(render));
			log.scrollTop = 0;
		},
		clear() {
			log.replaceChildren();
			log.scrollTop = 0;
		},
		append(entries) {
			log.append(...entries.map(render));
		},
		filter({ text = '', kinds = null } = {}) {
			shown = { text, kinds };
			for (const element of log.querySelectorAll('.gldn-message')) applyFilter(element);
		},
		dismissError,
		destroy() {
			removers.splice(0).forEach((remove) => remove());
			view.clearTimeout(finishTimer);
		}
	};
}
