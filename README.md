# gldn-css - The Divine Proportional Semantic CSS System (DPS-CSS)

**gldn-css** is a lightweight **Utility-First CSS** framework with a **Semantic Composition** established by **Golden Ratio** principles.

Whereas other Utility-First CSS frameworks run counter to **separation of concerns** (separating presentation, markup and content),
and purely semantic CSS classes tend to *expand linearly* as the project grows, we are trying to strike a balance, the best of both worlds
in a beautiful and harmonious system:

* **Beautiful Math used Systematically:** Established on the Golden Ratio ($\phi \approx 1.61803$) to calculate proportional scaling and layout proportions
* **Semantically Rich Names:** HTML stays clean, readable, and meaningful using descriptive semantic classes prefixed with `gldn-`.
* **Minimal Bloat:** Built using pure CSS variables, Flexbox/Grid, and Cascade Layers (`@layer`) for predictable, conflict-free specificity.

## Features

* **The Golden Ratio Foundation:** Automatically divides sections into proportional major ($61.803\%$) and minor ($38.197\%$) sections that scale fluidly.
* **The `gldn-` Namespace:** Unique, collision-free custom properties and class prefixes designed to integrate seamlessly into projects.
* **Cascade Layers (`@layer`):** Strict separation of tokens, layout primitives, semantic classes, and responsive overrides for *conflict-free specificity*.
* **Fluid Adaptability & Reflow:** Layouts dynamically recalculate on resize and reflow seamlessly from side-by-side desktop viewports to stacked mobile layouts.

## Architecture

```text
gldn-css/
├── src/
│   ├── _tokens.css      # --gldn-phi constant and spacing scales
│   ├── _layout.css      # Global layout wrappers and flex/grid primitives
│   ├── _components.css  # Semantic component classes (.gldn-sidebar, etc.)
│   ├── _responsive.css  # @layer responsive media queries
│   └── gldn.css         # Main entry point importing all layers
├── dist/
│   └── gldn.min.css     # Production-ready compiled bundle
├── examples/
│   ├── gldn.html        # tour of features suitable for reuse
│   └── gldn.js          # JavaScript examples used in conjunction with `gldn.html`
└── README.md
```

