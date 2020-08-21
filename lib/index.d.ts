import { nonEmptyString, integer, locale } from './common.js';
import { BoundaryPoint } from './whatwg-dom.js';
import { origin } from './whatwg-html.js';
export declare const fragmentDirectiveDelimiter = ":~:";
export declare function initializeDocumentFragmentDirective(document: Document): {
    documentUrl: string;
    documentFragmentDirective: string | null;
};
export declare function parseTextDirective(textDirectiveInput: TextDirective): ParsedTextDirective | null;
export interface ParsedTextDirective {
    textStart: nonEmptyString;
    textEnd: nonEmptyString | null;
    prefix: nonEmptyString | null;
    suffix: nonEmptyString | null;
}
export declare type ValidFragmentDirective = string;
export declare function isValidFragmentDirective(input: string | null): input is ValidFragmentDirective;
export declare type TextDirective = string;
export declare function isTextFragmentDirective(input: string): input is TextDirective;
export declare function shouldAllowTextFragment(isUserTriggered: boolean, incumbentNavigationOrigin: origin | null, document: Document): boolean;
export declare function scrollToTheFragment(indicatedPart: [Element, Range | null]): void;
export declare function indicatedPartOfTheDocument_beginning({ document, documentFragmentDirective, documentAllowTextFragmentDirective }: {
    document: Document;
    documentFragmentDirective: string | null;
    documentAllowTextFragmentDirective: boolean;
}): {
    documentIndicatedPart: [Element, Range] | undefined;
    ranges?: Range[];
};
export declare function firstCommonAncestor(nodeA: Node, nodeB: Node): Node | never;
export declare function shadowIncludingParent(node: Node): Node | null;
export declare function scrollDomRectIntoView(boundingBox: DOMRect, options: ScrollIntoViewOptions, startingElement: Element): void;
export declare function scrollElementIntoView(element: Element, behavior: ScrollBehavior, block: ScrollLogicalPosition, inline: ScrollLogicalPosition): void;
export declare function scrollRangeIntoView(range: Range, containingElement: Element, options: ScrollIntoViewOptions): void;
export declare function processFragmentDirective(fragmentDirectiveInput: string | null, document: Document): Range[];
export declare function findRangeFromTextDirective(parsedValues: ParsedTextDirective, document: Document): Range | null;
export declare function advanceRangeStartToNextNonWhitespacePosition(range: Range): void;
export declare function findStringInRange(query: string, searchRange: Range): Range | null;
export declare function isSearchInvisible(node: Node): boolean;
export declare function partOfNonSearchableSubtree(node: Node): boolean;
export declare type VisibleTextNode = Text;
export declare function isVisibleTextNode(node: Node): node is VisibleTextNode;
export declare function hasBlockLevelDisplay(node: Node): boolean;
export declare function nearestBlockAncestorOf(node: Node): Node;
export declare function findARangeFromANodeList(queryString: string, searchRange: Range, nodes: Text[]): Range | null;
export declare function getBoundaryPointAtIndex(index: integer, nodes: Text[], isEnd: boolean): BoundaryPoint | null;
export declare function isWordBounded(text: string, startPosition: integer, count: number, startLocale: locale, endLocale: locale): boolean;
export interface FragmentDirective {
}
export declare function browserSupportsTextFragments(): boolean;
//# sourceMappingURL=index.d.ts.map