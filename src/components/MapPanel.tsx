/**
 * The sheet's body when nothing is selected: the map and where it is kept, the person's maps, what
 * is drawn, their position, who they are, the language, and the safety line.
 */

import { useEffect, useState } from "react";
import { CloudDownload, CloudOff, Link2, Plus, Radio, Save, Smartphone, Users } from "lucide-react";
import { hasIdentity, useAccount } from "../account/context";
import { isFeatureName } from "../doc/schema";
import type { FeatureId, MapDoc } from "../doc/types";
import { useI18n } from "../i18n/context";
import { LOCALES } from "../i18n/core";
import type { Fix } from "../map/me";
import { useInstall } from "../lib/useInstall";
import { api, type MapSummary } from "../share/api";
import { mapPath, navigate } from "../share/routes";
import type { SyncStatus } from "../sync/useMapDocument";
import { FeatureList } from "./editor/FeatureList";
import { linkButton, primaryButton, secondaryButton } from "./ui";

export type PanelActions = {
  rename: (name: string) => void;
  choose: (id: FeatureId) => void;
  save: () => void;
  share: () => void;
  startNew: () => void;
  signIn: () => void;
  register: () => void;
  transfer: () => void;
  signOut: () => void;
  deleteAccount: () => void;
  deleteDevice: () => void;
  offline: () => void;
  startHunt: () => void;
  joinHunt: () => void;
};

type Props = {
  doc: MapDoc;
  mapId: string | null;
  status: SyncStatus;
  fix: Fix | null;
  actions: PanelActions;
};

export function MapPanel({ doc, mapId, status, fix, actions }: Props) {
  const { t, locale, setLocale } = useI18n();
  const { me } = useAccount();
  const [maps, setMaps] = useState<MapSummary[] | null>(null);
  const [pending, setPending] = useState<string | "new" | null>(null);
  const identified = hasIdentity(me);
  const unsavedLocal = status === "local" && doc.features.length > 0;

  useEffect(() => {
    if (!identified) return;
    let cancelled = false;
    void api<{ maps: MapSummary[] }>("GET", "/api/maps").then((r) => {
      if (!cancelled && r.ok) setMaps(r.data.maps);
    });
    return () => {
      cancelled = true;
    };
  }, [identified, mapId, status]);

  const open = (target: string | "new") => {
    if (unsavedLocal && pending !== target) {
      setPending(target);
      return;
    }
    setPending(null);
    if (target === "new") actions.startNew();
    else navigate(mapPath(target));
  };

  return (
    <div className="flex flex-col gap-6">
      <MapName key={doc.coutada.name} name={doc.coutada.name} onRename={actions.rename} />

      <div className="flex flex-col gap-2">
        {mapId ? (
          <button type="button" onClick={actions.share} className={secondaryButton}>
            <Link2 size={18} />
            {t("share.title")}
          </button>
        ) : (
          <button type="button" onClick={actions.save} className={primaryButton}>
            <Save size={18} />
            {t("maps.save")}
          </button>
        )}
        {status === "local" && <p className="text-[14px] text-xisto-soft">{t("maps.localOnly")}</p>}
        {status === "offline" && (
          <p className="flex items-center gap-2 text-[14px] text-xisto-soft">
            <CloudOff size={16} />
            {t("sync.offline")}
          </p>
        )}
      </div>

      {identified && maps && (
        <section className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-semibold">{t("maps.mine")}</h3>
            <button type="button" onClick={() => open("new")} className={`${linkButton} flex items-center gap-1`}>
              <Plus size={16} />
              {t("maps.new")}
            </button>
          </div>
          {pending && (
            <div role="alert" className="flex flex-col gap-2 rounded-[12px] bg-cal-deep p-3 text-[15px]">
              {t("maps.discardLocal")}
              <button type="button" onClick={() => open(pending)} className="min-h-11 self-start font-semibold text-[#a32a1d]">
                {t("maps.discardConfirm")}
              </button>
            </div>
          )}
          <ul className="-mx-2">
            {maps.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  aria-current={m.id === mapId ? "page" : undefined}
                  onClick={() => m.id !== mapId && open(m.id)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 rounded-[12px] px-2 text-left text-[16px] active:bg-cal-deep aria-[current=page]:font-bold"
                >
                  <span className="truncate">{m.name}</span>
                  {m.share_slug && <Link2 size={16} className="shrink-0 text-xisto-soft" aria-label={t("share.live")} />}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <HuntSection canStart={!!mapId && identified} onStart={actions.startHunt} onJoin={actions.joinHunt} />

      <section className="flex flex-col gap-1">
        <h3 className="text-[15px] font-semibold">{t("maps.drawn")}</h3>
        <FeatureList doc={doc} onChoose={actions.choose} />
      </section>

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

      <OfflineSection onDownload={actions.offline} />

      <AccountSection actions={actions} />

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

export function HuntSection({ canStart, onStart, onJoin }: { canStart: boolean; onStart?: () => void; onJoin: () => void }) {
  const { t } = useI18n();
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[15px] font-semibold">{t("hunt.section")}</h3>
      {canStart && onStart && (
        <button type="button" onClick={onStart} className={secondaryButton}>
          <Radio size={18} />
          {t("hunt.start")}
        </button>
      )}
      <button type="button" onClick={onJoin} className={secondaryButton}>
        <Users size={18} />
        {t("hunt.join")}
      </button>
    </section>
  );
}

export function OfflineSection({ onDownload }: { onDownload: () => void }) {
  const { t } = useI18n();
  const { installed, install, iosHint } = useInstall();
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[15px] font-semibold">{t("offline.section")}</h3>
      <button type="button" onClick={onDownload} className={secondaryButton}>
        <CloudDownload size={18} />
        {t("offline.open")}
      </button>
      {!installed && install && (
        <button type="button" onClick={() => void install()} className={secondaryButton}>
          <Smartphone size={18} />
          {t("install.app")}
        </button>
      )}
      {iosHint && <p className="text-[14px] leading-snug text-xisto-soft">{t("install.iosHint")}</p>}
    </section>
  );
}

function AccountSection({ actions }: { actions: PanelActions }) {
  const { t } = useI18n();
  const { me } = useAccount();

  if (me?.user) {
    return (
      <section className="flex flex-col gap-2">
        <h3 className="text-[15px] font-semibold">{t("account.title")}</h3>
        <p className="truncate text-[15px]">{t("account.signedInAs", { email: me.user.email })}</p>
        <div className="flex flex-wrap gap-x-5">
          <button type="button" onClick={actions.signOut} className={linkButton}>
            {t("account.signOut")}
          </button>
          <button type="button" onClick={actions.deleteAccount} className={`${linkButton} text-[#a32a1d]`}>
            {t("account.delete")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[15px] font-semibold">{t("account.title")}</h3>
      <p className="text-[15px] leading-snug text-xisto-soft">
        {me?.device ? t("account.anonymous", { name: me.device.username }) : t("account.none")}
      </p>
      <button type="button" onClick={actions.signIn} className={secondaryButton}>
        {t("account.signIn")}
      </button>
      <div className="flex flex-wrap gap-x-5">
        <button type="button" onClick={actions.register} className={linkButton}>
          {t("account.register")}
        </button>
        <button type="button" onClick={actions.transfer} className={linkButton}>
          {me?.device ? t("transfer.title") : t("transfer.haveCode")}
        </button>
        {me?.device && (
          <button type="button" onClick={actions.deleteDevice} className={`${linkButton} text-[#a32a1d]`}>
            {t("device.delete")}
          </button>
        )}
      </div>
    </section>
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
