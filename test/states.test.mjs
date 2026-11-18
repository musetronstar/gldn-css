/*
 * Rendered tests for states and foundations: selection, current items, validity, busy and
 * disclosure cues, icons and groups, notices and empty states, wide content, the system color
 * scheme, forced colors and coarse pointers. Run through test/layout.test.mjs.
 */
import path from 'node:path';

const contrastFunctions = `
	const channels = (color) => color.match(/[\\d.]+/g).map(Number);
	const over = (top, bottom) => {
		const [r, g, b, a = 1] = channels(top);
		const [R, G, B] = channels(bottom);
		return \`rgb(\${r * a + R * (1 - a)}, \${g * a + G * (1 - a)}, \${b * a + B * (1 - a)})\`;
	};
	const luminance = (color) => {
		const [r, g, b] = channels(color).slice(0, 3).map((value) => {
			value /= 255;
			return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
		});
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	};
	const contrast = (a, b) => {
		const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
		return (light + 0.05) / (dark + 0.05);
	};
`;

const stateExpression = `(() => {
	${contrastFunctions}
	const style = (id, pseudo) => getComputedStyle(document.getElementById(id), pseudo);
	const rect = (id) => document.getElementById(id).getBoundingClientRect();
	return ['light', 'dark'].map((theme) => {
		const card = document.getElementById('states-' + theme);
		const surface = getComputedStyle(card).backgroundColor;
		const selected = style(theme + '-selected');
		const shown = over(selected.backgroundColor, surface);
		const invalid = style(theme + '-invalid');
		const valid = style(theme + '-valid');
		const probe = (name) => {
			const span = document.createElement('span');
			span.style.color = 'var(--gldn-' + name + ')';
			card.appendChild(span);
			const color = getComputedStyle(span).color;
			span.remove();
			return color;
		};
		const group = [...document.getElementById(theme + '-group').children].map((child) => child.getBoundingClientRect());
		return {
			theme,
			selectedContrast: contrast(selected.color, shown),
			selectedEdge: selected.boxShadow,
			current: parseFloat(getComputedStyle(card.querySelector('a[aria-current]')).fontWeight),
			invalidBorder: invalid.borderTopColor,
			invalidEdge: parseFloat(invalid.borderLeftWidth) - parseFloat(invalid.borderTopWidth),
			invalidContrast: contrast(invalid.borderTopColor, surface),
			validBorder: valid.borderTopColor,
			error: probe('color-invalid'),
			success: probe('color-valid'),
			busyRing: style(theme + '-busy', '::before').borderTopStyle,
			busyAnimation: style(theme + '-busy', '::before').animationName,
			busyPanelRing: style(theme + '-busy-panel', '::before').borderTopStyle,
			disclosure: style(theme + '-disclosure', '::before').rotate,
			icon: [rect(theme + '-icon').width, rect(theme + '-icon').height],
			groupOverlap: group.slice(1).map((box, i) => group[i].right - box.left),
			empty: style(theme + '-empty').borderTopStyle,
			alertEdge: parseFloat(style(theme + '-invalid-note').borderLeftWidth)
				- parseFloat(style(theme + '-invalid-note').borderTopWidth),
			alertColor: style(theme + '-invalid-note').borderTopColor
		};
	});
})()`;

