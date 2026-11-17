# gldn-css - The Divine Proportional Semantic CSS System (DPS-CSS)

**gldn-css** is a lightweight **Utility-First CSS** framework with a
**Semantic Composition** established by **Golden Ratio** principles. Its typography and
composition draw on Robert Bringhurst, Tim Brown's modular scales, Utopia, Every Layout,
CUBE CSS, Open Props, and Pico CSS.

Whereas other Utility-First CSS frameworks run counter to **separation of concerns**
(separating presentation, markup and content), and purely semantic CSS classes
tend to *expand linearly* as the project grows, we are trying to strike a balance,
the best of both worlds in a beautiful and harmonious system:

* **Beautiful Math used Systematically:** Established on the Golden Ratio ($\phi \approx 1.61803$)
  to calculate proportional scaling and layout proportions
* **Semantically Rich Names:** HTML stays clean, readable, and meaningful using
  descriptive semantic classes prefixed with `gldn-`.
* **Minimal Bloat:** Built using CSS variables, Flexbox/Grid, and
  Cascade Layers (`@layer`) for predictable, conflict-free specificity.
  Optional zero-dependency JavaScript modules supply behavior CSS cannot express.

## Philosophy & Lineage

**gldn-css** is built from small parts that each do one thing and compose without
dictating markup. It learns from seven works and copies none of them:

|    Source    |       Lesson        |                        In gldn-css                        |
| ------------ | ------------------- | --------------------------------------------------------- |
| Bringhurst   | measure and rhythm  | φ leading, a `100ch / φ` measure, no space at panel edges |
| Tim Brown    | one ratio, one base | type, space, radii and lines are the base times φ^n       |
| Utopia       | fluid type, space   | one `clamp()` base from a 20rem to a 75rem viewport       |
| Every Layout | intrinsic layout    | splits, stack, cluster, grid, switcher and frame          |
| CUBE CSS     | styles by intent    | five layers, from reset to responsive                     |
| Open Props   | tokens used alone   | `--gldn-*` tokens, also alone in `gldn-tokens.min.css`    |
| Pico CSS     | plain HTML composed | the reset styles prose, code, tables and forms            |

The sources: Robert Bringhurst, *The Elements of Typographic Style*; Tim Brown,
*More Meaningful Typography* (modular scales); Utopia (utopia.fyi); Every Layout,
by Heydon Pickering and Andy Bell; CUBE CSS, by Andy Bell; Open Props; and Pico CSS.
The reset is part of `gldn.min.css`. Only the base is fluid: the padding of
`gldn-hero` and `gldn-workspace` steps down at the 48rem breakpoint.

## Features

* **The Golden Ratio Foundation:** Automatically divides sections into proportional
  major ($61.803\%$) and minor ($38.197\%$) sections that scale fluidly.
* **The `gldn-` Namespace:** Unique custom properties and class prefixes avoid
  naming collisions; the separate global reset still affects host elements.
* **Cascade Layers (`@layer`):** Strict separation of tokens, layout primitives,
  semantic classes, and responsive overrides for *conflict-free specificity*.
* **Fluid Adaptability & Reflow:** Layouts dynamically recalculate on resize and
  reflow seamlessly from side-by-side desktop viewports to stacked mobile layouts.

## Architecture

