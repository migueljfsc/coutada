/** An irreversible delete asks for something typed back: the account's address or the device's name (D22). */

import { useState, type FormEvent } from "react";
import { Dialog } from "../components/Dialog";
import { field } from "../components/ui";
import { useI18n } from "../i18n/context";
import { api } from "../share/api";
import { errorKey } from "./errors";

export function ConfirmDelete({
  path,
  expected,
  prompt,
  onDone,
  onClose,
}: {
  path: string;
  expected: string;
  prompt: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await api("DELETE", path, { confirm: typed });
    setBusy(false);
    if (!r.ok) return setError(t(errorKey(r.error)));
    onDone();
  };

  return (
    <Dialog title={t("delete.title")} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-[15px] leading-snug">{prompt}</p>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label={expected} placeholder={expected} className={field} />
        {error && (
          <p role="alert" className="text-[15px] text-[#a32a1d]">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || typed.trim().length === 0}
          className="flex min-h-12 w-full items-center justify-center rounded-[14px] bg-[#a32a1d] px-4 text-[15px] font-semibold text-white disabled:opacity-50"
        >
          {t("delete.confirm")}
        </button>
      </form>
    </Dialog>
  );
}
