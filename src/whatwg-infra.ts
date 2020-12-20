  ////////////////////////////////////////////////
 /// Required pieces of the WHATWG Infra Spec ///
////////////////////////////////////////////////

// Based on the version of 6 August 2020 <https://infra.spec.whatwg.org/commit-snapshots/38caa3d54ec94b757326b18b0b6cfb39c454f1de/>

// https://infra.spec.whatwg.org/#ascii-whitespace
// “ASCII whitespace is U+0009 TAB, U+000A LF, U+000C FF, U+000D CR, or U+0020 SPACE.”
export const asciiWhitespace = '\u0009\u000a\u000c\u000d\u0020';

// https://infra.spec.whatwg.org/#ascii-string
// “An ASCII string is a string whose code points are all ASCII code points.”
export type AsciiString = string;

// https://infra.spec.whatwg.org/#html-namespace
// “The HTML namespace is "http://www.w3.org/1999/xhtml".”
export const htmlNamespace = 'http://www.w3.org/1999/xhtml';

// https://infra.spec.whatwg.org/#xml-namespace
// “The XML namespace is "http://www.w3.org/XML/1998/namespace".”
export const xmlNamespace = 'http://www.w3.org/XML/1998/namespace';
