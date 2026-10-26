/** A read-only link to the map as it is now (D8): minting it, copying it, withdrawing it. */

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Dialog } from "../components/Dialog";
import { field, primaryButton, secondaryButton } from "../components/ui";
import { useI18n } from "../i18n/context";
import { api } from "../share/api";
import { sharedUrl } from "../share/routes";
import { errorKey } from "./errors";

export function ShareDialog({
  mapId,
  slug,
  onSlug,
  onClose,
}: {
  mapId: string;
  slug: string | null;
  onSlug: (slug: string | null) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publish = async () => {
    setBusy(true);
    const r = await api<{ slug: string }>("POST", `/api/maps/${mapId}/publish`);
    setBusy(false);
    if (r.ok) onSlug(r.data.slug);
    else setError(t(errorKey(r.error)));
  };

  const withdraw = async () => {
    setBusy(true);
    const r = await api("DELETE", `/api/maps/${mapId}/publish`);
    setBusy(false);
    if (r.ok) onSlug(null);
    else setError(t(errorKey(r.error)));
  };

  const copy = async () => {
    if (!slug) return;
    try {
      await navigator.clipboard.writeText(sharedUrl(slug));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Dialog title={t("share.title")} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-[15px] leading-snug text-xisto-soft">{slug ? t("share.live") : t("share.explain")}</p>
        {slug ? (
          <>
            <input readOnly value={sharedUrl(slug)} onFocus={(e) => e.currentTarget.select()} aria-label={t("share.link")} className={field} />
            <button type="button" onClick={copy} className={primaryButton}>
              {copied ? <Check size={18} /> : <Copy size={18} />}
              {copied ? t("share.copied") : t("share.copy")}
            </button>
            <button type="button" onClick={withdraw} disabled={busy} className={secondaryButton}>
              {t("share.withdraw")}
            </button>
          </>
        ) : (
          <button type="button" onClick={publish} disabled={busy} className={primaryButton}>
            {t("share.create")}
          </button>
        )}
        {error && (
          <p role="alert" className="text-[15px] text-[#a32a1d]">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
