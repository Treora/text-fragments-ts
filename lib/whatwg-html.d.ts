import { integer, locale, nonEmptyString } from './common.js';
export declare function languageOf(node: Node): locale;
export declare function getPragmaSetDefaultLanguage(): string | undefined;
export declare type origin = opaqueOrigin | tupleOrigin;
export declare type opaqueOrigin = symbol;
export declare type tupleOrigin = [string, string | integer | integer[], // integers for IP addresses
// integers for IP addresses
integer | null, nonEmptyString | null];
export declare const voidElements: string[];
export declare function serializesAsVoid(element: Element): boolean;
export declare function isBeingRendered(element: Element): boolean;
//# sourceMappingURL=whatwg-html.d.ts.map