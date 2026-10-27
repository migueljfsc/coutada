/**
 * The anonymous counters the browser bumps (D26): fire and forget, nothing about who. The Worker
 * holds the whole list (worker/lib/usage.ts), and a test holds this one inside it.
 */

export const BROWSER_EVENTS = [
  "page.map",
  "page.shared",
  "page.hunt",
  "offline.download",
  "import.gpx",
  "import.kml",
  "import.geojson",
  "export.gpx",
  "export.kml",
  "export.geojson",
] as const;

export type BrowserEvent = (typeof BROWSER_EVENTS)[number];

export function count(event: BrowserEvent): void {
  void fetch("/api/usage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event }),
  }).catch(() => undefined);
}

/** The page a load opened, by its route's kind, counted once per load; the operator's page is not. */
export function pageEvent(kind: string): BrowserEvent | null {
  if (kind === "admin" || kind === "privacy") return null;
  return kind === "shared" ? "page.shared" : kind === "hunt" ? "page.hunt" : "page.map";
}