```text
gldn-css/
├── src/
│   ├── _reset.css       # Plain HTML on the golden scale, in the reset layer
│   ├── _tokens.css      # Fluid golden scales, radii, colors, and system fonts
│   ├── _layout.css      # Global layout wrappers and flex/grid primitives
│   ├── _components.css  # Semantic component classes (.gldn-sidebar, etc.)
│   ├── _responsive.css  # @layer responsive media queries
│   ├── gldn.css         # Main entry point declaring the layer order
│   ├── gldn-fonts.css   # Opt-in variable font stacks
│   ├── fonts/           # woff2 files and one LICENSE.txt with notices and sources
│   ├── gldn-tabs.js     # Optional WAI-ARIA tabs and marks module
│   ├── gldn-messages.js # Optional message pane and pop-in module
│   ├── gldn-dock.js     # Optional fixed dock and visual-viewport module
│   └── gldn-*.js        # Optional popover, dialog, roving focus, form, file drop,
│                        #   theme, shortcut, and media modules
├── dist/
│   ├── gldn.min.css     # Production-ready compiled bundle
│   ├── gldn-tokens.min.css  # The tokens layer alone
│   ├── gldn-fonts.css   # Generated copy of the opt-in font sheet
│   ├── fonts/           # Generated copies of the font files and license
│   └── gldn-*.js        # Generated copies of optional behavior modules
├── scripts/
│   └── build.mjs        # zero-dependency inliner and minifier
├── test/
│   ├── contract.test.mjs  # source-level contract suite
│   ├── layout.test.mjs    # rendered layout regression suite (headless Chrome)
│   ├── dock.test.mjs      # rendered dock, tabs, and message pane suite
│   ├── plain-html.test.mjs  # rendered reset, focus, and tokens bundle suite
│   ├── primitives.test.mjs  # rendered layout primitives and scopes suite
│   ├── splits.test.mjs    # rendered golden split stacking suite
│   ├── states.test.mjs    # rendered states, schemes, forced colors, and pointers suite
│   └── modules.test.mjs   # rendered optional module suite
├── docs/
│   ├── index.html       # Feature tour, full scales, and plain HTML specimens
│   ├── fonts.html       # The bundled pairing and two alternatives in both themes
│   ├── specimen/fonts/  # Fonts used only by fonts.html, with their LICENSE.txt
│   ├── components/      # One working example page per component
│   ├── gldn.js          # JavaScript examples used in conjunction with `index.html`
│   ├── gldn.min.css     # Generated copy of the production bundle
│   ├── gldn-tokens.min.css  # Generated copy of the tokens bundle
│   ├── gldn-fonts.css   # Generated copy of the opt-in font sheet
│   ├── fonts/           # Generated copies of the font files and license
│   ├── gldn-*.js        # Generated copies of optional behavior modules
│   ├── .nojekyll        # Publish as plain static files
│   └── fibonacci-spiral.svg  # hero artwork by nbpetersen via OpenClipart,
                             #   public domain: https://freesvg.org/fibonacci-spiral
└── README.md
```

**Quick start**

Link the compiled bundle and write semantic markup; the golden math stays in CSS:

```html
<link rel="stylesheet" href="dist/gldn.min.css">

<div class="gldn-workspace">
	<aside class="gldn-sidebar">minor column, 38.197%</aside>
	<main class="gldn-main">major column, 61.803%</main>
</div>
```

To use the tokens with your own rules, link only the tokens bundle. It sets
`--gldn-*` custom properties on `:root` and the dark theme class, and styles no
element:

```html
<link rel="stylesheet" href="dist/gldn-tokens.min.css">

<style>
	article { padding: var(--gldn-space-lg); font-size: var(--gldn-text-md); }
</style>
```

Open `docs/index.html` in a browser for a guided tour of the foundation,
including the full scales, plain HTML in both themes, and live measurement of
the rendered golden ratio. The tour links working component examples under
`docs/components/`. Their prose quotes Vannevar Bush, "As We May Think" (*The Atlantic
Monthly*, July 1945), verbatim and with attribution, in `<q cite>` and
`<blockquote cite>`. The quotations remain their author's work; the CC0 dedication
covers gldn-css, not them.

The default stacks use fonts shipped with macOS, Windows, and Linux. To opt in
to the bundled Inter, Literata, and JetBrains Mono variable fonts, link
`gldn-fonts.css` after the main bundle. Nothing downloads until that sheet is
linked. Each font is the Latin subset of an SIL Open Font License font with a
roman and an italic face; `fonts/LICENSE.txt` holds their copyright notices,
sources, and the license. `docs/fonts.html` shows this pairing beside the system
fonts and one alternative, in both themes.
Headings use the sans stack; for serif headings, set
`--gldn-font-display: var(--gldn-font-serif)` on `:root`.

**Cascade layers**

