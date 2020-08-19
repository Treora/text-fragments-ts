  //////////////////////
 /// Text Fragments ///
//////////////////////

// An implementation of (most of) the Text Fragments draft spec.
// See https://wicg.github.io/scroll-to-text-fragment/
// Based on the version of 13 August 2020. <https://raw.githubusercontent.com/WICG/scroll-to-text-fragment/2dcfbd6e272f51e5b250c58076b6d1cc57656fce/index.html>

// Some terms used in the spec (would be great if these could be expressed more precisely in TypeScript)
type nonEmptyString = string;
type nonNegativeInteger = number;
type count = number; // same as nonNegativeInteger?
type integer = number; // XXX each use in the spec looks like it should be a nonnegative integer.


// § 3.3.1. Parsing the fragment directive

// https://wicg.github.io/scroll-to-text-fragment/#fragment-directive-delimiter
// “The fragment directive delimiter is the string ":~:", that is the three consecutive code points U+003A (:), U+007E (~), U+003A (:).”
const fragmentDirectiveDelimiter = ':~:';

// The function below implements most of the specified amendment to the ‘create and initialize a Document object’ steps. It applies the newly introduced steps on an ‘unmodified’ document. Instead of actually setting the document’s URL and fragment directive, it returns the values they should have obtained.
// XXX Should the new procedure really “replace steps 7 and 8”? Which version of the HTML spec was this written for? In the version of 6 August 2020, steps 4, 5 and 9 seem more related.
export function initializeDocumentFragmentDirective(document: Document): { documentUrl: string, documentFragmentDirective: string | null } {
    // We mock the document’s URL and the document’s fragment directive using plain variables.
    // As far as I can tell, we cannot access the document’s URL directly — only this serialised version (see <https://dom.spec.whatwg.org/#dom-document-url> as of 29 June 2020).
    let documentUrl: string = document.URL;
    // “Each document has an associated fragment directive which is either null or an ASCII string holding data used by the UA to process the resource. It is initially null.”
    let documentFragmentDirective: string | null = null;

    // 7. “Let url be null”
    let url: string | null = null;

    // XXX What is the idea of the new steps 8 and 9? These could at least use an explanatory note:
    // 8. “If request is non-null, then set document’s URL to request’s current URL.”
    // XXX should this perhaps be “url” instead of “document’s URL”? Otherwise we ignore the fragment directive completely.
    // 9. “Otherwise, set url to response’s URL.”
    // XXX should be “navigationParams's response”? Also, note its URL could be null.
    // In any case, we deviate from the spec in these steps, to allow testing this implementation without access to the request and response. We just take the document’s URL instead.
    url = documentUrl;

    // 10. “Let raw fragment be equal to url’s fragment.”
    // (as we only have access to the serialised URL, we extract the fragment again)
    const rawFragment = url.split('#')[1] ?? null;

    // XXX The spec seems to neglect that a URL’s fragment can be null (or is it somehow guaranteed to be non-null?). If it is null, I suppose we should skip the subsequent steps.
    if (rawFragment !== null) {

        // (a sane implementation would simply use rawFragment.indexOf(…) or rawFragment.split(…) instead the steps below)
        // 11. “Let fragmentDirectivePosition be an integer initialized to 0.”
        let fragmentDirectivePosition = 0;

        // 12. “While the substring of raw fragment starting at position fragmentDirectivePosition does not begin with the fragment directive delimiter and fragmentDirectivePosition does not point past the end of raw fragment:”
        while (
            !rawFragment.substring(fragmentDirectivePosition).startsWith(fragmentDirectiveDelimiter)
            && !(fragmentDirectivePosition >= rawFragment.length)
        ) {
            // 1. “Increment fragmentDirectivePosition by 1.”
            fragmentDirectivePosition += 1;
        }

        // 13. “If fragmentDirectivePosition does not point past the end of raw fragment:”
        if (!(fragmentDirectivePosition >= rawFragment.length)) {
            // 1. “Let fragment be the substring of raw fragment starting at 0 of count fragmentDirectivePosition.”
            const fragment = rawFragment.substring(0, 0 + fragmentDirectivePosition);
            // 2. “Advance fragmentDirectivePosition by the length of fragment directive delimiter.”
            fragmentDirectivePosition += fragmentDirectiveDelimiter.length;
            // 3. “Let fragment directive be the substring of raw fragment starting at fragmentDirectivePosition.”
            const fragmentDirective = rawFragment.substring(fragmentDirectivePosition);
            // 4. “Set url’s fragment to fragment.”
            // (as we only have access to the serialised URL, we manually replace its fragment part)
            url = url.split('#')[0] + (fragment !== null) ? '#' + fragment : '';
            // 5. “Set document’s fragment directive to fragment directive. (Note: this is stored on the document but not web-exposed)”
            documentFragmentDirective = fragmentDirective;
        }

    }

    // 14. “Set document’s URL to be url.”
    documentUrl = url;

    // For testing/trying purposes, we return what should now be the document’s URL and fragment directive.
    return { documentUrl, documentFragmentDirective };
}

// https://wicg.github.io/scroll-to-text-fragment/#parse-a-text-directive
// “To parse a text directive, on a string textDirectiveString, run these steps:”
function parseTextDirective(textDirectiveInput: TextDirective): ParsedTextDirective | null { // XXX The spec writes “textDirectiveString” here, but probably meant “text directive input”.
    // 1. “Assert: textDirectiveString matches the production TextDirective.” XXX again, this should be “text directive input” (Note the 'TextDirective' subtype of string is intended to express this assertion)
    // assert(isTextFragmentDirective(textDirectiveInput));

    // 2. “Let textDirectiveString be the substring of text directive input starting at index 5.”
    const textDirectiveString = textDirectiveInput.substring(5);

    // 3. “Let tokens be a list of strings that is the result of splitting textDirectiveString on commas.”
    const tokens = textDirectiveString.split(',');

    // 4. “If tokens has size less than 1 or greater than 4, return null.”
    if (tokens.length < 1 || tokens.length > 4)
        return null;

    // 5. “If any of tokens’s items are the empty string, return null.”
    if (tokens.some(token => token === ''))
        return null;

    // 6. “Let retVal be a ParsedTextDirective with each of its items initialized to null.”
    const retVal: Partial<ParsedTextDirective> = {
        // XXX Initialising textStart to null would conflict with the type definition; hence using Partial<…> instead. Is this temporary type mismatch acceptable in the spec?
        textEnd: null,
        prefix: null,
        suffix: null,
    };

    // 7. “Let potential prefix be the first item of tokens.”
    const potentialPrefix = tokens[0];

    // 8. “If the last character of potential prefix is U+002D (-), then:”
    if (potentialPrefix.endsWith('-')) {
        // 1. “Set retVal’s prefix to the result of removing the last character from potential prefix.
        retVal.prefix = decodeURIComponent(potentialPrefix.substring(0, potentialPrefix.length - 1)); // XXX spec forgets “…the percent-decoding of…”
        // 2. “Remove the first item of the list tokens.”
        tokens.shift();
    }

    // 9. “Let potential suffix be the last item of tokens, if one exists, null otherwise.”
    const potentialSuffix = tokens[tokens.length - 1] ?? null;

    // 10. “If potential suffix is non-null and its first character is U+002D (-), then:”
    if (potentialSuffix !== null && potentialSuffix.startsWith('-')) {
        // 1. “Set retVal’s suffix to the result of removing the first character from potential suffix.”
        retVal.suffix = decodeURIComponent(potentialSuffix.substring(1)); // XXX spec forgets “…the percent-decoding of…”
        // 2. “Remove the last item of the list tokens.”
        tokens.pop();
    }

    // 11. “If tokens has size not equal to 1 nor 2 then return null.”
    if (tokens.length !== 1 && tokens.length !== 2)
        return null;

    // 12. “Set retVal’s textStart be the first item of tokens.”
    retVal.textStart = decodeURIComponent(tokens[0]); // XXX spec forgets “…the percent-decoding of…”

    // 13. “If tokens has size 2, then set retVal’s textEnd be the last item of tokens.”
    if (tokens.length === 2)
        retVal.textEnd = decodeURIComponent(tokens[tokens.length - 1]); // XXX spec forgets “…the percent-decoding of…”

    // 14. “Return retVal.”
    return retVal as ParsedTextDirective;
}

