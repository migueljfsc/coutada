import type { MapFeature } from "../../doc/types";
import { useI18n } from "../../i18n/context";
import type { MessageKey } from "../../i18n/core";

/** The title a feature goes by: its name, a porta's number, a game pin's species, or its type. */
export function useFeatureTitle() {
  const { t } = useI18n();
  return (f: MapFeature) => {
    const p = f.properties;
    if (p.name) return p.name;
    if (p.kind === "pin" && p.type === "porta" && p.n !== undefined) return t("list.portaN", { n: p.n });
    if (p.kind === "pin" && p.species) return t(`species.${p.species}`);
    return t(`type.${p.type}` as MessageKey);
  };
}
