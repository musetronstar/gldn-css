/*
 * File selection by picker or by drop. Files dropped on the zone join the pending list, which
 * mirrors the file input, so an ordinary form submission sends exactly what the list shows.
 * Each entry can be removed. Dragging marks the zone with data-gldn-dragging; only a drop on
 * the zone is kept from opening the file in the browser. Nothing is uploaded.
 */

function size(bytes) {
	const units = ['B', 'KB', 'MB', 'GB'];
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit++;
	}
	return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`;
}

/**
 * @typedef {object} FileDrop
 * @property {File[]} files - A copy of the pending files, in order; read-only.
 * @property {(index: number) => void} remove - Removes the pending file at `index`.
 * @property {() => void} clear - Removes every pending file.
 * @property {() => void} destroy - Removes the module's listeners; the files stay pending.
 */

/**
 * Connects a drop zone, its file input and its pending list. Each entry shows the file's name,
 * its size and a Remove button, and `[data-gldn-file-count]` shows the count. An input without
 * `multiple` keeps only the latest file.
 * @param {HTMLElement} zone - The `gldn-dropzone`, usually a `<label>` around the input.
 * @param {object} [options]
 * @param {HTMLInputElement} [options.input] - The `<input type="file">`; by default the first in
 *   `zone`.
 * @param {HTMLElement} [options.list] - The pending list; by default `zone`'s
 *   `[data-gldn-files]`. Without one, the module keeps the input's files only.
 * @param {(files: File[]) => void} [options.onChange] - Receives the pending files after each
 *   change.
 * @returns {FileDrop} The pending files and their controls.
 * @throws {Error} When there is no file input.
 * @fires gldn-files - On `zone`, bubbling, after each change; `detail.files` holds the pending
 *   files.
 * @example
 * const drop = createFileDrop(document.querySelector('.gldn-dropzone'));
 * form.addEventListener('submit', () => console.log(drop.files.length));
 */
export function createFileDrop(zone, { input = zone.querySelector('input[type="file"]'),
	list = zone.querySelector('[data-gldn-files]'), onChange } = {}) {
	if (!input) throw new Error('a file drop zone requires an <input type="file">');
	const document = zone.ownerDocument;
	let files = [...input.files];
	let depth = 0;

	function sync() {
		const transfer = new DataTransfer();
		for (const file of files) transfer.items.add(file);
		input.files = transfer.files;
		render();
		zone.dispatchEvent(new CustomEvent('gldn-files', { bubbles: true, detail: { files: [...files] } }));
		onChange?.([...files]);
	}

	function render() {
		if (!list) return;
		list.replaceChildren(...files.map((file, index) => {
			const item = document.createElement('li');
			const name = document.createElement('span');
			name.textContent = file.name;
			const detail = document.createElement('small');
			detail.textContent = size(file.size);
			const remove = document.createElement('button');
			remove.type = 'button';
			remove.className = 'gldn-btn gldn-btn-quiet';
			remove.textContent = 'Remove';
			remove.setAttribute('aria-label', `Remove ${file.name}`);
			remove.addEventListener('click', () => api.remove(index));
			item.append(name, ' ', detail, ' ', remove);
			return item;
		}));
		const count = zone.querySelector('[data-gldn-file-count]');
		if (count) count.textContent = files.length === 1 ? '1 file' : `${files.length} files`;
	}

	function add(added) {
		const multiple = input.multiple;
		files = multiple ? files.concat([...added]) : [...added].slice(0, 1);
		sync();
	}

	function over(event) {
		if (![...event.dataTransfer.types].includes('Files')) return;
		event.preventDefault();
		zone.dataset.gldnDragging = 'true';
	}

	function enter(event) {
		if ([...event.dataTransfer.types].includes('Files')) depth++;
	}

	function leave() {
		depth = Math.max(0, depth - 1);
		if (depth === 0) delete zone.dataset.gldnDragging;
	}

	function drop(event) {
		if (!event.dataTransfer.files.length) return;
		event.preventDefault();
		depth = 0;
		delete zone.dataset.gldnDragging;
		add(event.dataTransfer.files);
	}

	// The picker replaces the input's files; earlier entries stay when the input takes several.
	function picked() {
		const added = [...input.files];
		if (!input.multiple) files = [];
		add(added);
	}

	zone.addEventListener('dragenter', enter);
	zone.addEventListener('dragover', over);
	zone.addEventListener('dragleave', leave);
	zone.addEventListener('drop', drop);
	input.addEventListener('change', picked);
	render();
	const api = {
		get files() {
			return [...files];
		},
		remove(index) {
			files = files.filter((_, i) => i !== index);
			sync();
		},
		clear() {
			files = [];
			sync();
		},
		destroy() {
			zone.removeEventListener('dragenter', enter);
			zone.removeEventListener('dragover', over);
			zone.removeEventListener('dragleave', leave);
			zone.removeEventListener('drop', drop);
			input.removeEventListener('change', picked);
		}
	};
	return api;
}
