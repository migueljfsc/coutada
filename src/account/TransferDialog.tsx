/**
 * Moving the anonymous device to another browser (D5): this one shows a code and its QR, the other
 * opens the QR's link or types the code.
 */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import qrcode from "qrcode-generator";
import { Dialog } from "../components/Dialog";
import { field, primaryButton } from "../components/ui";
import { useI18n } from "../i18n/context";
import { api } from "../share/api";
import { transferUrl } from "../share/routes";
import { useAccount } from "./context";
import { errorKey } from "./errors";

function qrDataUrl(text: string): string {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr.createDataURL(6, 2);
}

/** Shows this device's code, or — on a browser without one — takes a code typed in. */
export function TransferDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { me } = useAccount();
  return (
    <Dialog title={t("transfer.title")} onClose={onClose}>
      {me?.device ? <ShowCode /> : <EnterCode onDone={onClose} />}
    </Dialog>
  );
}

function ShowCode() {
  const { t } = useI18n();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api<{ code: string }>("POST", "/api/device/transfer").then((r) => {
      if (cancelled) return;
      if (r.ok) setCode(r.data.code);
      else setError(t(errorKey(r.error)));
    });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const qr = useMemo(() => (code ? qrDataUrl(transferUrl(code)) : null), [code]);

  if (error) return <p role="alert" className="text-[15px] text-[#a32a1d]">{error}</p>;
  if (!code || !qr) return <p className="text-[15px] text-xisto-soft">{t("auth.working")}</p>;
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-[15px] leading-snug">{t("transfer.explain")}</p>
      <img src={qr} alt={t("transfer.qrAlt")} className="size-56 rounded-[8px] bg-white p-2 [image-rendering:pixelated]" />
      <p className="font-mono text-[28px] font-bold tracking-[0.2em]" aria-label={code.split("").join(" ")}>
        {code}
      </p>
      <p className="text-[14px] text-xisto-soft">{t("transfer.expires")}</p>
    </div>
  );
}

export function EnterCode({ onDone, initial = "" }: { onDone: () => void; initial?: string }) {
  const { t } = useI18n();
  const { refresh } = useAccount();
  const [code, setCode] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await api("POST", "/api/device/transfer/redeem", { code });
    setBusy(false);
    if (!r.ok) {
      setError(t(errorKey(r.error)));
      return;
    }
    await refresh();
    onDone();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-[15px] leading-snug text-xisto-soft">{t("transfer.enterExplain")}</p>
      <input
        required
        value={code}
        maxLength={8}
        autoCapitalize="characters"
        autoComplete="one-time-code"
        aria-label={t("transfer.code")}
        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ""))}
        className={`${field} text-center font-mono text-[22px] tracking-[0.2em] uppercase`}
      />
      {error && (
        <p role="alert" className="text-[15px] text-[#a32a1d]">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy || code.length !== 8} className={primaryButton}>
        {busy ? t("auth.working") : t("transfer.use")}
      </button>
    </form>
  );
}