// https://wicg.github.io/scroll-to-text-fragment/#parsedtextdirective
// “A ParsedTextDirective is a struct that consists of four strings: textStart, textEnd, prefix, and suffix. textStart is required to be non-null. The other three items may be set to null, indicating they weren’t provided. The empty string is not a valid value for any of these items.”
interface ParsedTextDirective {
    textStart: nonEmptyString;
    textEnd: nonEmptyString | null;
    prefix: nonEmptyString | null;
    suffix: nonEmptyString | null;
};


// § 3.3.2. Fragment directive grammar

// https://wicg.github.io/scroll-to-text-fragment/#valid-fragment-directive
// “A valid fragment directive is a sequence of characters that appears in the fragment directive that matches the production:”
type ValidFragmentDirective = string;  // could be `unique string`, when (if) TypeScript will support that.
function isValidFragmentDirective(input: string | null): input is ValidFragmentDirective {
    // TODO (use PEG.js?)
    return true; // TEMP
}

// https://wicg.github.io/scroll-to-text-fragment/#text-fragment-directive
// “The text fragment directive is one such fragment directive that enables specifying a piece of text on the page, that matches the production:”
type TextDirective = string; // could be `unique string`, when (if) TypeScript will support that.

function isTextFragmentDirective(input: string): input is TextDirective {
    // TODO (use PEG.js?)
    return input.startsWith('text='); // TEMP
}


// § 3.4. Security and Privacy


// § 3.4.4 Restricting the Text Fragment

// https://wicg.github.io/scroll-to-text-fragment/#should-allow-a-text-fragment
// “To determine whether a navigation should allow a text fragment, given as input a boolean is user triggered, an origin incumbentNavigationOrigin, and Document document; follow these steps:”
export function shouldAllowTextFragment(isUserTriggered: boolean, incumbentNavigationOrigin: origin | null, document: Document): boolean {
    // 1. “If incumbentNavigationOrigin is null, return true.”
    // XXX This implies null is a potential value of the parameter (is this implicitly allowed in web specs?). (note that an opaque origin is serialised to null, but that is presumably not the situation meant here)
    if (incumbentNavigationOrigin === null)
        return true;

    // 2. “If is user triggered is false, return false.”
    if (isUserTriggered === false)
        return false;

    // 3. “If the document of the latest entry in document’s browsing context's session history is equal to document, return false.”
    // 4. “If incumbentNavigationOrigin is equal to the origin of document return true.”
    // 5. “If document’s browsing context is a top-level browsing context and its group’s browsing context set has length 1 return true.”
    // NOT IMPLEMENTED. Implementing these steps would require reproducing a bunch of browser internals. Probably not worthwhile.

    // 6. “Otherwise, return false.”
    return false;
}

// https://wicg.github.io/scroll-to-text-fragment/#allowtextfragmentdirective
// “To set the allowTextFragmentDirective flag, follow these steps:”
// XXX Is this line supposed to be there? Looks like it may have left by accident while changing the approach.

// “Amend the page load processing model for HTML files to insert these steps after step 1:
//     2. “Let is user activated be true if the current navigation was initiated from a window that had a transient activation at the time the navigation was initiated.”
//     3. “Set document’s allowTextFragmentDirective flag to the result of running should allow a text fragment with is user activated, incumbentNavigationOrigin, and the document.”
// Amend the try to scroll to the fragment steps by replacing the steps of the task queued in step 2:
//     1. “If document has no parser, or its parser has stopped parsing, or the user agent has reason to believe the user is no longer interested in scrolling to the fragment, then clear document’s allowTextFragmentDirective flag and abort these steps.”
//     2. “Scroll to the fragment given in document’s URL. If this does not find an indicated part of the document, then try to scroll to the fragment for document.”
//     3. “Clear document’s allowTextFragmentDirective flag””

// NOT IMPLEMENTED. Implementing these amendments would require reproducing a bunch of browser internals. Not deemed worthwhile here.


// § 3.5. Navigating to a Text Fragment

// https://wicg.github.io/scroll-to-text-fragment/#navigating-to-text-fragment
// This implements the amended version of step 3 of the HTML spec’s “scroll to the fragment” steps: <https://html.spec.whatwg.org/multipage/browsing-the-web.html#scroll-to-the-fragment-identifier>
export function scrollToTheFragment(indicatedPart: [Element, Range | null]): void {
    // (note that step 1 and 2 are irrelevant if the indicated part is an Element/Range, which we require here)

    // “Replace step 3.1 of the scroll to the fragment algorithm with the following:”

    // 3. “Otherwise:”
    // XXX this line above seems superfluous (and possibly confusing).

    // 1. (new) “Let target, range be the element and range that is the indicated part of the document.”
    const [target, range] = indicatedPart;

    // 2. (from original) “Set the Document's target element to target.”
    // TODO Perhaps we could fake this by applying any stylesheet rules for :target to target?

    // “Replace step 3.3 of the scroll to the fragment algorithm with the following:”

    // 3. (new) “Get the policy value for force-load-at-top in the Document. If the result is true, abort these steps.”
    // TODO (but this would require access to HTTP headers)

    // 4. (new) “If range is non-null:”
    if (range !== null) {
        // 1. “If the UA supports scrolling of text fragments on navigation, invoke Scroll range into view, with containingElement target, behavior set to "auto", block set to "center", and inline set to "nearest".”
        // XXX …and “with range range”?
        scrollRangeIntoView(range, target, { behavior: 'auto', block: 'center', inline: 'nearest' });
    }

    // 5. (new) “Otherwise:”
    else {
        // 1. (equals original step 3.3) “Scroll target into view, with behavior set to "auto", block set to "start", and inline set to "nearest".”
        scrollElementIntoView(target, 'auto', 'start', 'nearest');
    }
}

// “Add the following steps to the beginning of the processing model for the indicated part of the document:”
// This function only implements the newly introduced steps. To help testing it out, its required inputs have to be passed as arguments, and the resulting indicated part (if any), is returned, along with the list of ranges (if any).
export function indicatedPartOfTheDocument_beginning(
    { document, documentFragmentDirective, documentAllowTextFragmentDirective }:
    { document: Document, documentFragmentDirective: string | null, documentAllowTextFragmentDirective: boolean }
): { documentIndicatedPart: [Element, Range] | undefined, ranges?: Range[] } {
    let documentIndicatedPart: [Element, Range] | undefined = undefined;

    // 1. “Let fragment directive string be the document’s fragment directive.”
    const fragmentDirectiveString = documentFragmentDirective;

    // 2. “If the document’s allowTextFragmentDirective flag is true then:”
    if (documentAllowTextFragmentDirective === true) {

        // 1. “Let ranges be a list that is the result of running the process a fragment directive steps with fragment directive string and the document.”
        let ranges = processFragmentDirective(fragmentDirectiveString, document);

        // 2. “If ranges is non-empty, then:”
        if (ranges.length > 0) {

            // 1. “Let range be the first item of ranges.”
            const range = ranges[0];

            // 2. “Let node be the first common ancestor of range’s start node and start node.”
            // XXX This looks silly. Was “start node and end node” meant here?
            let node = firstCommonAncestor(range.startContainer, range.startContainer);

            // 3. “While node is not an element, set node to node’s parent.”
            // XXX Could loop forever! Or is it guaranteed that node has an element as ancestor? This may be a valid but fragile assumption.
            while (!isElement(node))
                node = node.parentNode as Node;

            // 4. “The indicated part of the document is node and range; return.”
            documentIndicatedPart = [node, range];
            // return;
            return { documentIndicatedPart, ranges }; // To allow testing it out.
        }
    }

    return { documentIndicatedPart };
}

// https://wicg.github.io/scroll-to-text-fragment/#first-common-ancestor
// To find the first common ancestor of two nodes nodeA and nodeB, follow these steps:
function firstCommonAncestor(nodeA: Node, nodeB: Node): Node | never {
    // 1. “Let commonAncestor be nodeA.”
    let commonAncestor = nodeA;

    // 2. “While commonAncestor is not a shadow-including inclusive ancestor of nodeB, let commonAncestor be commonAncestor’s shadow-including parent.”
    // XXX If the nodes are not part of the same tree, this becomes an infinite loop! Should be “While commonAncestor is not null and …”
    while (!isShadowIncludingInclusiveAncestor(commonAncestor, /* of */ nodeB))
        commonAncestor = shadowIncludingParent(commonAncestor) as Node;

    // 3. “Return commonAncestor.”
    return commonAncestor;
}

