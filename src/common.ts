export type Locale = string;

export function nextNode(node: Node): Node | null {
    const walker = (node.ownerDocument ?? node as Document).createTreeWalker(node.getRootNode());
    walker.currentNode = node;
    return walker.nextNode();
}

export function isElement(node: Node): node is Element {
    return node.nodeType === Node.ELEMENT_NODE
}