`src/gldn.css` declares the layer order `reset, tokens, layout, components,
responsive` and imports each partial; every partial assigns its own rules to
its own layer, so `src/` and `dist/` build the same layer tree. Layer order is the
framework's specificity contract: responsive overrides always win without
`!important`, and unlayered author styles can still override everything. Every
rule gldn-css ships sits in a layer, the opt-in font stacks included.

The reset (`src/_reset.css`) is the first layer. It is not scoped to `gldn-`
classes: it normalizes box sizing and media, then styles bare headings, prose,
lists, definition lists, rules, blockquotes, code, preformatted blocks, tables,
and forms on the golden scale. Headings use balanced wrapping and tighter
leading; paragraphs, list items, definitions, and quotations use golden leading,
pretty wrapping, and a readable measure, while lists, preformatted blocks, and
tables span their container. Space falls between siblings: the first and last
child of a container add none, so a panel's padding alone sets the space around
its content. Inline code keeps the size of the text around it on a tint of the
text color.

Text fields, selects, and bare buttons share one quiet look: the surface and text
colors, a boundary with 3:1 contrast against the page and panels, and the small
radius. A bare button is as tall as the field beside it; `gldn-btn` marks the
primary action. Checkboxes, radios, ranges, and progress bars take the primary
color as their accent. One `:focus-visible` rule gives every focusable element,
components included, the focus ring.

Semantic HTML needs no classes. On a page whose top-level `header`, `main`, and
`footer` carry no class, each is a centered column, and an unclassed `article` is a
card with its `header` and `footer` set off by hairlines. A `header`'s `nav` lays its
lists out as rows of links; navigation elsewhere keeps its lists. `hgroup` mutes its
subtitle. Unclassed sections stand a larger step apart. `mark`, `abbr[title]`, `del`,
`ins`, `kbd`, `var`, `sub`, `sup`, `figcaption`, `caption`, a quotation's
`footer`, an unclassed `details` (one row of an accordion), `progress`, and `meter`
each have a composed look. A table's `border` attribute draws nothing.

In an unclassed `form`, text fields, selects, and text areas fill their line, as a
column of fields, and a `<small>` after a control is its hint. A label around a
checkbox or radio sits beside it. `fieldset` and `legend` frame a group;
`fieldset[role="group"]` joins its controls on one line. A checkbox with
`role="switch"` is a track whose knob moves to the end when it is on. The file
picker's button is a bare button. A `dialog` holding one `article` lets the article
be its surface. `docs/semantic.html` shows all of it with no class or style attribute.

States carry a cue beside color. A link with `aria-current` is heavier, with a
thicker underline. An option, row, or cell with `aria-selected="true"` takes a
tint and an edge bar. A field with `aria-invalid="true"` takes the error boundary
and a thicker inline-start edge, and `aria-invalid="false"` the success boundary.
An element with `aria-busy="true"` shows a turning ring before its content, or
alone when it is empty. Disabled controls fade. In forced colors, selection keeps
an outline in the system highlight. Animation and transitions run only under
`prefers-reduced-motion: no-preference`. Long words and URLs wrap.

Host projects override the reset by layer without touching the design tokens.
A page that wants no reset links `gldn-tokens.min.css` in place of `gldn.min.css`.

**Design tokens**

All tokens live in `src/_tokens.css` under the `--gldn-` prefix and
form the single source of truth:

* *Proportions:* `--gldn-phi` (1.61803398875),
                 `--gldn-major` and `--gldn-minor`, derived exactly from
                 the first two cascade terms (1/phi + 1/phi^2 = 1)
* *Golden division cascade:* `--gldn-phi-1` through `--gldn-phi-10`,
  the percentages phi^-1 .. phi^-10, each term dividing the previous one
  by phi (the first two summing to exactly 100%)
* *Fluid base:* `--gldn-fluid-base` uses `clamp()` to grow from 1rem at a 20rem
  viewport to 1.125rem at 75rem. The endpoints `--gldn-base-min/max` and
  `--gldn-viewport-min/max` are numbers in rem, so the interpolation only
  multiplies lengths by numbers; type and space share the result
