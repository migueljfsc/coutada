/**
 * The sheet when nothing is selected, about this map only: its name, which opens the map
 * switcher, whether it is saved, the four things to do with it, and what is drawn on it.
 */

import type { ReactNode } from "react";
import { ChevronDown, CloudDownload, FolderOpen, Link2, Radio, Save } from "lucide-react";
import type { FeatureId, MapDoc } from "../doc/types";
import { useI18n } from "../i18n/context";
import type { MessageKey } from "../i18n/core";
import type { SyncStatus } from "../sync/useMapDocument";
import { FeatureList } from "./editor/FeatureList";
import { SearchField } from "./search/SearchField";
import type { Search, SearchHit } from "./search/useSearch";

export type PanelActions = {
  openMaps: () => void;
  choose: (id: FeatureId) => void;
  save: () => void;
  share: () => void;
  offline: () => void;
  hunt: () => void;
  files: () => void;
};

/** Each state's dot: settled, on its way, only here, or needing the person. */
const STATE: Record<SyncStatus, { dot: string; label: MessageKey }> = {
  saved: { dot: "bg-[#2f9e44]", label: "status.saved" },
  saving: { dot: "bg-[#c9a227]", label: "status.saving" },
  loading: { dot: "bg-[#c9a227]", label: "status.loading" },
  offline: { dot: "bg-[#c9a227]", label: "status.offline" },
  local: { dot: "bg-[#9aa093]", label: "status.local" },
  hunting: { dot: "bg-azinho", label: "status.hunting" },
  conflict: { dot: "bg-[#c23a2b]", label: "status.conflict" },
  missing: { dot: "bg-[#c23a2b]", label: "status.missing" },
};

export function Tile({
  icon,
  label,
  primary = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex min-h-16 flex-col items-center justify-center gap-1 rounded-[10px] px-1 py-2 text-center text-[13px] leading-tight font-semibold",
        primary ? "bg-azinho text-white active:bg-[#46653a]" : "bg-cal-deep text-xisto active:bg-azinho active:text-white",
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}

const tiles = "grid grid-cols-4 gap-2";

/** The peek: the map's name as the way to the other maps, its state, the search, and the four actions. */
export function MapPeek({
  doc,
  status,
  saved,
  inHunt,
  actions,
  search,
  onFound,
  onSearchFocus,
}: {
  doc: MapDoc;
  status: SyncStatus;
  /** The map is on the server, so it can be shared and hunted on. */
  saved: boolean;
  /** This phone is in a live hunt it can go back to. */
  inHunt: boolean;
  actions: PanelActions;
  search: Search;
  onFound: (hit: SearchHit) => void;
  /** The search box was focused or typed in: the sheet opens so its results show. */
  onSearchFocus: () => void;
}) {
  const { t } = useI18n();
  const state = STATE[status];
  return (
    <div className="flex flex-col gap-3">
      <div className="min-w-0">
        <button
          type="button"
          onClick={actions.openMaps}
          aria-haspopup="dialog"
          className="-mx-1 flex min-h-11 max-w-full items-center gap-1 rounded-[10px] px-1 text-left active:bg-cal-deep"
        >
          <span className="truncate text-[22px] leading-tight font-bold">{doc.coutada.name}</span>
          <ChevronDown size={22} strokeWidth={2.4} className="shrink-0 text-xisto-soft" aria-hidden />
        </button>
        <p className="flex items-center gap-2 text-[14px] text-xisto-soft" role="status">
          <span className={`size-2 shrink-0 rounded-full ${state.dot}`} aria-hidden />
          {t(state.label)}
        </p>
      </div>
      <SearchField search={search} onGo={onFound} onEngage={onSearchFocus} />
      <div className={tiles}>
        <Tile icon={<Radio size={20} />} label={t(inHunt ? "tile.backToHunt" : "tile.hunt")} onClick={actions.hunt} />
        {saved ? (
          <Tile icon={<Link2 size={20} />} label={t("tile.share")} onClick={actions.share} />
        ) : (
          <Tile icon={<Save size={20} />} label={t("tile.save")} primary onClick={actions.save} />
        )}
        <Tile icon={<CloudDownload size={20} />} label={t("tile.offline")} onClick={actions.offline} />
        <Tile icon={<FolderOpen size={20} />} label={t("tile.files")} onClick={actions.files} />
      </div>
    </div>
  );
}

/** The sheet's body: everything drawn on the map. */
export function MapBody({ doc, onChoose }: { doc: MapDoc; onChoose: (id: FeatureId) => void }) {
  const { t } = useI18n();
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-[15px] font-semibold">{t("maps.drawn")}</h3>
      <FeatureList doc={doc} onChoose={onChoose} />
    </section>
  );
}
