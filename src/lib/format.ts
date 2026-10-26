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
