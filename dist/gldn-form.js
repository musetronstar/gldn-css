/*
 * Deliberate form submission. The browser's constraints decide validity; this module shows
 * each field's message beside it, focuses the first invalid field, and marks the form busy
 * while the application works. A second submit while busy is ignored. The application
 * receives a gldn-submit event, does its own request, and calls done() or fail(errors);
 * cancel() (or Escape while busy) dispatches gldn-cancel. The module never sends anything.
 */

function messageFor(control) {
	return control.id ? control.form.querySelector(`[data-gldn-error-for="${CSS.escape(control.id)}"]`) : null;
}

function describe(control, message) {
	const ids = new Set((control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
	ids.add(message.id || (message.id = `${control.id}-error`));
	control.setAttribute('aria-describedby', [...ids].join(' '));
}

/**
 * @typedef {object} FormControl
 * @property {(button?: HTMLElement) => void} submit - Submits the form as `button` would.
 * @property {() => void} done - Ends the busy state after a successful request.
 * @property {(errors?: Object<string, string>) => void} fail - Ends the busy state and shows each
 *   message beside the control with that name; focus moves to the first of them.
 * @property {() => void} cancel - Ends the busy state and dispatches `gldn-cancel`; does nothing
 *   when the form is not busy.
 * @property {boolean} busy - Whether the application is working on a submission; read-only.
 * @property {() => void} destroy - Removes the module's listeners.
 */

/**
 * Enhances a form. Each control's message goes in the element whose `data-gldn-error-for` names
 * the control's `id`, linked by `aria-describedby`; after a first attempt, messages update as
 * the reader types. The form and its submit button carry `aria-busy="true"` while busy.
 * @param {HTMLFormElement} form - The form; the module sets `noValidate` on it.
 * @returns {FormControl} The form's state and controls.
 * @fires gldn-submit - On `form` when every control is valid; `detail.data` is the `FormData`
 *   and `detail.submitter` the button that submitted it.
 * @fires gldn-invalid - On `form` when a control is invalid; `detail.controls` lists them.
 * @fires gldn-cancel - On `form` when a busy submission is cancelled, also by Escape.
 * @example
 * const control = enhanceForm(form);
 * form.addEventListener('gldn-submit', async ({ detail }) => {
 *   const stored = await store(detail.data);
 *   if (stored) control.done();
 *   else control.fail({ name: 'That name is taken.' });
 * });
 */
export function enhanceForm(form) {
	let busy = false;
	let submitter = null;
	let attempted = false;
	form.noValidate = true;

	function show(control, text) {
		const message = messageFor(control);
		if (text) control.setAttribute('aria-invalid', 'true');
		else control.removeAttribute('aria-invalid');
		if (!message) return;
		describe(control, message);
		message.textContent = text;
		message.hidden = !text;
	}

	function check() {
		const invalid = [];
		for (const control of form.elements) {
			if (!control.willValidate) continue;
			const valid = control.checkValidity();
			show(control, valid ? '' : control.validationMessage);
			if (!valid) invalid.push(control);
		}
		return invalid;
	}

	function setBusy(value) {
		busy = value;
		for (const element of [form, submitter]) {
			if (!element) continue;
			if (value) element.setAttribute('aria-busy', 'true');
			else element.removeAttribute('aria-busy');
		}
	}

	function finish() {
		setBusy(false);
		submitter = null;
	}

	function submitted(event) {
		event.preventDefault();
		if (busy) return;
		attempted = true;
		const invalid = check();
		if (invalid.length) {
			invalid[0].focus();
			form.dispatchEvent(new CustomEvent('gldn-invalid', { detail: { controls: invalid } }));
			return;
		}
		submitter = event.submitter || null;
		setBusy(true);
		form.dispatchEvent(new CustomEvent('gldn-submit', {
			detail: { data: new FormData(form, submitter || undefined), submitter }
		}));
	}

	// After a first attempt, each field updates its message as the reader corrects it.
	function input(event) {
		if (!attempted || !event.target.willValidate) return;
		show(event.target, event.target.checkValidity() ? '' : event.target.validationMessage);
	}

	function keydown(event) {
		if (event.key === 'Escape' && busy) api.cancel();
	}

	form.addEventListener('submit', submitted);
	form.addEventListener('input', input);
	form.addEventListener('keydown', keydown);
	const api = {
		submit(button) {
			form.requestSubmit(button);
		},
		done() {
			finish();
		},
		fail(errors = {}) {
			finish();
			const controls = Object.entries(errors).map(([name, text]) => {
				const control = form.elements.namedItem(name);
				if (control) show(control, text);
				return control;
			}).filter(Boolean);
			controls[0]?.focus();
		},
		cancel() {
			if (!busy) return;
			finish();
			form.dispatchEvent(new CustomEvent('gldn-cancel'));
		},
		get busy() {
			return busy;
		},
		destroy() {
			form.removeEventListener('submit', submitted);
			form.removeEventListener('input', input);
			form.removeEventListener('keydown', keydown);
		}
	};
	return api;
}
