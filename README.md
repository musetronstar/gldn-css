# gldn-css - The Divine Proportional Semantic CSS System (DPS-CSS)

**gldn-css** is a lightweight **Utility-First CSS** framework with a
**Semantic Composition** established by **Golden Ratio** principles.

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
│   ├── _tokens.css      # --gldn-phi constant and spacing scales; hosts the reset layer
│   ├── _layout.css      # Global layout wrappers and flex/grid primitives
│   ├── _components.css  # Semantic component classes (.gldn-sidebar, etc.)
│   ├── _responsive.css  # @layer responsive media queries
│   ├── gldn.css         # Main entry point declaring the layer order
│   ├── gldn-tabs.js     # Optional WAI-ARIA tabs and marks module
│   ├── gldn-messages.js # Optional message pane and pop-in module
│   └── gldn-dock.js     # Optional fixed dock and visual-viewport module
├── dist/
│   ├── gldn.min.css     # Production-ready compiled bundle
│   └── gldn-*.js        # Generated copies of optional behavior modules
├── scripts/
│   └── build.mjs        # zero-dependency inliner and minifier
├── test/
│   ├── contract.test.mjs  # source-level contract suite
│   └── layout.test.mjs    # rendered layout regression suite (headless Chrome)
├── docs/
│   ├── index.html       # Feature tour and GitHub Pages entry point
│   ├── components/      # One working example page per component
│   ├── gldn.js          # JavaScript examples used in conjunction with `index.html`
│   ├── gldn.min.css     # Generated copy of the production bundle
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

Open `docs/index.html` in a browser for a guided tour of the foundation,
including live measurement of the rendered golden ratio. The tour links
working component examples under `docs/components/`.

**Cascade layers**

`src/gldn.css` declares the layer order `reset, tokens, layout, components,
responsive` and imports each partial; every partial assigns its own rules to
a layer, so `src/` and `dist/` build the same layer tree. Layer order is the
framework's specificity contract: responsive overrides always win without
`!important`, and unlayered author styles can still override everything.
The global reset rides in the first layer, physically hosted by
`_tokens.css`. It is not scoped to `gldn-` classes: it sets
`box-sizing: border-box` and zeroes margin and padding on every element and
pseudo-element, gives the body at least the viewport's height, makes media
elements block-level with a maximum width, and sets page typography, body
background and text colors, link colors, inherited form fonts, and golden
padding for text controls. Host projects can override or discard the reset by
layer without touching the design tokens.

**Design tokens**

All tokens live in `src/_tokens.css` under the `--gldn-` prefix and
form the single source of truth:

* *Proportions:* `--gldn-phi` (1.61803398875),
                 `--gldn-major` and `--gldn-minor`, derived exactly from
                 the first two cascade terms (1/phi + 1/phi^2 = 1)
* *Golden division cascade:* `--gldn-phi-1` through `--gldn-phi-10`,
  the percentages phi^-1 .. phi^-10, each term dividing the previous one
  by phi (the first two summing to exactly 100%)
* *Spacing:* `--gldn-space-xs` through `--gldn-space-2xl`, every step multiplying
  or dividing the base by phi, plus `--gldn-gutter`, the single gutter between
  golden split columns
* *Typography:* `--gldn-text-sm` through `--gldn-text-xl` on the same scale,
  with `--gldn-leading` set to phi for prose
* *Surfaces:* `--gldn-color-bg/surface/text/muted/primary/primary-hover/primary-fg/link/border`,
              `--gldn-radius-sm/md`,
              `--gldn-shadow`
* *Status colors:* `--gldn-color-info/success/warning/error`, each with `-fg`
  for text on the base color and `-surface` for a tinted background, in both themes
* *Interaction:* `--gldn-focus-ring`, `--gldn-z-popover`, `--gldn-z-dock`, and
  `--gldn-motion-duration` (in `ms` or `s`)
* *Dock:* `--gldn-dock-strip-height`, `--gldn-dock-panel-height`, `--gldn-dock-height`,
  `--gldn-dock-expanded-height`, and the measured `--gldn-dock-reserve`; narrow sheets use
  `--gldn-bp-sm` and controls meet `--gldn-touch-target`
* *Reference values:* `--gldn-bp-sm` (48rem) and `--gldn-bp-lg` (75rem);
  media query conditions cannot read custom properties,
  so `src/_responsive.css` repeats these literals

Override tokens on `:root` to re-theme globally without touching markup.
Scoped overrides work for leaf tokens (colors, shadow); derived tokens
(spacing, type, radii) resolve on `:root` and are inherited as computed
values, so a scoped `--gldn-space-base` change does not re-derive the scale.
Adding `class="gldn-theme-dark"` to `<html>` switches to the built-in dark theme.

**Layout primitives**

The utility layer (`src/_layout.css`) provides low-level golden proportions for
composing your own components:

* `gldn-container` centers content at a 75rem maximum width
* `gldn-row` / `gldn-stack` arrange children horizontally / vertically with golden gaps
* `gldn-center` centers a row or stack on both axes
* `gldn-visually-hidden` hides content visually without removing it from the accessibility tree
* `gldn-major` / `gldn-minor` split a row in the golden ratio: each basis is its
  golden percentage minus the column's golden share of the one gutter, so
  bases + gutter = exactly 100%, and the border-box basis never shrinks or
  redistributes. A row holds one major and one minor; retune its gutter via
  `--gldn-gutter`, never by setting `gap` directly
* `gldn-major-fluid` / `gldn-minor-fluid` divide available space by flex-grow weights phi and 1,
  keeping the ratio at any width
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
* `gldn-title-hero` display heading at the largest type step
* `gldn-title-1` section heading one golden step down
* `gldn-title-2` subsection heading, one more step down
* `gldn-title-3` small heading at the base type size, semibold
* `gldn-lede` section introduction at the larger type size, muted
* `gldn-text` body copy at the base type size, muted, readable measure
* `gldn-btn` primary-colored action surface for `<button>` and `<a>`
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

**Responsive behavior**

Below 48rem the responsive layer stacks `gldn-workspace`, `gldn-row`, and every
golden split into full-width columns with tighter gaps. The dock starts as a
one-line tab strip and opens panels as bottom sheets. At 75rem and above it grows
`--gldn-space-base` to 1.125rem so the entire spacing scale breathes on wide screens.

**Building and testing**

The build and tests are zero-dependency Node scripts. CSS is compiled and
JavaScript modules are copied without transformation:

```sh
node scripts/build.mjs        # rebuild dist/ and docs/ assets from src/
node test/contract.test.mjs   # run the source contract suite
node test/layout.test.mjs     # render the framework in headless Chrome and
                              # pin its golden layout promises (skips without Chrome)
```

The contract suite pins the file layout, cascade layer order, `gldn-` namespace
purity, golden token math, cross-file reference integrity, and that the
committed bundles and modules match `src/`. The layout suite uses computed styles
and browser layer data to assert zero horizontal overflow, both splits within 0.01%
of phi, wide content unable to disturb a split, full-width mobile stacking and
workspace filling, AA text contrast, native color schemes, dock and message lifecycle,
tab accessibility, and identical top-level cascade layers in `src/` and `dist/`.

## GitHub Pages

See the framework in action in the [gldn-css demo](https://musetronstar.github.io/gldn-css/).

