/**
 * Signing in, registering, asking for a reset and setting a new password (D4). The password never
 * leaves the browser: `deriveKey` runs here and the server sees only the key.
 */

import { useState, type FormEvent } from "react";
import { Dialog } from "../components/Dialog";
import { Turnstile } from "../components/Turnstile";
import { field, linkButton, primaryButton, secondaryButton } from "../components/ui";
import { useI18n } from "../i18n/context";
import { api } from "../share/api";
import { deriveKey, MIN_PASSWORD } from "../share/password";
import { useAccount } from "./context";
import { errorKey } from "./errors";

export type AuthMode = "signin" | "register" | "forgot" | "reset";

type Props = {
  initial: AuthMode;
  onClose: () => void;
  /** The reset link's token and address, for `reset`. */
  reset?: { token: string; email: string };
};

export function AuthDialog({ initial, onClose, reset }: Props) {
  const { t, locale } = useI18n();
  const { refresh } = useAccount();
  const [mode, setMode] = useState<AuthMode>(initial);
  const [email, setEmail] = useState(reset?.email ?? "");
  const [password, setPassword] = useState("");
  const [turnstile, setTurnstile] = useState<string | null>(null);
  const [challenge, setChallenge] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<"verify" | "reset" | null>(null);

  const needsTurnstile = mode === "register" || mode === "forgot";
  const needsPassword = mode !== "forgot";
  const short = needsPassword && mode !== "signin" && password.length > 0 && password.length < MIN_PASSWORD;

  const switchTo = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setTurnstile(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (short || busy) return;
    setBusy(true);
    setError(null);
    const fail = (code: string) => {
      setError(t(errorKey(code)));
      setBusy(false);
      setTurnstile(null);
      setChallenge((c) => c + 1);
    };

    if (mode === "forgot") {
      const r = await api("POST", "/api/auth/reset/request", { email, turnstile, lang: locale });
      if (!r.ok) return fail(r.error);
      setSent("reset");
      setBusy(false);
      return;
    }

    const key = await deriveKey(email, password);
    if (mode === "register") {
      const r = await api("POST", "/api/auth/register", { email, key, turnstile, lang: locale });
      if (!r.ok) return fail(r.error);
      setSent("verify");
      setBusy(false);
      return;
    }

    const r =
      mode === "reset"
        ? await api("POST", "/api/auth/reset", { email, key, token: reset?.token })
        : await api("POST", "/api/auth/login", { email, key });
    if (!r.ok) return fail(r.error);
    await refresh();
    onClose();
  };

  const title =
    sent === "verify" ? t("auth.checkMail") : sent === "reset" ? t("auth.checkMail") : t(`auth.title.${mode}`);

  if (sent) {
    return (
      <Dialog title={title} onClose={onClose}>
        <p className="text-[16px] leading-snug">{t(sent === "verify" ? "auth.sentVerify" : "auth.sentReset", { email })}</p>
        <button type="button" onClick={onClose} className={`mt-5 ${primaryButton}`}>
          {t("auth.done")}
        </button>
      </Dialog>
    );
  }

  return (
    <Dialog title={title} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {(mode === "signin" || mode === "register") && (
          <>
            <a
              href={`/api/auth/google/start?next=${encodeURIComponent(location.pathname)}`}
              className={secondaryButton}
            >
              <GoogleMark />
              {t("auth.google")}
            </a>
            <p className="text-center text-[14px] text-xisto-soft">{t("auth.or")}</p>
          </>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-[15px] font-semibold">{t("auth.email")}</span>
          <input
            type="email"
            autoComplete="email"
            required
            readOnly={mode === "reset"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={field}
          />
        </label>

        {needsPassword && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[15px] font-semibold">{mode === "signin" ? t("auth.password") : t("auth.newPassword")}</span>
            <input
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              value={password}
              aria-invalid={short}
              onChange={(e) => setPassword(e.target.value)}
              className={field}
            />
            {mode !== "signin" && (
              <span className={`text-[14px] ${short ? "text-[#a32a1d]" : "text-xisto-soft"}`}>{t("auth.minLength", { n: MIN_PASSWORD })}</span>
            )}
          </label>
        )}

        {needsTurnstile && <Turnstile key={`${mode}-${challenge}`} language={locale} onToken={setTurnstile} />}

        {error && (
          <p role="alert" className="text-[15px] text-[#a32a1d]">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy || short || (needsTurnstile && !turnstile)} className={primaryButton}>
          {busy ? t("auth.working") : t(`auth.submit.${mode}`)}
        </button>

        <div className="flex flex-wrap justify-between gap-x-4">
          {mode === "signin" && (
            <>
              <button type="button" onClick={() => switchTo("register")} className={linkButton}>
                {t("auth.toRegister")}
              </button>
              <button type="button" onClick={() => switchTo("forgot")} className={linkButton}>
                {t("auth.toForgot")}
              </button>
            </>
          )}
          {(mode === "register" || mode === "forgot") && (
            <button type="button" onClick={() => switchTo("signin")} className={linkButton}>
              {t("auth.toSignin")}
            </button>
          )}
        </div>
      </form>
    </Dialog>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.5 5.8c4.4-4 6.8-10 6.8-17.2z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}