// To find the shadow-including parent of node follow these steps:
function shadowIncludingParent(node: Node): Node | null {
    // 1. “If node is a shadow root, return node’s host.”
    if (node instanceof ShadowRoot)
        return node.host;

    // 2. “Otherwise, return node’s parent.”
    return node.parentNode;
}


// § 3.5.1. Scroll a DOMRect into view

// https://wicg.github.io/scroll-to-text-fragment/#scroll-a-domrect-into-view
// “Move the scroll an element into view algorithm’s steps 3-14 into a new algorithm scroll a DOMRect into view, with input DOMRect bounding box, ScrollIntoViewOptions dictionary options, and element startingElement.”
// “Also move the recursive behavior described at the top of the scroll an element into view algorithm to the scroll a DOMRect into view algorithm: "run these steps for each ancestor element or viewport of startingElement that establishes a scrolling box scrolling box, in order of innermost to outermost scrolling box".”
function scrollDomRectIntoView(boundingBox: DOMRect, options: ScrollIntoViewOptions, startingElement: Element): void {
    // TODO Create/borrow a complete implementation.
    // TEMP assume the window is the only scrolling box, block=vertical and inline=horizontal, …
    function applyScrollLogicalPosition({
        position,
        boundingBoxRelativeEdgeBegin,
        boundingBoxRelativeEdgeEnd,
        boundingBoxSize,
        scrollBoxAbsoluteEdgeBegin,
        scrollBoxSize,
    }: {
        position: ScrollLogicalPosition,
        boundingBoxRelativeEdgeBegin: number,
        boundingBoxRelativeEdgeEnd: number,
        boundingBoxSize: number,
        scrollBoxAbsoluteEdgeBegin: number,
        scrollBoxSize: number,
    }): number | undefined {
        const boundingBoxAbsoluteEdgeBegin = scrollBoxAbsoluteEdgeBegin + boundingBoxRelativeEdgeBegin;
        const boundingBoxAbsoluteEdgeEnd = boundingBoxAbsoluteEdgeBegin + boundingBoxSize;
        boundingBoxRelativeEdgeEnd -= scrollBoxSize; // measure relative to scroll box’s end, not start.
        switch (position) {
            case 'start':
                return boundingBoxAbsoluteEdgeBegin;
            case 'end':
                return boundingBoxAbsoluteEdgeEnd - scrollBoxSize;
            case 'center':
                return boundingBoxAbsoluteEdgeBegin + boundingBoxSize / 2 - scrollBoxSize / 2;
            case 'nearest':
                const fitsInView = boundingBoxSize < scrollBoxSize; // XXX CSSWG spec seems to forget the case in which the sizes are equal. Here we interpret “greater than” as “greater than or equal to”.
                if (boundingBoxRelativeEdgeBegin < 0 && boundingBoxRelativeEdgeEnd > 0)
                    return undefined;
                else if (boundingBoxRelativeEdgeBegin < 0 && fitsInView || boundingBoxRelativeEdgeEnd > 0 && !fitsInView)
                    return boundingBoxAbsoluteEdgeBegin;
                else if (boundingBoxRelativeEdgeBegin < 0 && !fitsInView || boundingBoxRelativeEdgeEnd > 0 && fitsInView)
                    return boundingBoxAbsoluteEdgeEnd - scrollBoxSize;
        }
        return undefined;
    }
    const top = applyScrollLogicalPosition({
        position: options.block ?? 'start', // presuming same default as for Element.scrollIntoView
        boundingBoxRelativeEdgeBegin: boundingBox.top,
        boundingBoxRelativeEdgeEnd: boundingBox.bottom,
        scrollBoxAbsoluteEdgeBegin: window.scrollY,
        boundingBoxSize: boundingBox.height,
        scrollBoxSize: document.documentElement.clientHeight,
    });
    const left = applyScrollLogicalPosition({
        position: options.inline ?? 'nearest', // presuming same default as for Element.scrollIntoView
        boundingBoxRelativeEdgeBegin: boundingBox.left,
        boundingBoxRelativeEdgeEnd: boundingBox.right,
        boundingBoxSize: boundingBox.width,
        scrollBoxAbsoluteEdgeBegin: window.scrollX,
        scrollBoxSize: document.documentElement.clientWidth,
    });
    window.scroll({ top, left, behavior: options.behavior });
}

// “Replace steps 3-14 of the scroll an element into view algorithm with a call to scroll a DOMRect into view:”
// (note the recursive behaviour is already removed due to the lines above)
// Basing on the <https://drafts.csswg.org/cssom-view-1/#scroll-an-element-into-view> version of 20 February 2020
function scrollElementIntoView(element: Element, behavior: ScrollBehavior, block: ScrollLogicalPosition, inline: ScrollLogicalPosition) {
    // 1. (from original) “If the Document associated with element is not same origin with the Document associated with the element or viewport associated with box, terminate these steps.”
    // TODO (if this makes sense here at all?)

    // 2. (from original) “Let element bounding border box be the box that the return value of invoking getBoundingClientRect() on element represents.”
    const elementBoundingBorderBox = element.getBoundingClientRect();

    // 3. (new) “Perform scroll a DOMRect into view given element bounding border box, options and element.”
    // XXX There is no “options” defined; presumably that should be { behavior, block, inline }.
    scrollDomRectIntoView(elementBoundingBorderBox, { behavior, block, inline }, element);
}

// https://wicg.github.io/scroll-to-text-fragment/#scroll-a-range-into-view
// “Define a new algorithm scroll a Range into view, with input range range, element containingElement, and a ScrollIntoViewOptions dictionary options:”
function scrollRangeIntoView(range: Range, containingElement: Element, options: ScrollIntoViewOptions): void {
    // 1. “Let bounding rect be the DOMRect that is the return value of invoking getBoundingClientRect() on range.”
    const boundingRect = range.getBoundingClientRect();

    // 2. “Perform scroll a DOMRect into view given bounding rect, options, and containingElement.”
    scrollDomRectIntoView(boundingRect, options, containingElement);
}


// § 3.5.2 Finding Ranges in a Document

// https://wicg.github.io/scroll-to-text-fragment/#process-a-fragment-directive
export function processFragmentDirective(fragmentDirectiveInput: string | null, document: Document): Range[] {
    // 1. “If fragment directive input is not a valid fragment directive, then return an empty list.”
    if (!isValidFragmentDirective(fragmentDirectiveInput)) {
        return [];
    }

    // 2. “Let directives be a list of strings that is the result of strictly splitting the string fragment directive input on "&".”
    const directives = fragmentDirectiveInput.split('&');

    // 3. “Let ranges be a list of ranges, initially empty.”
    const ranges = [];

    // 4. “For each string directive of directives:”
    for (const directive of directives) {
        // 1. “If directive does not match the production TextDirective, then continue.”
        if (!isTextFragmentDirective(directive))
            continue;

        // 2. “Let parsedValues be the result of running the parse a text directive steps on directive.”
        const parsedValues = parseTextDirective(directive);

        // 3. “If parsedValues is null then continue.”
        if (parsedValues === null)
            continue;

        // 4. “If the result of running find a range from a text directive given parsedValues and document is non-null, then append it to ranges.”
        const range = findRangeFromTextDirective(parsedValues, document);
        if (range !== null)
            ranges.push(range);
    }

    // 5. “Return ranges.”
    return ranges;
}

