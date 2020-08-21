declare type nonNegativeInteger = number;
declare type count = number;
export declare function isDescendant(nodeA: Node, nodeB: Node): boolean;
export declare function followsInTree(nodeA: Node, nodeB: Node): boolean;
export declare function nodeLength(node: Node): number;
export declare function nextNodeInShadowIncludingTreeOrder(node: Node): Node | null;
export declare type ShadowHost = Element & {
    shadowRoot: ShadowRoot;
};
export declare function isShadowHost(node: Node): node is ShadowHost;
export declare function isShadowIncludingDescendant(nodeA: Node, nodeB: Node): boolean;
export declare function isShadowIncludingInclusiveDescendant(nodeA: Node, nodeB: Node): boolean;
export declare function isShadowIncludingAncestor(nodeA: Node, nodeB: Node): boolean;
export declare function isShadowIncludingInclusiveAncestor(nodeA: Node, nodeB: Node): boolean;
export declare function substringData(node: CharacterData, // XXX The spec says “node node”, but reads “node’s data” which is only defined for CharacterData nodes.
offset: number, count: count): string;
export declare type BoundaryPoint = [Node, nonNegativeInteger];
export {};
//# sourceMappingURL=whatwg-dom.d.ts.map