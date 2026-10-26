/**
 * The anonymous way in (D5): a username and a passed Turnstile make a device this browser holds,
 * which the map is then filed under.
 */

import { useState, type FormEvent } from "react";
import { Dialog } from "../components/Dialog";
import { Turnstile } from "../components/Turnstile";
import { field, linkButton, primaryButton } from "../components/ui";
import { useI18n } from "../i18n/context";
import { api } from "../share/api";
import { useAccount } from "./context";
import { errorKey } from "./errors";

export function DeviceDialog({ onDone, onClose, onSignIn }: { onDone: () => void; onClose: () => void; onSignIn: () => void }) {
  const { t, locale } = useI18n();
  const { refresh } = useAccount();
  const [username, setUsername] = useState("");
  const [turnstile, setTurnstile] = useState<string | null>(null);
  const [challenge, setChallenge] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await api("POST", "/api/device", { username, turnstile });
    if (!r.ok) {
      setError(t(errorKey(r.error)));
      setBusy(false);
      setTurnstile(null);
      setChallenge((c) => c + 1);
      return;
    }
    await refresh();
    onDone();
  };

  return (
    <Dialog title={t("device.title")} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-[15px] leading-snug text-xisto-soft">{t("device.explain")}</p>
        <label className="flex flex-col gap-1.5">
          <span className="text-[15px] font-semibold">{t("device.name")}</span>
          <input
            required
            maxLength={24}
            autoComplete="nickname"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={field}
          />
        </label>
        <Turnstile key={challenge} language={locale} onToken={setTurnstile} />
        {error && (
          <p role="alert" className="text-[15px] text-[#a32a1d]">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || !turnstile || username.trim() === ""} className={primaryButton}>
          {busy ? t("auth.working") : t("device.submit")}
        </button>
        <button type="button" onClick={onSignIn} className={linkButton}>
          {t("device.orAccount")}
        </button>
      </form>
    </Dialog>
  );
}
