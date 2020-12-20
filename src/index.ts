  //////////////////////
 /// Text Fragments ///
//////////////////////

// An implementation of (most of) the Text Fragments draft spec.
// See https://wicg.github.io/scroll-to-text-fragment/
// Based on the version of 25 November 2020. <https://raw.githubusercontent.com/WICG/scroll-to-text-fragment/91e2a621a8690302f32ee5f4a18517b8c75c5495/index.html>


import {
    Locale,
    isElement,
    nextNode,
} from './common.js';

import {
    nodeLength,
    nextNodeInShadowIncludingTreeOrder,
    isShadowIncludingDescendant,
    isShadowIncludingInclusiveAncestor,
    substringData,
    BoundaryPoint,
} from './whatwg-dom.js';

import {
    languageOf,
    serializesAsVoid,
    isBeingRendered,
} from './whatwg-html.js';

import {
    AsciiString,
    htmlNamespace,
} from './whatwg-infra.js';

type NonEmptyString = string;
type Integer = number;


// § 3.3.1. Processing the fragment directive

// https://wicg.github.io/scroll-to-text-fragment/#fragment-directive-delimiter
// “The fragment directive delimiter is the string ":~:", that is the three consecutive code points U+003A (:), U+007E (~), U+003A (:).”
export const fragmentDirectiveDelimiter = ':~:';

// https://wicg.github.io/scroll-to-text-fragment/#process-and-consume-fragment-directive
// “To process and consume fragment directive from a URL url and Document document, run these steps:”
// Instead of actually modifying the document’s URL fragment and fragment directive, this implementation returns the values these should have been set to. It therefore does not take the second argument. Also it expects to receive the URL as a string instead of as a URL object.
export function processAndConsumeFragmentDirective(url: string): { url: string, documentFragmentDirective: string | null } {
    // “Each document has an associated fragment directive which is either null or an ASCII string holding data used by the UA to process the resource. It is initially null.”
    let documentFragmentDirective: AsciiString | null = null;

    // 1. “Let raw fragment be equal to url’s fragment.”
    // (as we only have access to the serialised URL, we extract the fragment again)
    const rawFragment = url.split('#')[1] ?? null;

    // 2. “If raw fragment is non-null and contains the fragment directive delimiter as a substring:”
    if (rawFragment !== null && rawFragment.includes(fragmentDirectiveDelimiter)) {
        // 1. “Let fragmentDirectivePosition be the index of the first instance of the fragment directive delimiter in raw fragment.”
        let fragmentDirectivePosition = rawFragment.indexOf(fragmentDirectiveDelimiter);

        // 2. “Let fragment be the substring of raw fragment starting at 0 of count fragmentDirectivePosition.”
        const fragment = rawFragment.substring(0, 0 + fragmentDirectivePosition);

        // 3. “Advance fragmentDirectivePosition by the length of fragment directive delimiter.”
        fragmentDirectivePosition += fragmentDirectiveDelimiter.length;

        // 4. “Let fragment directive be the substring of raw fragment starting at fragmentDirectivePosition.”
        const fragmentDirective = rawFragment.substring(fragmentDirectivePosition);

        // 5. “Set url’s fragment to fragment.”
        // (as we only have access to the serialised URL, we manually replace its fragment part)
        url = url.split('#')[0] + (fragment !== null) ? '#' + fragment : '';

        // 6. “Set document’s fragment directive to fragment directive.”
        documentFragmentDirective = fragmentDirective;
    }

    // For testing/trying purposes, we return what should now be the document’s URL and fragment directive.
    return { url, documentFragmentDirective };
}


// § 3.3.2. Parsing the fragment directive

// https://wicg.github.io/scroll-to-text-fragment/#parsedtextdirective
// “A ParsedTextDirective is a struct that consists of four strings: textStart, textEnd, prefix, and suffix. textStart is required to be non-null. The other three items may be set to null, indicating they weren’t provided. The empty string is not a valid value for any of these items.”
export interface ParsedTextDirective {
    textStart: NonEmptyString;
    textEnd: NonEmptyString | null;
    prefix: NonEmptyString | null;
    suffix: NonEmptyString | null;
};