// https://wicg.github.io/scroll-to-text-fragment/#find-a-range-from-a-text-directive
// “To find a range from a text directive, given a ParsedTextDirective parsedValues and Document document, run the following steps:”
export function findRangeFromTextDirective(parsedValues: ParsedTextDirective, document: Document): Range | null {
    // 1. “Let searchRange be a range with start (document, 0) and end (document, document’s length)”
    const searchRange = document.createRange();
    searchRange.setStart(document, 0);
    searchRange.setEnd(document, document.childNodes.length);

    // 2. “While searchRange is not collapsed:”
    while (!searchRange.collapsed) {
        // 1. “Let potentialMatch be null.”
        let potentialMatch = null;
        // 2. “If parsedValues’s prefix is not null:”
        if (parsedValues.prefix !== null) {
            // 1. “Let prefixMatch be the the result of running the find a string in range steps given parsedValues’s prefix and searchRange”.
            const prefixMatch = findStringInRange(parsedValues.prefix, searchRange);

            // 2. “If prefixMatch is null, return null.”
            if (prefixMatch === null)
                return null;

            // 3. “Set searchRange’s start to the first boundary point after prefixMatch’s start”
            // XXX I suppose we can be certain a next boundary point always exist in this case; can we proof this?
            searchRange.setStart(...firstBoundaryPointAfter(getStart(prefixMatch)) as BoundaryPoint);

            // 4. “Let matchRange be a range whose start is prefixMatch’s end and end is searchRange’s end.”
            const matchRange = document.createRange();
            matchRange.setStart(...getEnd(prefixMatch));
            matchRange.setEnd(...getEnd(searchRange));

            // 5. “Advance matchRange’s start to the next non-whitespace position.”
            advanceRangeStartToNextNonWhitespacePosition(matchRange);

            // 6. “If matchRange is collapsed return null.”
            if (matchRange.collapsed)
                return null;

            // 7. “Assert: matchRange’s start node is a Text node.”
            // assert(matchRange.startContainer.nodeType === Node.TEXT_NODE);

            // 8. “Set potentialMatch to the result of running the find a string in range steps given parsedValues’s textStart and matchRange.”
            potentialMatch = findStringInRange(parsedValues.textStart, matchRange);

            // 9. “If potentialMatch is null, return null.”
            if (potentialMatch === null)
                return null;

            // 10. “If potentialMatch’s start is not matchRange’s start, then and continue.” XXX then ~~and~~ continue
            if (!samePoint(getStart(potentialMatch), getStart(matchRange)))
                continue;

            // 11. “If parsedValues’s textEnd item is non-null, then:”
            // XXX This block of steps could be deduplicated by factoring it out of the if/else.
            if (parsedValues.textEnd !== null) {
                // 1. “Let textEndRange be a range whose start is potentialMatch’s end and whose end is searchRange’s end.”
                const textEndRange = document.createRange();
                textEndRange.setStart(...getEnd(potentialMatch));
                textEndRange.setEnd(...getEnd(searchRange));

                // 2. “Let textEndMatch be the result of running the find a string in range steps given parsedValue’s textEnd and textEndRange.”
                const textEndMatch = findStringInRange(parsedValues.textEnd, textEndRange);

                // 3. “If textEndMatch is null then return null.”
                if (textEndMatch === null)
                    return null;

                // 4. “Set potentialMatch’s end to textEndMatch’s end.”
                potentialMatch.setEnd(...getEnd(textEndMatch));
            }
        }
        // 3. “Otherwise:”
        else {
            // 1. “Set potentialMatch to the result of running the find a string in range steps given parsedValues’s textStart and searchRange.”
            potentialMatch = findStringInRange(parsedValues.textStart, searchRange);

            // 2. “If potentialMatch is null, return null.”
            if (potentialMatch === null)
                return null;

            // 3. “Set searchRange’s start to the first boundary point after potentialMatch’s start”
            // XXX I suppose we can be certain a next boundary point always exist in this case; can we proof this?
            searchRange.setStart(...firstBoundaryPointAfter(getStart(potentialMatch)) as BoundaryPoint);

            // 4. “If parsedValues’s textEnd item is non-null, then:”
            // XXX This block of steps could be deduplicated by factoring it out of the if/else.
            if (parsedValues.textEnd !== null) {
                // 1. “Let textEndRange be a range whose start is potentialMatch’s end and whose end is searchRange’s end.”
                const textEndRange = document.createRange();
                textEndRange.setStart(...getEnd(potentialMatch));
                textEndRange.setEnd(...getEnd(searchRange));

                // 2. “Let textEndMatch be the result of running the find a string in range steps given parsedValue’s textEnd and textEndRange.”
                const textEndMatch = findStringInRange(parsedValues.textEnd, textEndRange);

                // 3. “If textEndMatch is null then return null.”
                if (textEndMatch === null)
                    return null;

                // 4. “Set potentialMatch’s end to textEndMatch’s end.”
                potentialMatch.setEnd(...getEnd(textEndMatch));
            }
        }

        // 4. “Assert: potentialMatch is non-null, not collapsed and represents a range exactly containing an instance of matching text.” XXX the last assertion sounds rather vague.
        // assert(
        //     potentialMatch !== null
        //     && !potentialMatch.collapsed
        //     && new RegExp('^' + escapeRegExp(textStart) + '.*' + escapeRegExp(textEnd) + '$').test(potentialMatch.toString())  // …or something similar?
        // );

        // 5. “If parsedValues’s suffix is null, return potentialMatch.”
        if (parsedValues.suffix === null)
            return potentialMatch;

        // 6. “Let suffixRange be a range with start equal to potentialMatch’s end and end equal to searchRange’s end.”
        const suffixRange = document.createRange();
        suffixRange.setStart(...getEnd(potentialMatch));
        suffixRange.setEnd(...getEnd(searchRange));

        // 7. “Advance suffixRange’s start to the next non-whitespace position.”
        advanceRangeStartToNextNonWhitespacePosition(suffixRange);

        // 8. “Let suffixMatch be result of running the find a string in range steps given parsedValues’s suffix and suffixRange.”
        const suffixMatch = findStringInRange(parsedValues.suffix, suffixRange);

        // 9. “If suffixMatch is null then return null.”
        if (suffixMatch === null)
            return null;

        // 10. “If suffixMatch’s start is suffixRange’s start, return potentialMatch.”
        if (samePoint(getStart(suffixMatch), getStart(suffixRange)))
            return potentialMatch;
    }

    // XXX Not in spec; by intention or accident?
    return null;
}

// https://wicg.github.io/scroll-to-text-fragment/#next-non-whitespace-position
// “To advance a range range’s start to the next non-whitespace position follow the steps:”
function advanceRangeStartToNextNonWhitespacePosition(range: Range) {
    // 1. “While range is not collapsed:”
    while (!range.collapsed) {
        // 1. “Let node be range’s start node.”
        const node = range.startContainer;

        // 2. “Let offset be range’s start offset.”
        const offset = range.startOffset;

        // 3. “If node is part of a non-searchable subtree then:”
        if (partOfNonSearchableSubtree(node)) {
            // 1. “Set range’s start node to the next node, in shadow-including tree order, that isn’t a shadow-including descendant of node.”
            range.setStart(
                nextNodeInShadowIncludingTreeOrderThatIsNotAShadowIncludingDescendantOf(node) as Node, // XXX Can we be sure there is a next node? Asserting it here.
                0, // XXX presumably we should set the offset to zero?
            );

            // 2. “Continue.”
            continue;
        }

        // 4. “If node is not a visible text node:”
        if (!isVisibleTextNode(node)) {
            // 1. “Set range’s start node to the next node, in shadow-including tree order.”
            range.setStart(
                nextNodeInShadowIncludingTreeOrder(node) as Node, // XXX Can we be sure there is a next node? Asserting it here.
                0, // XXX presumably we should set the offset to zero?
            );
            // 2. “Continue.”
            continue;
        }

        // 5. “If the substring data of node at offset offset and count 6 is equal to the string "&nbsp;" then:” XXX Why only "&nbsp;", and not e.g. "&thinspace;" or others? Is there no existing spec for whitespace that can be used here?
        if (substringData(node as CharacterData, offset, 6) === '&nbsp;') { // XXX Is node guaranteed to be CharacterData? Not clear in spec.
            // 1. “Add 6 to range’s start offset.”
            range.setStart(range.startContainer, range.startOffset + 6);
        }

        // 6. “Otherwise, if the substring data of node at offset offset and count 5 is equal to the string "&nbsp" then:”
        else if (substringData(node as CharacterData, offset, 5) === '&nbsp') { // XXX Is node guaranteed to be CharacterData? Not clear in spec.
            // 1. “Add 5 to range’s start offset.”
            range.setStart(range.startContainer, range.startOffset + 5);
        }

        // 7. “Otherwise”
        else {
            // 1. “Let cp be the code point at the offset index in node’s data.”
            const cp = (node as CharacterData).data.codePointAt(offset) as number; // TODO verify if this is correct. We use the index to count code *units*, but we read the code *point*, which smells fishy but may be correct.

            // 2. “If cp does not have the White_Space property set, return.”
            if (!hasWhiteSpaceProperty(cp)) return;

            // 3. “Add 1 to range’s start offset.”
            range.setStart(range.startContainer, range.startOffset + 1);
        }

        // 8. “If range’s start offset is equal to node’s length, set range’s start node to the next node in shadow-including tree order.”
        if (range.startOffset === nodeLength(node)) {
            range.setStart(
                nextNodeInShadowIncludingTreeOrder(node) as Node, // XXX Can we be sure there is a next node? Asserting it here.
                0, // XXX presumably we should set the offset to zero?
            );
        }
    }
}

