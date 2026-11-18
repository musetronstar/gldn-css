/*
 * Deliberate form submission. The browser's constraints decide validity; this module shows
 * each field's message beside it, focuses the first invalid field, and marks the form busy
 * while the application works. A second submit while busy is ignored. The application
 * receives a gldn-submit event, does its own request, and calls done() or fail(errors);
 * cancel() (or Escape while busy) dispatches gldn-cancel. The module never sends anything.
 */

const messageNamed = (form, name) => form.querySelector(`[data-gldn-error-for="${CSS.escape(name)}"]`);

// A control's message names its id; a radio or checkbox group's message may name the group.
function messageFor(control) {
	const own = control.id ? messageNamed(control.form, control.id) : null;
	if (own || !/^(?:radio|checkbox)$/.test(control.type) || !control.name) return own;
	return messageNamed(control.form, control.name);
}

function describe(control, message) {
	const ids = new Set((control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
	ids.add(message.id || (message.id = `${control.id || control.name}-error`));
	control.setAttribute('aria-describedby', [...ids].join(' '));
}

/**
 * @typedef {object} FormControl
 * @property {(button?: HTMLElement) => void} submit - Submits the form as `button` would.
 * @property {() => void} done - Ends the busy state after a successful request.
 * @property {(errors?: Object<string, string>) => void} fail - Ends the busy state and shows each
 *   message beside the control or the radio or checkbox group with that name. Focus moves to
 *   the first of them: for a group, its checked member, or else its first enabled one.
 * @property {() => void} cancel - Ends the busy state and dispatches `gldn-cancel`; does nothing
 *   when the form is not busy.
 * @property {boolean} busy - Whether the application is working on a submission; read-only.
 * @property {() => void} destroy - Removes the module's listeners.
 */

/**
 * Enhances a form. Each control's message goes in the element whose `data-gldn-error-for` names
 * the control's `id`, or, for a same-name radio or checkbox group, the group's `name`; it is
 * linked by `aria-describedby`. After a first attempt, messages update as the reader types. The form and its submit button carry `aria-busy="true"` while busy.
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
		const results = [];
		for (const control of form.elements) {
			if (control.willValidate) results.push([control, control.checkValidity() ? '' : control.validationMessage]);
		}
		// Valid controls clear their messages first, so a group's message keeps a member's error.
		for (const [control, text] of results) if (!text) show(control, '');
		for (const [control, text] of results) if (text) show(control, text);
		return results.filter(([, text]) => text).map(([control]) => control);
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
				const named = form.elements.namedItem(name);
				if (!named) return null;
				// Same-name controls, such as a radio group, arrive as a list without a nodeType.
				const members = named.nodeType ? [named] : [...named];
				for (const member of members) show(member, text);
				return members.find((member) => member.checked && !member.disabled)
					|| members.find((member) => !member.disabled) || null;
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