* *Spacing:* `--gldn-space-xs` through `--gldn-space-2xl`, with whole phi powers
  computed by `pow()`, plus `--gldn-gutter`, the single gutter between golden
  split columns, and `--gldn-workspace-padding`, which the workspace's columns
  read so that they stack when the workspace, padding included, is no wider than
  `--gldn-bp-sm`
* *Typography:* `--gldn-text-xs` through `--gldn-text-3xl`, advancing by half
  phi powers from the fluid base; `--gldn-leading` is phi for prose,
  `--gldn-leading-heading` is `1 + phi^-3`, and `--gldn-measure` is `100ch / phi`.
  `--gldn-text-sm` is the smallest size for text people read; `--gldn-text-xs`
  (9.9px at a 20rem viewport) is for marks such as superscripts
* *Fonts:* `--gldn-font-sans`, `--gldn-font-serif`, and `--gldn-font-mono` name
  platform fonts, and `--gldn-font-display`, the heading stack, is the sans stack;
  the opt-in font sheet redefines them
* *Color schemes:* every color is a `light-dark()` pair and `:root` sets
  `color-scheme: light dark`, so a page follows the system scheme. `gldn-theme-light`
  or `gldn-theme-dark` fixes the scheme for a page (on `<html>`) or for one panel
* *Surfaces:* `--gldn-color-bg/surface/text/muted/primary/primary-hover/primary-fg/link/border`,
  `--gldn-color-control-border` (a control's boundary, 3:1 against `bg` and
  `surface`), and `--gldn-shadow`
* *Lines and corners:* `--gldn-hairline` is the base times phi^-5. `--gldn-radius-sm`,
  `-md`, and `-lg` equal `--gldn-space-xs`, `-sm`, and `-md`. Since
  phi^n = phi^(n-1) + phi^(n-2), a `radius-lg` panel padded by `space-xs` holds
  `radius-md` children with concentric corners, and padded by `space-sm` holds
  `radius-sm` children
* *Status colors:* `--gldn-color-info/success/warning/error`, each with `-fg`
  for text on the base color and `-surface` for a tinted background, in both themes
* *States:* `--gldn-color-tint` (code and hover) and `--gldn-color-active` (press) are
  tints of the text color; `--gldn-color-selected` is a tint of the primary color;
  `--gldn-color-valid`, `--gldn-color-invalid`, `--gldn-color-overlay` (behind a
  modal), `--gldn-opacity-disabled`, `--gldn-edge-width` (the state edge, base ×
  phi^-3), and `--gldn-control-height` (one line of text plus a control's padding
  and boundary)
* *Interaction:* `--gldn-focus-ring`, `--gldn-z-popover`, `--gldn-z-dock`, and
  `--gldn-motion-duration` (in `ms` or `s`)
* *Dock:* `--gldn-dock-strip-height`, `--gldn-dock-panel-height`, `--gldn-dock-height`,
  `--gldn-dock-expanded-height`, and the measured `--gldn-dock-reserve`; narrow sheets use
  `--gldn-bp-sm` and controls meet `--gldn-touch-target`
* *Thresholds:* `--gldn-grid-min` is `100ch / phi^3` (23.6ch), the narrowest grid
  track, and `--gldn-switch-min` is `100ch / phi^2` (38.2ch), the width below which a
  switcher stacks. `--gldn-split-min` combines the same intrinsic threshold with a
  default viewport floor that stacks golden rows below 48rem. At 48rem and above,
  only the row's width and the 38.2ch threshold control the split. Retune each on
  the element, like `--gldn-gutter`; a row override replaces both split thresholds
* *Reference values:* `--gldn-bp-sm` (48rem) and `--gldn-bp-lg` (75rem);
  media query conditions cannot read custom properties,
  so `src/_responsive.css` repeats these literals

Override tokens on `:root` to re-theme globally without touching markup.
Scoped overrides work for leaf tokens (colors, shadow) on any element. Derived
tokens (space, type, gutter, radii, hairline) inherit as computed values, so
they follow a new base only where they are derived again: on `:root` and on a
scope element.