// https://wicg.github.io/scroll-to-text-fragment/#find-a-string-in-range
// To find a string in range for a string query in a given range range, run these steps:
function findStringInRange(query: string, searchRange: Range): Range | null { // XXX The spec calls it 'range' here, but 'searchRange' afterwards.
    // 1. “While searchRange is not collapsed:”
    while (!searchRange.collapsed) {
        // 1. “Let curNode be searchRange’s start node.”
        let curNode: Node | null = searchRange.startContainer;

        // 2. “If curNode is part of a non-searchable subtree:”
        if (partOfNonSearchableSubtree(curNode)) {
            // 1. “Set searchRange’s start node to the next node, in shadow-including tree order, that isn’t a shadow-including descendant of curNode”
            searchRange.setStart(
                nextNodeInShadowIncludingTreeOrderThatIsNotAShadowIncludingDescendantOf(curNode) as Node, // XXX Can we be sure there is a next node? Asserting it here.
                0, // XXX presumably we should set the offset to zero?
            );

            // 2. “Continue.”
            continue;
        }

        // 3. “If curNode is not a visible text node:”
        if (!isVisibleTextNode(curNode)) {
            // 1. “Set searchRange’s start node to the next node, in shadow-including tree order.”
            // searchRange.setStart(
            //     nextNodeInShadowIncludingTreeOrder(curNode) as Node, // XXX Can we be sure there is a next node? Asserting it here.
            //     0, // XXX presumably we should set the offset to zero?
            // );

            // XXX The above fails if nextNode is a doctype (see <https://dom.spec.whatwg.org/#concept-range-bp-set> as of 29 June 2020)
            // Take the next node that is not a doctype.
            curNode = nextNodeInShadowIncludingTreeOrder(curNode);
            while (curNode && curNode.nodeType === Node.DOCUMENT_TYPE_NODE)
                curNode = nextNodeInShadowIncludingTreeOrder(curNode);
            searchRange.setStart(
                curNode as Node, // XXX Can we be sure there is a next node? Asserting it here.
                0, // XXX presumably we should set the offset to zero?
            );

            // 2. “Continue.”
            continue;
        }

        // 4. “Otherwise:” XXX unnecessary due to the 'continue' (and confusing after two 'if's, should the latter be 'else if'?)
        else {
            // 1. “Let blockAncestor be the nearest block ancestor of curNode.”
            const blockAncestor = nearestBlockAncestorOf(curNode);

            // 2. “Let textNodeList be a list of Text nodes, initially empty.”
            const textNodeList: Text[] = [];

            // 3. “While curNode is a shadow-including descendant of blockAncestor and it does not follow searchRange’s end node:”
            while (
                curNode && isShadowIncludingDescendant(curNode, /* of */ blockAncestor)
                // XXX “it does not follow searchRange’s end node” seems mistaken: *every* node follows Document, which is usually the end node…
                // && !followsInTree(curNode, searchRange.endContainer)
                // XXX …so we check instead whether curNode starts after searchRange.
                && searchRange.comparePoint(curNode, 0) !== 1
            ) {
                // 1. “If curNode has block-level display then break.”
                if (hasBlockLevelDisplay(curNode)) {
                    break;
                }

                // 2. “If curNode is search invisible:”
                if (isSearchInvisible(curNode)) {
                    // 1. “Set curNode to the next node in shadow-including tree order whose ancestor is not curNode.”
                    // XXX Is this a *shadow-including* ancestor? Presumably yes, but making it explicit may be better.
                    // XXX Two other places in the spec use the equivalent phrasing “that isn’t a shadow-including descendant of”. Best to then use the same phrasing here (or vice versa, but “whose ancestor” seems slightly less clear as it suggests there is only one ancestor).
                    curNode = nextNodeInShadowIncludingTreeOrderThatIsNotAShadowIncludingDescendantOf(curNode);

                    // 2. “Continue.”
                    continue;
                }

                // 3. “If curNode is a visible text node then append it to textNodeList.”
                if (isVisibleTextNode(curNode)) {
                    textNodeList.push(curNode);
                }

                // 4. “Set curNode to the next node in shadow-including tree order.”
                curNode = nextNodeInShadowIncludingTreeOrder(curNode);
            }

            // 4. “Run the find a range from a node list steps given query, searchRange, and textNodeList, as input. If the resulting range is not null, then return it.”
            const resultingRange = findARangeFromANodeList(query, searchRange, textNodeList);
            if (resultingRange !== null) {
                return resultingRange;
            }

            // XXX curNode may be null (if we reach the end of tree).
            if (curNode === null)
                break;

            // 5. “Assert: curNode follows searchRange’s start node.”
            // assert(followsInTree(curNode, searchRange.startContainer))

            // 6. “Set searchRange’s start to the boundary point (curNode, 0).”
            searchRange.setStart(curNode, 0);
        }
    }
    // 2. “Return null.”
    return null;
}

// https://wicg.github.io/scroll-to-text-fragment/#search-invisible
// “A node is search invisible…”
function isSearchInvisible(node: Node): boolean {
    // “…if it is in the HTML namespace and meets any of the following conditions:”
    // XXX Namespace for nodes is inapplicable/deprecated? Presuming this was meant: “…if it is an element in the HTML namespace…”
    if (isElement(node) && node.namespaceURI === htmlNamespace) {

        // 1. “The computed value of its display property is none.”
        if (getComputedStyle(node).display === 'none')
            return true;

        // 2. “If the node serializes as void.”
        if (serializesAsVoid(node))
            return true;

        // 3. “Is any of the following types: HTMLIFrameElement, HTMLImageElement, HTMLMeterElement, HTMLObjectElement, HTMLProgressElement, HTMLStyleElement, HTMLScriptElement, HTMLVideoElement, HTMLAudioElement”
        if (['iframe', 'image', 'meter', 'object', 'progress', 'style', 'script', 'video', 'audio'].includes(node.localName)) // TODO verify: is this correct? Do class names and localName map one-to-one? (hopefully yes, as the term ‘element type’ seems used for both concepts)
            return true;

        // 4. “Is a select element whose multiple content attribute is absent.”
        if (node.localName === 'select' && !node.hasAttribute('multiple'))
            return true;
    }
    return false;
}

// https://wicg.github.io/scroll-to-text-fragment/#non-searchable-subtree
// “A node is part of a non-searchable subtree if it is or has an ancestor that is search invisible.”
function partOfNonSearchableSubtree(node: Node): boolean {
    let curNode: Node | null = node;
    while (curNode) {
        if (isSearchInvisible(curNode))
            return true;
        curNode = curNode.parentNode; // XXX I would expect this to be “shadow-including ancestor”.
        // curNode = shadowIncludingParent(curNode);
    }
    return false;
}

// https://wicg.github.io/scroll-to-text-fragment/#visible-text-node
// “A node is a visible text node if it is a Text node, the computed value of its visibility property is visible, and it is being rendered.”
type VisibleTextNode = Text; // could be `unique Text`, when (if) TypeScript will support that.
function isVisibleTextNode(node: Node): node is VisibleTextNode {
    if (node.nodeType !== Node.TEXT_NODE)
        return false;

    // XXX How are “the computed value of its visibility property” and “being rendered” defined for non-element nodes? Using the text node’s parent element instead!
    if (
        node.parentElement
        && getComputedStyle(node.parentElement).visibility === 'visible'
        && isBeingRendered(node.parentElement)
    )
        return true;

    return false;
}

// https://wicg.github.io/scroll-to-text-fragment/#has-block-level-display
// “A node has block-level display if the computed value of its display property is any of block, table, flow-root, grid, flex, list-item.”
function hasBlockLevelDisplay(node: Node): boolean {
    // XXX How is “the computed value of its display property” defined for non-element nodes? Assuming here it only applies to elements!
    return (
        isElement(node)
        && ['block', 'table', 'flow-root', 'grid', 'flex', 'list-item'].includes(getComputedStyle(node).display)
    );
}

// https://wicg.github.io/scroll-to-text-fragment/#nearest-block-ancestor
// “To find the nearest block ancestor of a node follow the steps:”
function nearestBlockAncestorOf(node: Node): Node {
    // 1. “While node is non-null”
    // XXX We replace node with a new variable curNode for walking up the tree, as we will still need a non-null node in step 2 (and also it needs the type Node | null).
    let curNode: Node | null = node;
    while (curNode !== null) {

        // 1. “If node is not a Text node and it has block-level display then return node.”
        if (curNode.nodeType !== Node.TEXT_NODE && hasBlockLevelDisplay(curNode))
            return curNode;

        // 2. “Otherwise, set node to node’s parent.”
        else
            curNode = curNode.parentNode;
    }

    // 2. “Return node’s node document's document element.”
    // XXX In the spec, node would be null now! Hence the need for introducing curNode.
    return (node.ownerDocument ?? node as Document).documentElement;
}

