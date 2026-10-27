/** Starting a hunt on a saved map, and joining one by its code (D9, D10). */

import { useState, type FormEvent } from "react";
import { useAccount } from "../../account/context";
import { errorKey } from "../../account/errors";
import { useI18n } from "../../i18n/context";
import { lastHunt, storedPass, storePass } from "../../live/huntStore";
import type { HuntType } from "../../live/protocol";
import { api } from "../../share/api";
import { huntPath, navigate } from "../../share/routes";
import { Dialog } from "../Dialog";
import { Turnstile } from "../Turnstile";
import { field, primaryButton } from "../ui";

type Pass = { hunt: { id: string; code?: string }; member: { id: string; token: string } };

export function StartHuntDialog({ mapId, onClose }: { mapId: string; onClose: () => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async (type: HuntType) => {
    setBusy(true);
    setError(null);
    const r = await api<Pass>("POST", "/api/hunts", { mapId, type });
    setBusy(false);
    if (r.ok) {
      storePass(r.data.hunt.id, { memberId: r.data.member.id, token: r.data.member.token });
      navigate(huntPath(r.data.hunt.id));
      return;
    }
    const existing = (r.data?.hunt as { id?: string } | undefined)?.id;
    if (r.error === "hunt_exists" && existing && storedPass(existing)) {
      navigate(huntPath(existing));
      return;
    }
    setError(r.error === "hunt_exists" ? t("hunt.alreadyRunning") : t(errorKey(r.error)));
  };

  return (
    <Dialog title={t("hunt.start")} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-[15px] leading-snug text-xisto-soft">{t("hunt.startExplain")}</p>
        {(["montaria", "salto"] as const).map((type) => (
          <button
            key={type}
            type="button"
            disabled={busy}
            onClick={() => void start(type)}
            className="flex min-h-16 flex-col items-start justify-center rounded-[10px] bg-cal-deep px-4 py-3 text-left active:bg-azinho active:text-white disabled:opacity-50"
          >
            <span className="text-[17px] font-bold">{t(`hunt.type.${type}`)}</span>
            <span className="text-[14px] leading-snug text-xisto-soft">{t(`hunt.type.${type}.detail`)}</span>
          </button>
        ))}
        {error && (
          <p role="alert" className="text-[15px] text-[#a32a1d]">
            {error}
          </p>
        )}
        <p className="border-l-4 border-person pl-3 text-[14px] leading-snug">{t("safety.notice")}</p>
      </div>
    </Dialog>
  );
}

export function JoinHuntDialog({ onClose }: { onClose: () => void }) {
  const { t, locale } = useI18n();
  const { me } = useAccount();
  const [code, setCode] = useState("");
  const [name, setName] = useState(me?.device?.username ?? me?.user?.displayName ?? "");
  const [turnstile, setTurnstile] = useState<string | null>(null);
  const [challenge, setChallenge] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const back = lastHunt();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await api<Pass>("POST", "/api/hunts/join", { code, username: name, turnstile });
    setBusy(false);
    if (r.ok) {
      storePass(r.data.hunt.id, { memberId: r.data.member.id, token: r.data.member.token });
      navigate(huntPath(r.data.hunt.id));
      return;
    }
    setError(r.status === 404 ? t("hunt.codeUnknown") : t(errorKey(r.error)));
    setTurnstile(null);
    setChallenge((c) => c + 1);
  };

  return (
    <Dialog title={t("hunt.join")} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {back && storedPass(back) && (
          <button type="button" onClick={() => navigate(huntPath(back))} className={primaryButton}>
            {t("hunt.backTo")}
          </button>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="text-[15px] font-semibold">{t("hunt.code")}</span>
          <input
            required
            value={code}
            maxLength={4}
            autoCapitalize="characters"
            autoComplete="off"
            inputMode="text"
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ""))}
            className={`${field} text-center font-mono text-[28px] font-bold tracking-[0.3em] uppercase`}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[15px] font-semibold">{t("device.name")}</span>
          <input required maxLength={24} value={name} onChange={(e) => setName(e.target.value)} className={field} />
        </label>
        <Turnstile key={challenge} language={locale} onToken={setTurnstile} />
        {error && (
          <p role="alert" className="text-[15px] text-[#a32a1d]">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || code.length !== 4 || !name.trim() || !turnstile} className={primaryButton}>
          {busy ? t("auth.working") : t("hunt.joinSubmit")}
        </button>
        <p className="border-l-4 border-person pl-3 text-[14px] leading-snug">{t("hunt.sharesPosition")}</p>
      </form>
    </Dialog>
  );
}

const choice =
  "flex min-h-16 flex-col items-start justify-center rounded-[10px] bg-cal-deep px-4 py-3 text-left active:bg-azinho active:text-white disabled:opacity-50";

/** The hunt tile's choice: start one on this map, or join one with a code. */
export function HuntChooser({ canStart, onStart, onJoin, onClose }: { canStart: boolean; onStart: () => void; onJoin: () => void; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Dialog title={t("hunt.section")} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <button type="button" disabled={!canStart} onClick={onStart} className={choice}>
          <span className="text-[17px] font-bold">{t("hunt.startHere")}</span>
          <span className="text-[14px] leading-snug text-xisto-soft">{t(canStart ? "hunt.startDetail" : "hunt.needsSave")}</span>
        </button>
        <button type="button" onClick={onJoin} className={choice}>
          <span className="text-[17px] font-bold">{t("hunt.joinWithCode")}</span>
          <span className="text-[14px] leading-snug text-xisto-soft">{t("hunt.joinDetail")}</span>
        </button>
        <p className="border-l-4 border-person pl-3 text-[14px] leading-snug">{t("safety.notice")}</p>
      </div>
    </Dialog>
  );
}
