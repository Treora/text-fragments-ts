export function nextNode(node) {
    var _a;
    const walker = ((_a = node.ownerDocument) !== null && _a !== void 0 ? _a : node).createTreeWalker(node.getRootNode());
    walker.currentNode = node;
    return walker.nextNode();
}
export function isElement(node) {
    return node.nodeType === Node.ELEMENT_NODE;
}
//# sourceMappingURL=common.js.map