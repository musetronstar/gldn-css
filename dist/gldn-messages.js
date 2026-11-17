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
		article.appendChild(body);
	}
	return article;
}

/** A newest-first message log with optional error pop-in over its dock. */
export function createMessages(log) {
	const document = log.ownerDocument;
	const view = document.defaultView;
	const panel = log.closest('[data-gldn-panel]');
	const dock = log.closest('[data-gldn-dock]');
	const popin = dock?.querySelector('[data-gldn-popin]');
	const popinContent = popin?.querySelector('[data-gldn-popin-content]');
	const expandButton = panel?.querySelector('[data-gldn-messages-expand]');
	let activePopin = null;

	function render(entry) {
		return renderEntry({ ...entry, document });
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
		else view.setTimeout(finish, duration);
	}

	function showError(entry) {
		if (!popin || !popinContent) throw new Error('an error pop-in requires dock pop-in markup');
		activePopin = { dismissed: false };
		popinContent.replaceChildren(render({ ...entry, kind: 'error' }));
		popin.classList.remove('gldn-dock-popin-entering', 'gldn-dock-popin-leaving');
		popin.hidden = false;
		void popin.offsetWidth;
		popin.classList.add('gldn-dock-popin-entering');
	}

	popin?.querySelector('[data-gldn-popin-dismiss]').addEventListener('click', dismissError);
	popin?.addEventListener('animationend', (event) => {
		if (event.animationName === 'gldn-dock-popin-enter') {
			popin.classList.remove('gldn-dock-popin-entering');
		}
	});
	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && !event.defaultPrevented) dismissError();
	});
	document.addEventListener('click', (event) => {
		if (activePopin && !popin.contains(event.target)) dismissError();
	}, { capture: true });

	expandButton?.addEventListener('click', () => {
		const expanded = expandButton.getAttribute('aria-expanded') !== 'true';
		expandButton.setAttribute('aria-expanded', String(expanded));
		expandButton.textContent = expanded ? 'Collapse' : 'Expand';
		dock.dataset.gldnMessagesExpanded = String(expanded);
	});
	panel?.querySelector('[data-gldn-messages-clear]')?.addEventListener('click', () => {
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
		dismissError
	};
}