// https://wicg.github.io/scroll-to-text-fragment/#parse-a-text-directive
// “To parse a text directive, on an ASCII string text directive input, run these steps:”
export function parseTextDirective(textDirectiveInput: TextDirective): ParsedTextDirective | null {
    // 1. “Assert: text directive input matches the production TextDirective.”
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
        retVal.prefix = decodeURIComponent(potentialPrefix.substring(0, potentialPrefix.length - 1));
        // 2. “Remove the first item of the list tokens.”
        tokens.shift();
    }

    // 9. “Let potential suffix be the last item of tokens, if one exists, null otherwise.”
    const potentialSuffix = tokens[tokens.length - 1] ?? null;

    // 10. “If potential suffix is non-null and its first character is U+002D (-), then:”
    if (potentialSuffix !== null && potentialSuffix.startsWith('-')) {
        // 1. “Set retVal’s suffix to the result of removing the first character from potential suffix.”
        retVal.suffix = decodeURIComponent(potentialSuffix.substring(1));
        // 2. “Remove the last item of the list tokens.”
        tokens.pop();
    }

    // 11. “If tokens has size not equal to 1 nor 2 then return null.”
    if (tokens.length !== 1 && tokens.length !== 2)
        return null;

    // 12. “Set retVal’s textStart be the first item of tokens.”
    retVal.textStart = decodeURIComponent(tokens[0]);

    // 13. “If tokens has size 2, then set retVal’s textEnd be the last item of tokens.”
    if (tokens.length === 2)
        retVal.textEnd = decodeURIComponent(tokens[tokens.length - 1]);

    // 14. “Return retVal.”
    return retVal as ParsedTextDirective;
}


// § 3.3.3. Fragment directive grammar

// https://wicg.github.io/scroll-to-text-fragment/#valid-fragment-directive
// “A valid fragment directive is a sequence of characters that appears in the fragment directive that matches the production:”
export type ValidFragmentDirective = string;  // could be `unique string`, when (if) TypeScript will support that.
export function isValidFragmentDirective(input: string | null): input is ValidFragmentDirective {
    // TODO (use PEG.js?)
    return true; // TEMP
}

// https://wicg.github.io/scroll-to-text-fragment/#text-fragment-directive
// “The text fragment directive is one such fragment directive that enables specifying a piece of text on the page, that matches the production:”
export type TextDirective = AsciiString; // should conform to the text directive grammar
export function isTextFragmentDirective(input: string): input is TextDirective {
    // TODO (use PEG.js?)
    return input.startsWith('text='); // TEMP
}


// § 3.5. Navigating to a Text Fragment