* `gldn-scope` re-derives the scales in its subtree from its own
  `--gldn-space-base` and `--gldn-text-base`:

  ```html
  <section class="gldn-scope" style="--gldn-text-base: 0.875rem">
  	<!-- text-lg is 0.875rem × φ here -->
  </section>
  ```

* `gldn-compact` and `gldn-spacious` are scopes whose space base is one phi step
  below or above the page's; type keeps its scale. A compact card has a smaller
  padding, and a row inside it a smaller gutter. A custom property cannot refer
  to itself, so the step is taken from the page's base and nested density
  classes do not compound.

Adding `class="gldn-theme-dark"` or `class="gldn-theme-light"` to `<html>` fixes the
scheme for the page; without either, the page follows the system.

**Layout primitives**

The utility layer (`src/_layout.css`) provides low-level golden proportions for
composing your own components:

* `gldn-container` centers content at the `--gldn-bp-lg` maximum width (75rem)
* `gldn-row` / `gldn-stack` arrange children horizontally / vertically with golden gaps;
  a stack's gap alone separates its children, whatever their own margins
* `gldn-cluster` keeps an inline group (tags, chips, buttons) on as few lines as
  fit, wrapping and never stacking; each child keeps its own width
* `gldn-grid` lays out as many equal columns as fit `--gldn-grid-min`; a container
  narrower than one track gets one full-width column
* `gldn-switcher` shares one line among equal columns and becomes a stack when the
  switcher is narrower than `--gldn-switch-min`. At a 1200px viewport it is a row in
  the workspace's main panel (629px) and a stack in its sidebar (367px)
* `gldn-frame` is a box phi wide to 1 high; add `gldn-frame-portrait` for 1 to phi.
  An `img`, `video`, `canvas`, `svg`, or `iframe` child covers it, cropped
* none of these primitives needs a breakpoint or sets a color, radius, or shadow
* `gldn-center` centers a row or stack on both axes
* `gldn-visually-hidden` hides content visually without removing it from the accessibility tree
* `gldn-major` / `gldn-minor` split a row in the golden ratio: each basis is its
  golden percentage minus the column's golden share of the one gutter, so
  bases + gutter = exactly 100%, and the border-box basis never shrinks or
  redistributes. A row holds one major and one minor; retune its gutter via
  `--gldn-gutter`, never by setting `gap` directly, and give it a length:
  `0px`, not `0`, since a unitless number cannot be subtracted from a percentage
* `gldn-major-fluid` / `gldn-minor-fluid` divide available space by flex-grow weights phi and 1,
  keeping the ratio at any width
* a row of golden columns stacks when the row is narrower than `--gldn-split-min`.
  The default token uses the 38.2ch intrinsic threshold at 48rem and above, and a
  viewport floor that stacks every default golden row below 48rem. At a 1200px
  viewport a golden row splits in the workspace's main panel and stacks in its
  sidebar; retune the token on the row to replace both default thresholds. At the
  intrinsic threshold the columns are about 22ch and 13ch wide: enough for navigation
  and metadata, not for prose. `gldn-sidebar` and `gldn-main` stack when their
  workspace or row is narrower than `--gldn-bp-sm` (48rem)
* all four split columns set `min-width: 0`, so wide content (code blocks,
  tables, long URLs) overflows its own column instead of stealing the
  sibling's share; give such content `overflow-x: auto`

**Components**

Semantic classes (`src/_components.css`) compose tokens and primitives:
* `gldn-workspace` full-height flex frame that splits a page into golden columns
* `gldn-sidebar` minor (38.197%) panel with the shared card surface
* `gldn-main` major (61.803%) panel with the shared card surface
* `gldn-header` full-width surface band for the top of a page
* `gldn-footer` full-width surface band for the bottom of a page
* `gldn-hero` centered display section with the largest padding
* `gldn-card` the shared panel surface: background, radius, shadow, golden padding
* `gldn-nav` horizontal list with golden gaps
* `gldn-title-hero` display heading at `--gldn-text-3xl`
* `gldn-title-1` section heading at `--gldn-text-2xl`
* `gldn-title-2` subsection heading at `--gldn-text-xl`
* `gldn-title-3` small heading at `--gldn-text-lg`, semibold
* `gldn-lede` section introduction at the larger type size, muted
* `gldn-text` body copy at the base type size, muted, readable measure
* `gldn-btn` primary-colored action for `<button>` and `<a>`, with the same height and
  boundary as a field or a bare button beside it. Add `gldn-btn-secondary` (the
  surface and control boundary), `gldn-btn-quiet` (no fill or visible boundary),
  or `gldn-btn-danger` (the error color, for destructive actions); a variant changes
  only colors
