/**
 * Coordinates as people write and paste them (D28): decimal degrees ("39.882, -6.918"), degrees
 * and minutes ("N39 52.917 W6 55.083"), or degrees, minutes and seconds ("39°52'55"N 6°55'05"W"),
 * with signs or N/S/E/W, latitude first unless the letters say otherwise. Pure.
 */

import type { Position } from "./geo";

const NUMBER = /-?\d+(?:\.\d+)?/g;

/** One half's value in degrees, from one to three numbers, signed by "-" or S/W. */
function degrees(half: string): { value: number; hemisphere: string | null } | null {
  const hemisphere = /[NSEW]/.exec(half)?.[0] ?? null;
  const parts = half.match(NUMBER)?.map(Number) ?? [];
  if (parts.length < 1 || parts.length > 3) return null;
  const [d, m = 0, s = 0] = parts;
  if (m < 0 || m >= 60 || s < 0 || s >= 60 || (parts.length > 1 && !Number.isInteger(d))) return null;
  const negative = d < 0 || Object.is(d, -0) || /^\s*-/.test(half) || hemisphere === "S" || hemisphere === "W";
  const value = Math.abs(d) + m / 60 + s / 3600;
  return { value: negative ? -value : value, hemisphere };
}

/** The two halves of a pair, split where the letters, a separator or a space between two numbers say. */
function halves(text: string): [string, string] | null {
  if (/^[NS]/.test(text)) {
    const at = text.search(/[EW]/);
    return at > 0 ? [text.slice(0, at), text.slice(at)] : null;
  }
  const suffix = /^(.*?[NS])\s*(.*[EW].*)$/.exec(text) ?? /^(.*?[EW])\s*(.*[NS].*)$/.exec(text);
  if (suffix) return [suffix[1], suffix[2]];
  const split = text.split(/\s*[;,]\s*|\s+/).filter(Boolean);
  return split.length === 2 ? [split[0], split[1]] : null;
}

/** `[lon, lat]` from what was typed or pasted, or null when it is not a pair of coordinates. */
export function parseCoordinates(input: string): Position | null {
  let text = input
    .trim()
    .toUpperCase()
    .replace(/[º˚]/g, "°")
    .replace(/[′’‘]/g, "'")
    .replace(/[″“”]|''/g, '"');
  if (!text || /[^0-9NSEW°'".,;\s+-]/.test(text)) return null;
  // A decimal comma only where no point is used and the pair is split by a space or a semicolon.
  if (!text.includes(".") && /\d,\d/.test(text) && /\d,\d+[\s;]+-?\d/.test(text)) text = text.replace(/(\d),(\d)/g, "$1.$2");
  const pair = halves(text);
  if (!pair) return null;
  const [a, b] = pair.map(degrees);
  if (!a || !b) return null;
  const swap = a.hemisphere === "E" || a.hemisphere === "W" || b.hemisphere === "N" || b.hemisphere === "S";
  const [lat, lon] = swap ? [b.value, a.value] : [a.value, b.value];
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return [Math.round(lon * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6];
}
