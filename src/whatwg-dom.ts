  /////////////////////////////////////////////
 // Required pieces of the WHATWG DOM spec ///
/////////////////////////////////////////////

// Based on the version of 29 June 2020 <https://dom.spec.whatwg.org/commit-snapshots/e191f73a0fcc09c48f9e962188748f811b09c239/>


import {
    isElement,
    nextNode,
} from './common.js';

type NonNegativeInteger = number;
type Count = number;


// https://dom.spec.whatwg.org/#concept-tree-descendant
// “An object A is called a descendant of an object B, if either A is a child of B or A is a child of an object C that is a descendant of B.”
export function isDescendant(nodeA: Node, nodeB: Node): boolean {
    if (nodeA.parentNode === nodeB)
        return true;
    const nodeC = nodeA.parentNode;
    if (nodeC && isDescendant(nodeC, nodeB))
        return true;
    return false;
}

// https://dom.spec.whatwg.org/#concept-node-length
// “To determine the length of a node node, switch on node:”
export function nodeLength(node: Node): number {
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
export function nextNodeInShadowIncludingTreeOrder(node: Node): Node | null {
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
export type ShadowHost = Element & { shadowRoot: ShadowRoot }
export function isShadowHost(node: Node): node is ShadowHost {
    return (isElement(node) && node.shadowRoot !== null);
}

// https://dom.spec.whatwg.org/#concept-shadow-including-descendant
// “An object A is a shadow-including descendant of an object B, if A is a descendant of B, or A’s root is a shadow root and A’s root’s host is a shadow-including inclusive descendant of B.”
export function isShadowIncludingDescendant(nodeA: Node, nodeB: Node): boolean {
    if (isDescendant(nodeA, nodeB))
        return true;
    const nodeARoot = nodeA.getRootNode();
    if (nodeARoot instanceof ShadowRoot && isShadowIncludingInclusiveDescendant(nodeARoot.host, nodeB))
        return true;
    return false;
}

// https://dom.spec.whatwg.org/#concept-shadow-including-inclusive-descendant
// “A shadow-including inclusive descendant is an object or one of its shadow-including descendants.”
export function isShadowIncludingInclusiveDescendant(nodeA: Node, nodeB: Node): boolean {
    if (nodeA === nodeB)
        return true;
    if (isShadowIncludingDescendant(nodeA, nodeB))
        return true;
    return false;
}

// https://dom.spec.whatwg.org/#concept-shadow-including-ancestor
// “An object A is a shadow-including ancestor of an object B, if and only if B is a shadow-including descendant of A.”
export function isShadowIncludingAncestor(nodeA: Node, nodeB: Node): boolean {
    return isShadowIncludingDescendant(nodeB, nodeA);
}

// https://dom.spec.whatwg.org/#concept-shadow-including-inclusive-ancestor
// “A shadow-including inclusive ancestor is an object or one of its shadow-including ancestors.”
export function isShadowIncludingInclusiveAncestor(nodeA: Node, nodeB: Node): boolean {
    if (nodeA === nodeB)
        return true;
    if (isShadowIncludingAncestor(nodeA, nodeB))
        return true;
    return false;
}

// https://dom.spec.whatwg.org/#concept-cd-substring
// “To substring data with node node, offset offset, and count count, run these steps:”
export function substringData(
    node: CharacterData, // XXX The spec says “node node”, but reads “node’s data” which is only defined for CharacterData nodes.
    offset: number,
    count: Count
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
export type BoundaryPoint = [Node, NonNegativeInteger];