// https://wicg.github.io/scroll-to-text-fragment/#find-a-range-from-a-node-list
// “To find a range from a node list given a search string queryString, a range searchRange, and a list of nodes nodes, follow the steps”
function findARangeFromANodeList(queryString: string, searchRange: Range, nodes: Text[]): Range | null {
    // 1. “Assert: each item in nodes is a Text node.”
    // XXX Could this not just be asserted through the parameter type, like is done in “get boundary point at index”? Applying this already.
    // assert(nodes.every(node => node.nodeType === Node.TEXT_NODE));

    // 2. “Let searchBuffer be the concatenation of the data of each item in in nodes.”
    // XXX typo: “in in nodes”
    const searchBuffer = nodes.map(node => node.data).join('');

    // 3. “Let searchStart be 0.”
    let searchStart = 0;

    // 4. “If the first item in nodes is searchRange’s start node then set searchStart to searchRange’s start offset.”
    if (nodes[0] === searchRange.startContainer)
        searchStart = searchRange.startOffset;

    // 5. “Let start and end be boundary points, initially null.”
    let start: BoundaryPoint | null = null;
    let end: BoundaryPoint | null = null;

    // 6. “Let matchIndex be null.”
    let matchIndex = null;

    // 7. “While matchIndex is null”
    while (matchIndex === null) {
        // 1. “Let matchIndex be an integer set to the index of the first instance of queryString in searchBuffer, starting at searchStart. The string search must be performed using a base character comparison, or the primary level, as defined in [UTS10].”
        // XXX “Let matchIndex be an integer” sounds like a redeclaration; presumably a mistake?
        // TODO implement base character comparison (i.e. ignoring accents, etc.)
        // XXX It would be helpful to have more specific guidance than merely a link to UTS10 <https://www.unicode.org/reports/tr10/tr10-43.html>
        matchIndex = searchBuffer.toLowerCase().indexOf(queryString.toLowerCase(), searchStart); // TEMP case-insensitive string match will have to suffice for now.

        // XXX If queryString does not appear in searchString, I suppose we should return.
        if (matchIndex === -1)
            return null;

        // 2. “Let endIx be matchIndex + queryString’s length.”
        const endIx = matchIndex + queryString.length;

        // 3. “Set start be the boundary point result of get boundary point at index matchIndex run over nodes with isEnd false.”
        // XXX typo: “Set start be”
        start = getBoundaryPointAtIndex(matchIndex, nodes, false) as BoundaryPoint;

        // 4. “Set end be the boundary point result of get boundary point at index endIx run over nodes with isEnd true.”
        // XXX typo: “Set end be”
        end = getBoundaryPointAtIndex(endIx, nodes, true) as BoundaryPoint;

        // XXX Assert start and end are non-null? (should be correct, as matchIndex and endIx are both less than the search text’s length)

        // 5. “If the substring of searchBuffer starting at matchIndex and of length queryString’s length is not word bounded, given the language from each of start and end’s nodes as the startLocale and endLocale:”
        if (!isWordBounded(searchBuffer, matchIndex, queryString.length, languageOf(start[0]), languageOf(end[0]))) {
            // 1. “Let searchStart be matchIndex + 1.”
            // XXX “Let … be” should be “Set … to”?
            searchStart = matchIndex + 1;

            // 2. “Set matchIndex to null.”
            matchIndex = null;
        }
    }

    // 8. “Let endInset be 0.”
    let endInset = 0;

    // 9. “If the last item in nodes is searchRange’s end node then set endInset to (searchRange’s end node's length − searchRange’s end offset)”
    if (nodes[nodes.length - 1] === searchRange.endContainer)
        endInset = (searchRange.endContainer as Text).length - searchRange.endOffset;

    // 10. “If matchIndex + queryString’s length is greater than or equal to searchBuffer’s length − endInset return null.”
    // XXX This comparison should be strictly greater than: a boundary point can be right after the last character.
    if (matchIndex + queryString.length > searchBuffer.length - endInset)
        return null;

    // 11. “Assert: start and end are non-null, valid boundary points in searchRange.”
    // assert(start !== null && end !== null && searchRange.comparePoint(...start) === 0 && searchRange.comparePoint(...end) === 0);
    start = start as BoundaryPoint;
    end = end as BoundaryPoint;

    // 12. “Return a range with start start and end end.”
    const result = document.createRange();
    result.setStart(...start);
    result.setEnd(...end);
    return result;
}

// https://wicg.github.io/scroll-to-text-fragment/#get-boundary-point-at-index
// “To get boundary point at index, given an integer index, list of Text nodes nodes, and a boolean isEnd, follow these steps:”
function getBoundaryPointAtIndex(index: integer, nodes: Text[], isEnd: boolean): BoundaryPoint | null {
    // 1. “Let counted be 0.”
    let counted = 0;

    // 2. “For each curNode of nodes:”
    for (const curNode of nodes) {

        // 1. “Let nodeEnd be counted + curNode’s length.”
        let nodeEnd = counted + curNode.length;

        // 2. “If isEnd is true, add 1 to nodeEnd.”
        if (isEnd)
            nodeEnd += 1;

        // 3. “If nodeEnd is greater than index then:”
        if (nodeEnd > index) {
            // 1. “Return the boundary point (curNode, index − counted).”
            return [curNode, index - counted];
        }

        // 4. “Increment counted by curNode’s length.”
        counted += curNode.length;
    }

    // 3. “Return null.”
    return null;
}


// § 3.5.3 Word Boundaries

// https://wicg.github.io/scroll-to-text-fragment/#word-bounded
// “To determine if a substring of a larger string is word bounded, given a string text, an integer startPosition, number count, and locales startLocale and endLocale, follow these steps:”

// “startLocale and endLocale must be a valid [BCP47] language tag, or the empty string. An empty string indicates that the primary language is unknown.” <https://tools.ietf.org/html/bcp47>
// XXX Is this, or should this be a step? (should locale strings be validated?)
type locale = string;

function isWordBounded(text: string, startPosition: integer, count: number, startLocale: locale, endLocale: locale): boolean {
    // 1. “Using locale startLocale, let left bound be the last word boundary in text that precedes startPositionth code point of text.”
    // XXX It seems that “startPositionth” involves zero-based indexing; is that considered self-evident?
    const leftBound = nearestWordBoundary(text, startPosition, 'before', startLocale);

    // “A string will always contain at least 2 word boundaries before the first code point and after the last code point of the string.
    // XXX Is this really true, even for a string with only white space? Or an empty string?
    // XXX typo: missing a colon before “before”

    // 2. “If the first code point of text following left bound is not at position startPosition return false.”
    if (leftBound !== startPosition) // We should be able to assume leftBound is not inside a multi-unit code point.
        return false;

    // 3. “Let endPosition be (startPosition + count − 1).”
    const endPosition = startPosition + count - 1;

    // 4. “Using locale endLocale, let right bound be the first word boundary in text after the endPositionth code point.”
    // XXX It seems that “endPositionth” involves zero-based indexing; is that considered self-evident?
    const rightBound = nearestWordBoundary(text, endPosition, 'after', endLocale);

    // 5. “If the first code point of text preceding right bound is not at position endPosition return false.”
    if (rightBound - 1 !== endPosition) // TEMP (TODO figure this out)
        return false;

    // 6. “Return true.”
    return true;
}

// https://wicg.github.io/scroll-to-text-fragment/#feature-detectability
// § 3.8. Feature Detectability
// “For feature detectability, we propose adding a new FragmentDirective interface that is exposed via document.fragmentDirective if the UA supports the feature.
//     [Exposed=Document]
//     interface FragmentDirective {
//     };
// We amend the Document interface to include a fragmentDirective property:
//     partial interface Document {
//         [SameObject] readonly attribute FragmentDirective fragmentDirective;
//     };”
export interface FragmentDirective {
};
// TODO Can and should we modify the Document interface?

