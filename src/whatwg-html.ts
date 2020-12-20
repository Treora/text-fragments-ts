  ///////////////////////////////////////////////
 /// Required pieces of the WHATWG HTML Spec ///
///////////////////////////////////////////////

// Based on the version of 13 August 2020 <https://html.spec.whatwg.org/commit-snapshots/3c52fe139d9c637eb901932a77d743d6d5ecaa56/>


import {
    Locale,
    isElement,
} from './common.js';

import {
    asciiWhitespace,
    htmlNamespace,
    xmlNamespace,
} from './whatwg-infra.js';


// § 3.2.6.2 The lang and xml:lang attributes
// https://html.spec.whatwg.org/multipage/dom.html#language
export function languageOf(node: Node): Locale {
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
export function getPragmaSetDefaultLanguage(): string | undefined {
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
        while (position < input.length && asciiWhitespace.includes(input[position]))
            position++;

        // 6. “Collect a sequence of code points that are not ASCII whitespace from input given position.”
        // 7. “Let candidate be the string that resulted from the previous step.”
        let candidate = '';
        while (!asciiWhitespace.includes(input[position])) {
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


// § 12.1.2 Elements
// https://html.spec.whatwg.org/multipage/syntax.html#void-elements
export const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];


// § 12.2 Parsing HTML documents
// https://html.spec.whatwg.org/multipage/parsing.html#serializes-as-void
// “For the purposes of the following algorithm, an element serializes as void if its element type is one of the void elements, or is basefont, bgsound, frame, or keygen.”
export function serializesAsVoid(element: Element): boolean {
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
export function isBeingRendered(element: Element) {
    // “Note … The presence of the hidden attribute normally means the element is not being rendered, though this might be overridden by the style sheets.”
    // TODO figure out what exactly we should/could test.
    return !element.hasAttribute('hidden'); // TEMP
}
