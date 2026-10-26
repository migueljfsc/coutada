/**
 * The map screen: imagery full bleed, the tool rail on the right within thumb reach, the sheet
 * at the bottom (a left panel on wide screens). Drawing tools join the rail in slice 3.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { Check, Layers, Locate, LocateFixed } from "lucide-react";
import { DEFAULT_IMAGERY, type ImageryId } from "../doc/catalogue";
import { distance } from "../geo/geo";
import { LOCALES } from "../i18n/core";
import { useI18n } from "../i18n/context";
import type { MessageKey } from "../i18n/core";
import { useMedia } from "../lib/useMedia";
import { useWakeLock } from "../lib/useWakeLock";
import { AVAILABLE_IMAGERY, imageryOf } from "../map/imagery";
import { MapView, type View } from "../map/MapView";
import { useLocation, type LocationStatus } from "../map/useLocation";
import { PORTUGAL, storedImagery, storedView, storeImagery, storeView } from "../share/prefs";
import { RailButton } from "../components/RailButton";
import { Sheet } from "../components/Sheet";

/** Zoom a first fix is shown at, unless the map is already closer. */
const LOCATE_ZOOM = 16;
/** The left panel's width plus its margins, on wide screens. */
const PANEL_PX = 392;
/** The map counts as centred on you within this many metres. */
const CENTRED_M = 15;

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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [peek, setPeek] = useState(96);
  const [picker, setPicker] = useState(false);
  const [following, setFollowing] = useState(false);
  const [imageryFailing, setImageryFailing] = useState(false);
  const map = useRef<MapLibreMap | null>(null);
  const centreNext = useRef(false);
  const { status, fix, start, stop } = useLocation();
  const wide = useMedia("(min-width: 48rem)");

  useWakeLock(status === "on");

  const centre = useCallback((at: readonly [number, number]) => {
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

  const locateLabel =
    status === "on" ? (following ? t("locate.stop") : t("locate.recenter")) : t("locate.start");

  return (
    <main className="fixed inset-0 overflow-hidden font-sans" style={{ "--peek": `${peek}px` } as React.CSSProperties}>
      <MapView
        imagery={imagery}
        initialView={initialView}
        fix={fix}
        inset={wide ? { bottom: 0, left: PANEL_PX } : { bottom: sheetOpen ? 0 : peek, left: 0 }}
        onReady={onReady}
        onViewChange={storeView}
        onImageryFailing={setImageryFailing}
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

      <p className="pointer-events-none absolute bottom-[calc(var(--peek)+0.5rem)] left-3 z-10 rounded-md bg-cal/80 px-2 py-0.5 text-[11px] text-xisto md:bottom-3 md:left-[392px]">
        {imageryOf(imagery).attribution}
      </p>

      <div className="absolute right-3 bottom-[calc(var(--peek)+1rem)] z-10 flex flex-col items-end gap-3 md:bottom-6">
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

      <Sheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onPeekHeight={setPeek}
        peek={
          <div>
            <h1 className="text-xl leading-tight font-bold">{t("map.untitled")}</h1>
            <p className="mt-1 flex items-center gap-2 text-[15px] text-xisto-soft" role="status">
              {status === "on" && <span className="size-2.5 shrink-0 rounded-full bg-person" aria-hidden />}
              {status === "on" && fix ? t("locate.accuracy", { m: Math.round(fix.accuracy) }) : t(STATUS[status as Exclude<LocationStatus, "on">] ?? "locate.off")}
            </p>
          </div>
        }
      >
        {fix && (
          <dl className="mb-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[15px]">
            <dt className="text-xisto-soft">{t("position.coords")}</dt>
            <dd className="tabular-nums">
              {fix.at[1].toFixed(5)}, {fix.at[0].toFixed(5)}
            </dd>
            <dt className="text-xisto-soft">{t("position.accuracy")}</dt>
            <dd className="tabular-nums">± {Math.round(fix.accuracy)} m</dd>
          </dl>
        )}

        <div role="group" aria-label={t("app.locale")} className="mb-5 inline-flex rounded-xl bg-cal-deep p-1">
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
      </Sheet>
    </main>
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
