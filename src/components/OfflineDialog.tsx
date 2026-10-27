/**
 * Downloading the property's imagery for use with no signal (D19): what it covers, how much it
 * weighs, a lighter option, progress you can cancel, and removing it again.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "./Dialog";
import { linkButton, primaryButton, secondaryButton } from "./ui";
import type { MapDoc } from "../doc/types";
import { useI18n } from "../i18n/context";
import type { MessageKey } from "../i18n/core";
import { formatBytes } from "../lib/format";
import { isIos, isStandalone } from "../lib/useInstall";
import { imageryOf } from "../map/imagery";
import type { ImageryId } from "../doc/catalogue";
import { clearPacks, downloadPack, packTileCount, type Progress } from "../offline/download";
import { areaOf, planPack, type Detail } from "../offline/plan";
import { count } from "../share/usage";

type Connection = { type?: string; saveData?: boolean };

export function OfflineDialog({ doc, imagery, onClose }: { doc: MapDoc; imagery: ImageryId; onClose: () => void }) {
  const { t, tn, locale } = useI18n();
  const [detail, setDetail] = useState<Detail>("full");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [finished, setFinished] = useState<Progress | null>(null);
  const [stored, setStored] = useState<number | null>(null);
  const [quota, setQuota] = useState<{ usage: number; quota: number } | null>(null);
  const abort = useRef<AbortController | null>(null);

  const source = imageryOf(imagery);
  const area = useMemo(() => areaOf(doc), [doc]);
  const plans = useMemo(() => (area ? { full: planPack(area, "full"), light: planPack(area, "light") } : null), [area]);
  const plan = plans?.[detail];
  const connection = (navigator as { connection?: Connection }).connection;
  const metered = connection?.type === "cellular" || connection?.saveData === true;

  const refreshStorage = async () => {
    setStored(await packTileCount().catch(() => null));
    const estimate = await navigator.storage?.estimate?.().catch(() => undefined);
    if (estimate?.quota) setQuota({ usage: estimate.usage ?? 0, quota: estimate.quota });
  };

  useEffect(() => {
    // The pack's size and the device's room are read once the dialog opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshStorage();
    return () => abort.current?.abort();
  }, []);

  const start = async () => {
    if (!plan || plan.tooBig) return;
    await navigator.storage?.persist?.().catch(() => false);
    abort.current = new AbortController();
    setFinished(null);
    setProgress({ done: 0, failed: 0, total: plan.tiles.length, bytes: 0 });
    count("offline.download");
    const result = await downloadPack(plan, source, abort.current.signal, setProgress);
    setProgress(null);
    setFinished(result);
    void refreshStorage();
  };

  const cancel = () => abort.current?.abort();

  const remove = async () => {
    await clearPacks();
    setFinished(null);
    void refreshStorage();
  };

  return (
    <Dialog title={t("offline.title")} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-[15px] leading-snug text-xisto-soft">{t("offline.explain", { source: t(`imagery.${imagery}` as MessageKey) })}</p>

        {isIos() && !isStandalone() && (
          <p className="rounded-[12px] border-l-4 border-anil bg-anil/10 p-3 text-[15px] leading-snug">{t("offline.iosInstall")}</p>
        )}

        {!plans ? (
          <p className="text-[15px] leading-snug">{t("offline.nothingDrawn")}</p>
        ) : progress ? (
          <div className="flex flex-col gap-3" role="status" aria-live="polite">
            <div className="h-3 overflow-hidden rounded-full bg-cal-deep">
              <div
                className="h-full bg-anil motion-safe:transition-[width]"
                style={{ width: `${Math.round(((progress.done + progress.failed) / Math.max(1, progress.total)) * 100)}%` }}
              />
            </div>
            <p className="text-[15px] tabular-nums">
              {t("offline.progress", { done: progress.done, total: progress.total, size: formatBytes(progress.bytes, locale) })}
            </p>
            <button type="button" onClick={cancel} className={secondaryButton}>
              {t("draw.cancel")}
            </button>
          </div>
        ) : (
          <>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-[15px] font-semibold">{t("offline.detail")}</legend>
              {(["full", "light"] as const).map((d) => (
                <label
                  key={d}
                  className="flex min-h-14 cursor-pointer items-center gap-3 rounded-[14px] border-2 border-transparent bg-cal-deep px-3 py-2 has-checked:border-anil"
                >
                  <input type="radio" name="detail" checked={detail === d} onChange={() => setDetail(d)} className="size-5 accent-anil" />
                  <span className="flex-1">
                    <span className="block text-[15px] font-semibold">{t(`offline.detail.${d}`)}</span>
                    <span className="block text-[14px] text-xisto-soft tabular-nums">
                      {t("offline.estimate", { tiles: plans[d].tiles.length, size: formatBytes(plans[d].bytes, locale) })}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            {plan?.tooBig && <p className="text-[15px] text-[#a32a1d]">{t("offline.tooBig")}</p>}
            {metered && <p className="text-[15px] leading-snug text-[#a32a1d]">{t("offline.metered")}</p>}

            {finished && (
              <p role="status" className="text-[15px] leading-snug">
                {finished.failed > 0
                  ? tn("offline.partial", finished.failed)
                  : t("offline.done", { size: formatBytes(finished.bytes, locale) })}
              </p>
            )}

            <button type="button" onClick={() => void start()} disabled={!plan || plan.tooBig} className={primaryButton}>
              {finished?.failed ? t("offline.retry") : t("offline.start")}
            </button>
          </>
        )}

        {(stored !== null || quota) && (
          <div className="flex flex-col gap-1 border-t border-rule pt-3 text-[14px] text-xisto-soft">
            {stored !== null && stored > 0 && <span>{t("offline.stored", { tiles: stored })}</span>}
            {quota && <span>{t("offline.quota", { used: formatBytes(quota.usage, locale), free: formatBytes(quota.quota - quota.usage, locale) })}</span>}
            {stored !== null && stored > 0 && !progress && (
              <button type="button" onClick={() => void remove()} className={`${linkButton} self-start text-[#a32a1d]`}>
                {t("offline.remove")}
              </button>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
