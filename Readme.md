# Text Fragments — TypeScript implementation

This is an implementation of (most of) the [WICG’s Text Fragments draft specification: <https://wicg.github.io/scroll-to-text-fragment/>][spec].

It implements the spec line by line, in order to help serve as a reference implementation and to help test the specification. No attempt is made to e.g. increase efficiency.

A polyfill is provided to use text fragments in browsers and other HTML viewers that do not support this feature natively.

Try it out in the [playground][]!

[spec]: https://wicg.github.io/scroll-to-text-fragment/
[playground]: https://temp.treora.com/text-fragments-ts/demo.html


## Status

Although intended mainly to help test and improve the specification, it works and could be used in practice. However, as the spec is still a draft, expect this implementation to change too. Note that some corners of the spec are not yet fully implemented (search for `TODO` comments in the source code).

Note that no effort has been made to make this run in environments that do not support ES2017.


## Install

To use this implementation in your own code:

    npm install "git+https://code.treora.com/gerben/text-fragments-ts.git#semver:^0.1.0"

…or equivalent.

Every definition that has been implemented is exported to allow creating compatibility tests, your own polyfill, annotation tool, or other usage (please tell about your use case!). For the precise API, please look at the `export`s in the source code ([src/index.ts][]), and perhaps at how the polyfill ([src/polyfill.ts][]) uses them.

To use the polyfill, include the package’s `lib/polyfill.js` into a web page (or browser extension, …):

    <script src="path/to/text-fragments-ts/lib/polyfill.js" type="module"></script>

[src/index.ts]: src/index.ts
[src/polyfill.ts]: src/polyfill.ts
