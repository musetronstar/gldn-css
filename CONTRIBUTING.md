# Contributing to gldn-css

## Documentation as Code

gldn-css practices Documentation as Code: the code is documented where it is written, in
the same commits, and checked by the same tests. The stylesheets carry their reference as
KSS comment blocks, the modules carry JSDoc, and the README introduces the project. The
build strips comments from the CSS bundles, so documentation costs a page nothing.

## Describe what is

* Write documentation in the present tense, describing what the code does now. Leave out
  history, changelogs, and "now", "previously" or "no longer"; git history holds them.
* When behavior changes, rewrite the comment that describes it in the same commit.
* Keep test-run observations and implementation accounts out of documentation.
* Write a description in the third person present: "Splits a row in the golden ratio."

## Stylesheets: KSS

Every public class, token, and reset rule group has a
[KSS](https://github.com/kss-node/kss/blob/spec/SPEC.md) block before its rules:

```css
/*
Button

The primary action, for a <button> or an <a>. A variant changes only colors.

.gldn-btn-secondary - The surface and the control boundary.
:disabled           - Fades.

Markup: <button class="gldn-btn {{modifier_class}}" type="button">Save</button>

Example: docs/components/controls.html

Styleguide Components.Button
*/
```

* The first line is the title; the description follows after a blank line.
* Modifier lines name a class, a state, or an attribute, then ` - ` and its meaning. In
  the tokens layer, a token line names each custom property the same way.
* `Markup:` shows the smallest useful HTML. `Example:` names the page under `docs/` that
  shows the component working.
* The last line, `Styleguide <Section>.<Title>`, places the block: `Reset`, `Tokens`,
  `Layout`, `Components`, or `Responsive`.
* Plain `/* */` comments explain a rule's reasoning, such as an invariant or a browser
  constraint, where the KSS block does not.

## Modules: JSDoc

* Each module opens with a block comment that says what it does and which pattern, such
  as a WAI-ARIA pattern, it follows.
* Every export has a JSDoc block with `@param` for each parameter and its options,
  `@returns` for any result, `@throws` for each error, and `@fires` for each `gldn-*`
  event. A function that connects an element has an `@example`, and a `@typedef`
  describes the controller it returns and its methods.
* A private function has a comment when it carries a contract the reader cannot see at
  the call site. Self-evident helpers need none.
* Comments stay in `dist/` and `docs/`, since the modules are copied unchanged.

## README

The README introduces gldn-css to someone trying it for the first time: what it is, its
lineage, a quick start, what is included and where it is documented, the files, building
and testing, and the license. Reference material belongs in the code.

## Tests

`node test/contract.test.mjs` holds Documentation as Code to the same standard as the code:

* every KSS block has a title, a description, and a unique `Styleguide` reference; its
  `Example:` page exists, and a component's page shows the component;
* every `gldn-` class is documented in a KSS block, and every token has a token line;
* every module opens with a description, and every export has JSDoc with its
  parameters, result, and events;
* README lines fit in 100 columns.

Run `node scripts/build.mjs` before the tests, and `node test/layout.test.mjs` for the
rendered suites.
