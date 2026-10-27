/** Lengths and areas as a person reads them, in the reader's locale. */

export function formatLength(metres: number, locale: string): string {
  if (metres < 1000) return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(metres)} m`;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(metres / 1000)} km`;
}

export function formatArea(squareMetres: number, locale: string): string {
  if (squareMetres < 10_000) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(squareMetres)} m²`;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(squareMetres / 10_000)} ha`;
}

/** Bytes as kilobytes, megabytes or gigabytes, in the reader's locale. */
export function formatBytes(bytes: number, locale: string): string {
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: value < 10 ? 1 : 0 }).format(value)} ${units[unit]}`;
}

const STEPS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.35],
  ["month", 12],
  ["year", Infinity],
];

/** How long ago `at` was, from `now` (both ms), in the reader's words: "3 minutes ago", "há 2 dias". */
export function formatAgo(at: number, now: number, locale: string): string {
  let value = Math.max(0, now - at) / 1000;
  for (const [unit, size] of STEPS) {
    if (value < size || unit === "year") {
      const n = unit === "second" && value < 45 ? 0 : Math.round(value);
      return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-n, unit);
    }
    value /= size;
  }
  return "";
}

/** A moment as a date and a time of day, in the reader's locale and time zone. */
export const formatMoment = (at: number, locale: string, timeZone?: string): string =>
  new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone }).format(at);

/** A time of day, in the reader's locale and time zone. */
export const formatTime = (at: number, locale: string, timeZone?: string): string =>
  new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone }).format(at);
