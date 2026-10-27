/** The search as a sheet of its own, for the hunt screen, whose panel has no room for the field (D28). */

import { useEffect, useRef } from "react";
import type { MapDoc } from "../doc/types";
import { useI18n } from "../i18n/context";
import { Dialog } from "./Dialog";
import { SearchField } from "./search/SearchField";
import { SearchResults } from "./search/SearchResults";
import { useSearch, type SearchHit } from "./search/useSearch";

export function SearchDialog({ doc, onGo, onClose }: { doc: MapDoc | null; onGo: (hit: SearchHit) => void; onClose: () => void }) {
  const { t } = useI18n();
  const search = useSearch(doc);
  const input = useRef<HTMLInputElement>(null);

  // The dialog gives focus to its first control, the close button; the search box is what is wanted.
  useEffect(() => {
    const timer = setTimeout(() => input.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, []);

  const go = (hit: SearchHit) => {
    onClose();
    onGo(hit);
  };

  return (
    <Dialog title={t("search.title")} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <SearchField ref={input} search={search} onGo={go} />
        <SearchResults search={search} onGo={go} />
      </div>
    </Dialog>
  );
}
