// A polyfill that makes the browser scroll to, and highlight, the Text Fragment given in the location’s fragment directive.
// See https://wicg.github.io/scroll-to-text-fragment/
// Based on the version of 12 August 2020. <https://raw.githubusercontent.com/WICG/scroll-to-text-fragment/60f5f63b4997bde7e688cacf897e1167c622e100/index.html>

// This implementation assumes the browser has already performed the normal procedures to identify and scroll to the fragment, without support for Text Fragments.

import {
    processAndConsumeFragmentDirective,
    indicatedPartOfTheDocument_beginning,
    scrollToTheFragment,
    FragmentDirective,
    browserSupportsTextFragments,
} from './index.js';

function run(): void {
    const { url, documentFragmentDirective } = processAndConsumeFragmentDirective(document.URL);
    if (url !== document.URL) {
        // We could change the location to hide the fragment directive from the fragment, as the spec prescribes; however this would also hide it from the user (and could trigger other event listeners).
        // document.location.replace(url);
    }
    applyFragmentDirective({ document, documentFragmentDirective });
}

function applyFragmentDirective({ document, documentFragmentDirective } : {
    document: Document,
    documentFragmentDirective: string | null,
}): void {
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

    Object.defineProperty(document, 'fragmentDirective', {
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

// Listen to link clicks, and activate the polyfill when a link points to a fragment within the same page.
function addLinkClickListeners() {
    const linkElements = [
        ...document.getElementsByTagName('a'),
        ...document.getElementsByTagName('area'),
    ]
    linkElements.forEach(element => {
        element.addEventListener('click', () => {
            if (element.href.split('#')[0] === document.URL.split('#')[0]) {
                const fragId = element.href.split('#')[1];
                if (fragId && fragId.includes(':~:')) {
                    const fragmentDirective = fragId.substring(fragId.indexOf(':~:') + 3);
                    applyFragmentDirective({
                        document,
                        documentFragmentDirective: fragmentDirective,
                    });
                }
            }
        });
    });
}

function install(): void {
    if (browserSupportsTextFragments()) {
        // Chromium’s implementation currently does not trigger when clicking links pointing to quotes within the same page. Use this as a workaround (listening to hashchange won’t help, as we cannot access the fragment directive).
        addLinkClickListeners();

        return;
    }

    pretendBrowserSupportsTextFragments();

    // Run when the page is ready.
    window.addEventListener('load', run);
    // Could we somehow avoid activating in cases where the browser would retain scroll position, e.g. on page reload or history navigation?

    // Run whenever the location’s fragment identifier is changed.
    window.addEventListener('hashchange', run);
    // Could we somehow also detect it when the user navigates to exactly the same fragment again? (to mimic browser/Firefox’s behaviour when just pressing enter in the URL bar)
}

install();

// A small tool to use from e.g. the browser console.
export function applyFragDir(fragmentDirective: string) {
    if (typeof fragmentDirective !== 'string' || !fragmentDirective.includes(':~:'))
        throw new TypeError('Expected a fragment directive string, e.g. ":~:text=bla&text=blub"');
    fragmentDirective = fragmentDirective.substring(fragmentDirective.indexOf(':~:') + 3);
    applyFragmentDirective({
        document,
        documentFragmentDirective: fragmentDirective,
    });
}
