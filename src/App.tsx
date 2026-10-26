import { LOCALES } from "./i18n/core";
import { useI18n } from "./i18n/context";

export function App() {
  const { t, locale, setLocale } = useI18n();

  return (
    <main className="min-h-dvh bg-ink-900 text-ink-100 flex flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between">
        <span className="text-lg font-semibold tracking-tight">{t("app.name")}</span>
        <div role="group" aria-label={t("app.locale")} className="flex gap-1 text-sm">
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={l === locale}
              onClick={() => setLocale(l)}
              className="min-h-11 min-w-11 rounded-md uppercase aria-pressed:bg-ink-700 aria-pressed:text-accent"
            >
              {l}
            </button>
          ))}
        </div>
      </header>

      <section className="flex flex-1 flex-col justify-center gap-4 max-w-md">
        <h1 className="text-3xl font-semibold leading-tight">{t("app.tagline")}</h1>
        <p className="text-ink-400">{t("app.soon")}</p>
      </section>

      <footer className="text-sm text-ink-400">{t("safety.notice")}</footer>
    </main>
  );
}