* `gldn-btn-icon` a square `gldn-btn` for one icon, named by `aria-label`
* `gldn-btn-group` buttons joined into one control (`role="group"` with a label)
* `gldn-icon` inline SVG or a text symbol at the size of its text; decorative icons
  carry `aria-hidden="true"`
* `gldn-disclosure` a button whose marker turns with `aria-expanded`
* `gldn-empty` a dashed frame around a sentence that says nothing is there yet
* `gldn-alert` a notice in the page flow; `data-gldn-kind` is `info`, `success`,
  `warning`, or `error`, and its text names the kind as well
* `gldn-scroll` a region that scrolls wide content inside itself; give it
  `tabindex="0"`, `role="region"`, and a label
* `gldn-field` a label, an optional `gldn-hint`, the control, and a `gldn-error`
  message (`data-gldn-error-for` names the control for the form module)
* `gldn-code-input` / `gldn-code-output` a monospace editor and a result shown as
  literal, preformatted text
* `gldn-search` a `role="search"` form: query, optional controls, and a Search button
  that wrap on narrow screens without hiding any of them
* `gldn-tree` a nested `role="tree"`: each item's `gldn-tree-row` carries the marker,
  the focus ring, and the selected state; a closed item hides its group. A row may hold
  its marker as a `gldn-tree-toggle`, which a pointer clicks to open or close the item,
  and its own controls, such as an Add button
* `gldn-results` a list of results, each with a link, a `gldn-result-meta` line (kind
  and identity), and a snippet; `aria-current` or `aria-selected` marks one
* `gldn-chip` a filter label with its own Remove button; `gldn-facets` a fieldset of
  choices that apply when the form is submitted
* `gldn-pagination` a `<nav>` of page links: `aria-current="page"` marks the current
  one, and an unavailable end is a `<span aria-disabled="true">`
* `gldn-panel` a view panel with a `<header>` (`gldn-panel-title`, metadata,
  actions), content, and a `<footer>` of actions; `aria-current="true"` marks the
  active panel, and `aria-busy`, `gldn-empty`, or `gldn-alert` give its states
* `gldn-meta` a key-value `<dl>`; `gldn-badge` a short label; `gldn-truncate` cuts
  text to one line and keeps its full content for assistive technology
* `gldn-dropzone` a `<label>` around a file input, its count, and its
  `[data-gldn-files]` pending list; it turns solid while files are dragged over it
* `gldn-shell` an application page: a `gldn-shell-bar` above a workspace. Below 48rem
  its `gldn-shell-nav`, and a `gldn-search` in the bar, fold behind `gldn-shell-toggle`
  buttons while they carry `data-gldn-collapsed`, and an unfolded region sits above
  the content. A `gldn-shell-close` button closes the navigation at any width: set
  `data-gldn-closed` on the navigation and its toggle, which then shows to reopen it,
  and the `gldn-main` beside it fills the workspace
* `gldn-hints` keyboard shortcuts beside what they do
* `gldn-media` framed images, native players, pages, and cues
* `gldn-timeline` the message log with a filter bar; `[data-gldn-messages-older]` asks
  for older entries
* `gldn-dock` fixed bottom panel with a tab strip, resizable message log, and error pop-in
* `gldn-tab` / `gldn-tabpanel` accessible tab controls and their panels
* `gldn-messages` newest-first, scrollable `role="log"` message pane

**Bottom dock, tabs, and messages**

Add `gldn-has-dock` to the body. The dock module measures the current wide dock
height or narrow strip and writes `--gldn-dock-reserve`; the body uses it as
bottom padding so fixed UI never covers page content.

