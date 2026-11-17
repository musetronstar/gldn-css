/*
 * Rendered tests for plain HTML: the reset's controls and buttons in both themes, the focus
 * ring, the space at a panel's edges, component buttons beside the reset, and the tokens bundle
 * linked on its own. Run through test/layout.test.mjs.
 */
import { writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const contrastFunctions = `
	const channel = (value) => {
		value /= 255;
		return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	};
	const luminance = (color) => {
		const [r, g, b] = color.match(/[\\d.]+/g).map(Number).map(channel);
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	};
	const contrast = (a, b) => {
		const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
		return (light + 0.05) / (dark + 0.05);
	};
`;

/* Each theme gets the same controls, so a section can be measured on its own. */
const controls = (theme) => `
	<section class="gldn-card${theme === 'dark' ? ' gldn-theme-dark' : ''}" id="${theme}">
		<p>
			<input id="${theme}-text" type="text" placeholder="Name">
			<button id="${theme}-button" type="button">Cancel</button>
			<input id="${theme}-submit" type="submit" value="Send">
			<button class="gldn-btn" id="${theme}-primary" type="button">Save</button>
		</p>
		<p><textarea id="${theme}-area"></textarea> <select id="${theme}-select"><option>one</option></select></p>
		<p><input id="${theme}-check" type="checkbox"> <input id="${theme}-radio" type="radio"></p>
	</section>`;

const edges = ['p', 'ul', 'h2', 'table'].map((element) => {
	const child = {
		p: '<p>paragraph</p>',
		ul: '<ul><li>item<ul><li>nested item</li></ul></li></ul>',
		h2: '<h2>Heading</h2>',
		table: '<table><tbody><tr><td>cell</td></tr></tbody></table>'
	}[element];
	return `<div class="gldn-card" id="edge-${element}">${child}<p>between</p>${child}</div>`;
}).join('\n');

export async function testPlainHtml(browser, test, root) {
	const page = (name, sheets, body) => {
		const file = path.join(os.tmpdir(), `gldn-${name}.html`);
		const links = sheets.map((sheet) =>
			`<link rel="stylesheet" href="file://${path.join(root, 'dist', sheet)}">`).join('');
		writeFileSync(file, `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">${links}`
			+ `</head><body>${body}</body></html>`);
		return 'file://' + file;
	};
	const controlBody = controls('light') + controls('dark');

	const controlState = `(() => {
		${contrastFunctions}
		const token = (section, name) => {
			const probe = document.createElement('span');
			probe.style.color = 'var(--gldn-' + name + ')';
			section.appendChild(probe);
			const color = getComputedStyle(probe).color;
			probe.remove();
			return color;
		};
		const style = (id) => getComputedStyle(document.getElementById(id));
		const rect = (id) => document.getElementById(id).getBoundingClientRect();
		return ['light', 'dark'].map((theme) => {
			const section = document.getElementById(theme);
			const surface = token(section, 'color-surface');
			const bg = token(section, 'color-bg');
			const boundary = style(theme + '-text').borderTopColor;
			const radius = (() => {
				const probe = document.createElement('div');
				probe.style.width = 'var(--gldn-radius-sm)';
				section.appendChild(probe);
				const width = probe.getBoundingClientRect().width;
				probe.remove();
				return width;
			})();
			const looks = ['text', 'area', 'select', 'button', 'submit'].map((name) => {
				const s = style(theme + '-' + name);
				return {
					name,
					background: s.backgroundColor,
					color: s.color,
					border: s.borderTopColor,
					borderStyle: s.borderTopStyle,
					radius: parseFloat(s.borderTopLeftRadius)
				};
			});
			const check = style(theme + '-check');
			return {
				theme,
				surface,
				text: token(section, 'color-text'),
				primary: token(section, 'color-primary'),
				controlBorder: token(section, 'color-control-border'),
				radius,
				looks,
				boundaryOnSurface: contrast(boundary, surface),
				boundaryOnBg: contrast(boundary, bg),
				placeholder: getComputedStyle(document.getElementById(theme + '-text'), '::placeholder').color,
				muted: token(section, 'color-muted'),
				placeholderContrast: contrast(
					getComputedStyle(document.getElementById(theme + '-text'), '::placeholder').color,
					style(theme + '-text').backgroundColor),
				buttonHeight: rect(theme + '-button').height,
				textHeight: rect(theme + '-text').height,
				primaryBackground: style(theme + '-primary').backgroundColor,
				check: {
					width: rect(theme + '-check').width,
					height: rect(theme + '-check').height,
					padding: check.paddingLeft,
					accent: check.accentColor
				}
			};
		});
	})()`;

	await browser.viewport(1200);
	await browser.navigate(page('plain-controls', ['gldn.min.css'], controlBody), 16);
	const themes = await browser.evaluate(controlState);
	await browser.navigate(page('plain-unstyled', [], controlBody), 16);
	const unstyled = await browser.evaluate(`(() => {
		const rect = document.getElementById('light-check').getBoundingClientRect();
		return { width: rect.width, height: rect.height };
	})()`);

	test('text controls and bare buttons use the surface, text and boundary tokens in both themes', () => {
		for (const theme of themes) {
			for (const look of theme.looks) {
				if (look.background !== theme.surface || look.color !== theme.text
					|| look.border !== theme.controlBorder || look.borderStyle !== 'solid'
					|| Math.abs(look.radius - theme.radius) > 0.5) {
					throw new Error(`${theme.theme} ${look.name}: ${JSON.stringify({ look, theme })}`);
				}
			}
		}
	});

	test('control boundaries reach 3:1 and placeholders 4.5:1 in both themes', () => {
		for (const theme of themes) {
			if (theme.boundaryOnSurface < 3 || theme.boundaryOnBg < 3
				|| theme.placeholder !== theme.muted || theme.placeholderContrast < 4.5) {
				throw new Error(JSON.stringify(theme));
			}
		}
	});

	test('a bare button matches the height of a text input; gldn-btn keeps the primary fill', () => {
		for (const theme of themes) {
			if (Math.abs(theme.buttonHeight - theme.textHeight) > 0.5
				|| theme.primaryBackground !== theme.primary) {
				throw new Error(JSON.stringify(theme));
			}
		}
	});

	test('checkboxes keep their browser size and take the primary accent', () => {
		for (const theme of themes) {
			if (Math.abs(theme.check.width - unstyled.width) > 0.5
				|| Math.abs(theme.check.height - unstyled.height) > 0.5
				|| theme.check.padding !== '0px' || theme.check.accent !== theme.primary) {
				throw new Error(JSON.stringify({ check: theme.check, unstyled }));
			}
		}
	});

	await browser.navigate(page('plain-focus', ['gldn.min.css'],
		'<p><a id="focus-link" href="#">link</a> <button id="focus-button" type="button">button</button>'
		+ ' <input id="focus-input" type="text"></p>'
		+ '<details><summary id="focus-summary">summary</summary><p>detail</p></details>'), 16);
	const rings = [];
	for (let i = 0; i < 4; i++) {
		await browser.press('Tab');
		rings.push(await browser.evaluate(`(() => {
			const element = document.activeElement;
			const style = getComputedStyle(element);
			const probe = document.createElement('span');
			probe.style.color = 'var(--gldn-color-link)';
			document.body.appendChild(probe);
			const link = getComputedStyle(probe).color;
			probe.remove();
			return {
				id: element.id,
				style: style.outlineStyle,
				width: parseFloat(style.outlineWidth),
				color: style.outlineColor,
				link
			};
		})()`));
	}

	test('Tab reaches a bare link, button, input and summary, and each shows the focus ring', () => {
		const ids = rings.map((ring) => ring.id).join(',');
		if (ids !== 'focus-link,focus-button,focus-input,focus-summary') {
			throw new Error(`focus order: ${ids}`);
		}
		for (const ring of rings) {
			if (ring.style !== 'solid' || ring.width <= 0 || ring.color !== ring.link) {
				throw new Error(JSON.stringify(ring));
			}
		}
	});

	await browser.navigate(page('plain-edges', ['gldn.min.css'], edges), 16);
	const edgeState = await browser.evaluate(`['p', 'ul', 'h2', 'table'].map((element) => {
		const card = document.getElementById('edge-' + element);
		const box = card.getBoundingClientRect();
		const style = getComputedStyle(card);
		return {
			element,
			padding: parseFloat(style.paddingTop),
			above: card.firstElementChild.getBoundingClientRect().top - box.top,
			below: box.bottom - card.lastElementChild.getBoundingClientRect().bottom
		};
	})`);

	test('a panel holds its first and last child exactly its padding from the edges', () => {
		for (const edge of edgeState) {
			if (Math.abs(edge.above - edge.padding) > 0.5 || Math.abs(edge.below - edge.padding) > 0.5) {
				throw new Error(JSON.stringify(edge));
			}
		}
	});

	await browser.viewport(1100);
	await browser.navigate('file://' + path.join(root, 'docs', 'components', 'dock.html'), 16);
	const componentButtons = await browser.evaluate(`(() => {
		const strip = document.querySelector('.gldn-dock-strip').getBoundingClientRect();
		const stripStyle = getComputedStyle(document.querySelector('.gldn-dock-strip'));
		const stripContent = strip.height - parseFloat(stripStyle.borderBottomWidth);
		return [...document.querySelectorAll('.gldn-tab, .gldn-dock-control, .gldn-popin-dismiss')]
			.map((button) => {
				const style = getComputedStyle(button);
				const inStrip = button.closest('.gldn-dock-strip') !== null;
				return {
					name: button.className + ' ' + button.textContent.trim(),
					padding: style.paddingTop + ' ' + style.paddingBottom,
					border: style.borderTopWidth,
					background: style.backgroundColor,
					selected: button.getAttribute('aria-selected') === 'true',
					dismiss: button.classList.contains('gldn-popin-dismiss'),
					fillError: inStrip ? Math.abs(button.getBoundingClientRect().height - stripContent) : 0
				};
			});
	})()`);

	test('component buttons keep their own fill, border and size beside the reset', () => {
		for (const button of componentButtons) {
			if (button.border !== '0px' || button.fillError > 0.5
				|| (!button.dismiss && button.padding !== '0px 0px')
				|| (!button.selected && button.background !== 'rgba(0, 0, 0, 0)')) {
				throw new Error(JSON.stringify(button));
			}
		}
	});

	/* Adjacent controls: a field, a bare button and each gldn-btn variant, in both themes. */
	const buttonSet = (theme) => `
		<section class="gldn-card${theme === 'dark' ? ' gldn-theme-dark' : ''}" id="buttons-${theme}">
			<p>
				<input id="${theme}-field" type="text" value="field">
				<button id="${theme}-bare" type="button">Bare</button>
				<button class="gldn-btn" id="${theme}-primary" type="button">Primary</button>
				<button class="gldn-btn gldn-btn-secondary" id="${theme}-secondary" type="button">Secondary</button>
				<button class="gldn-btn gldn-btn-quiet" id="${theme}-quiet" type="button">Quiet</button>
				<button class="gldn-btn gldn-btn-danger" id="${theme}-danger" type="button">Danger</button>
				<a class="gldn-btn" id="${theme}-link" href="#">Link</a>
				<button class="gldn-btn gldn-btn-danger" id="${theme}-disabled" type="button" disabled>Disabled</button>
			</p>
		</section>`;
	const buttonState = `(() => {
		${contrastFunctions}
		const token = (section, name) => {
			const probe = document.createElement('span');
			probe.style.color = 'var(--gldn-' + name + ')';
			section.appendChild(probe);
			const color = getComputedStyle(probe).color;
			probe.remove();
			return color;
		};
		return ['light', 'dark'].map((theme) => {
			const section = document.getElementById('buttons-' + theme);
			const measure = (name) => {
				const element = document.getElementById(theme + '-' + name);
				const style = getComputedStyle(element);
				const rect = element.getBoundingClientRect();
				return {
					name,
					height: rect.height,
					width: rect.width,
					border: style.borderTopWidth + ' ' + style.borderTopStyle,
					background: style.backgroundColor,
					color: style.color,
					borderColor: style.borderTopColor,
					opacity: style.opacity,
					textContrast: style.backgroundColor === 'rgba(0, 0, 0, 0)'
						? contrast(style.color, getComputedStyle(section).backgroundColor)
						: contrast(style.color, style.backgroundColor)
				};
			};
			return {
				theme,
				tokens: Object.fromEntries(['color-primary', 'color-primary-fg', 'color-surface', 'color-text',
					'color-control-border', 'color-error', 'color-error-fg'].map((name) => [name, token(section, name)])),
				controls: ['field', 'bare', 'primary', 'secondary', 'quiet', 'danger', 'link', 'disabled'].map(measure)
			};
		});
	})()`;

	await browser.viewport(1200);
	await browser.navigate(page('plain-buttons', ['gldn.min.css'], buttonSet('light') + buttonSet('dark')), 16);
	const buttons = {};
	buttons[1200] = await browser.evaluate(buttonState);
	const buttonRings = [];
	for (let i = 0; i < 7; i++) {
		await browser.press('Tab');
		buttonRings.push(await browser.evaluate(`(() => {
			const style = getComputedStyle(document.activeElement);
			return { id: document.activeElement.id, style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
		})()`));
	}
	await browser.viewport(320);
	await browser.navigate(page('plain-buttons', ['gldn.min.css'], buttonSet('light') + buttonSet('dark')), 16);
	buttons[320] = await browser.evaluate(buttonState);

	test('adjacent fields, bare buttons and every gldn-btn variant share one height and boundary', () => {
		for (const [width, themes] of Object.entries(buttons)) {
			for (const { theme, controls } of themes) {
				const [field] = controls;
				for (const control of controls) {
					if (Math.abs(control.height - field.height) > 0.5 || control.border !== field.border) {
						throw new Error(`${width}px ${theme} ${control.name}: ${JSON.stringify({ control, field })}`);
					}
				}
			}
		}
	});

	test('button variants take their colors from the tokens with AA text in both themes', () => {
		for (const { theme, tokens, controls } of buttons[1200]) {
			const by = Object.fromEntries(controls.map((control) => [control.name, control]));
			const expected = {
				primary: [tokens['color-primary'], tokens['color-primary-fg'], tokens['color-primary']],
				link: [tokens['color-primary'], tokens['color-primary-fg'], tokens['color-primary']],
				secondary: [tokens['color-surface'], tokens['color-text'], tokens['color-control-border']],
				quiet: ['rgba(0, 0, 0, 0)', tokens['color-text'], 'rgba(0, 0, 0, 0)'],
				danger: [tokens['color-error'], tokens['color-error-fg'], tokens['color-error']]
			};
			for (const [name, [background, color, borderColor]] of Object.entries(expected)) {
				const control = by[name];
				if (control.background !== background || control.color !== color
					|| control.borderColor !== borderColor || control.textContrast < 4.5) {
					throw new Error(`${theme} ${name}: ${JSON.stringify(control)}`);
				}
			}
			if (by.disabled.opacity !== '0.5') throw new Error(`${theme} disabled: ${JSON.stringify(by.disabled)}`);
		}
	});

	test('every button variant shows the focus ring and is at least a 24px target at 320px', () => {
		const ids = buttonRings.map((ring) => ring.id).join(',');
		if (ids !== 'light-field,light-bare,light-primary,light-secondary,light-quiet,light-danger,light-link') {
			throw new Error(`focus order: ${ids}`);
		}
		for (const ring of buttonRings) {
			if (ring.style !== 'solid' || ring.width <= 0) throw new Error(JSON.stringify(ring));
		}
		for (const { theme, controls } of buttons[320]) {
			for (const control of controls) {
				if (control.height < 24 || control.width < 24) {
					throw new Error(`320px ${theme} ${control.name}: ${control.width} × ${control.height}`);
				}
			}
		}
	});

	const scaleProbe = `(() => {
		const probe = document.createElement('div');
		probe.style.position = 'absolute';
		document.body.appendChild(probe);
		const values = {};
		for (const name of ['text-sm', 'text-lg', 'space-xs', 'space-xl', 'radius-md', 'hairline']) {
			probe.style.width = 'var(--gldn-' + name + ')';
			values[name] = probe.getBoundingClientRect().width;
		}
		probe.remove();
		const style = (selector) => getComputedStyle(document.querySelector(selector));
		return {
			values,
			h1Size: style('h1').fontSize,
			h1Margin: style('h1').marginTop,
			buttonBackground: style('button').backgroundColor,
			buttonBorder: style('button').borderTopColor,
			inputBorder: style('input').borderTopColor + ' ' + style('input').borderTopWidth
		};
	})()`;
	const alone = '<h1>Heading</h1><p><button type="button">button</button> <input type="text"></p>';
	await browser.viewport(1200);
	await browser.navigate(page('tokens-bundle', ['gldn.min.css'], alone), 16);
	const full = await browser.evaluate(scaleProbe);
	await browser.navigate(page('tokens-alone', ['gldn-tokens.min.css'], alone), 16);
	const tokensOnly = await browser.evaluate(scaleProbe);
	await browser.navigate(page('tokens-none', [], alone), 16);
	const browserLook = await browser.evaluate(scaleProbe);

	test('the tokens bundle alone resolves the scale and leaves bare elements to the browser', () => {
		for (const [name, value] of Object.entries(full.values)) {
			if (Math.abs(tokensOnly.values[name] - value) > 0.5) {
				throw new Error(`${name}: ${tokensOnly.values[name]} vs ${value}`);
			}
		}
		for (const key of ['h1Size', 'h1Margin', 'buttonBackground', 'buttonBorder', 'inputBorder']) {
			if (tokensOnly[key] !== browserLook[key]) {
				throw new Error(`${key}: ${tokensOnly[key]} vs the browser's ${browserLook[key]}`);
			}
		}
	});
}
