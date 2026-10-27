/**
 * The operator's view (D26): accounts, phones without one, maps, hunts, and everybody's use.
 *
 * English only, outside i18n: it has one reader. Every figure comes from the Worker, which
 * answers 404 to anyone else, so the page is inert without the session behind it; being in the
 * bundle gives nothing away that the route does not already refuse.
 */

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RotateCw, Search } from "lucide-react";
import { ConfirmDelete } from "../account/ConfirmDelete";
import { api } from "../share/api";
import { sharedUrl } from "../share/routes";
import { ChartCard, ColumnChart, LineChart, Sparkline, StackedBar } from "./admin/AdminCharts";
import {
  ANIL,
  CATEGORICAL,
  cumulative,
  DAY_S,
  fillDays,
  lastDays,
  lastWeeks,
  NEUTRAL,
  RECENCY,
  shortDate,
  usageDays,
  type AdminStats,
  type AdminUserDetail,
  type AdminUserSummary,
} from "./admin/adminData";

const WEEKS = 12;

type Load = AdminStats | "denied" | "failed" | null;

export default function AdminScreen() {
  const [stats, setStats] = useState<Load>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [refresh, setRefresh] = useState<"idle" | "loading" | "failed">("idle");

  const load = async (): Promise<Load> => {
    const r = await api<AdminStats>("GET", "/api/admin/stats");
    return r.ok ? r.data : r.status === 404 ? "denied" : "failed";
  };

  useEffect(() => {
    let live = true;
    void load().then((result) => live && setStats(result));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => window.scrollTo({ top: 0 }), [selected]);

  const reload = async () => {
    setRefresh("loading");
    const result = await load();
    if (typeof result === "object" && result) {
      setStats(result);
      setRefresh("idle");
    } else {
      setRefresh("failed");
    }
  };

  if (stats === "denied" || stats === "failed") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-cal p-8 text-center text-xisto">
        <p className="text-[17px]">{stats === "denied" ? "Nothing here." : "Could not reach the server."}</p>
        <a href="/" className="font-semibold text-anil underline-offset-4 hover:underline">
          Open Coutada
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-cal font-sans text-xisto">
      <nav className="sticky top-0 z-30 border-b border-rule bg-cal/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <a href="/" className="text-[17px] font-bold">
            Coutada
          </a>
          <span className="rounded-full bg-anil/10 px-2 py-0.5 text-[12px] font-semibold text-anil">Usage</span>
          {!selected && stats && (
            <button
              type="button"
              onClick={() => void reload()}
              disabled={refresh === "loading"}
              className={`ml-auto flex min-h-11 items-center gap-1.5 rounded-[10px] px-3 text-[14px] font-semibold hover:bg-cal-deep disabled:opacity-60 ${refresh === "failed" ? "text-[#a32a1d]" : ""}`}
            >
              <RotateCw size={15} className={refresh === "loading" ? "animate-spin" : undefined} />
              {refresh === "loading" ? "Refreshing…" : refresh === "failed" ? "Refresh failed, retry" : "Refresh"}
            </button>
          )}
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {stats === null ? (
          <p role="status" className="text-[15px] text-xisto-soft">
            Loading…
          </p>
        ) : selected ? (
          <UserDetail id={selected} onBack={() => setSelected(null)} />
        ) : (
          <Overview stats={stats} onSelect={setSelected} />
        )}
      </main>
    </div>
  );
}

/** Accounts by their most recent visit, oldest bucket last; `never` is its own neutral column. */
function recency(users: AdminUserSummary[]): number[] {
  const now = Date.now() / 1000;
  const limits = [1, 7, 30, 90].map((d) => d * DAY_S);
  const buckets = [0, 0, 0, 0, 0, 0];
  for (const u of users) {
    if (u.last_seen_at === null) {
      buckets[5]++;
      continue;
    }
    const i = limits.findIndex((limit) => now - u.last_seen_at! < limit);
    buckets[i === -1 ? 4 : i]++;
  }
  return buckets;
}

const RECENCY_LABELS = ["Today", "This week", "This month", "3 months", "Older", "Never"];
const FORMATS = ["gpx", "kml", "geojson"] as const;

