import { createDock } from '../gldn-dock.js';

const byId = (id) => document.getElementById(id);
const dock = createDock(document.querySelector('[data-gldn-dock]'));
window.demoDock = dock;

byId('gldn-theme-toggle').addEventListener('click', (event) => {
	const dark = document.documentElement.classList.toggle('gldn-theme-dark');
	event.currentTarget.textContent = dark ? 'light theme' : 'dark theme';
	event.currentTarget.setAttribute('aria-pressed', String(dark));
});

function add(entry) {
	dock.messages.add(entry);
	if (dock.tabs.state.active !== 'messages') {
		dock.tabs.mark('messages', { error: entry.kind === 'error' });
	}
}

byId('demo-add-info').addEventListener('click', () => {
	add({
		kind: 'info',
		time: new Date().toISOString(),
		header: 'Information entry',
		body: 'The operation completed with additional information.'
	});
});

byId('demo-add-error').addEventListener('click', () => {
	add({
		kind: 'error',
		time: new Date().toISOString(),
		header: 'Request failed with status 503',
		body: 'The service is unavailable.\nTry again later.'
	});
});

byId('demo-add-long').addEventListener('click', () => {
	add({
		kind: 'warning',
		time: new Date().toISOString(),
		header: 'A longer entry',
		body: Array.from({ length: 12 }, (_, index) => `Detail line ${index + 1}`).join('\n')
	});
});

byId('demo-replace').addEventListener('click', () => {
	dock.messages.replace([
		{ kind: 'success', time: new Date().toISOString(), header: 'Restored newest entry' },
		{ kind: 'info', time: new Date().toISOString(), header: 'Restored older entry' }
	]);
});
