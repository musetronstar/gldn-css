/*
 * Dialog lifecycle around a native <dialog>: showModal(), initial focus, a click on the
 * backdrop as cancel, and focus back on the opener when the dialog closes. The application
 * owns what submitting or cancelling means; onClose receives the dialog's returnValue.
 */

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), '
	+ 'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * @typedef {object} DialogControl
 * @property {(opener?: Element) => void} open - Opens the dialog as a modal and focuses its
 *   `autofocus` control, or its first focusable one. Focus returns to `opener`, by default the
 *   element focused before, when the dialog closes. Opening an open dialog does nothing.
 * @property {(returnValue?: string) => void} close - Closes an open dialog with a return value.
 * @property {() => void} destroy - Removes the module's listeners; the dialog stays as it is.
 */

/**
 * Wraps a native dialog.
 * @param {HTMLDialogElement} dialog - The `<dialog>` element.
 * @param {object} [options]
 * @param {boolean} [options.lightDismiss=true] - Whether a click on the backdrop closes the
 *   dialog with the return value `"cancel"`.
 * @param {(returnValue: string) => void} [options.onClose] - Receives the dialog's
 *   `returnValue` when it closes, before focus returns to the opener.
 * @returns {DialogControl} The dialog's controls.
 * @throws {Error} When `dialog` is not a `<dialog>` element.
 * @example
 * const confirm = createDialog(document.querySelector('#confirm'), {
 *   onClose: (value) => { if (value === 'delete') remove(); }
 * });
 * deleteButton.addEventListener('click', () => confirm.open());
 */
export function createDialog(dialog, { lightDismiss = true, onClose } = {}) {
	if (dialog.localName !== 'dialog') throw new Error('createDialog requires a <dialog> element');
	const document = dialog.ownerDocument;
	let opener = null;

	function clicked(event) {
		if (!lightDismiss || event.target !== dialog) return;
		const box = dialog.getBoundingClientRect();
		const inside = event.clientX >= box.left && event.clientX <= box.right
			&& event.clientY >= box.top && event.clientY <= box.bottom;
		if (!inside) dialog.close('cancel');
	}

	function closed() {
		onClose?.(dialog.returnValue);
		if (opener?.isConnected) opener.focus();
		opener = null;
	}

	dialog.addEventListener('click', clicked);
	dialog.addEventListener('close', closed);
	return {
		open(from = document.activeElement) {
			if (dialog.open) return;
			opener = from;
			dialog.returnValue = '';
			dialog.showModal();
			const first = dialog.querySelector('[autofocus]') || dialog.querySelector(FOCUSABLE);
			(first || dialog).focus();
		},
		close(returnValue) {
			if (dialog.open) dialog.close(returnValue);
		},
		destroy() {
			dialog.removeEventListener('click', clicked);
			dialog.removeEventListener('close', closed);
		}
	};
}