// https://wicg.github.io/scroll-to-text-fragment/#navigating-to-text-fragment
// This implements the amended version of step 3 of the HTML spec’s “scroll to the fragment” steps: <https://html.spec.whatwg.org/multipage/browsing-the-web.html#scroll-to-the-fragment-identifier>
export function scrollToTheFragment(indicatedPart: [Element, Range | null]): void {
    // (note that step 1 and 2 are irrelevant if the indicated part is an Element/Range, which we require here)

    // “Replace step 3.1 of the scroll to the fragment algorithm with the following:”

    // 1. (new) “Let target, range be the element and range that is the indicated part of the document.”
    const [target, range] = indicatedPart;

    // 2. (from original) “Set the Document's target element to target.”
    // TODO Perhaps we could fake this by applying any stylesheet rules for :target to target?

    // “Replace step 3.3 of the scroll to the fragment algorithm with the following:”

    // 3. (new) “Get the policy value for force-load-at-top in the Document. If the result is true, abort these steps.”
    // TODO (but this would require access to HTTP headers)

    // 4. (new) “If range is non-null:”
    if (range !== null) {
        // 1. “If the UA supports scrolling of text fragments on navigation, invoke Scroll range into view, with range range, containingElement target, behavior set to "auto", block set to "center", and inline set to "nearest".”
        scrollRangeIntoView(range, 'auto', 'center', 'nearest', target);
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
// “To find the first common ancestor of two nodes nodeA and nodeB, follow these steps:”
export function firstCommonAncestor(nodeA: Node, nodeB: Node): Node | never {
    // 1. “Let commonAncestor be nodeA.”
    let commonAncestor = nodeA;

    // 2. “While commonAncestor is non-null and is not a shadow-including inclusive ancestor of nodeB, let commonAncestor be commonAncestor’s shadow-including parent.”
    while (!isShadowIncludingInclusiveAncestor(commonAncestor, /* of */ nodeB))
        commonAncestor = shadowIncludingParent(commonAncestor) as Node;

    // 3. “Return commonAncestor.”
    return commonAncestor;
}

// https://wicg.github.io/scroll-to-text-fragment/#shadow-including-parent
// “To find the shadow-including parent of node follow these steps:”
export function shadowIncludingParent(node: Node): Node | null {
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
// “To scroll a DOMRect into view given a DOMRect bounding box, a scroll behavior behavior, a block flow direction position block, and an inline base direction position inline, and element startingElement, means to run these steps for each ancestor element or viewport of startingElement that establishes a scrolling box scrolling box, in order of innermost to outermost scrolling box:”
export function scrollDomRectIntoView(boundingBox: DOMRect, behavior: ScrollBehavior, block: ScrollLogicalPosition, inline: ScrollLogicalPosition, startingElement: Element): void {
    // “OMITTED”
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
        position: block ?? 'start', // presuming same default as for Element.scrollIntoView
        boundingBoxRelativeEdgeBegin: boundingBox.top,
        boundingBoxRelativeEdgeEnd: boundingBox.bottom,
        scrollBoxAbsoluteEdgeBegin: window.scrollY,
        boundingBoxSize: boundingBox.height,
        scrollBoxSize: document.documentElement.clientHeight,
    });
    const left = applyScrollLogicalPosition({
        position: inline ?? 'nearest', // presuming same default as for Element.scrollIntoView
        boundingBoxRelativeEdgeBegin: boundingBox.left,
        boundingBoxRelativeEdgeEnd: boundingBox.right,
        boundingBoxSize: boundingBox.width,
        scrollBoxAbsoluteEdgeBegin: window.scrollX,
        scrollBoxSize: document.documentElement.clientWidth,
    });
    window.scroll({ top, left, behavior });
}

// “Replace steps 3-14 of the scroll an element into view algorithm with a call to scroll a DOMRect into view:”
// “To scroll an element into view element, with a scroll behavior behavior, a block flow direction position block, and an inline base direction position inline, means to run these steps:”
export function scrollElementIntoView(element: Element, behavior: ScrollBehavior, block: ScrollLogicalPosition, inline: ScrollLogicalPosition) {
    // 1. “If the Document associated with element is not same origin with the Document associated with the element or viewport associated with box, terminate these steps.”
    // TODO (if this makes sense here at all?)

    // 2. “Let element bounding border box be the box that the return value of invoking getBoundingClientRect() on element represents.”
    const elementBoundingBorderBox = element.getBoundingClientRect();

    // 3. “Perform scroll a DOMRect into view given element bounding border box, options and element.”
    // XXX There is no “options” defined; presumably that should be “behavior, block, inline”.
    scrollDomRectIntoView(elementBoundingBorderBox, behavior, block, inline, element);
}

// https://wicg.github.io/scroll-to-text-fragment/#scroll-a-range-into-view
// “To scroll a Range into view, with input range range, scroll behavior behavior, a block flow direction position block, an inline base direction position inline, and an element containingElement:”
export function scrollRangeIntoView(range: Range, behavior: ScrollBehavior, block: ScrollLogicalPosition, inline: ScrollLogicalPosition, containingElement: Element): void {
    // 1. “Let bounding rect be the DOMRect that is the return value of invoking getBoundingClientRect() on range.”
    const boundingRect = range.getBoundingClientRect();

    // 2. “Perform scroll a DOMRect into view given bounding rect, behavior, block, inline, and containingElement.”
    scrollDomRectIntoView(boundingRect, behavior, block, inline, containingElement);
}


// § 3.5.2 Finding Ranges in a Document

// https://wicg.github.io/scroll-to-text-fragment/#process-a-fragment-directive

// “To process a fragment directive, given as input an ASCII string fragment directive input and a Document document, run these steps:”
export function processFragmentDirective(fragmentDirectiveInput: AsciiString | null, document: Document): Range[] {
    // 1. “If fragment directive input is not a valid fragment directive, then return an empty list.”
    if (!isValidFragmentDirective(fragmentDirectiveInput)) {
        return [];
    }

    // 2. “Let directives be a list of ASCII strings that is the result of strictly splitting the string fragment directive input on "&".”
    const directives = fragmentDirectiveInput.split('&');

    // 3. “Let ranges be a list of ranges, initially empty.”
    const ranges = [];

    // 4. “For each ASCII string directive of directives:”
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
            // 1. “Let prefixMatch be the the result of running the find a string in range steps with query parsedValues’s prefix, searchRange searchRange, wordStartBounded true and wordEndBounded false.”
            const prefixMatch = findStringInRange(parsedValues.prefix, searchRange, true, false);

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

            // 8. “Let mustEndAtWordBoundary be true if parsedValues’s textEnd is non-null or parsedValues’s suffix is null, false otherwise.”
            const mustEndAtWordBoundary = (parsedValues.textEnd !== null || parsedValues.suffix === null);

            // 9. “Set potentialMatch to the result of running the find a string in range steps with query parsedValues’s textStart, searchRange matchRange, wordStartBounded false, and wordEndBounded mustEndAtWordBoundary.”
            potentialMatch = findStringInRange(parsedValues.textStart, matchRange, false, mustEndAtWordBoundary);

            // 10. “If potentialMatch is null, return null.”
            if (potentialMatch === null)
                return null;

            // 11. “If potentialMatch’s start is not matchRange’s start, then continue.”
            if (!samePoint(getStart(potentialMatch), getStart(matchRange)))
                continue;
        }
        // 3. “Otherwise:”
        else {
            // 1. “Let mustEndAtWordBoundary be true if parsedValues’s textEnd is non-null or parsedValues’s suffix is null, false otherwise.”
            const mustEndAtWordBoundary = (parsedValues.textEnd !== null || parsedValues.suffix === null);

            // 2. “Set potentialMatch to the result of running the find a string in range steps with query parsedValues’s textStart, searchRange searchRange, wordStartBounded true, and wordEndBounded mustEndAtWordBoundary.”
            potentialMatch = findStringInRange(parsedValues.textStart, searchRange, true, mustEndAtWordBoundary);

            // 3. “If potentialMatch is null, return null.”
            if (potentialMatch === null)
                return null;

            // 4. “Set searchRange’s start to the first boundary point after potentialMatch’s start”
            // XXX I suppose we can be certain a next boundary point always exist in this case; can we proof this?
            searchRange.setStart(...firstBoundaryPointAfter(getStart(potentialMatch)) as BoundaryPoint);
        }

        // 4. “If parsedValues’s textEnd item is non-null, then:”
        if (parsedValues.textEnd !== null) {
            // 1. “Let textEndRange be a range whose start is potentialMatch’s end and whose end is searchRange’s end.”
            const textEndRange = document.createRange();
            textEndRange.setStart(...getEnd(potentialMatch));
            textEndRange.setEnd(...getEnd(searchRange));

            // 2. “Let mustEndAtWordBoundary be true if parsedValues’s suffix is null, false otherwise.”
            const mustEndAtWordBoundary = parsedValues.suffix === null;

            // 3. “Let textEndMatch be the result of running the find a string in range steps with query parsedValues’s textEnd, searchRange textEndRange, wordStartBounded true, and wordEndBounded mustEndAtWordBoundary.”
            const textEndMatch = findStringInRange(parsedValues.textEnd, textEndRange, true, mustEndAtWordBoundary);

            // 4. “If textEndMatch is null then return null.”
            if (textEndMatch === null)
                return null;

            // 5. “Set potentialMatch’s end to textEndMatch’s end.”
            potentialMatch.setEnd(...getEnd(textEndMatch));
        }

        // 5. “Assert: potentialMatch is non-null, not collapsed and represents a range exactly containing an instance of matching text.” XXX the last assertion sounds rather vague.
        // assert(
        //     potentialMatch !== null
        //     && !potentialMatch.collapsed
        //     && new RegExp('^' + escapeRegExp(textStart) + '.*' + escapeRegExp(textEnd) + '$').test(potentialMatch.toString())  // …or something similar?
        // );

        // 6. “If parsedValues’s suffix is null, return potentialMatch.”
        if (parsedValues.suffix === null)
            return potentialMatch;

        // 7. “Let suffixRange be a range with start equal to potentialMatch’s end and end equal to searchRange’s end.”
        const suffixRange = document.createRange();
        suffixRange.setStart(...getEnd(potentialMatch));
        suffixRange.setEnd(...getEnd(searchRange));

        // 8. “Advance suffixRange’s start to the next non-whitespace position.”
        advanceRangeStartToNextNonWhitespacePosition(suffixRange);

        // 9. “Let suffixMatch be result of running the find a string in range steps with query parsedValues’s suffix, searchRange suffixRange, wordStartBounded false, and wordEndBounded true.”
        const suffixMatch = findStringInRange(parsedValues.suffix, suffixRange, false, true);

        // 10. “If suffixMatch is null then return null.”
        if (suffixMatch === null)
            return null;

        // 11. “If suffixMatch’s start is suffixRange’s start, return potentialMatch.”
        if (samePoint(getStart(suffixMatch), getStart(suffixRange)))
            return potentialMatch;
    }

    // 3. “Return null”
    return null;
}

