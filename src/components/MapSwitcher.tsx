/**
 * The person's maps, opened from the map's name: renaming this one, going to another, starting a
 * new one. Leaving a map that is only in this browser asks first, since it would be lost.
 */

import { useEffect, useState } from "react";
import { Check, Link2, Plus } from "lucide-react";
import { hasIdentity, useAccount } from "../account/context";
import { isFeatureName } from "../doc/schema";
import { useI18n } from "../i18n/context";
import { api, type MapSummary } from "../share/api";
import { mapPath, navigate } from "../share/routes";
import { Dialog } from "./Dialog";
import { field, secondaryButton } from "./ui";

export function MapSwitcher({
  name,
  mapId,
  unsavedLocal,
  onRename,
  onNew,
  onClose,
}: {
  name: string;
  mapId: string | null;
  /** Drawn on, and only in this browser. */
  unsavedLocal: boolean;
  onRename: (name: string) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { me } = useAccount();
  const identified = hasIdentity(me);
  const [maps, setMaps] = useState<MapSummary[] | null>(null);
  const [pending, setPending] = useState<string | "new" | null>(null);

  useEffect(() => {
    if (!identified) return;
    let cancelled = false;
    void api<{ maps: MapSummary[] }>("GET", "/api/maps").then((r) => {
      if (!cancelled && r.ok) setMaps(r.data.maps);
    });
    return () => {
      cancelled = true;
    };
  }, [identified]);

  const open = (target: string | "new") => {
    if (unsavedLocal && pending !== target) {
      setPending(target);
      return;
    }
    onClose();
    if (target === "new") onNew();
    else navigate(mapPath(target));
  };

  const others = (maps ?? []).filter((m) => m.id !== mapId);

  return (
    <Dialog title={t("maps.mine")} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <MapName name={name} onRename={onRename} />

        {others.length > 0 && (
          <ul className="-mx-2 flex flex-col">
            {others.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => open(m.id)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 rounded-[12px] px-2 text-left text-[17px] font-semibold active:bg-cal-deep"
                >
                  <span className="truncate">{m.name}</span>
                  {m.share_slug && <Link2 size={16} className="shrink-0 text-xisto-soft" aria-label={t("share.live")} />}
                </button>
              </li>
            ))}
          </ul>
        )}

        {pending && (
          <div role="alert" className="flex flex-col gap-2 rounded-[12px] bg-cal-deep p-3 text-[15px]">
            {t("maps.discardLocal")}
            <button type="button" onClick={() => open(pending)} className="min-h-11 self-start font-semibold text-[#a32a1d]">
              {t("maps.discardConfirm")}
            </button>
          </div>
        )}

        <button type="button" onClick={() => open("new")} className={secondaryButton}>
          <Plus size={18} />
          {t("maps.new")}
        </button>

        {!identified && <p className="text-[14px] leading-snug text-xisto-soft">{t("maps.localOnly")}</p>}
      </div>
    </Dialog>
  );
}

function MapName({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const { t } = useI18n();
  const [value, setValue] = useState(name);
  const valid = isFeatureName(value.trim());
  const changed = valid && value.trim() !== name;
  const commit = () => {
    if (changed) onRename(value.trim());
    else if (!valid) setValue(name);
  };
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[15px] font-semibold">{t("map.name")}</span>
      <span className="flex gap-2">
        <input
          type="text"
          value={value}
          maxLength={60}
          enterKeyHint="done"
          aria-invalid={!valid}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className={field}
        />
        {changed && (
          <button
            type="button"
            onClick={commit}
            aria-label={t("map.rename")}
            className="flex size-12 shrink-0 items-center justify-center rounded-[12px] bg-anil text-white"
          >
            <Check size={20} strokeWidth={2.6} />
          </button>
        )}
      </span>
    </label>
  );
}
