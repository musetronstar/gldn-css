/*
 * Navigation and annotation intent for timed or paged media. Timed: controls with
 * data-gldn-time seek the media, and the cue whose time range holds the playhead gets
 * aria-current="time". Paged: one [data-gldn-page] shows at a time, with previous and next
 * controls and a status. A [data-gldn-annotate] control dispatches gldn-annotate with the
 * current time or page; the application owns anchors and what an annotation becomes.
 */

/** Connects media navigation inside root. Returns { seek, page, destroy }. */
export function createMediaNav(root, { media = root.querySelector('audio, video') } = {}) {
	const pages = [...root.querySelectorAll('[data-gldn-page]')];
	const previous = root.querySelector('[data-gldn-page-prev]');
	const next = root.querySelector('[data-gldn-page-next]');
	const status = root.querySelector('[data-gldn-page-status]');
	const cues = [...root.querySelectorAll('[data-gldn-time]')]
		.map((element) => ({ element, time: Number(element.dataset.gldnTime) }))
		.sort((a, b) => a.time - b.time);
	let current = Math.max(0, pages.findIndex((page) => !page.hidden));

	function showPage(index) {
		if (pages.length === 0) return;
		current = Math.min(Math.max(0, index), pages.length - 1);
		pages.forEach((page, i) => {
			page.hidden = i !== current;
		});
		if (previous) previous.disabled = current === 0;
		if (next) next.disabled = current === pages.length - 1;
		if (status) status.textContent = `Page ${current + 1} of ${pages.length}`;
	}

	function markCue() {
		const time = media.currentTime;
		const active = cues.filter((cue) => cue.time <= time).at(-1);
		for (const cue of cues) {
			if (cue === active) cue.element.setAttribute('aria-current', 'time');
			else cue.element.removeAttribute('aria-current');
		}
	}

	function clicked(event) {
		const cue = event.target.closest('[data-gldn-time]');
		if (cue && media && root.contains(cue)) {
			event.preventDefault();
			api.seek(Number(cue.dataset.gldnTime));
		}
		if (event.target.closest('[data-gldn-page-prev]')) showPage(current - 1);
		if (event.target.closest('[data-gldn-page-next]')) showPage(current + 1);
		if (event.target.closest('[data-gldn-annotate]')) {
			root.dispatchEvent(new CustomEvent('gldn-annotate', {
				bubbles: true,
				detail: media ? { time: media.currentTime } : { page: current + 1 }
			}));
		}
	}

	root.addEventListener('click', clicked);
	media?.addEventListener('timeupdate', markCue);
	media?.addEventListener('seeked', markCue);
	showPage(current);
	const api = {
		seek(time) {
			if (!media) throw new Error('seek requires an audio or video element');
			media.currentTime = time;
			markCue();
		},
		page(number) {
			showPage(number - 1);
		},
		destroy() {
			root.removeEventListener('click', clicked);
			media?.removeEventListener('timeupdate', markCue);
			media?.removeEventListener('seeked', markCue);
		}
	};
	return api;
}
