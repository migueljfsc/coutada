import { forwardRef, type FormEvent } from "react";
import { Search as SearchIcon } from "lucide-react";
import { useI18n } from "../../i18n/context";
import { field } from "../ui";
import type { Search, SearchHit } from "./useSearch";

/** The search box and its button: places are searched on submit, coordinates are gone to at once. */
/** `onEngage` is told when the box is focused or typed in, so the screen can make room for results. */
export const SearchField = forwardRef<HTMLInputElement, { search: Search; onGo: (hit: SearchHit) => void; onEngage?: () => void }>(
  function SearchField({ search, onGo, onEngage }, ref) {
    const { t } = useI18n();
    const submit = async (e: FormEvent) => {
      e.preventDefault();
      const hit = await search.submit();
      if (hit) onGo(hit);
    };
    return (
      <form role="search" onSubmit={submit} className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{t("search.title")}</span>
          <SearchIcon size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xisto-soft" aria-hidden />
          <input
            ref={ref}
            type="search"
            enterKeyHint="search"
            maxLength={100}
            value={search.query}
            onChange={(e) => {
              search.setQuery(e.target.value);
              onEngage?.();
            }}
            onFocus={onEngage}
            placeholder={t("search.placeholder")}
            className={`${field} pl-10`}
          />
        </label>
        {search.active && (
          <button
            type="submit"
            disabled={search.status === "busy"}
            className="min-h-12 shrink-0 rounded-[10px] bg-azinho px-4 text-[15px] font-semibold text-white disabled:opacity-50"
          >
            {t("search.submit")}
          </button>
        )}
      </form>
    );
  },
);
