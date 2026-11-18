# gldn-css - The Divine Proportional Semantic CSS System (DPS-CSS)

**gldn-css** is a lightweight, **CSS-first** framework for **semantic HTML** and
**composition**, guided by **golden-ratio** proportions. Its typography and composition
draw on Robert Bringhurst, Tim Brown's modular scales, Utopia, Every Layout,
CUBE CSS, Open Props, and Pico CSS.

Whereas Utility-First CSS frameworks run counter to **separation of concerns**
(separating presentation, markup and content), and purely semantic CSS classes
tend to *expand linearly* as the project grows, we are trying to strike a balance,
the best of both worlds in a beautiful and harmonious system:

* **Beautiful Math used Systematically:** Established on the Golden Ratio ($\phi \approx 1.61803$)
  to calculate proportional scaling and layout proportions: major ($61.803\%$) and minor
  ($38.197\%$) columns, and type and space scales that grow fluidly with the viewport.
* **Semantically Rich Names:** HTML stays clean, readable, and meaningful using
  descriptive semantic classes prefixed with `gldn-`. Plain semantic HTML needs no
  classes at all.
* **Minimal Bloat:** Built using CSS variables, Flexbox/Grid, and
  Cascade Layers (`@layer`) for predictable, conflict-free specificity.
  Optional zero-dependency JavaScript modules supply behavior CSS cannot express.