```html
<div class="gldn-dock" data-gldn-dock data-gldn-expanded="true">
  <div class="gldn-dock-popin" data-gldn-popin role="alert" aria-atomic="true" hidden>
    <div class="gldn-dock-popin-content" data-gldn-popin-content></div>
    <button class="gldn-popin-dismiss" data-gldn-popin-dismiss
            type="button" aria-label="Dismiss">×</button>
  </div>
  <div class="gldn-tabs" data-gldn-tabs>
    <div class="gldn-dock-strip">
      <div class="gldn-tablist" role="tablist" aria-label="Dock panels">
        <button class="gldn-tab" id="input-tab" data-gldn-tab="input" role="tab"
                aria-selected="true" aria-controls="input-panel">Input</button>
        <button class="gldn-tab" id="messages-tab" data-gldn-tab="messages" role="tab"
                aria-selected="false" aria-controls="messages-panel" tabindex="-1">
          Messages
          <span class="gldn-tab-mark" data-gldn-tab-mark hidden>
            (<span data-gldn-tab-count>0</span><span data-gldn-tab-error hidden>!</span>)
          </span>
        </button>
      </div>
      <button class="gldn-dock-control" data-gldn-tabs-collapse type="button"
              aria-expanded="true" aria-controls="dock-panels" aria-label="Collapse panels">⌄</button>
    </div>
    <div class="gldn-dock-panels" id="dock-panels" data-gldn-dock-panels>
      <section class="gldn-tabpanel gldn-code-panel" id="input-panel"
               data-gldn-panel="input" role="tabpanel" aria-labelledby="input-tab">
        <label for="command">Command</label>
        <textarea class="gldn-code-input" id="command"></textarea>
      </section>
      <section class="gldn-tabpanel gldn-message-panel" id="messages-panel"
               data-gldn-panel="messages" role="tabpanel" aria-labelledby="messages-tab" hidden>
        <div class="gldn-message-tools">
          <button class="gldn-dock-control" data-gldn-messages-expand
                  type="button" aria-expanded="false" aria-controls="message-log">Expand</button>
          <button class="gldn-dock-control" data-gldn-messages-clear type="button">Clear</button>
        </div>
        <div class="gldn-messages" id="message-log" data-gldn-messages
             role="log" aria-live="polite" aria-relevant="additions"></div>
      </section>
    </div>
  </div>
</div>
```

```js
import { createDock } from './dist/gldn-dock.js';

const dock = createDock(document.querySelector('[data-gldn-dock]'), {
  active: 'input',
  expanded: true,
  onStateChange: ({ active, expanded }) => saveViewSomewhere(active, expanded)
});
dock.messages.add({
  kind: 'error', time: new Date().toISOString(),
  header: 'Request failed', body: 'Service unavailable'
});
dock.tabs.mark('messages', { error: true });
```

* `dock.messages.add(entry)` prepends a text-only entry with `kind`, `time`,
  `header`, and optional `body`; pass `{ popIn: false }` to suppress an error pop-in.
* `replace(entries)` restores a newest-first list; `clear()` empties the pane.
  Applications own storage, channels, and entry caps.
* `dock.tabs.select(name)`, `collapse()`, and `expand()` control the view.
  `mark(name, { count, error })` increments a mark; selecting a tab clears it.
* Arrow keys, Home, and End follow the WAI-ARIA tabs pattern. Showing entries
  and errors never moves focus; dismissing an error leaves its log entry intact.
* The message control expands history to at most half the viewport. The separate
  strip control collapses all panels; selecting a tab expands them again.
* Narrow screens start collapsed. Tabs open sheets over content, reselecting the
  active tab or tapping content closes them, and `visualViewport` keeps the dock
  above an on-screen keyboard. Errors use a smaller sheet above the strip.
* Pop-in animation runs only under `prefers-reduced-motion: no-preference`.
* See `docs/components/dock.html` for all behavior in both themes and at narrow width.

**Optional modules**

Each module is a zero-dependency ES module in `src/`, copied to `dist/`. It takes the
element it enhances, reports what the reader asked for through a callback or a
`gldn-*` event, and leaves requests, storage, and routing to the application. The
markup works without it.

