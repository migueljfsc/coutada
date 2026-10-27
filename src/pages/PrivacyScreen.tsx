/**
 * What Coutada keeps, where, for how long, and how to take it away (D27). Plain reading: one
 * column, the sections in the order a person asks about them.
 */

import { ArrowLeft } from "lucide-react";
import { useI18n } from "../i18n/context";
import { navigate } from "../share/routes";

const SECTIONS = ["stored", "positions", "where", "imagery", "counting", "cookies", "control", "safety"] as const;

export function PrivacyScreen() {
  const { t } = useI18n();
  return (
    <div className="min-h-dvh overflow-y-auto bg-cal font-sans text-xisto">
      <main className="mx-auto max-w-[38rem] px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-16">
        <button
          type="button"
          onClick={() => (history.length > 1 ? history.back() : navigate("/"))}
          className="-ml-3 flex min-h-11 items-center gap-1.5 rounded-[10px] px-3 text-[15px] font-semibold text-anil active:bg-cal-deep"
        >
          <ArrowLeft size={18} />
          {t("privacy.back")}
        </button>
        <h1 className="mt-6 text-[32px] leading-tight font-bold">{t("privacy.title")}</h1>
        <p className="mt-3 text-[18px] leading-relaxed">{t("privacy.intro")}</p>
        {SECTIONS.map((s) => (
          <section key={s} className={`mt-8 ${s === "safety" ? "border-l-4 border-person pl-4" : ""}`}>
            <h2 className="text-[20px] leading-snug font-bold">{t(`privacy.${s}.title`)}</h2>
            <p className="mt-2 text-[17px] leading-relaxed">{t(`privacy.${s}.body`)}</p>
          </section>
        ))}
      </main>
    </div>
  );
}
