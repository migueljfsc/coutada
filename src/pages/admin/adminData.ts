/**
 * The numbers behind the operator's charts (D26), their shapes, and their colours.
 *
 * One rule per colour. A single series wears anil, the app's own blue. The sign-in split takes
 * three categorical hues in fixed order, never orange, which is the map's colour for people.
 * "Last seen" is a one-hue ramp, darkest for the most recent, with "never" in neutral grey. All
 * were validated against the bone chart surface (#e8e2d4) for contrast and colour-blind separation.
 */

export const DAY_S = 24 * 60 * 60;

export const ANIL = "#1e4fa0";
export const CATEGORICAL = ["#2a78d6", "#1baf7a", "#6250d6"] as const;
/** Most recent first: darkest on a light surface reads as "most". */
export const RECENCY = ["#0f3366", "#184f95", "#256abf", "#3987e5", "#6a9fe0"] as const;
export const NEUTRAL = "#7d8277";

type Day = { day: string; n: number };

export type AdminUserSummary = {
  id: string;
  email: string;
  display_name: string | null;
  created_at: number;
  last_login_at: number | null;
  last_seen_at: number | null;
  maps: number;
  shared: number;
  bytes: number;
  last_map_at: number | null;
};

export type AdminStats = {
  totals: {
    users: number;
    signups_7d: number;
    signups_30d: number;
    active_1d: number;
    active_7d: number;
    active_30d: number;
    devices: number;
    devices_new_7d: number;
    devices_active_7d: number;
    maps: number;
    maps_on_devices: number;
    maps_created_7d: number;
    maps_updated_7d: number;
    shared: number;
    hunts_live: number;
    sessions: number;
    bytes: number;
  };
  users: AdminUserSummary[];
  series: { since: number; days: number; signups: Day[]; maps: Day[]; usersBefore: number };
  methods: { google: number; password: number; both: number };
  usage: Array<{ day: string; event: string; n: number }>;
};

export type AdminUserDetail = {
  user: AdminUserSummary;
  maps: Array<{
    id: string;
    name: string;
    share_slug: string | null;
    version: number;
    created_at: number;
    updated_at: number;
    bytes: number;
    features: number | null;
    hunting: number;
  }>;
};

/** One value per UTC day from `since`, zero where the server had no row. */
export function fillDays(rows: Day[], since: number, days: number): number[] {
  const byDay = new Map(rows.map((r) => [r.day, r.n]));
  return Array.from({ length: days }, (_, i) => byDay.get(isoDay(since + i * DAY_S)) ?? 0);
}

/** The last `weeks` whole 7-day runs, ending today, so the newest column is this week. */
export function lastWeeks(daily: number[], weeks: number): number[] {
  const out: number[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const end = daily.length - w * 7;
    out.push(daily.slice(Math.max(0, end - 7), end).reduce((a, b) => a + b, 0));
  }
  return out;
}

export function cumulative(start: number, daily: number[]): number[] {
  let total = start;
  return daily.map((n) => (total += n));
}

export const isoDay = (at: number): string => new Date(at * 1000).toISOString().slice(0, 10);

export const shortDate = (at: number): string =>
  new Date(at * 1000).toLocaleDateString("en-GB", { month: "short", day: "numeric", timeZone: "UTC" });

/** One or more anonymous counters, summed per day and filled like `fillDays`. */
export function usageDays(usage: AdminStats["usage"], events: readonly string[], since: number, days: number): number[] {
  const wanted = new Set(events);
  const byDay = new Map<string, number>();
  for (const row of usage) if (wanted.has(row.event)) byDay.set(row.day, (byDay.get(row.day) ?? 0) + row.n);
  return fillDays([...byDay].map(([day, n]) => ({ day, n })), since, days);
}

/** The sum of the last `n` days of a daily series. */
export const lastDays = (daily: number[], n: number): number => daily.slice(-n).reduce((a, b) => a + b, 0);
