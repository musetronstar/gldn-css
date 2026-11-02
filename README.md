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
* **Minimal Bloat:** Built using pure CSS variables, Flexbox/Grid, and
  Cascade Layers (`@layer`) for predictable, conflict-free specificity.

## Features

* **The Golden Ratio Foundation:** Automatically divides sections into proportional
  major ($61.803\%$) and minor ($38.197\%$) sections that scale fluidly.
* **The `gldn-` Namespace:** Unique, collision-free custom properties and
  class prefixes designed to integrate seamlessly into projects.
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
│   └── gldn.css         # Main entry point declaring the layer order
├── dist/
│   └── gldn.min.css     # Production-ready compiled bundle
├── scripts/
│   └── build.mjs        # zero-dependency inliner and minifier
├── test/
│   ├── contract.test.mjs  # source-level contract suite
│   └── layout.test.mjs    # rendered layout regression suite (headless Chrome)
├── docs/
│   ├── index.html       # demo and GitHub Pages entry point
│   ├── gldn.js          # JavaScript examples used in conjunction with `index.html`
│   ├── gldn.min.css     # Generated copy of the production bundle
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

Open `docs/index.html` in a browser for a guided tour of every feature,
including live measurement of the rendered golden ratio.

**Cascade layers**

`src/gldn.css` declares the layer order `reset, tokens, layout, components,
responsive` and imports each partial; every partial assigns its own rules to
a layer, so `src/` and `dist/` build the same layer tree. Layer order is the
framework's specificity contract: responsive overrides always win without
`!important`, and unlayered author styles can still override everything.
The global reset rides in the first layer, physically hosted by
`_tokens.css`; host projects can override or discard it by layer without
touching the design tokens.

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

**Responsive behavior**

Below 48rem the responsive layer stacks `gldn-workspace`, `gldn-row`, and every
golden split into full-width columns with tighter gaps. At 75rem and above it
grows `--gldn-space-base` to 1.125rem so the entire spacing scale breathes
on wide screens.

**Building and testing**

The build and tests are zero-dependency Node scripts; the framework itself is
pure CSS:

```sh
node scripts/build.mjs        # rebuild dist/ and docs/ CSS bundles from src/
node test/contract.test.mjs   # run the source contract suite
node test/layout.test.mjs     # render the framework in headless Chrome and
                              # pin its golden layout promises (skips without Chrome)
```

The contract suite pins the file layout, cascade layer order, `gldn-` namespace
purity, golden token math, cross-file reference integrity, and that the
committed bundles match `src/`. The layout suite renders the example page at
phone through desktop widths (and enlarged root fonts), asserting zero
horizontal overflow, both splits within 0.01% of phi, wide content unable to
disturb a split, and full-width stacking below the breakpoint.

## GitHub Pages

See the framework in action in the [gldn-css demo](https://musetronstar.github.io/gldn-css/).

