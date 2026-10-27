/**
 * Just enough XML for GPX and KML, read from text so it runs anywhere: elements by tag, with or
 * without a namespace prefix, their attributes and text, and escaping for writing. Pure.
 */

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** Text content: CDATA as written, entities decoded. */
export function decode(text: string): string {
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(text);
  if (cdata) return cdata[1];
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, ref: string) => {
    if (ref[0] !== "#") return ENTITIES[ref] ?? whole;
    const code = ref[1] === "x" || ref[1] === "X" ? Number.parseInt(ref.slice(2), 16) : Number.parseInt(ref.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

/** The document without its comments. */
export const uncommented = (text: string) => text.replace(/<!--[\s\S]*?-->/g, "");

/** Whether the document's elements include `tag`. */
export const has = (xml: string, tag: string) => new RegExp(`<(?:[\\w-]+:)?${tag}\\b`).test(xml);

/** Elements named `tag`, with or without a namespace prefix: their attributes and their content. */
export function elements(xml: string, tag: string): { attrs: string; body: string }[] {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}\\s*>)`, "g");
  return [...xml.matchAll(re)].map((m) => ({ attrs: m[1], body: m[2] ?? "" }));
}

/** An attribute's value. */
export const attr = (attrs: string, name: string) => new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`).exec(attrs)?.[1];

/** The first `tag` element's text, decoded and trimmed, or null. */
export function text(body: string, tag: string): string | null {
  const m = new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}\\s*>`).exec(body);
  return m ? decode(m[1]).trim() || null : null;
}

/** The element's own `<name>`, ignoring those of the `inner` elements inside it. */
export function ownName(body: string, inner?: string): string | null {
  const own = inner ? body.split(new RegExp(`<(?:[\\w-]+:)?${inner}\\b`))[0] : body;
  return text(own, "name");
}

/** Text made safe inside an element or an attribute. */
export const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
