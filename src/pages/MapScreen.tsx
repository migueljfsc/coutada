/**
 * The map screen: imagery full bleed, the tool rail on the right within thumb reach, the sheet at
 * the bottom (a left panel on wide screens) showing whatever is in hand — the map, a type to pick,
 * the line being drawn, or the selected feature.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { Check, Layers, Locate, LocateFixed, MapPin, Pentagon, Redo2, Spline, Undo2 } from "lucide-react";
import { DEFAULT_IMAGERY, type ImageryId, type PinType, type RouteType, type ZoneType } from "../doc/catalogue";
import { newFeatureId } from "../doc/ids";
import { createMapDoc, featureById } from "../doc/operations";
import { isFeatureName } from "../doc/schema";
import type { FeatureId } from "../doc/types";
import { initialEditor, reduce } from "../draw/editor";
import { bboxOf, distance, type Position } from "../geo/geo";
import { LOCALES, type MessageKey } from "../i18n/core";
import { useI18n } from "../i18n/context";
import { useMedia } from "../lib/useMedia";
import { useWakeLock } from "../lib/useWakeLock";
import { dragShape, render, withoutVertex } from "../map/drawing";
import { AVAILABLE_IMAGERY, imageryOf } from "../map/imagery";
import { MapView, type DragPhase, type Handle, type View } from "../map/MapView";
import { useLocation, type LocationStatus } from "../map/useLocation";
import { storeDraft, storedDraft } from "../share/draft";
import { PORTUGAL, storedImagery, storedView, storeImagery, storeView } from "../share/prefs";
import { RailButton } from "../components/RailButton";
import { Sheet } from "../components/Sheet";
import { DrawBar } from "../components/editor/DrawBar";
import { FeatureDetails, FeatureHeader, type EditCommands } from "../components/editor/FeatureEditor";
import { FeatureList } from "../components/editor/FeatureList";
import { TypePicker, type Picking } from "../components/editor/TypePicker";
import type { FeatureType } from "../components/editor/TypeIcon";

/** Zoom a first fix is shown at, unless the map is already closer. */
const LOCATE_ZOOM = 16;
/** The left panel's width plus its margins, on wide screens. */
const PANEL_PX = 392;
/** The map counts as centred on you within this many metres. */
const CENTRED_M = 15;
/** How long the draft waits after an edit before it is written. */
const SAVE_DELAY_MS = 400;

const STATUS: Record<Exclude<LocationStatus, "on">, MessageKey> = {
  off: "locate.off",
  asking: "locate.asking",
  denied: "locate.denied",
  unavailable: "locate.unavailable",
};