export async function testStates(browser, test, root) {
	const url = 'file://' + path.join(root, 'docs', 'components', 'states.html');
	const dockUrl = 'file://' + path.join(root, 'docs', 'components', 'dock.html');

	await browser.viewport(1200);
	await browser.navigate(url, 16);
	const themes = await browser.evaluate(stateExpression);

	test('selected rows keep AA text on their tint and an edge bar, in both themes', () => {
		for (const theme of themes) {
			if (theme.selectedContrast < 4.5 || !theme.selectedEdge.includes('inset')) {
				throw new Error(JSON.stringify(theme));
			}
		}
	});

	test('current links are heavier; invalid fields have an edge and a 3:1 boundary', () => {
		for (const theme of themes) {
			if (theme.current < 600 || theme.invalidBorder !== theme.error || theme.invalidEdge <= 0
				|| theme.invalidContrast < 3 || theme.validBorder !== theme.success) {
				throw new Error(JSON.stringify(theme));
			}
		}
	});

	// Hover: each link is scrolled into view and hovered with a real mouse move. A selected
	// result keeps the text color on its tint. Visited colors are hidden from scripts.
	await browser.evaluate(`['light', 'dark'].forEach((theme) => {
		document.getElementById('states-' + theme).insertAdjacentHTML('beforeend',
			'<ul class="gldn-results" id="' + theme + '-results">'
			+ '<li aria-selected="true"><a href="#selected-result" id="' + theme + '-result-selected">Memex</a></li>'
			+ '<li><a href="#result" id="' + theme + '-result">Trails</a></li></ul>');
	})`);
	const linkStyle = async (id, hovered) => {
		const point = await browser.evaluate(`(() => {
			const element = document.getElementById('${id}');
			element.scrollIntoView({ block: 'center' });
			const box = element.getBoundingClientRect();
			return [box.left + box.width / 2, box.top + box.height / 2];
		})()`);
		await browser.hover(...(hovered ? point : [0, 0]));
		return browser.evaluate(`getComputedStyle(document.getElementById('${id}')).color`);
	};
	const links = [];
	for (const theme of ['light', 'dark']) {
		const tokens = await browser.evaluate(`(() => {
			${contrastFunctions}
			const card = document.getElementById('states-${theme}');
			const probe = (name) => {
				const span = document.createElement('span');
				span.style.color = 'var(--gldn-' + name + ')';
				card.appendChild(span);
				const color = getComputedStyle(span).color;
				span.remove();
				return color;
			};
			const surface = getComputedStyle(card).backgroundColor;
			return { link: probe('color-link'), hover: probe('color-link-hover'), text: probe('color-text'),
				restContrast: contrast(probe('color-link'), surface),
				hoverContrast: contrast(probe('color-link-hover'), surface) };
		})()`);
		const navId = await browser.evaluate(`(() => {
			const link = document.querySelector('#states-${theme} nav a:not([aria-current])');
			link.id = '${theme}-nav-link';
			return link.id;
		})()`);
		links.push({
			theme,
			...tokens,
			rest: await linkStyle(`${theme}-link`, false),
			hovered: await linkStyle(`${theme}-link`, true),
			nav: await linkStyle(navId, true),
			result: await linkStyle(`${theme}-result`, true),
			selectedResult: await linkStyle(`${theme}-result-selected`, true)
		});
	}
	await browser.hover(0, 0);
	await browser.evaluate(`document.querySelectorAll('.gldn-results').forEach((list) => list.remove())`);

	test('hovered links gain contrast, and a selected result keeps the text color, in both themes', () => {
		for (const theme of links) {
			if (theme.rest !== theme.link || theme.hovered !== theme.hover || theme.nav !== theme.hover
				|| theme.result !== theme.hover || theme.selectedResult !== theme.text
				|| theme.hoverContrast < 4.5 || theme.hoverContrast <= theme.restContrast) {
				throw new Error(JSON.stringify(theme));
			}
		}
	});

	// Hidden stays hidden over a component's display; small controls are at least 24px square;
	// an unavailable action fades like a disabled one and takes no hover fill.
	await browser.evaluate(`document.getElementById('states-light').insertAdjacentHTML('beforeend', \`
		<div class="gldn-cluster" id="probe-hidden" hidden>hidden</div>
		<p><span class="gldn-chip">kind <button type="button" id="probe-chip" aria-label="Remove kind">×</button></span></p>
		<ul class="gldn-tree" role="tree" aria-label="Probe"><li role="treeitem" aria-expanded="false">
			<span class="gldn-tree-row"><span class="gldn-tree-toggle" id="probe-toggle" aria-hidden="true"></span>
			<a href="#">item</a></span><ul role="group"><li role="treeitem">child</li></ul></li></ul>
		<p><button type="button" class="gldn-popin-dismiss" id="probe-dismiss" aria-label="Dismiss">×</button>
			<button type="button" id="probe-bare" aria-disabled="true">Delete</button>
			<button type="button" class="gldn-btn" id="probe-btn" aria-disabled="true">Delete</button></p>\`)`);
	const restFill = await browser.evaluate(`getComputedStyle(document.getElementById('probe-btn')).backgroundColor`);
	const probeBox = await browser.evaluate(`(() => {
		const element = document.getElementById('probe-btn');
		element.scrollIntoView({ block: 'center' });
		const box = element.getBoundingClientRect();
		return [box.left + box.width / 2, box.top + box.height / 2];
	})()`);
	await browser.hover(...probeBox);
	const small = await browser.evaluate(`(() => {
		const size = (id) => { const box = document.getElementById(id).getBoundingClientRect(); return [box.width, box.height]; };
		const style = (id) => getComputedStyle(document.getElementById(id));
		return { hidden: style('probe-hidden').display, chip: size('probe-chip'), toggle: size('probe-toggle'),
			dismiss: size('probe-dismiss'), bare: style('probe-bare').opacity, btn: style('probe-btn').opacity,
			hoverFill: style('probe-btn').backgroundColor };
	})()`);
	await browser.hover(0, 0);

	test('hidden stays hidden, small controls are 24px targets, and unavailable actions fade', () => {
		const target = (size) => size.every((side) => side >= 24 - 0.01);
		if (small.hidden !== 'none' || !target(small.chip) || !target(small.toggle) || !target(small.dismiss)
			|| small.bare !== '0.5' || small.btn !== '0.5' || small.hoverFill !== restFill) {
			throw new Error(JSON.stringify({ small, restFill }));
		}
	});

	test('busy elements show a turning ring, and a disclosure marker turns when expanded', () => {
		for (const theme of themes) {
			if (theme.busyRing !== 'solid' || theme.busyPanelRing !== 'solid'
				|| theme.busyAnimation !== 'gldn-spin' || theme.disclosure !== '90deg') {
				throw new Error(JSON.stringify(theme));
			}
		}
	});

	test('icon buttons are square, groups share one boundary, notices and empty states have cues', () => {
		for (const theme of themes) {
			if (Math.abs(theme.icon[0] - theme.icon[1]) > 0.5
				|| theme.groupOverlap.some((overlap) => overlap <= 0 || overlap > 2)
				|| theme.empty !== 'dashed' || theme.alertEdge <= 0 || theme.alertColor !== theme.error) {
				throw new Error(JSON.stringify(theme));
			}
		}
	});

	await browser.reducedMotion(true);
	await browser.navigate(url, 16);
	const reduced = await browser.evaluate(`getComputedStyle(document.getElementById('light-busy'), '::before').animationName`);
	await browser.reducedMotion(false);

	test('the busy ring stands still when reduced motion is requested', () => {
		if (reduced !== 'none') throw new Error(`animation: ${reduced}`);
	});

	await browser.viewport(320);
	await browser.navigate(url, 16);
	const narrow = await browser.evaluate(`(() => {
		const region = document.querySelector('.gldn-scroll');
		return {
			regionOverflow: region.scrollWidth - region.clientWidth,
			pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
		};
	})()`);

	test('wide content scrolls inside its region, not the page, at 320px', () => {
		if (narrow.regionOverflow <= 0 || narrow.pageOverflow > 1) throw new Error(JSON.stringify(narrow));
	});

	await browser.viewport(1200);
	await browser.media([{ name: 'prefers-color-scheme', value: 'dark' }]);
	await browser.navigate(url, 16);
	const system = await browser.evaluate(`({
		body: getComputedStyle(document.body).backgroundColor,
		light: getComputedStyle(document.getElementById('states-light')).backgroundColor,
		dark: getComputedStyle(document.getElementById('states-dark')).backgroundColor
	})`);
	await browser.media([]);

	test('a page follows a dark system scheme, and a light class keeps its panel light', () => {
		if (system.body !== 'rgb(15, 23, 42)' || system.light !== 'rgb(255, 255, 255)'
			|| system.dark !== 'rgb(30, 41, 59)') {
			throw new Error(JSON.stringify(system));
		}
	});

	await browser.media([{ name: 'forced-colors', value: 'active' }]);
	await browser.navigate(url, 16);
	const forcedOption = await browser.evaluate(`getComputedStyle(document.getElementById('light-selected')).outlineStyle`);
	await browser.navigate(dockUrl, 16);
	const forcedTab = await browser.evaluate(`getComputedStyle(document.querySelector('.gldn-tab[aria-selected="true"]')).borderTopStyle`);
	await browser.media([]);

	test('in forced colors, selection keeps an outline or an edge', () => {
		if (forcedOption !== 'solid' || forcedTab !== 'solid') {
			throw new Error(JSON.stringify({ forcedOption, forcedTab }));
		}
	});

	const sizes = `(() => {
		const box = (selector) => document.querySelector(selector).getBoundingClientRect();
		return {
			coarse: matchMedia('(pointer: coarse)').matches,
			button: box('#light-busy').height,
			field: box('#light-valid').height,
			icon: [box('#light-icon').width, box('#light-icon').height]
		};
	})()`;
	const tabSize = `(() => {
		const tab = document.querySelector('.gldn-tab').getBoundingClientRect();
		return [tab.width, tab.height];
	})()`;
	// At 375px a control is about 40px tall, so only the coarse-pointer rule reaches 44px.
	await browser.viewport(375);
	await browser.navigate(dockUrl, 16);
	const fineTab = await browser.evaluate(tabSize);
	await browser.touch(true);
	await browser.navigate(url, 16);
	const coarse = await browser.evaluate(sizes);
	await browser.navigate(dockUrl, 16);
	const coarseTab = await browser.evaluate(tabSize);
	await browser.navigate('file://' + path.join(root, 'docs', 'components', 'tree.html'), 16);
	const coarseTree = await browser.evaluate(`(() => {
		const box = (selector) => document.querySelector(selector).getBoundingClientRect();
		return { row: box('#science > .gldn-tree-row').height,
			toggle: [box('#science > .gldn-tree-row > .gldn-tree-toggle').width, box('#science > .gldn-tree-row > .gldn-tree-toggle').height] };
	})()`);
	await browser.navigate('file://' + path.join(root, 'docs', 'components', 'chips.html'), 16);
	const coarseChip = await browser.evaluate(`(() => {
		const box = document.querySelector('#chips button').getBoundingClientRect();
		return [box.width, box.height];
	})()`);
	await browser.touch(false);
	await browser.viewport(1200);

	test('coarse pointers get 44px controls while the dock keeps its sizes', () => {
		if (!coarse.coarse || coarse.button < 44 || coarse.field < 44
			|| coarse.icon.some((side) => side < 44)
			|| Math.abs(coarseTab[0] - fineTab[0]) > 0.5 || Math.abs(coarseTab[1] - fineTab[1]) > 0.5) {
			throw new Error(JSON.stringify({ coarse, fineTab, coarseTab }));
		}
	});

	test('coarse pointers get 44px tree rows, tree markers and chip Remove buttons', () => {
		if (coarseTree.row < 44 || coarseTree.toggle.some((side) => side < 44) || coarseChip.some((side) => side < 44)) {
			throw new Error(JSON.stringify({ coarseTree, coarseChip }));
		}
	});
}
