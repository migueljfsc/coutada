/**
 * Routes, and the links that arrive from outside: a verification or reset email, a Google sign-in
 * that failed, a device handed over by code. After a sign-in, the device's maps are offered to the
 * account once (D6).
 */

import { useEffect, useState } from "react";
import { AuthDialog } from "./account/AuthDialog";
import { useAccount } from "./account/context";
import { errorKey } from "./account/errors";
import { EnterCode } from "./account/TransferDialog";
import { Dialog } from "./components/Dialog";
import { primaryButton, secondaryButton } from "./components/ui";
import { useI18n } from "./i18n/context";
import { HuntScreen } from "./pages/HuntScreen";
import { MapScreen } from "./pages/MapScreen";
import { SharedScreen } from "./pages/SharedScreen";
import { api } from "./share/api";
import { dropParams, navigate, useRoute } from "./share/routes";

export function App() {
  const route = useRoute();
  return (
    <>
      {route.kind === "shared" ? (
        <SharedScreen slug={route.slug} />
      ) : route.kind === "hunt" ? (
        <HuntScreen key={route.id} huntId={route.id} />
      ) : (
        <MapScreen mapId={route.kind === "map" ? route.id : null} />
      )}
      <Links />
      <ClaimOffer />
      {route.kind === "transfer" && <TransferLink code={route.code} />}
    </>
  );
}

type Message = { title: string; text: string };

/** Acts on `?verify=`, `?reset=` and `?auth_error=` once, then drops them from the address. */
function Links() {
  const { t } = useI18n();
  const { refresh } = useAccount();
  const [params] = useState(() => new URLSearchParams(location.search));
  const [message, setMessage] = useState<Message | null>(null);
  const [reset] = useState(() => {
    const token = params.get("reset");
    const email = params.get("email");
    return token && email ? { token, email } : null;
  });
  const [showReset, setShowReset] = useState(reset !== null);

  useEffect(() => {
    const verify = params.get("verify");
    const authError = params.get("auth_error");
    dropParams("verify", "reset", "email", "auth_error", "welcome");
    if (verify) {
      void api("POST", "/api/auth/verify", { token: verify }).then(async (r) => {
        if (r.ok) {
          await refresh();
          setMessage({ title: t("auth.verified"), text: t("auth.verifiedText") });
        } else {
          setMessage({ title: t("auth.linkTitle"), text: t(errorKey(r.error)) });
        }
      });
    } else if (authError) {
      // The error comes from the address bar; it is shown as a known message, never echoed.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessage({ title: t("auth.googleFailed"), text: t(authError === "access_denied" ? "auth.googleDenied" : "auth.googleError") });
    }
  }, [params, refresh, t]);

  return (
    <>
      {showReset && reset && <AuthDialog initial="reset" reset={reset} onClose={() => setShowReset(false)} />}
      {message && (
        <Dialog title={message.title} onClose={() => setMessage(null)}>
          <p className="text-[16px] leading-snug">{message.text}</p>
          <button type="button" onClick={() => setMessage(null)} className={`mt-5 ${primaryButton}`}>
            {t("auth.done")}
          </button>
        </Dialog>
      )}
    </>
  );
}

/** Offers, once per page, to move this device's anonymous maps into the account just signed in to. */
function ClaimOffer() {
  const { t, tn } = useI18n();
  const { me, refresh } = useAccount();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const count = me?.claimable?.maps ?? 0;
  if (dismissed || !me?.user || count === 0) return null;

  const claim = async () => {
    setBusy(true);
    const r = await api("POST", "/api/me/claim");
    setBusy(false);
    if (!r.ok) return setError(t(errorKey(r.error)));
    await refresh();
    setDismissed(true);
  };

  return (
    <Dialog title={t("claim.title")} onClose={() => setDismissed(true)}>
      <div className="flex flex-col gap-4">
        <p className="text-[16px] leading-snug">{tn("claim.text", count)}</p>
        {error && (
          <p role="alert" className="text-[15px] text-[#a32a1d]">
            {error}
          </p>
        )}
        <button type="button" onClick={claim} disabled={busy} className={primaryButton}>
          {tn("claim.move", count)}
        </button>
        <button type="button" onClick={() => setDismissed(true)} className={secondaryButton}>
          {t("claim.notNow")}
        </button>
      </div>
    </Dialog>
  );
}

/** `/transfer?c=<code>`: the other browser's QR, opened here. */
function TransferLink({ code }: { code: string }) {
  const { t } = useI18n();
  return (
    <Dialog title={t("transfer.title")} onClose={() => navigate("/", true)}>
      <EnterCode initial={code.toUpperCase()} onDone={() => navigate("/", true)} />
    </Dialog>
  );
}