export function MapScreen() {
  const { t, locale, setLocale } = useI18n();
  const [imagery, setImagery] = useState<ImageryId>(() => storedImagery() ?? DEFAULT_IMAGERY);
  const [initialView] = useState<View>(() => storedView() ?? PORTUGAL);
  const [editor, dispatch] = useReducer(reduce, null, () => initialEditor(storedDraft() ?? createMapDoc(t("map.untitled"))));
  const [picking, setPicking] = useState<Picking | null>(null);
  const [vertex, setVertex] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [peek, setPeek] = useState(96);
  const [picker, setPicker] = useState(false);
  const [following, setFollowing] = useState(false);
  const [imageryFailing, setImageryFailing] = useState(false);
  const map = useRef<MapLibreMap | null>(null);
  const centreNext = useRef(false);
  const latest = useRef(editor);
  const midDrag = useRef<number | null>(null);
  const { status, fix, start, stop } = useLocation();
  const wide = useMedia("(min-width: 48rem)");

  useWakeLock(status === "on");

  useEffect(() => {
    latest.current = editor;
  }, [editor]);

  useEffect(() => {
    const timer = setTimeout(() => storeDraft(editor.doc), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [editor.doc]);

  const { doc, tool, selected } = editor;
  const selectedFeature = selected ? featureById(doc, selected) : undefined;
  const rendered = useMemo(() => render(doc, selected, tool, vertex), [doc, selected, tool, vertex]);
  const now = () => Date.now();

  // ------------------------------------------------------------ my position

  const centre = useCallback((at: Position) => {
    const m = map.current;
    if (!m) return;
    m.easeTo({ center: [at[0], at[1]], zoom: Math.max(m.getZoom(), LOCATE_ZOOM), duration: 600 });
    setFollowing(true);
  }, []);

  useEffect(() => {
    if (!fix) return;
    if (centreNext.current) {
      centreNext.current = false;
      centre(fix.at);
    } else if (following && map.current) {
      const c = map.current.getCenter();
      if (distance([c.lng, c.lat], fix.at) > CENTRED_M) map.current.easeTo({ center: [fix.at[0], fix.at[1]], duration: 400 });
    }
  }, [fix, following, centre]);

  const onLocate = () => {
    if (status !== "on" && status !== "asking") {
      centreNext.current = true;
      void start();
    } else if (fix && !following) {
      centre(fix.at);
    } else {
      setFollowing(false);
      stop();
    }
  };

  const onReady = useCallback((m: MapLibreMap) => {
    map.current = m;
    m.on("dragstart", () => setFollowing(false));
  }, []);

  const chooseImagery = (id: ImageryId) => {
    setImagery(id);
    storeImagery(id);
    setPicker(false);
  };

  // --------------------------------------------------------------- drawing

  const openPicker = (kind: Picking) => {
    dispatch({ type: "tool", tool: { kind: "idle" } });
    dispatch({ type: "select", id: null });
    setPicking((p) => (p === kind ? null : kind));
    setSheetOpen(true);
  };

  const pickType = (type: FeatureType) => {
    const kind = picking;
    setPicking(null);
    setSheetOpen(false);
    if (kind === "pin") dispatch({ type: "tool", tool: { kind: "pin", type: type as PinType } });
    if (kind === "line") dispatch({ type: "tool", tool: { kind: "line", type: type as RouteType, points: [] } });
    if (kind === "area") dispatch({ type: "tool", tool: { kind: "area", type: type as ZoneType, points: [] } });
  };

  const onTap = useCallback((at: Position, hit: FeatureId | null, handle: Handle | null) => {
    const state = latest.current;
    if (state.tool.kind === "idle" && handle?.role === "vertex" && state.selected) {
      setVertex(handle.i);
      return;
    }
    setVertex(null);
    setPicking(null);
    dispatch({ type: "tap", at, hit, id: newFeatureId(), now: Date.now() });
  }, []);

  const onDrag = useCallback((handle: Handle, to: Position, phase: DragPhase) => {
    const state = latest.current;
    const record = phase === "start";
    if (handle.role === "pin") {
      if (phase !== "end") dispatch({ type: "move", id: handle.fid, at: to, now: Date.now(), record });
      return;
    }
    const feature = state.selected ? featureById(state.doc, state.selected) : undefined;
    if (!feature) return;
    if (phase === "end") {
      midDrag.current = null;
      return;
    }
    let role = handle.role;
    let i = handle.i;
    if (role === "mid" && midDrag.current !== null) {
      role = "vertex";
      i = midDrag.current;
    } else if (role === "mid") {
      midDrag.current = i + 1;
    }
    const positions = dragShape(feature, role, i, to);
    if (positions) dispatch({ type: "shape", id: feature.id, positions, now: Date.now(), record });
    setVertex(null);
  }, []);

  const select = (id: FeatureId) => {
    dispatch({ type: "select", id });
    setVertex(null);
    const f = featureById(doc, id);
    const m = map.current;
    if (!f || !m) return;
    const g = f.geometry;
    const points = g.type === "Point" ? [g.coordinates] : g.type === "LineString" ? g.coordinates : g.coordinates[0];
    const box = bboxOf(points);
    if (!box) return;
    if (g.type === "Point") m.easeTo({ center: [g.coordinates[0], g.coordinates[1]], zoom: Math.max(m.getZoom(), 17) });
    else m.fitBounds([box[0], box[1], box[2], box[3]], { padding: 60, maxZoom: 18 });
    if (!wide) setSheetOpen(false);
  };

  const commands: EditCommands | null = selectedFeature
    ? {
        rename: (name) => dispatch({ type: "props", id: selectedFeature.id, patch: { name }, now: now() }),
        note: (note) => dispatch({ type: "props", id: selectedFeature.id, patch: { note }, now: now() }),
        colour: (color) => dispatch({ type: "props", id: selectedFeature.id, patch: { color }, now: now() }),
        number: (n) => dispatch({ type: "number", id: selectedFeature.id, n, now: now() }),
        armada: (armada) => dispatch({ type: "armada", id: selectedFeature.id, armada, now: now() }),
        numberPortas: () => dispatch({ type: "numberPortas", armada: selectedFeature.id, now: now() }),
        deleteVertex: () => {
          const positions = vertex !== null ? withoutVertex(selectedFeature, vertex) : null;
          if (positions) dispatch({ type: "shape", id: selectedFeature.id, positions, now: now(), record: true });
          setVertex(null);
        },
        remove: () => dispatch({ type: "delete", id: selectedFeature.id, now: now() }),
        close: () => {
          dispatch({ type: "select", id: null });
          setVertex(null);
        },
      }
    : null;

  // ---------------------------------------------------------------- render

  const locateLabel = status === "on" ? (following ? t("locate.stop") : t("locate.recenter")) : t("locate.start");
  const drawing = tool.kind !== "idle";
  const toolKind: Picking | null = picking ?? (tool.kind === "idle" ? null : tool.kind);

  let peekContent: React.ReactNode;
  let body: React.ReactNode;
  if (picking) {
    peekContent = <TypePicker picking={picking} onPick={pickType} onCancel={() => setPicking(null)} />;
    body = null;
  } else if (tool.kind !== "idle") {
    peekContent = (
      <DrawBar
        tool={tool}
        onUndoPoint={() => dispatch({ type: "undoPoint" })}
        onCancel={() => dispatch({ type: "tool", tool: { kind: "idle" } })}
        onFinish={() => dispatch({ type: "finish", id: newFeatureId(), now: now() })}
      />
    );
    body = null;
  } else if (selectedFeature && commands) {
    peekContent = <FeatureHeader feature={selectedFeature} onClose={commands.close} />;
    body = <FeatureDetails feature={selectedFeature} doc={doc} vertex={vertex} commands={commands} />;
  } else {
    peekContent = (
      <div>
        <h1 className="truncate text-xl leading-tight font-bold">{doc.coutada.name}</h1>
        <p className="mt-1 flex items-center gap-2 text-[15px] text-xisto-soft" role="status">
          {status === "on" && <span className="size-2.5 shrink-0 rounded-full bg-person" aria-hidden />}
          {status === "on" && fix ? t("locate.accuracy", { m: Math.round(fix.accuracy) }) : t(STATUS[status as Exclude<LocationStatus, "on">] ?? "locate.off")}
        </p>
      </div>
    );
    body = (
      <div className="flex flex-col gap-6">
        <MapName key={doc.coutada.name} name={doc.coutada.name} onRename={(name) => dispatch({ type: "rename", name })} />
        <FeatureList doc={doc} onChoose={select} />
        {fix && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[15px]">
            <dt className="text-xisto-soft">{t("position.coords")}</dt>
            <dd className="tabular-nums">
              {fix.at[1].toFixed(5)}, {fix.at[0].toFixed(5)}
            </dd>
            <dt className="text-xisto-soft">{t("position.accuracy")}</dt>
            <dd className="tabular-nums">± {Math.round(fix.accuracy)} m</dd>
          </dl>
        )}
        <div role="group" aria-label={t("app.locale")} className="inline-flex self-start rounded-xl bg-cal-deep p-1">
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={l === locale}
              onClick={() => setLocale(l)}
              className="min-h-11 min-w-14 rounded-lg px-3 text-[15px] font-semibold text-xisto-soft aria-pressed:bg-cal aria-pressed:text-xisto aria-pressed:shadow-sm"
            >
              {t(`locale.${l}`)}
            </button>
          ))}
        </div>
        <p className="border-l-4 border-person pl-3 text-[15px] leading-snug">{t("safety.notice")}</p>
      </div>
    );
  }

  return (
    <main className="fixed inset-0 overflow-hidden font-sans" style={{ "--peek": `${peek}px` } as React.CSSProperties}>
      <MapView
        imagery={imagery}
        initialView={initialView}
        fix={fix}
        rendered={rendered}
        drawing={drawing}
        inset={wide ? { bottom: 0, left: PANEL_PX } : { bottom: sheetOpen ? 0 : peek, left: 0 }}
        onReady={onReady}
        onViewChange={storeView}
        onImageryFailing={setImageryFailing}
        onTap={onTap}
        onDrag={onDrag}
      />

      {imageryFailing && (
        <div
          role="alert"
          className="absolute top-[max(0.75rem,env(safe-area-inset-top))] left-1/2 z-30 flex w-[min(calc(100%-1.5rem),26rem)] -translate-x-1/2 items-center gap-3 rounded-[16px] bg-cal py-2 pr-2 pl-4 shadow-float md:left-[calc(50%+188px)]"
        >
          <p className="flex-1 text-[15px] leading-snug">{t("imagery.failing", { source: t(`imagery.${imagery}` as MessageKey) })}</p>
          {imagery !== DEFAULT_IMAGERY && (
            <button
              type="button"
              onClick={() => chooseImagery(DEFAULT_IMAGERY)}
              className="min-h-11 shrink-0 rounded-[11px] bg-anil px-3 text-[15px] font-semibold text-white"
            >
              {t("imagery.useDefault")}
            </button>
          )}
        </div>
      )}

      {(editor.past.length > 0 || editor.future.length > 0) && (
        <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] left-3 z-10 flex gap-2 md:left-[404px]">
          <RailButton label={t("history.undo")} disabled={editor.past.length === 0} onClick={() => dispatch({ type: "undo" })} className="disabled:opacity-50">
            <Undo2 size={22} />
          </RailButton>
          <RailButton label={t("history.redo")} disabled={editor.future.length === 0} onClick={() => dispatch({ type: "redo" })} className="disabled:opacity-50">
            <Redo2 size={22} />
          </RailButton>
        </div>
      )}

      <p className="pointer-events-none absolute bottom-[calc(var(--peek)+0.5rem)] left-3 z-10 rounded-md bg-cal/80 px-2 py-0.5 text-[11px] text-xisto md:bottom-3 md:left-[404px]">
        {imageryOf(imagery).attribution}
      </p>

      <div className="absolute right-3 bottom-[calc(var(--peek)+1rem)] z-10 flex flex-col items-end gap-3 md:bottom-6">
        <div className="flex flex-col gap-2">
          <RailButton label={t("tool.pin")} active={toolKind === "pin"} onClick={() => openPicker("pin")}>
            <MapPin size={22} strokeWidth={2.2} />
          </RailButton>
          <RailButton label={t("tool.line")} active={toolKind === "line"} onClick={() => openPicker("line")}>
            <Spline size={22} strokeWidth={2.2} />
          </RailButton>
          <RailButton label={t("tool.area")} active={toolKind === "area"} onClick={() => openPicker("area")}>
            <Pentagon size={22} strokeWidth={2.2} />
          </RailButton>
        </div>
        <div className="relative">
          <RailButton label={t("imagery.title")} active={picker} aria-expanded={picker} onClick={() => setPicker((p) => !p)}>
            <Layers size={22} strokeWidth={2.2} />
          </RailButton>
          {picker && <ImageryPicker current={imagery} onChoose={chooseImagery} onClose={() => setPicker(false)} />}
        </div>
        <RailButton label={locateLabel} active={status === "on"} tone="person" onClick={onLocate} className="size-14 rounded-full">
          {status === "on" && following ? <LocateFixed size={24} strokeWidth={2.2} /> : <Locate size={24} strokeWidth={2.2} />}
        </RailButton>
      </div>

      <Sheet open={sheetOpen && body !== null} onOpenChange={setSheetOpen} onPeekHeight={setPeek} peek={peekContent}>
        {body}
      </Sheet>
    </main>
  );
}

