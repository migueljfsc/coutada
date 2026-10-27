/**
 * A map opened by its view link (D8): read-only, with the person's own position, the imagery, and
 * a feature's name and note on a tap.
 */

import { useEffect, useMemo, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { CloudDownload, Layers, Locate, LocateFixed, LogIn, Radio } from "lucide-react";
import { DEFAULT_IMAGERY, type ImageryId } from "../doc/catalogue";
import { loadMapDoc } from "../doc/migrate";
import { featureById } from "../doc/operations";
import type { FeatureId, MapDoc } from "../doc/types";
import { useI18n } from "../i18n/context";
import { useMedia } from "../lib/useMedia";
import { render } from "../map/drawing";
import { imageryOf } from "../map/imagery";
import { MapView, type View } from "../map/MapView";
import { useFollow } from "../map/useFollow";
import { useNavigation } from "../nav/useNavigation";
import { NavPanel } from "../components/NavPanel";
import { api } from "../share/api";
import { navigate } from "../share/routes";
import { storedImagery, storeImagery } from "../share/prefs";
import { bboxOf, type Position } from "../geo/geo";
import { ImageryPicker } from "../components/ImageryPicker";
import { RailButton } from "../components/RailButton";
import { Sheet } from "../components/Sheet";
import { primaryButton } from "../components/ui";
import { FeatureHeader, NavigateButton } from "../components/editor/FeatureEditor";
import { FeatureList } from "../components/editor/FeatureList";
import { Tile } from "../components/MapPanel";
import { JoinHuntDialog } from "../components/hunt/HuntDialogs";
import { OfflineDialog } from "../components/OfflineDialog";

const PANEL_PX = 392;

/** Fits the view to everything drawn on the map. */
function frameMap(m: MapLibreMap, d: MapDoc) {
  const box = bboxOf(
    d.features.flatMap((f): Position[] =>
      f.geometry.type === "Point" ? [f.geometry.coordinates] : f.geometry.type === "LineString" ? f.geometry.coordinates : f.geometry.coordinates[0],
    ),
  );
  if (box) m.fitBounds([box[0], box[1], box[2], box[3]], { padding: 60, maxZoom: 17, duration: 0 });
}

export function SharedScreen({ slug }: { slug: string }) {
  const { t } = useI18n();
  const [doc, setDoc] = useState<MapDoc | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<FeatureId | null>(null);
  const [imagery, setImagery] = useState<ImageryId>(() => storedImagery() ?? DEFAULT_IMAGERY);
  const [picker, setPicker] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [peek, setPeek] = useState(96);
  const [offline, setOffline] = useState(false);
  const [joining, setJoining] = useState(false);
  const follow = useFollow();
  const wide = useMedia("(min-width: 48rem)");
  const [initialView] = useState<View>({ center: [-8.1, 39.6], zoom: 6 });

  useEffect(() => {
    let cancelled = false;
    void api<{ share: { doc: unknown } }>("GET", `/api/shares/${slug}`).then((r) => {
      if (cancelled) return;
      const loaded = r.ok ? loadMapDoc(r.data.share.doc) : null;
      if (loaded?.ok) setDoc(loaded.doc);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (doc && follow.map.current) frameMap(follow.map.current, doc);
  }, [doc, follow.map]);

  const { navigation, start: startNavigation, stop: stopNavigation } = useNavigation(doc, follow.fix);
  const navTarget = doc && navigation ? featureById(doc, navigation.target.id) : undefined;
  const shown = navigation ? navigation.target.id : selected;
  const rendered = useMemo(
    () => render(doc ?? { type: "FeatureCollection", coutada: { v: 1, name: "" }, features: [] }, { selected: shown, guide: navigation?.guide ?? null }),
    [doc, shown, navigation],
  );
  const feature = doc && selected ? featureById(doc, selected) : undefined;

  const navigateTo = (id: FeatureId) => {
    follow.ensure();
    startNavigation(id);
    setSelected(null);
    setSheetOpen(false);
  };

  const peekContent = navigation && navTarget ? (
    <NavPanel navigation={navigation} feature={navTarget} fix={follow.fix} status={follow.status} onStop={stopNavigation} />
  ) : failed ? (
    <div>
      <h1 className="text-xl leading-tight font-bold">{t("shared.gone")}</h1>
      <p className="mt-1 text-[15px] text-xisto-soft">{t("shared.goneExplain")}</p>
    </div>
  ) : feature ? (
    <FeatureHeader feature={feature} onClose={() => setSelected(null)} />
  ) : (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="truncate text-[22px] leading-tight font-bold">{doc?.coutada.name ?? t("auth.working")}</h1>
        <p className="text-[14px] text-xisto-soft">{t("shared.readOnly")}</p>
      </div>
      {doc && (
        <div className="grid grid-cols-3 gap-2">
          <Tile icon={<Radio size={20} />} label={t("tile.join")} onClick={() => setJoining(true)} />
          <Tile icon={<CloudDownload size={20} />} label={t("tile.offline")} onClick={() => setOffline(true)} />
          <Tile icon={<LogIn size={20} />} label={t("tile.openApp")} onClick={() => navigate("/")} />
        </div>
      )}
    </div>
  );

  const body = navigation ? null : failed ? (
    <a href="/" className={primaryButton}>
      {t("shared.openApp")}
    </a>
  ) : feature ? (
    <div className="flex flex-col gap-4">
      {feature.geometry.type !== "Polygon" && <NavigateButton feature={feature} onNavigate={() => navigateTo(feature.id)} />}
      {feature.properties.note && <p className="text-[16px] leading-snug whitespace-pre-wrap">{feature.properties.note}</p>}
    </div>
  ) : doc ? (
    <section className="flex flex-col gap-1">
      <h3 className="text-[15px] font-semibold">{t("maps.drawn")}</h3>
      <FeatureList doc={doc} onChoose={(id) => setSelected(id)} />
    </section>
  ) : null;

  return (
    <main className="fixed inset-0 overflow-hidden font-sans" style={{ "--peek": `${peek}px` } as React.CSSProperties}>
      <MapView
        imagery={imagery}
        initialView={initialView}
        fix={follow.fix}
        rendered={rendered}
        drawing={false}
        inset={wide ? { bottom: 0, left: PANEL_PX } : { bottom: sheetOpen ? 0 : peek, left: 0 }}
        onReady={(m) => {
          follow.attach(m);
          if (doc) frameMap(m, doc);
        }}
        onTap={(_at, hit) => {
          setSelected(hit);
          setSheetOpen(hit !== null);
        }}
      />

      <p className="pointer-events-none absolute bottom-[calc(var(--peek)+0.5rem)] left-3 z-10 rounded-md bg-cal/80 px-2 py-0.5 text-[11px] text-xisto md:bottom-3 md:left-[404px]">
        {imageryOf(imagery).attribution}
      </p>

      <div className="absolute right-3 bottom-[calc(var(--peek)+1rem)] z-10 flex flex-col items-end gap-3 md:bottom-6">
        <div className="relative">
          <RailButton label={t("imagery.title")} active={picker} aria-expanded={picker} onClick={() => setPicker((p) => !p)}>
            <Layers size={22} strokeWidth={2.2} />
          </RailButton>
          {picker && (
            <ImageryPicker
              current={imagery}
              onChoose={(id) => {
                setImagery(id);
                storeImagery(id);
                setPicker(false);
              }}
              onClose={() => setPicker(false)}
            />
          )}
        </div>
        <RailButton label={follow.label} active={follow.status === "on"} tone="person" onClick={follow.onLocate} className="size-14 rounded-full">
          {follow.status === "on" && follow.following ? <LocateFixed size={24} strokeWidth={2.2} /> : <Locate size={24} strokeWidth={2.2} />}
        </RailButton>
      </div>

      <Sheet open={sheetOpen && body !== null} onOpenChange={setSheetOpen} onPeekHeight={setPeek} peek={peekContent}>
        {body}
      </Sheet>
      {offline && doc && <OfflineDialog doc={doc} imagery={imagery} onClose={() => setOffline(false)} />}
      {joining && <JoinHuntDialog onClose={() => setJoining(false)} />}
    </main>
  );
}