* `gldn-popover.js`: `anchorPopover(popover, opener)` places a native `[popover]`
  below its opener, or above it near the bottom of the viewport, and returns focus to
  the opener when it closes; the browser owns opening, Escape, and light dismiss
* `gldn-dialog.js`: `createDialog(dialog, { onClose })` opens a native `<dialog>` as
  a modal, focuses its `autofocus` control, treats a click on the backdrop as cancel,
  and returns focus to the opener with the dialog's `returnValue`
* `gldn-roving.js`: `createRoving(root)` gives a listbox, menu, or tree one Tab stop,
  the arrow, Home, and End keys, and typeahead. In a tree, Right opens an item
  (`gldn-expand`, so the application can load its children) and Left closes it or
  moves to its parent; a click on a `gldn-tree-toggle` does either. Enter or Space
  dispatch `gldn-activate` and follow the item's link. Links in items leave the Tab
  order, and the current item's other row controls follow it. Items added later, such
  as loaded children, join the widget
* `gldn-form.js`: `enhanceForm(form)` shows each field's constraint message in its
  `[data-gldn-error-for]` element, focuses the first invalid field, marks the form and
  its submit button busy, and dispatches `gldn-submit` with the form data. A second
  submit while busy is ignored; `done()`, `fail({ name: message })`, and `cancel()`
  (or Escape, dispatching `gldn-cancel`) end the busy state
* `gldn-files.js`: `createFileDrop(zone)` adds dropped files to the zone's file
  input and pending list, each with a Remove button; a drop is kept from opening the
  file only on the zone, and nothing is uploaded
* `gldn-theme.js`: `createThemeControl(select)` offers system, light, and dark,
  applies `gldn-theme-light` or `gldn-theme-dark` to `<html>`, and remembers the
  choice when storage is available
* `gldn-keys.js`: `createShortcuts()` registers shortcuts that need Ctrl, Alt, or
  Meta (`Mod` is Meta on Apple systems); keys typed into a field stay with the field
  unless a shortcut is registered with `{ editable: true }`. `renderHints(dl, list)`
  writes them as `<kbd>` keys
* `gldn-media.js`: `createMediaNav(root)` pages through `[data-gldn-page]` content
  with a status, seeks `<audio>` or `<video>` to `[data-gldn-time]` cues, marks the
  cue under the playhead with `aria-current="time"`, and dispatches `gldn-annotate`
  with the time or page

**Responsive behavior**

The workspace and layout primitives respond to their own width, and no media
query stacks them. Golden rows also use the default `--gldn-split-min` viewport
floor to stack below 48rem. At that width the responsive layer only tightens the
padding of `gldn-workspace` and `gldn-hero`. The dock starts as a one-line tab
strip and opens panels as bottom sheets. Type and space need no breakpoint
override because their shared base interpolates smoothly. On coarse pointers
every control, except the dock's own, is at least a 44px target, and so are tree
rows, tree markers, and chip Remove buttons.

**Building and testing**

The build and tests are zero-dependency Node scripts. CSS is compiled, and the
opt-in font assets and JavaScript modules are copied without transformation:

```sh
node scripts/build.mjs        # rebuild dist/ and docs/ assets from src/
node test/contract.test.mjs   # run the source contract suite
node test/layout.test.mjs     # render the framework in headless Chrome and
                              # pin its golden layout promises (skips without Chrome)
```

With `GLDN_QUOTE_SOURCES` set to plain-text copies of the quoted works, the contract
suite also checks that every quotation in the examples appears in them verbatim.

The contract suite pins the file layout, cascade layer order, `gldn-` namespace
purity, fluid golden token math, opt-in font records, cross-file reference
integrity, and that the committed bundles and modules match `src/`. It rejects a
style rule outside a layer, and a literal length that its allowlist does not name
with a reason. The layout suite measures every type, space, and radius token at
320, 768, and 1200px, checks plain HTML, controls, focus, and font loading, links
the tokens bundle alone, and exercises the layout and component contracts.

## GitHub Pages

See the framework in action in the [gldn-css demo](https://musetronstar.github.io/gldn-css/).

