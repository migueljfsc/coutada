import { Search } from "lucide-react";
import { useI18n } from "../i18n/context";
import { RailButton } from "./RailButton";

/** The round button beside the menu that opens the search (D28). */
export function SearchButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <RailButton label={t("search.open")} aria-haspopup="dialog" onClick={onClick} className="rounded-full">
      <Search size={21} strokeWidth={2.2} />
    </RailButton>
  );
}
