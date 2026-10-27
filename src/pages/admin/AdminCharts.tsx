/**
 * The charts on the operator's page (D26): hand-drawn SVG, as pitchboard's are. Colours and the
 * reasons for them are in `adminData.ts`; text never wears a series colour. Every chart has a
 * table view one click away, so no value is reachable only by hovering.
 */

import { useEffect, useRef, useState } from "react";
import { AZINHO, DAY_S, shortDate } from "./adminData";

const SURFACE = "#e8e2d4";
const GRID = "#d6d0c3";
const AXIS = "#a39d90";
const MUTED = "#4c5244";

/** Round, readable ticks: 0 and up to four steps of 1, 2 or 5 × 10ⁿ. */
function ticks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag);
  const top = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) out.push(v);
  return out;
}

const fmt = (n: number) => n.toLocaleString("en-GB");

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** A column with a 4px rounded top and a square foot on the baseline. */
function columnPath(x: number, y: number, w: number, base: number): string {
  const h = base - y;
  if (h <= 0) return "";
  const r = Math.min(4, h, w / 2);
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z`;
}

function Tooltip({ x, value, label, color }: { x: number; value: string; label: string; color: string }) {
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-rule bg-osso px-2 py-1 shadow-float"
      style={{ left: x }}
    >
      <div className="text-[13px] font-bold whitespace-nowrap text-xisto">{value}</div>
      <div className="flex items-center gap-1.5 text-[11px] whitespace-nowrap text-xisto-soft">
        <span className="inline-block h-0.5 w-2.5 rounded" style={{ background: color }} />
        {label}
      </div>
    </div>
  );
}

export function ChartCard({
  title,
  subtitle,
  table,
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  /** The same numbers as rows: the chart's accessible twin. */
  table: Array<[string, string]>;
  className?: string;
  children: React.ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className={`rounded-[12px] border border-rule bg-osso p-4 ${className}`}>
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-bold">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[12px] text-xisto-soft">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          className="shrink-0 rounded-md border border-rule px-2 py-1 text-[12px] font-semibold text-xisto-soft hover:text-xisto"
        >
          {asTable ? "Chart" : "Table"}
        </button>
      </header>
      {asTable ? (
        <div className="max-h-56 overflow-y-auto">
          <table className="w-full text-[13px]">
            <tbody>
              {table.map(([label, value]) => (
                <tr key={label} className="border-t border-rule first:border-t-0">
                  <td className="py-1 pr-3">{label}</td>
                  <td className="py-1 text-right tabular-nums">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

const PLOT_H = 140;
const AXIS_H = 20;
/** Room above the plot, so the top tick's label is not cut by the SVG's edge. */
const TOP = 8;
const LEFT = 32;

export function ColumnChart({
  values,
  labels,
  colors,
  unit,
}: {
  values: number[];
  labels: string[];
  /** One colour for every column, or one per column for an ordered ramp. */
  colors: string | readonly string[];
  unit: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const colorOf = (i: number) => (typeof colors === "string" ? colors : colors[i]);
  const grid = ticks(Math.max(...values, 0));
  const top = grid[grid.length - 1];
  const band = values.length ? Math.max(0, width - LEFT) / values.length : 0;
  const barW = Math.min(24, band * 0.7);
  const y = (v: number) => PLOT_H - (v / top) * PLOT_H;
  // Every label when they fit, else every other or third, always keeping the newest.
  const every = band >= 44 ? 1 : band >= 22 ? 2 : 3;
  const showLabel = (i: number) => (values.length - 1 - i) % every === 0;

  return (
    <div ref={ref} className="relative" onPointerLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={TOP + PLOT_H + AXIS_H} role="img" aria-label={`Column chart, ${unit}`}>
          <g transform={`translate(0,${TOP})`}>
            {grid.map((t) => (
              <g key={t}>
                <line x1={LEFT} x2={width} y1={y(t)} y2={y(t)} stroke={t === 0 ? AXIS : GRID} strokeWidth={1} />
                <text x={LEFT - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={MUTED}>
                  {fmt(t)}
                </text>
              </g>
            ))}
            {values.map((v, i) => {
              const x = LEFT + i * band + (band - barW) / 2;
              return (
                <g key={i}>
                  <path d={columnPath(x, y(v), barW, PLOT_H)} fill={colorOf(i)} opacity={hover === null || hover === i ? 1 : 0.55} />
                  {showLabel(i) && (
                    <text x={x + barW / 2} y={PLOT_H + 14} textAnchor="middle" fontSize={11} fill={MUTED}>
                      {labels[i]}
                    </text>
                  )}
                  <rect
                    x={LEFT + i * band}
                    y={0}
                    width={band}
                    height={PLOT_H}
                    fill="transparent"
                    tabIndex={0}
                    aria-label={`${labels[i]}: ${fmt(v)} ${unit}`}
                    onPointerEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    className="outline-none"
                  />
                </g>
              );
            })}
          </g>
        </svg>
      )}
      {hover !== null && <Tooltip x={LEFT + hover * band + band / 2} value={`${fmt(values[hover])} ${unit}`} label={labels[hover]} color={colorOf(hover)} />}
    </div>
  );
}

export function LineChart({ values, since, unit }: { values: number[]; since: number; unit: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const grid = ticks(Math.max(...values, 0));
  const top = grid[grid.length - 1];
  const right = 36;
  const plotW = Math.max(0, width - LEFT - right);
  const step = values.length > 1 ? plotW / (values.length - 1) : 0;
  const x = (i: number) => LEFT + i * step;
  const y = (v: number) => PLOT_H - (v / top) * PLOT_H;
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join("");
  const last = values.length - 1;
  const area = `${line}L${x(last)},${PLOT_H}L${x(0)},${PLOT_H}Z`;
  const dateOf = (i: number) => shortDate(since + i * DAY_S);
  const axisDays = [0, Math.floor(last / 2), last];

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.round((e.clientX - box.left - LEFT) / (step || 1));
    setHover(Math.max(0, Math.min(last, i)));
  };

  return (
    <div ref={ref} className="relative" onPointerLeave={() => setHover(null)}>
      {width > 0 && values.length > 0 && (
        <svg width={width} height={TOP + PLOT_H + AXIS_H} role="img" aria-label={`Line chart, ${unit}`} onPointerMove={onMove}>
          <g transform={`translate(0,${TOP})`}>
            {grid.map((t) => (
              <g key={t}>
                <line x1={LEFT} x2={width - right} y1={y(t)} y2={y(t)} stroke={t === 0 ? AXIS : GRID} strokeWidth={1} />
                <text x={LEFT - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={MUTED}>
                  {fmt(t)}
                </text>
              </g>
            ))}
            {axisDays.map((i, k) => (
              <text key={i} x={x(i)} y={PLOT_H + 14} fontSize={11} fill={MUTED} textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"}>
                {dateOf(i)}
              </text>
            ))}
            <path d={area} fill={AZINHO} opacity={0.08} />
            <path d={line} fill="none" stroke={AZINHO} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={x(last)} cy={y(values[last])} r={4} fill={AZINHO} stroke={SURFACE} strokeWidth={2} />
            <text x={x(last) + 8} y={y(values[last])} dy="0.32em" fontSize={12} fontWeight={700} fill="#23281f">
              {fmt(values[last])}
            </text>
            {hover !== null && (
              <>
                <line x1={x(hover)} x2={x(hover)} y1={0} y2={PLOT_H} stroke={AXIS} strokeWidth={1} />
                <circle cx={x(hover)} cy={y(values[hover])} r={4} fill={AZINHO} stroke={SURFACE} strokeWidth={2} />
              </>
            )}
          </g>
        </svg>
      )}
      {hover !== null && <Tooltip x={x(hover)} value={`${fmt(values[hover])} ${unit}`} label={dateOf(hover)} color={AZINHO} />}
    </div>
  );
}

export function StackedBar({ segments }: { segments: Array<{ label: string; value: number; color: string }> }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const total = segments.reduce((a, s) => a + s.value, 0);
  const shown = segments.map((s, i) => ({ ...s, i })).filter((s) => s.value > 0);
  const gap = 2;
  const usable = Math.max(0, width - gap * (shown.length - 1));
  const pct = (v: number) => (total ? `${Math.round((v / total) * 100)}%` : "0%");
  const widths = shown.map((s) => (s.value / total) * usable);
  const placed = shown.map((s, k) => ({ ...s, w: widths[k], x: widths.slice(0, k).reduce((a, w) => a + w + gap, 0) }));
  const hovered = placed.find((p) => p.i === hover);

  return (
    <div>
      <div ref={ref} className="relative pt-12" onPointerLeave={() => setHover(null)}>
        {width > 0 && total > 0 && (
          <svg width={width} height={20} role="img" aria-label="Stacked bar">
            {placed.map((s, k) => (
              <rect
                key={s.label}
                x={s.x}
                y={0}
                width={Math.max(0, s.w)}
                height={20}
                rx={k === 0 || k === placed.length - 1 ? 4 : 0}
                fill={s.color}
                opacity={hover === null || hover === s.i ? 1 : 0.55}
                tabIndex={0}
                aria-label={`${s.label}: ${s.value}`}
                onPointerEnter={() => setHover(s.i)}
                onFocus={() => setHover(s.i)}
                onBlur={() => setHover(null)}
                className="outline-none"
              />
            ))}
          </svg>
        )}
        {total === 0 && <div className="h-5 rounded bg-cal-deep" />}
        {hovered && <Tooltip x={hovered.x + hovered.w / 2} value={`${fmt(hovered.value)} · ${pct(hovered.value)}`} label={hovered.label} color={hovered.color} />}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5 text-[13px]">
            <span className="inline-block size-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
            <span className="font-bold">{fmt(s.value)}</span>
            <span className="text-xisto-soft">{pct(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Trend only: no axes, no hover. The tile beside it carries the number. */
export function Sparkline({ values }: { values: number[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const h = 28;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const step = values.length > 1 ? (width - 8) / (values.length - 1) : 0;
  const pts = values.map((v, i) => [4 + i * step, h - 4 - ((v - min) / (max - min || 1)) * (h - 8)] as const);
  const last = pts[pts.length - 1];
  return (
    <div ref={ref} className="mt-2" aria-hidden>
      {width > 0 && last && (
        <svg width={width} height={h}>
          <path d={pts.map(([px, py], i) => `${i ? "L" : "M"}${px},${py}`).join("")} fill="none" stroke={AZINHO} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.8} />
          <circle cx={last[0]} cy={last[1]} r={3} fill={AZINHO} />
        </svg>
      )}
    </div>
  );
}