function Overview({ stats, onSelect }: { stats: AdminStats; onSelect: (id: string) => void }) {
  const { totals, users, series, methods, usage } = stats;
  const everyone = useMemo(() => {
    const daily = (...events: string[]) => usageDays(usage, events, series.since, series.days);
    return {
      map: daily("page.map"),
      shared: daily("page.shared"),
      hunt: daily("page.hunt"),
      visits: daily("page.map", "page.shared", "page.hunt"),
      started: daily("hunt.montaria", "hunt.salto"),
      montaria: lastDays(daily("hunt.montaria"), 7),
      salto: lastDays(daily("hunt.salto"), 7),
      joins: daily("hunt.join"),
      links: daily("share.live"),
      downloads: daily("offline.download"),
      imports: FORMATS.map((f) => lastDays(daily(`import.${f}`), series.days)),
      exports: FORMATS.map((f) => lastDays(daily(`export.${f}`), series.days)),
    };
  }, [usage, series]);
  const charts = useMemo(() => {
    const signups = fillDays(series.signups, series.since, series.days);
    const maps = fillDays(series.maps, series.since, series.days);
    return {
      accounts: cumulative(series.usersBefore, signups),
      signupWeeks: lastWeeks(signups, WEEKS),
      mapWeeks: lastWeeks(maps, WEEKS),
      weekStarts: Array.from({ length: WEEKS }, (_, w) => shortDate(series.since + (series.days - (WEEKS - w) * 7) * DAY_S)),
      seen: recency(users),
    };
  }, [series, users]);
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? users.filter((u) => u.email.toLowerCase().includes(q) || (u.display_name ?? "").toLowerCase().includes(q)) : users;
  }, [users, query]);
  const weekRows = (values: number[]) => charts.weekStarts.map((d, i) => [d, String(values[i])] as [string, string]).reverse();
  const visitWeeks = lastWeeks(everyone.visits, WEEKS);
  const huntWeeks = lastWeeks(everyone.started, WEEKS);
  const in30 = (daily: number[]) => `${lastDays(daily, 30).toLocaleString("en-GB")} in 30 days`;

  return (
    <>
      <header className="mb-6">
        <h1 className="text-[28px] leading-tight font-bold">Usage</h1>
        <p className="mt-1 text-[14px] text-xisto-soft">
          {plural(totals.users, "account")}, {plural(totals.devices, "phone")} without one
        </p>
      </header>

      <Tiles
        items={[
          ["Accounts", totals.users, `+${totals.signups_7d} this week, +${totals.signups_30d} in 30 days`, charts.signupWeeks],
          ["Active today", totals.active_1d, `${totals.active_7d} in 7 days, ${totals.active_30d} in 30`],
          ["Phones without an account", totals.devices, `${totals.devices_new_7d} new, ${totals.devices_active_7d} active this week`],
          ["Maps", totals.maps, `${totals.maps_created_7d} new, ${totals.maps_updated_7d} edited this week`, charts.mapWeeks],
          ["On phones", totals.maps_on_devices, "maps kept without an account"],
          ["Shared links", totals.shared, "live /m links"],
          ["Live hunts", totals.hunts_live, null],
          ["Stored maps", formatBytes(totals.bytes), "sum of documents"],
        ]}
      />

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <ChartCard
          className="md:col-span-2"
          title="Accounts over time"
          subtitle={`All accounts, last ${series.days} days (UTC)`}
          table={charts.accounts.map((n, i) => [shortDate(series.since + i * DAY_S), String(n)] as [string, string]).reverse()}
        >
          <LineChart values={charts.accounts} since={series.since} unit="accounts" />
        </ChartCard>
        <ChartCard title="Sign-ups per week" subtitle={`Last ${WEEKS} weeks, labelled by the week's first day`} table={weekRows(charts.signupWeeks)}>
          <ColumnChart values={charts.signupWeeks} labels={charts.weekStarts} colors={ANIL} unit="sign-ups" />
        </ChartCard>
        <ChartCard title="Maps created per week" subtitle={`Last ${WEEKS} weeks, accounts and phones`} table={weekRows(charts.mapWeeks)}>
          <ColumnChart values={charts.mapWeeks} labels={charts.weekStarts} colors={ANIL} unit="maps" />
        </ChartCard>
        <ChartCard
          title="How people sign in"
          subtitle="Every account, by the sign-in methods it has"
          table={[
            ["Google only", String(methods.google)],
            ["Password only", String(methods.password)],
            ["Both", String(methods.both)],
          ]}
        >
          <StackedBar
            segments={[
              { label: "Google only", value: methods.google, color: CATEGORICAL[0] },
              { label: "Password only", value: methods.password, color: CATEGORICAL[1] },
              { label: "Both", value: methods.both, color: CATEGORICAL[2] },
            ]}
          />
        </ChartCard>
        <ChartCard title="Last seen" subtitle="Accounts by their most recent visit, to the day" table={RECENCY_LABELS.map((l, i) => [l, String(charts.seen[i])] as [string, string])}>
          <ColumnChart values={charts.seen} labels={RECENCY_LABELS} colors={[...RECENCY, NEUTRAL]} unit="accounts" />
        </ChartCard>
      </div>

      <h2 className="mt-10 mb-3 text-[16px] font-bold">
        Everyone <span className="font-normal text-xisto-soft">accounts or not, last 7 days</span>
      </h2>
      <Tiles
        items={[
          ["Maps opened", lastDays(everyone.map, 7), in30(everyone.map), lastWeeks(everyone.map, WEEKS)],
          ["Shared maps viewed", lastDays(everyone.shared, 7), in30(everyone.shared), lastWeeks(everyone.shared, WEEKS)],
          ["Hunt screens opened", lastDays(everyone.hunt, 7), in30(everyone.hunt), lastWeeks(everyone.hunt, WEEKS)],
          ["Hunts started", lastDays(everyone.started, 7), `${everyone.montaria} montaria, ${everyone.salto} salto`],
          ["Hunters joined", lastDays(everyone.joins, 7), in30(everyone.joins)],
          ["Links shared", lastDays(everyone.links, 7), in30(everyone.links)],
          ["Areas downloaded", lastDays(everyone.downloads, 7), in30(everyone.downloads)],
          ["Files", everyone.imports.reduce((a, b) => a + b, 0) + everyone.exports.reduce((a, b) => a + b, 0), `imported and exported, ${series.days} days`],
        ]}
      />

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <ChartCard title="Visits per week" subtitle={`Maps, shared maps and hunts, last ${WEEKS} weeks`} table={weekRows(visitWeeks)}>
          <ColumnChart values={visitWeeks} labels={charts.weekStarts} colors={ANIL} unit="visits" />
        </ChartCard>
        <ChartCard title="Hunts started per week" subtitle={`Montaria and salto, last ${WEEKS} weeks`} table={weekRows(huntWeeks)}>
          <ColumnChart values={huntWeeks} labels={charts.weekStarts} colors={ANIL} unit="hunts" />
        </ChartCard>
        {(["Imports", "Exports"] as const).map((title) => {
          const counts = title === "Imports" ? everyone.imports : everyone.exports;
          return (
            <ChartCard
              key={title}
              title={`${title} by format`}
              subtitle={`Last ${series.days} days`}
              table={FORMATS.map((f, i) => [f.toUpperCase(), String(counts[i])] as [string, string])}
            >
              <StackedBar segments={FORMATS.map((f, i) => ({ label: f === "geojson" ? "GeoJSON" : f.toUpperCase(), value: counts[i], color: CATEGORICAL[i] }))} />
            </ChartCard>
          );
        })}
      </div>

      <div className="mt-10 mb-3 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-[16px] font-bold">
          Accounts <span className="font-normal text-xisto-soft">{users.length}</span>
        </h2>
        <label className="relative">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xisto-soft" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by email or name"
            className="min-h-11 w-72 max-w-full rounded-[12px] border border-rule bg-white py-2 pr-3 pl-9 text-[15px]"
          />
        </label>
      </div>
      <Table
        head={["Account", "Joined", "Last login", "Last seen", "Maps", "Shared", "Size", "Last edit"]}
        numeric={[4, 5, 6]}
        rows={shown.map((u) => ({
          key: u.id,
          onClick: () => onSelect(u.id),
          cells: [
            <Account key="a" user={u} />,
            <When key="j" at={u.created_at} />,
            <When key="l" at={u.last_login_at} />,
            <When key="s" at={u.last_seen_at} />,
            u.maps,
            u.shared,
            formatBytes(u.bytes),
            <When key="e" at={u.last_map_at} />,
          ],
        }))}
        empty="No accounts match."
      />
    </>
  );
}

function UserDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [detail, setDetail] = useState<AdminUserDetail | "failed" | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let live = true;
    void api<AdminUserDetail>("GET", `/api/admin/users/${id}`).then((r) => live && setDetail(r.ok ? r.data : "failed"));
    return () => {
      live = false;
    };
  }, [id]);

  return (
    <>
      <button type="button" onClick={onBack} className="-ml-3 mb-6 flex min-h-11 items-center gap-1.5 rounded-[10px] px-3 text-[14px] font-semibold hover:bg-cal-deep">
        <ArrowLeft size={15} />
        All accounts
      </button>
      {detail === null && (
        <p role="status" className="text-[15px] text-xisto-soft">
          Loading…
        </p>
      )}
      {detail === "failed" && <p className="text-[15px] text-[#a32a1d]">Could not load this account.</p>}
      {detail && detail !== "failed" && (
        <>
          <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-[28px] leading-tight font-bold">{detail.user.display_name ?? detail.user.email}</h1>
              <p className="mt-1 text-[14px] text-xisto-soft">
                {detail.user.email}, joined {formatDate(detail.user.created_at)}, last login {formatDate(detail.user.last_login_at)}, last seen{" "}
                {formatDate(detail.user.last_seen_at)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDeleting(true)}
              className="min-h-11 shrink-0 rounded-[12px] border-2 border-[#c23a2b] px-4 text-[14px] font-semibold text-[#a32a1d] hover:bg-[#c23a2b] hover:text-white"
            >
              Delete account
            </button>
          </header>
          {deleting && (
            <ConfirmDelete
              path={`/api/admin/users/${id}`}
              expected={detail.user.email}
              prompt={`Type ${detail.user.email} to delete this account and every map in it. This cannot be undone.`}
              onClose={() => setDeleting(false)}
              onDone={() => window.location.assign("/admin")}
            />
          )}
          <Tiles
            items={[
              ["Maps", detail.user.maps, null],
              ["Shared", detail.user.shared, null],
              ["Stored", formatBytes(detail.user.bytes), null],
            ]}
          />
          <h2 className="mt-8 mb-3 text-[16px] font-bold">
            Maps <span className="font-normal text-xisto-soft">{detail.maps.length}</span>
          </h2>
          <Table
            head={["Map", "Features", "Size", "Version", "Link", "Hunt", "Created", "Updated"]}
            numeric={[1, 2, 3]}
            rows={detail.maps.map((m) => ({
              key: m.id,
              cells: [
                m.name,
                m.features ?? "—",
                formatBytes(m.bytes),
                m.version,
                m.share_slug ? (
                  <a key="l" href={sharedUrl(m.share_slug)} target="_blank" rel="noreferrer" className="text-anil hover:underline">
                    {m.share_slug}
                  </a>
                ) : (
                  "—"
                ),
                m.hunting ? "live" : "—",
                <When key="c" at={m.created_at} />,
                <When key="u" at={m.updated_at} />,
              ],
            }))}
            empty="No maps."
          />
        </>
      )}
    </>
  );
}

