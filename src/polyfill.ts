// A polyfill that makes the browser scroll to, and highlight, the Text Fragment given in the location’s fragment directive.
// See https://wicg.github.io/scroll-to-text-fragment/
// Based on the version of 12 August 2020. <https://raw.githubusercontent.com/WICG/scroll-to-text-fragment/60f5f63b4997bde7e688cacf897e1167c622e100/index.html>

// This implementation assumes the browser has already performed the normal procedures to identify and scroll to the fragment, without support for Text Fragments.

import {
    initializeDocumentFragmentDirective,
    indicatedPartOfTheDocument_beginning,
    scrollToTheFragment,
    FragmentDirective,
    browserSupportsTextFragments,
} from './index.js';

function run(): void {
    const { documentUrl, documentFragmentDirective } = initializeDocumentFragmentDirective(window.document) ?? {};
    if (documentUrl !== document.URL) {
        // We could change the location to hide the fragment directive from the fragment, as the spec prescribes; however this would also hide it from the user (and could trigger other event listeners).
        // document.location.replace(documentUrl);
    }

    if (documentFragmentDirective !== null) {
        const { documentIndicatedPart, ranges } = indicatedPartOfTheDocument_beginning({
            document,
            documentFragmentDirective,
            documentAllowTextFragmentDirective: true, // TEMP (TODO should be determined if possible)
        }) || undefined;

        if (documentIndicatedPart !== undefined) {
            scrollToTheFragment(documentIndicatedPart);
        }

        if (ranges !== undefined) {
            highlightRanges(ranges);
        }
    }
}

function pretendBrowserSupportsTextFragments(): void {
    const fragmentDirective: FragmentDirective = {};

    // Sneak in a note so one can discover whether the polyfill is used.
    Object.defineProperty(fragmentDirective, '_implementation', {
        value: 'text-fragments-ts',
        enumerable: false,
    });

    Object.defineProperty(window.location, 'fragmentDirective', {
        value: fragmentDirective,
        writable: false,
    });
}

// See § 3.6. Indicating The Text Match <https://wicg.github.io/scroll-to-text-fragment/#indicating-the-text-match>
// This implements a simple method to highlight the indicated ranges, without modifying the DOM: we use the window’s selection. This has the limitation that it disappears as soon as the user clicks anywhere; but the ability to dismiss it is a feature too; and it helps convey that the highlight is not part of the page itself.
// Note the spec urges against this approach: “the UA must not use the Document’s selection to indicate the text match as doing so could allow attack vectors for content exfiltration.”
// XXX How exactly could this be an attack vector?
function highlightRanges(ranges: Range[]): void {
    const selection = window.getSelection() as Selection; // should be non-null on top window.
    selection.removeAllRanges();
    for (const range of ranges) {
        selection.addRange(range);
    }
}

function install(): void {
    // Do nothing if the browser already supports (text) fragment directives.
    if (browserSupportsTextFragments())
        return;

    pretendBrowserSupportsTextFragments();

    // Run when the page is ready.
    window.addEventListener('load', run);
    // Could we somehow avoid activating in cases where the browser would retain scroll position, e.g. on page reload or history navigation?

    // Run whenever the location’s fragment identifier is changed.
    window.addEventListener('hashchange', run);
    // Could we somehow also detect it when the user navigates to exactly the same fragment again? (to mimic browser/Firefox’s behaviour when just pressing enter in the URL bar)
}

install();