See it in action in the [gldn-css demo](https://musetronstar.github.io/gldn-css/).

## Philosophy & Lineage

**gldn-css** is built from small parts that each do one thing and compose without
dictating markup. It draws inspiration and learns from the following seven works
but copies none of them:

|    Source    |       Lesson        |                        In gldn-css                        |
| ------------ | ------------------- | --------------------------------------------------------- |
| Bringhurst   | measure and rhythm  | φ leading, a `100ch / φ` measure, no space at panel edges |
| Tim Brown    | one ratio, one base | type, space, radii and lines are the base times φ^n       |
| Utopia       | fluid type, space   | one `clamp()` base from a 20rem to a 75rem viewport       |
| Every Layout | intrinsic layout    | splits, stack, cluster, grid, switcher and frame          |
| CUBE CSS     | styles by intent    | five layers, from reset to responsive                     |
| Open Props   | tokens used alone   | `--gldn-*` tokens, also alone in `gldn-tokens.min.css`    |
| Pico CSS     | plain HTML composed | the reset styles prose, code, tables and forms            |

### Sources

* Robert Bringhurst, [*The Elements of Typographic Style*][bringhurst], 4th ed.
  (Hartley & Marks, 2012).
* Tim Brown, ["More Meaningful Typography"][brown], *A List Apart*, no. 327, May 3, 2011.
* James Gilyead and Trys Mudford, [*Utopia*][utopia] (Clearleft).
* Heydon Pickering and Andy Bell, [*Every Layout*][every-layout].
* Andy Bell, [*CUBE CSS*][cube] (Composition Utility Block Exception).
* Adam Argyle, [*Open Props*][open-props].
* Lucas Larroche, [*Pico CSS*][pico].

[bringhurst]: https://en.wikipedia.org/wiki/The_Elements_of_Typographic_Style
[brown]: https://alistapart.com/article/more-meaningful-typography/
[utopia]: https://utopia.fyi/
[every-layout]: https://every-layout.dev/
[cube]: https://cube.fyi/
[open-props]: https://open-props.style/
[pico]: https://picocss.com/

## Quick start

Link the compiled bundle and write semantic markup; the golden math stays in CSS:

```html
<link rel="stylesheet" href="dist/gldn.min.css">

<div class="gldn-workspace">
	<aside class="gldn-sidebar">minor column, 38.197%</aside>
	<main class="gldn-main">major column, 61.803%</main>
</div>
```

To use the tokens with your own rules, link only the tokens bundle. It sets the
`--gldn-*` custom properties and styles no element:

```html
<link rel="stylesheet" href="dist/gldn-tokens.min.css">

<style>
	article { padding: var(--gldn-space-lg); font-size: var(--gldn-text-md); }
</style>
```

* **Color schemes:** a page follows the system scheme. `class="gldn-theme-dark"` or
  `class="gldn-theme-light"` on `<html>` fixes it, and `gldn-theme.js` offers the choice.
* **Fonts:** the default stacks use fonts shipped with macOS, Windows, and Linux. To use
  the bundled Inter, Literata, and JetBrains Mono variable fonts, link `gldn-fonts.css`
  after the bundle; nothing downloads until you do. `docs/fonts.html` compares them.
* **Re-theming:** override any `--gldn-*` token on `:root`.

Open `docs/index.html` for a guided tour of the scales, plain HTML in both schemes, and
live measurement of the rendered golden ratio. It links a working example page for each
component under `docs/components/`.

## What's included

gldn-css practices Documentation as Code: each part is documented where it is defined,
the stylesheets in [KSS](https://github.com/kss-node/kss/blob/spec/SPEC.md) comment
blocks and the modules in JSDoc.

* **Reset** (`src/_reset.css`): plain HTML on the golden scale. Headings, prose, lists,
  code, tables, forms, dialogs, and states such as `aria-current`, `aria-selected`,
  `aria-invalid` and `aria-busy`, each with a cue beside color. See `docs/semantic.html`.
* **Tokens** (`src/_tokens.css`): the golden ratio, its division cascade, the fluid
  base, the space and type scales, colors in light and dark, and thresholds. Scopes
  (`gldn-scope`, `gldn-compact`, `gldn-spacious`) re-derive the scales for a subtree.
* **Layout primitives** (`src/_layout.css`): container, row, stack, cluster, grid,
  switcher, sided, frame, and the golden split, none of which needs a breakpoint, and
  `gldn-context`, which lets components inside it adapt to its width.
* **Components** (`src/_components.css`): workspace, card, header and footer, hero,
  titles, buttons, alerts, field, search, tree, results, chips, pagination, panel,
  metadata, drop zone, application shell, dock, tabs, messages, media, and timeline.
* **Responsive rules** (`src/_responsive.css`): 44px targets on coarse pointers, and
  folds and tighter padding on small screens.
* **Modules** (`src/gldn-*.js`): optional, zero-dependency ES modules. Each takes the
  element it enhances, reports what the reader asked for through a callback or a
  `gldn-*` event, and leaves requests, storage, and routing to the application. The
  markup works without them.
  * `gldn-dialog.js`: a native modal dialog's focus and backdrop
  * `gldn-popover.js`: a native popover placed beside its opener
  * `gldn-roving.js`: one Tab stop and arrow keys for a listbox, menu, or tree
  * `gldn-form.js`: field messages and a busy state for a deliberate submit
  * `gldn-files.js`: a file drop zone and its pending list
  * `gldn-theme.js`: a system, light, or dark choice
  * `gldn-keys.js`: keyboard shortcuts and their hints
  * `gldn-media.js`: cues, pages, and annotation for timed or paged media
  * `gldn-tabs.js`, `gldn-messages.js`, `gldn-dock.js`: the bottom dock, its tabs, and
    its message log

`src/gldn.css` declares the layer order `reset, tokens, layout, components, responsive`,
so later layers win without `!important`, and unlayered page styles override them all.

## Files

```text
src/       the stylesheets, the opt-in font sheet and fonts, and the modules
dist/      the built bundles, font assets, and modules, for linking
docs/      the tour, the component examples, and their copies of dist/ (GitHub Pages)
scripts/   build.mjs, the zero-dependency builder
test/      the contract suite and the rendered suites
```

## Building and testing

The build and tests are zero-dependency Node scripts; the rendered suites need Chrome:

```sh
node scripts/build.mjs        # rebuild dist/ and docs/ from src/
node test/contract.test.mjs   # the source contract, including documentation coverage
node test/layout.test.mjs     # the rendered suites in headless Chrome
```

With `GLDN_QUOTE_SOURCES` set to plain-text copies of the quoted works, the contract
suite also checks that every quotation in the examples appears in them verbatim.
[CONTRIBUTING.md](CONTRIBUTING.md) describes its Documentation as Code conventions.

## License and credits

gldn-css is dedicated to the public domain under CC0 (see `LICENSE`).

* The examples quote Vannevar Bush, "As We May Think" (*The Atlantic Monthly*, July
  1945), verbatim and with attribution, in `<q cite>` and `<blockquote cite>`. The
  quotations remain their author's work; the CC0 dedication does not cover them.
* The bundled fonts are Latin subsets of SIL Open Font License fonts;
  `src/fonts/LICENSE.txt` holds their notices, sources, and the license.
* The hero artwork, `docs/fibonacci-spiral.svg`, is by nbpetersen via OpenClipart, in
  the public domain: <https://freesvg.org/fibonacci-spiral>.