export function browserSupportsTextFragments(): boolean {
    return (
        'fragmentDirective' in Document
        // Also check in window.location, which was in the spec until & including the version of 12 August 2020. See commit <https://github.com/WICG/scroll-to-text-fragment/commit/2dcfbd6e272f51e5b250c58076b6d1cc57656fce>.
        || 'fragmentDirective' in window.location
    );
}



  /////////////////////////////////////////////
 // Required pieces of the WHATWG DOM spec ///
/////////////////////////////////////////////

// Based on the version of 29 June 2020 <https://dom.spec.whatwg.org/commit-snapshots/e191f73a0fcc09c48f9e962188748f811b09c239/>

// https://dom.spec.whatwg.org/#concept-tree-descendant
// “An object A is called a descendant of an object B, if either A is a child of B or A is a child of an object C that is a descendant of B.”
function isDescendant(nodeA: Node, nodeB: Node): boolean {
    if (nodeA.parentNode === nodeB)
        return true;
    const nodeC = nodeA.parentNode;
    if (nodeC && isDescendant(nodeC, nodeB))
        return true;
    return false;
}

// https://dom.spec.whatwg.org/#concept-tree-following
// “An object A is following an object B if A and B are in the same tree and A comes after B in tree order.”
function followsInTree(nodeA: Node, nodeB: Node): boolean {
    return !!(nodeB.compareDocumentPosition(nodeA) & Node.DOCUMENT_POSITION_FOLLOWING);
}

// https://dom.spec.whatwg.org/#concept-node-length
// “To determine the length of a node node, switch on node:”
function nodeLength(node: Node): number {
    switch (node.nodeType) {
        // “DocumentType”
        case Node.DOCUMENT_TYPE_NODE:
            // “Zero.”
            return 0;
        // “Text”
        case Node.TEXT_NODE:
        // “ProcessingInstruction”
        case Node.PROCESSING_INSTRUCTION_NODE:
        // “Comment”
        case Node.COMMENT_NODE:
            // “Its data’s length.”
            return (node as CharacterData).data.length;
        // “Any other node”
        default:
            // “Its number of children.”
            return node.childNodes.length;
    }
}

// https://dom.spec.whatwg.org/#concept-shadow-including-tree-order
// “In shadow-including tree order is shadow-including preorder, depth-first traversal of a node tree. Shadow-including preorder, depth-first traversal of a node tree tree is preorder, depth-first traversal of tree, with for each shadow host encountered in tree, shadow-including preorder, depth-first traversal of that element’s shadow root’s node tree just after it is encountered.”
function nextNodeInShadowIncludingTreeOrder(node: Node): Node | null {
    if (isShadowHost(node)) {
        return nextNodeInShadowIncludingTreeOrder(node.shadowRoot);
    } else {
        return nextNode(node);
    }
}

// https://dom.spec.whatwg.org/#element-shadow-host
// “An element is a shadow host if its shadow root is non-null.”
// FIXME (WONTFIX?) Element.shadowRoot is also null if the ShadowRoot exists but its mode is 'closed'. Is there any way around this?
// XXX Might it be desirable to exclude closed shadow roots from a text fragment search?
type ShadowHost = Element & { shadowRoot: ShadowRoot }
function isShadowHost(node: Node): node is ShadowHost {
    return (isElement(node) && node.shadowRoot !== null);
}

// https://dom.spec.whatwg.org/#concept-shadow-including-descendant
// “An object A is a shadow-including descendant of an object B, if A is a descendant of B, or A’s root is a shadow root and A’s root’s host is a shadow-including inclusive descendant of B.”
function isShadowIncludingDescendant(nodeA: Node, nodeB: Node): boolean {
    if (isDescendant(nodeA, nodeB))
        return true;
    const nodeARoot = nodeA.getRootNode();
    if (nodeARoot instanceof ShadowRoot && isShadowIncludingInclusiveDescendant(nodeARoot.host, nodeB))
        return true;
    return false;
}

// https://dom.spec.whatwg.org/#concept-shadow-including-inclusive-descendant
// “A shadow-including inclusive descendant is an object or one of its shadow-including descendants.”
function isShadowIncludingInclusiveDescendant(nodeA: Node, nodeB: Node): boolean {
    if (nodeA === nodeB)
        return true;
    if (isShadowIncludingDescendant(nodeA, nodeB))
        return true;
    return false;
}

// https://dom.spec.whatwg.org/#concept-shadow-including-ancestor
// “An object A is a shadow-including ancestor of an object B, if and only if B is a shadow-including descendant of A.”
function isShadowIncludingAncestor(nodeA: Node, nodeB: Node): boolean {
    return isShadowIncludingDescendant(nodeB, nodeA);
}

// https://dom.spec.whatwg.org/#concept-shadow-including-inclusive-ancestor
// “A shadow-including inclusive ancestor is an object or one of its shadow-including ancestors.”
function isShadowIncludingInclusiveAncestor(nodeA: Node, nodeB: Node): boolean {
    if (nodeA === nodeB)
        return true;
    if (isShadowIncludingAncestor(nodeA, nodeB))
        return true;
    return false;
}

// https://dom.spec.whatwg.org/#concept-cd-substring
// “To substring data with node node, offset offset, and count count, run these steps:”
function substringData(
    node: CharacterData, // XXX The spec says “node node”, but reads “node’s data” which is only defined for CharacterData nodes.
    offset: number,
    count: count
): string {
    // 1. “Let length be node’s length.”
    const length = nodeLength(node);
    // 2. “If offset is greater than length, then throw an "IndexSizeError" DOMException.”
    if (offset > length)
        throw new DOMException('', 'IndexSizeError');
    // 3. “If offset plus count is greater than length, return a string whose value is the code units from the offsetth code unit to the end of node’s data, and then return.”
    if (offset + count > length) {
        return node.data.substring(offset);
    }
    // TODO verify: “Return a string whose value is the code units from the offsetth code unit to the offset+countth code unit in node’s data.”
    return node.data.substring(offset, offset + count);
}

// https://dom.spec.whatwg.org/#concept-range-bp
// “A boundary point is a tuple consisting of a node (a node) and an offset (a non-negative integer).”
type BoundaryPoint = [Node, nonNegativeInteger];



  ///////////////////////////////////////////////
 /// Required pieces of the WHATWG HTML Spec ///
///////////////////////////////////////////////

// Based on the version of 13 August 2020 <https://html.spec.whatwg.org/commit-snapshots/3c52fe139d9c637eb901932a77d743d6d5ecaa56/>

// § 3.2.6.2 The lang and xml:lang attributes
// https://html.spec.whatwg.org/multipage/dom.html#language
function languageOf(node: Node): locale {
    // “To determine the language of a node, user agents must look at the nearest ancestor element (including the element itself if the node is an element) that has a lang attribute in the XML namespace set or is an HTML element and has a lang in no namespace attribute set. That attribute specifies the language of the node (regardless of its value).”
    let curNode: Node | null = node;
    while (curNode !== null) {
        if (isElement(curNode)) {
            // “If both the lang attribute in no namespace and the lang attribute in the XML namespace are set on an element, user agents must use the lang attribute in the XML namespace, and the lang attribute in no namespace must be ignored for the purposes of determining the element's language.”
            const language = curNode.getAttributeNS(xmlNamespace, 'lang') ?? curNode.getAttributeNS(null, 'lang');
            if (language !== null)
                return language;
        }
        curNode = curNode.parentNode;
    }

    // “If node's inclusive ancestors do not have either attribute set, but there is a pragma-set default language set, then that is the language of the node.”
    const pragmaSetDefaultLanguage = getPragmaSetDefaultLanguage();
    if (pragmaSetDefaultLanguage !== undefined)
        return pragmaSetDefaultLanguage;

    // “If there is no pragma-set default language set, then language information from a higher-level protocol (such as HTTP), if any, must be used as the final fallback language instead.”
    // Probably not available to us. (well, perhaps we could try fetch document.URL from cache and read its headers…)

    // “In the absence of any such language information, and in cases where the higher-level protocol reports multiple languages, the language of the node is unknown, and the corresponding language tag is the empty string.”
    return '';
}


