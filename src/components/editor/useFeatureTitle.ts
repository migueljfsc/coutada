import type { MapFeature } from "../../doc/types";
import { useI18n } from "../../i18n/context";
import type { MessageKey } from "../../i18n/core";

/** The title a feature goes by: its name, a porta's number, or its type. */
export function useFeatureTitle() {
  const { t } = useI18n();
  return (f: MapFeature) =>
    f.properties.name ??
    (f.properties.kind === "pin" && f.properties.type === "porta" && f.properties.n !== undefined
      ? t("list.portaN", { n: f.properties.n })
      : t(`type.${f.properties.type}` as MessageKey));
}