// https://wicg.github.io/scroll-to-text-fragment/#next-non-whitespace-position
// “To advance a range range’s start to the next non-whitespace position follow the steps:”
export function advanceRangeStartToNextNonWhitespacePosition(range: Range) {
    // 1. “While range is not collapsed:”
    while (!range.collapsed) {
        // 1. “Let node be range’s start node.”
        const node = range.startContainer;

        // 2. “Let offset be range’s start offset.”
        const offset = range.startOffset;

        // 3. “If node is part of a non-searchable subtree then:”
        if (partOfNonSearchableSubtree(node)) {
            // 1. “Set range’s start node to the next node, in shadow-including tree order, that isn’t a shadow-including descendant of node, and set its start offset to 0.”
            range.setStart(
                nextNodeInShadowIncludingTreeOrderThatIsNotAShadowIncludingDescendantOf(node) as Node, // XXX Can we be sure there is a next node? Asserting it here.
                0,
            );

            // 2. “Continue.”
            continue;
        }

        // 4. “If node is not a visible text node:”
        if (!isVisibleTextNode(node)) {
            // 1. “Set range’s start node to the next node, in shadow-including tree order, and set its start offset to 0.”
            range.setStart(
                nextNodeInShadowIncludingTreeOrder(node) as Node, // XXX Can we be sure there is a next node? Asserting it here.
                0,
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

        // 8. “If range’s start offset is equal to node’s length, set range’s start node to the next node in shadow-including tree order, and set its start offset to 0.”
        if (range.startOffset === nodeLength(node)) {
            range.setStart(
                nextNodeInShadowIncludingTreeOrder(node) as Node, // XXX Can we be sure there is a next node? Asserting it here.
                0,
            );
        }
    }
}

// https://wicg.github.io/scroll-to-text-fragment/#find-a-string-in-range
// To find a string in range given a string query, a range searchRange, and booleans wordStartBounded and wordEndBounded, run these steps:
export function findStringInRange(query: string, searchRange: Range, wordStartBounded: boolean, wordEndBounded: boolean): Range | null {
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

            // 1. “Set searchRange’s start node to the next node, in shadow-including tree order, that is not a doctype, and set its start offset to 0.”
            curNode = nextNodeInShadowIncludingTreeOrder(curNode);
            while (curNode && curNode.nodeType === Node.DOCUMENT_TYPE_NODE)
                curNode = nextNodeInShadowIncludingTreeOrder(curNode);
            searchRange.setStart(
                curNode as Node, // XXX Can we be sure there is a next node? Asserting it here.
                0,
            );

            // 2. “Continue.”
            continue;
        }

        // 4. “Let blockAncestor be the nearest block ancestor of curNode.”
        const blockAncestor = nearestBlockAncestorOf(curNode);

        // 5. “Let textNodeList be a list of Text nodes, initially empty.”
        const textNodeList: Text[] = [];

        // 6. “While curNode is a shadow-including descendant of blockAncestor and the position of the boundary point (curNode, 0) is not after searchRange’s end:”
        while (
            curNode && isShadowIncludingDescendant(curNode, /* of */ blockAncestor)
            && searchRange.comparePoint(curNode, 0) !== 1
        ) {

            // 1. “If curNode has block-level display then break.”
            if (hasBlockLevelDisplay(curNode)) {
                break;
            }

            // 2. “If curNode is search invisible:”
            if (isSearchInvisible(curNode)) {

                // 1. “Set curNode to the next node in shadow-including tree order that isn’t a shadow-including descendant of curNode.”
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

        // 7. “Run the find a range from a node list steps given query, searchRange, textNodeList, wordStartBounded and wordEndBounded as input. If the resulting range is not null, then return it.”
        const resultingRange = findARangeFromANodeList(query, searchRange, textNodeList, wordStartBounded, wordEndBounded);
        if (resultingRange !== null) {
            return resultingRange;
        }

        // 8. “If curNode is null, then break.”
        if (curNode === null)
            break;

        // 9. “Assert: curNode follows searchRange’s start node.”
        // assert(searchRange.startContainer.compareDocumentPosition(curNode) & Node.DOCUMENT_POSITION_FOLLOWING);

        // 10. “Set searchRange’s start to the boundary point (curNode, 0).”
        searchRange.setStart(curNode, 0);
    }

    // 2. “Return null.”
    return null;
}

// https://wicg.github.io/scroll-to-text-fragment/#search-invisible
// “A node is search invisible…”
export function isSearchInvisible(node: Node): boolean {
    // “…if it is an element in the HTML namespace and meets any of the following conditions:”
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
// “A node is part of a non-searchable subtree if it is or has a shadow-including ancestor that is search invisible.”
export function partOfNonSearchableSubtree(node: Node): boolean {
    let curNode: Node | null = node;
    while (curNode) {
        if (isSearchInvisible(curNode))
            return true;
        curNode = shadowIncludingParent(curNode);
    }
    return false;
}

// https://wicg.github.io/scroll-to-text-fragment/#visible-text-node
// “A node is a visible text node if it is a Text node, the computed value of its parent element's visibility property is visible, and it is being rendered.”
export type VisibleTextNode = Text; // could be `unique Text`, when (if) TypeScript will support that.
export function isVisibleTextNode(node: Node): node is VisibleTextNode {
    return (
        node.nodeType === Node.TEXT_NODE
        && node.parentElement !== null
        && getComputedStyle(node.parentElement).visibility === 'visible'
        && isBeingRendered(node.parentElement)
    );
}

// https://wicg.github.io/scroll-to-text-fragment/#has-block-level-display
// “A node has block-level display if it is an element and the computed value of its display property is any of block, table, flow-root, grid, flex, list-item.”
export function hasBlockLevelDisplay(node: Node): boolean {
    return (
        isElement(node)
        && ['block', 'table', 'flow-root', 'grid', 'flex', 'list-item'].includes(getComputedStyle(node).display)
    );
}

// https://wicg.github.io/scroll-to-text-fragment/#nearest-block-ancestor
// “To find the nearest block ancestor of a node follow the steps:”
export function nearestBlockAncestorOf(node: Node): Node {
    // 1. “Let curNode be node.”
    let curNode: Node | null = node;

    // 2. “While curNode is non-null”
    while (curNode !== null) {

        // 1. “If curNode is not a Text node and it has block-level display then return curNode.”
        if (curNode.nodeType !== Node.TEXT_NODE && hasBlockLevelDisplay(curNode))
            return curNode;

        // 2. “Otherwise, set curNode to curNode’s parent.”
        else
            curNode = curNode.parentNode;
    }

    // 3. “Return node’s node document's document element.”
    return (node.ownerDocument ?? node as Document).documentElement;
}

// https://wicg.github.io/scroll-to-text-fragment/#find-a-range-from-a-node-list
// “To find a range from a node list given a search string queryString, a range searchRange, a list of Text nodes nodes, and booleans wordStartBounded and wordEndBounded, follow these steps:”
export function findARangeFromANodeList(queryString: string, searchRange: Range, nodes: Text[], wordStartBounded: boolean, wordEndBounded: boolean): Range | null {
    // 1. “Let searchBuffer be the concatenation of the data of each item in nodes.”
    // “ISSUE 1 data is not correct here since that’s the text data as it exists in the DOM. This algorithm means to run over the text as rendered (and then convert back to Ranges in the DOM). <https://github.com/WICG/scroll-to-text-fragment/issues/98>”
    const searchBuffer = nodes.map(node => node.data).join('');

    // 2. “Let searchStart be 0.”
    let searchStart = 0;

    // 3. “If the first item in nodes is searchRange’s start node then set searchStart to searchRange’s start offset.”
    if (nodes[0] === searchRange.startContainer)
        searchStart = searchRange.startOffset;

    // 4. “Let start and end be boundary points, initially null.”
    let start: BoundaryPoint | null = null;
    let end: BoundaryPoint | null = null;

    // 5. “Let matchIndex be null.”
    let matchIndex = null;

    // 6. “While matchIndex is null”
    while (matchIndex === null) {
        // 1. “Set matchIndex to the index of the first instance of queryString in searchBuffer, starting at searchStart. The string search must be performed using a base character comparison, or the primary level, as defined in [UTS10].”
        // TODO implement base character comparison (i.e. ignoring accents, etc.)
        // XXX It would be helpful to have more specific guidance than merely a link to UTS10 <https://www.unicode.org/reports/tr10/tr10-43.html>
        matchIndex = searchBuffer.toLowerCase().indexOf(queryString.toLowerCase(), searchStart); // TEMP case-insensitive string match will have to suffice for now.

        // 2. “If matchIndex is null, return null.”
        if (matchIndex === -1)
            return null;

        // 3. “Let endIx be matchIndex + queryString’s length.”
        const endIx = matchIndex + queryString.length;

        // 4. “Set start to the boundary point result of get boundary point at index matchIndex run over nodes with isEnd false.”
        start = getBoundaryPointAtIndex(matchIndex, nodes, false) as BoundaryPoint;

        // 5. “Set end to the boundary point result of get boundary point at index endIx run over nodes with isEnd true.”
        end = getBoundaryPointAtIndex(endIx, nodes, true) as BoundaryPoint;

        // XXX Assert start and end are non-null? (should be correct, as matchIndex and endIx are both less than the search text’s length)

        // 6. “If wordStartBounded is true and matchIndex is not at a word boundary in searchBuffer, given the language from start’s node as the locale; or wordEndBounded is true and matchIndex + queryString’s length is not at a word boundary in searchBuffer, given the language from end’s node as the locale:”
        if (
            wordStartBounded && !isAtWordBoundary(matchIndex, searchBuffer, languageOf(start[0]))
            || wordEndBounded && !isAtWordBoundary(matchIndex + queryString.length, searchBuffer, languageOf(end[0]))
        ) {

            // 1. “Set searchStart to matchIndex + 1.”
            searchStart = matchIndex + 1;

            // 2. “Set matchIndex to null.”
            matchIndex = null;
        }
    }

    // 7. “Let endInset be 0.”
    let endInset = 0;

    // 8. “If the last item in nodes is searchRange’s end node then set endInset to (searchRange’s end node's length − searchRange’s end offset)”
    if (nodes[nodes.length - 1] === searchRange.endContainer)
        endInset = (searchRange.endContainer as Text).length - searchRange.endOffset;

    // 9. “If matchIndex + queryString’s length is greater than searchBuffer’s length − endInset return null.”
    if (matchIndex + queryString.length > searchBuffer.length - endInset)
        return null;

    // 10. “Assert: start and end are non-null, valid boundary points in searchRange.”
    // assert(start !== null && end !== null && searchRange.comparePoint(...start) === 0 && searchRange.comparePoint(...end) === 0);
    start = start as BoundaryPoint;
    end = end as BoundaryPoint;

    // 11. “Return a range with start start and end end.”
    const result = document.createRange();
    result.setStart(...start);
    result.setEnd(...end);
    return result;
}

// https://wicg.github.io/scroll-to-text-fragment/#get-boundary-point-at-index
// “To get boundary point at index, given an integer index, list of Text nodes nodes, and a boolean isEnd, follow these steps:”
export function getBoundaryPointAtIndex(index: Integer, nodes: Text[], isEnd: boolean): BoundaryPoint | null {
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

// https://wicg.github.io/scroll-to-text-fragment/#word-boundary:
// “A word boundary is defined in [UAX29] in Unicode Text Segmentation §Word_Boundaries. Unicode Text Segmentation §Default_Word_Boundaries defines a default set of what constitutes a word boundary, but as the specification mentions, a more sophisticated algorithm should be used based on the locale.”

// https://wicg.github.io/scroll-to-text-fragment/#locale
// “A locale is a string containing a valid [BCP47] language tag, or the empty string. An empty string indicates that the primary language is unknown.”
// (the locale type is defined in ./common.ts and imported above)

// https://wicg.github.io/scroll-to-text-fragment/#is-at-a-word-boundary
// “A number position is at a word boundary in a string text, given a locale locale, if, using locale, …”
export function isAtWordBoundary(position: number, text: string, locale: Locale) {
    // “…either a word boundary immediately precedes the positionth code unit, …”
    // TODO Implement the “default word boundary specification” of the referenced unicode spec.
    // TEMP Just use a regular expression to test against a pair of alphanumeric characters.
    if (text.charAt(position) && text.substring(position - 1, position + 1).match(/^[\w\d]{2,2}$/) === null)
        return true;

    // “…or text’s length is more than 0 and position equals either 0 or text’s length.”
    if (text.length > 0 && (position === 0 || position === text.length))
        return true;

    return false;
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



  //////////////////////////////////////
 /// Simple helpers for readability ///
//////////////////////////////////////


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