// § 4.2.5.3 Pragma directives
// https://html.spec.whatwg.org/multipage/semantics.html#pragma-set-default-language
// This implementation is a workaround, since we cannot read the pragma-set default language from the DOM. We simply rerun the steps the user agent should have executed to determine this value, when the corresponding <meta> elements are inserted into the document.
// (note that we assume the meta elements were not modified after creation; in scenarios with attribute modifications our result could deviate from the correct result)
function getPragmaSetDefaultLanguage(): string | undefined {
    // “Content language state (http-equiv="content-language")”
    // “This pragma sets the pragma-set default language. Until such a pragma is successfully processed, there is no pragma-set default language.”
    let pragmaSetDefaultLanguage: string | undefined = undefined;

    const metaElements = document.querySelectorAll('meta[http-equiv="content-language"]');
    metaElements.forEach(element => {

        // 1. “If the meta element has no content attribute, then return.”
        if (element.hasAttribute('content'))
            return;

        // 3. “Let input be the value of the element's content attribute.”
        // (swapping the order for implementation simplicity)
        const input = element.getAttribute('content') as string;

        // 2. “If the element's content attribute contains a U+002C COMMA character (,) then return.”
        if (input.includes(','))
            return;

        // 4. “Let position point at the first character of input.”
        let position = 0;

        // 5. “Skip ASCII whitespace within input given position.”
        while (position < input.length && AsciiWhitespace.includes(input[position]))
            position++;

        // 6. “Collect a sequence of code points that are not ASCII whitespace from input given position.”
        // 7. “Let candidate be the string that resulted from the previous step.”
        let candidate = '';
        while (!AsciiWhitespace.includes(input[position])) {
            candidate += input[position];
            position++;
        }

        // 8. “If candidate is the empty string, return.”
        if (candidate === '')
            return;

        // 9. “Set the pragma-set default language to candidate.”
        pragmaSetDefaultLanguage = candidate;
    });

    return pragmaSetDefaultLanguage as string | undefined;
}


// § 7.5 Origin
// https://html.spec.whatwg.org/multipage/origin.html#concept-origin
type origin = opaqueOrigin | tupleOrigin
// “An opaque origin”: “An internal value, with no serialization it can be recreated from (it is serialized as "null" per serialization of an origin), for which the only meaningful operation is testing for equality.”
type opaqueOrigin = symbol; // I guess?
// “A tuple consists of:
//   • A scheme (a scheme).
//   • A host (a host).
//   • A port (a port).
//   • A domain (null or a domain). Null unless stated otherwise.”
type tupleOrigin = [
    // (using primitive types here; specifying these further is beyond scope)
    string,
    string | integer | integer[], // integers for IP addresses
    integer | null,
    nonEmptyString | null,
];


// § 12.1.2 Elements
// https://html.spec.whatwg.org/multipage/syntax.html#void-elements
const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];


// § 12.2 Parsing HTML documents
// https://html.spec.whatwg.org/multipage/parsing.html#serializes-as-void
// “For the purposes of the following algorithm, an element serializes as void if its element type is one of the void elements, or is basefont, bgsound, frame, or keygen.”
function serializesAsVoid(element: Element): boolean {
    // From § 2.1.3 XML Compatibility, <https://html.spec.whatwg.org/multipage/infrastructure.html#element-type>:
    // “The term element type is used to refer to the set of elements that have a given local name and namespace.”
    // “Except where otherwise stated, all elements defined or mentioned in this specification are in the HTML namespace ("http://www.w3.org/1999/xhtml")”
    if (element.namespaceURI === htmlNamespace
        && (voidElements.includes(element.localName) || ['basefont', 'bgsound', 'frame', 'keygen'].includes(element.localName))
    ) {
        return true;
    }
    return false;
}


// § 14.1 Rendering → Introduction
// https://html.spec.whatwg.org/multipage/rendering.html#being-rendered
// “An element is being rendered if it has any associated CSS layout boxes, SVG layout boxes, or some equivalent in other styling languages.”
function isBeingRendered(element: Element) {
    // “Note … The presence of the hidden attribute normally means the element is not being rendered, though this might be overridden by the style sheets.”
    // TODO figure out what exactly we should/could test.
    return !element.hasAttribute('hidden'); // TEMP
}



  ////////////////////////////////////////////////
 /// Required pieces of the WHATWG Infra Spec ///
////////////////////////////////////////////////

// Based on the version of 6 August 2020 <https://infra.spec.whatwg.org/commit-snapshots/38caa3d54ec94b757326b18b0b6cfb39c454f1de/>
// https://infra.spec.whatwg.org/#ascii-whitespace
// “ASCII whitespace is U+0009 TAB, U+000A LF, U+000C FF, U+000D CR, or U+0020 SPACE.”
const AsciiWhitespace = '\u0009\u000a\u000c\u000d\u0020';

// https://infra.spec.whatwg.org/#html-namespace
// “The HTML namespace is "http://www.w3.org/1999/xhtml".”
const htmlNamespace = 'http://www.w3.org/1999/xhtml';

// https://infra.spec.whatwg.org/#xml-namespace
// “The XML namespace is "http://www.w3.org/XML/1998/namespace".”
const xmlNamespace = 'http://www.w3.org/XML/1998/namespace';


  //////////////////////////////////////
 /// Simple helpers for readability ///
//////////////////////////////////////


function isElement(node: Node): node is Element {
    return node.nodeType === Node.ELEMENT_NODE
}

function getStart(range: Range): BoundaryPoint {
    return [range.startContainer, range.startOffset];
}

function getEnd(range: Range): BoundaryPoint {
    return [range.endContainer, range.endOffset];
}

function samePoint(point1: BoundaryPoint, point2: BoundaryPoint): boolean {
    return point1[0] === point2[0] && point1[1] === point2[1];
}

function nextNodeInShadowIncludingTreeOrderThatIsNotAShadowIncludingDescendantOf(node: Node): Node | null {
    let curNode: Node | null = nextNodeInShadowIncludingTreeOrder(node);
    while (curNode && isShadowIncludingDescendant(curNode, node)) {
        curNode = nextNodeInShadowIncludingTreeOrder(curNode);
    }
    return curNode;
}



  ///////////
 // Other //
///////////


function hasWhiteSpaceProperty(codePoint: number): boolean {
    // Soon to be widely supported in browsers. <https://caniuse.com/#feat=mdn-javascript_builtins_regexp_property_escapes>
    // return !!String.fromCodePoint(codePoint).match(/\p{White_Space}/u);

    // The list below takes the values from <https://www.unicode.org/Public/UCD/latest/ucd/PropList.txt> version of 2019-11-27
    const whitespaceCodePoints = [
        0x0009, 0x000A, 0x000B, 0x000C, 0x000D,
        0x0085, 0x2028, 0x2029, 0x0020, 0x3000,
        0x1680, 0x2000, 0x2001, 0x2002, 0x2003,
        0x2004, 0x2005, 0x2006, 0x2008, 0x2009,
        0x200A, 0x205F, 0x00A0, 0x2007, 0x202F,
    ];
    return whitespaceCodePoints.includes(codePoint);
}

// XXX Is this supposed to be self-evident, or should these steps perhaps be included in the spec?
function firstBoundaryPointAfter([node, offset]: BoundaryPoint): BoundaryPoint | null {
    if (offset < nodeLength(node)) { // (note that N children/characters makes for N+1 boundary points)
        return [node, offset + 1];
    } else {
        const next = nextNode(node);
        if (next !== null)
            return [next, 0];
        else
            return null;
    }
}

function nextNode(node: Node): Node | null {
    const walker = (node.ownerDocument ?? node as Document).createTreeWalker(node.getRootNode());
    walker.currentNode = node;
    return walker.nextNode();
}

// XXX Is this supposed to be self-evident, or should these steps perhaps be included in the spec?
function nearestWordBoundary(text: string, position: integer, direction: 'before' | 'after', locale: locale): integer {
    // From <https://wicg.github.io/scroll-to-text-fragment/#word-bounded>:
    // “A word boundary is defined in [UAX29] in Unicode Text Segmentation §Word_Boundaries. Unicode Text Segmentation §Default_Word_Boundaries defines a default set of what constitutes a word boundary, but as the specification mentions, a more sophisticated algorithm should be used based on the locale.”

    // TODO Look into the referenced unicode spec.
    // TEMP Just use regular expression’s word boundaries, whitespace, and the string’s start and end.
    const allBoundaries = [...text.matchAll(/^|\b|\s|$/g)].map(match => match.index as integer);
    if (direction === 'before') {
        // Find the last match before position. Sure to exist because we also match the start of the string.
        allBoundaries.reverse();
        return allBoundaries.find(boundaryPosition => boundaryPosition <= position) as number;
    } else {
        // Find the first match after position. Sure to exist because we also match the end of the string.
        return allBoundaries.find(boundaryPosition => boundaryPosition > position) as number;
    }
}