function MapName({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const { t } = useI18n();
  const [value, setValue] = useState(name);
  const valid = isFeatureName(value.trim());
  const commit = () => {
    if (valid && value.trim() !== name) onRename(value.trim());
    else if (!valid) setValue(name);
  };
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[15px] font-semibold">{t("map.name")}</span>
      <input
        type="text"
        value={value}
        maxLength={60}
        enterKeyHint="done"
        aria-invalid={!valid}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="w-full rounded-[12px] border border-rule bg-white px-3 py-2.5 text-[16px] aria-invalid:border-[#c23a2b]"
      />
    </label>
  );
}

function ImageryPicker({
  current,
  onChoose,
  onClose,
}: {
  current: ImageryId;
  onChoose: (id: ImageryId) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: PointerEvent) => {
      if (panel.current && !panel.current.parentElement?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    panel.current?.querySelector<HTMLButtonElement>("[aria-checked=true]")?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [onClose]);

  return (
    <div
      ref={panel}
      role="radiogroup"
      aria-label={t("imagery.title")}
      className="absolute right-[calc(100%+0.75rem)] bottom-0 w-64 rounded-[16px] bg-cal p-1.5 shadow-float"
    >
      {AVAILABLE_IMAGERY.map((i) => (
        <button
          key={i.id}
          type="button"
          role="radio"
          aria-checked={i.id === current}
          onClick={() => onChoose(i.id)}
          className="flex w-full items-start gap-3 rounded-[11px] px-3 py-2.5 text-left active:bg-cal-deep aria-checked:bg-anil/10"
        >
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center text-anil">
            {i.id === current && <Check size={18} strokeWidth={3} />}
          </span>
          <span>
            <span className="block text-[15px] font-semibold">{t(`imagery.${i.id}` as MessageKey)}</span>
            <span className="block text-[13px] text-xisto-soft">{t(`imagery.${i.id}.detail` as MessageKey)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