/** Label, value, an optional note, and an optional weekly trend drawn under it. */
type Tile = [string, number | string, string | null, number[]?];

function Tiles({ items }: { items: Tile[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map(([label, value, note, trend]) => (
        <div key={label} className="rounded-[16px] border border-rule bg-white p-3">
          <div className="text-[13px] text-xisto-soft">{label}</div>
          <div className="mt-1 text-[26px] leading-tight font-bold tabular-nums">{typeof value === "number" ? value.toLocaleString("en-GB") : value}</div>
          {note && <div className="mt-1 text-[12px] leading-snug text-xisto-soft">{note}</div>}
          {trend && <Sparkline values={trend} />}
        </div>
      ))}
    </div>
  );
}

interface Row {
  key: string;
  cells: React.ReactNode[];
  onClick?: () => void;
}

function Table({ head, rows, numeric = [], empty }: { head: string[]; rows: Row[]; numeric?: number[]; empty: string }) {
  if (rows.length === 0) return <p className="text-[14px] text-xisto-soft">{empty}</p>;
  const align = (i: number) => (numeric.includes(i) ? "text-right tabular-nums" : "text-left");
  return (
    <div className="overflow-x-auto rounded-[16px] border border-rule bg-white">
      <table className="w-full text-[14px]">
        <thead className="bg-cal-deep text-xisto-soft">
          <tr>
            {head.map((h, i) => (
              <th key={h} className={`px-3 py-2 font-semibold whitespace-nowrap ${align(i)}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              onClick={row.onClick}
              tabIndex={row.onClick ? 0 : undefined}
              onKeyDown={(e) => row.onClick && e.key === "Enter" && row.onClick()}
              className={`border-t border-rule ${row.onClick ? "cursor-pointer hover:bg-cal" : ""}`}
            >
              {row.cells.map((cell, i) => (
                <td key={i} className={`px-3 py-2 whitespace-nowrap ${align(i)}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Account({ user }: { user: AdminUserSummary }) {
  return (
    <div>
      <div>{user.email}</div>
      {user.display_name && <div className="text-xisto-soft">{user.display_name}</div>}
    </div>
  );
}

/** Relative for scanning, the exact moment on hover. */
function When({ at }: { at: number | null }) {
  if (at === null) return <span className="text-xisto-soft">—</span>;
  return <span title={new Date(at * 1000).toLocaleString("en-GB")}>{ago(at)}</span>;
}

function ago(at: number): string {
  const s = Math.max(0, Date.now() / 1000 - at);
  if (s < 60) return "just now";
  if (s < 60 * 60) return `${Math.floor(s / 60)}m ago`;
  if (s < 24 * 60 * 60) return `${Math.floor(s / 3600)}h ago`;
  if (s < 60 * 24 * 60 * 60) return `${Math.floor(s / 86400)}d ago`;
  return formatDate(at);
}

const formatDate = (at: number | null): string => (at === null ? "never" : new Date(at * 1000).toLocaleDateString("en-GB"));

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const plural = (n: number, noun: string) => `${n.toLocaleString("en-GB")} ${noun}${n === 1 ? "" : "s"}`;
