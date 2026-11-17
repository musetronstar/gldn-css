function panelName(tab) {
	return tab.dataset.gldnTab || tab.getAttribute('aria-controls');
}

/** Generic WAI-ARIA tabs with unread marks and a collapsible panel area. */
export function createTabs(root, options = {}) {
	const tabs = [...root.querySelectorAll('[role="tab"]')];
	const panels = [...root.querySelectorAll('[role="tabpanel"]')];
	const document = root.ownerDocument;
	const view = document.defaultView;
	const dock = root.closest('[data-gldn-dock]');
	const collapseButton = root.querySelector('[data-gldn-tabs-collapse]');
	const narrow = view.matchMedia('(max-width: 48rem)');
	const marks = new Map();
	if (tabs.length === 0) throw new Error('tabs require at least one tab');

	for (const tab of tabs) {
		const name = panelName(tab);
		const panel = panels.find((candidate) => candidate.id === tab.getAttribute('aria-controls'));
		if (!name || !panel) throw new Error(`missing panel for tab ${name || tab.id}`);
		panel.setAttribute('aria-labelledby', tab.id);
		marks.set(name, { count: 0, error: false });
	}

	const requested = options.active;
	const initial = tabs.find((tab) => panelName(tab) === requested)
		|| tabs.find((tab) => tab.getAttribute('aria-selected') === 'true') || tabs[0];
	const state = {
		active: panelName(initial),
		expanded: options.expanded === undefined ? true : Boolean(options.expanded)
	};

	function renderMark(name) {
		const tab = tabs.find((candidate) => panelName(candidate) === name);
		const mark = tab?.querySelector('[data-gldn-tab-mark]');
		if (!mark) return;
		const value = marks.get(name);
		mark.querySelector('[data-gldn-tab-count]').textContent = String(value.count);
		mark.querySelector('[data-gldn-tab-error]').hidden = !value.error;
		mark.hidden = value.count === 0 && !value.error;
	}

	function changed() {
		root.dataset.gldnExpanded = String(state.expanded);
		root.dataset.gldnActive = state.active;
		if (dock) {
			dock.dataset.gldnExpanded = String(state.expanded);
			dock.dataset.gldnActive = state.active;
		}
		options.onStateChange?.({ ...state });
	}

	function clearMark(name) {
		marks.set(name, { count: 0, error: false });
		renderMark(name);
	}

	function select(name, { focus = false } = {}) {
		const tab = tabs.find((candidate) => panelName(candidate) === name);
		if (!tab) throw new RangeError(`unknown tab: ${name}`);
		state.active = name;
		state.expanded = true;
		clearMark(name);
		render();
		if (focus) tab.focus();
	}

	function collapse() {
		state.expanded = false;
		render();
	}

	function render() {
		for (const tab of tabs) {
			const selected = panelName(tab) === state.active;
			tab.setAttribute('aria-selected', String(selected));
			tab.tabIndex = selected ? 0 : -1;
			const panel = document.getElementById(tab.getAttribute('aria-controls'));
			panel.hidden = !state.expanded || !selected;
		}
		if (collapseButton) {
			collapseButton.setAttribute('aria-expanded', String(state.expanded));
			collapseButton.setAttribute('aria-label', state.expanded ? 'Collapse panels' : 'Expand panels');
			collapseButton.textContent = state.expanded ? '⌄' : '⌃';
		}
		changed();
	}

	for (const tab of tabs) {
		const name = panelName(tab);
		tab.addEventListener('click', () => {
			if (narrow.matches && state.expanded && state.active === name) collapse();
			else select(name);
		});
		tab.addEventListener('keydown', (event) => {
			const index = tabs.indexOf(event.currentTarget);
			let next;
			if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
			else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
			else if (event.key === 'Home') next = 0;
			else if (event.key === 'End') next = tabs.length - 1;
			else return;
			event.preventDefault();
			select(panelName(tabs[next]), { focus: true });
		});
	}
	collapseButton?.addEventListener('click', () => {
		if (state.expanded) collapse();
		else select(state.active);
	});

	render();
	return {
		state,
		select,
		collapse,
		expand: () => select(state.active),
		mark(name, { count = 1, error = false } = {}) {
			if (state.active === name && state.expanded) return;
			const previous = marks.get(name) || { count: 0, error: false };
			marks.set(name, { count: previous.count + count, error: previous.error || error });
			renderMark(name);
		},
		clearMark
	};
}
