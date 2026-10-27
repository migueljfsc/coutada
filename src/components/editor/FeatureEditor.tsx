/**
 * The selected feature in the sheet: a header that stays in the peek, and the details below it —
 * name, colour, note, a porta's number and armada, an armada's numbering, size, and delete.
 */

import { useState } from "react";
import { Check, ListOrdered, Navigation2, Trash2, X } from "lucide-react";
import { DEFAULT_COLOR, PALETTE, PALETTE_KEYS, SPECIES, type PaletteKey, type Species } from "../../doc/catalogue";
import { isFeatureName } from "../../doc/schema";
import type { FeatureId, MapDoc, MapFeature, PinFeature } from "../../doc/types";
import { lineLength, ringArea } from "../../geo/geo";
import { useI18n } from "../../i18n/context";
import type { MessageKey } from "../../i18n/core";
import { formatAgo, formatArea, formatLength, formatMoment } from "../../lib/format";
import { useNow } from "../../lib/useNow";
import { TypeIcon } from "./TypeIcon";
import { useFeatureTitle } from "./useFeatureTitle";

export type EditCommands = {
  rename: (name: string | null) => void;
  note: (note: string | null) => void;
  colour: (colour: PaletteKey | null) => void;
  species: (species: Species | null) => void;
  number: (n: number | null) => void;
  armada: (armada: FeatureId | null) => void;
  numberPortas: () => void;
  deleteVertex: () => void;
  remove: () => void;
  close: () => void;
};

/** How long the feature has been on the map, or, drawn before that was kept, when it last changed. */
function Since({ feature }: { feature: MapFeature }) {
  const { t, locale } = useI18n();
  const now = useNow(30_000);
  const { createdAt, updatedAt } = feature.properties;
  return (
    <p className="text-[13px] text-xisto-soft">
      {createdAt !== undefined
        ? t("when.since", { date: formatMoment(createdAt, locale), ago: formatAgo(createdAt, now, locale) })
        : t("when.changed", { ago: formatAgo(updatedAt, now, locale) })}
    </p>
  );
}

export function FeatureHeader({ feature, onClose }: { feature: MapFeature; onClose: () => void }) {
  const { t } = useI18n();
  const title = useFeatureTitle();
  const p = feature.properties;
  return (
    <div className="flex items-center gap-3">
      <TypeIcon type={p.type} colour={p.color} n={p.kind === "pin" ? p.n : undefined} species={p.kind === "pin" ? p.species : undefined} size={40} />
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-xl leading-tight font-bold">{title(feature)}</h2>
        <p className="text-[15px] text-xisto-soft">
          {p.kind === "pin" && p.species && p.name ? t(`species.${p.species}`) : t(`type.${p.type}` as MessageKey)}
        </p>
        <Since feature={feature} />
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={t("edit.close")}
        className="flex size-11 shrink-0 items-center justify-center rounded-full active:bg-cal-deep"
      >
        <X size={22} />
      </button>
    </div>
  );
}

export function FeatureDetails({
  feature,
  doc,
  vertex,
  commands,
  onNavigate,
}: {
  feature: MapFeature;
  doc: MapDoc;
  vertex: number | null;
  commands: EditCommands;
  /** Starts navigating to the feature; absent for an area. */
  onNavigate?: () => void;
}) {
  const { t, tn, locale } = useI18n();
  const title = useFeatureTitle();
  const p = feature.properties;
  const g = feature.geometry;
  const armadas = doc.features.filter((f) => f.properties.kind === "route" && f.properties.type === "armada");
  const portasOn = doc.features.filter(
    (f): f is PinFeature => f.properties.kind === "pin" && f.properties.armada === feature.id,
  ).length;

  return (
    <div className="flex flex-col gap-5" key={feature.id}>
      {onNavigate && <NavigateButton feature={feature} onNavigate={onNavigate} />}

      <TextField
        label={t("edit.name")}
        initial={p.name ?? ""}
        placeholder={p.kind === "pin" && p.species ? t(`species.${p.species}`) : t(`type.${p.type}` as MessageKey)}
        maxLength={60}
        validate={(v) => v === "" || isFeatureName(v)}
        error={t("edit.nameInvalid")}
        onCommit={(v) => commands.rename(v.trim() || null)}
      />

      <fieldset>
        <legend className="mb-2 text-[15px] font-semibold">{t("edit.colour")}</legend>
        <div className="flex flex-wrap gap-2">
          {PALETTE_KEYS.map((key) => {
            const chosen = (p.color ?? DEFAULT_COLOR[p.type]) === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={chosen}
                aria-label={t(`colour.${key}` as MessageKey)}
                title={t(`colour.${key}` as MessageKey)}
                onClick={() => commands.colour(key === DEFAULT_COLOR[p.type] ? null : key)}
                className="flex size-11 items-center justify-center rounded-full border-[3px] border-xisto aria-checked:outline-3 aria-checked:outline-offset-2 aria-checked:outline-anil"
                style={{ background: PALETTE[key] }}
              >
                {chosen && <Check size={18} strokeWidth={3} className="text-xisto" />}
              </button>
            );
          })}
        </div>
      </fieldset>

      {p.kind === "pin" && p.type === "game" && (
        <label className="flex flex-col gap-1.5">
          <span className="text-[15px] font-semibold">{t("edit.species")}</span>
          <select
            value={p.species ?? ""}
            onChange={(e) => commands.species((e.target.value || null) as Species | null)}
            className="min-h-12 rounded-[8px] border border-rule bg-osso px-3 text-[16px]"
          >
            <option value="">{t("type.game")}</option>
            {SPECIES.map((s) => (
              <option key={s} value={s}>
                {t(`species.${s}`)}
              </option>
            ))}
          </select>
        </label>
      )}

      {p.kind === "pin" && p.type === "porta" && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[15px] font-semibold">{t("edit.armada")}</span>
            <select
              value={p.armada ?? ""}
              onChange={(e) => commands.armada(e.target.value || null)}
              className="min-h-12 rounded-[8px] border border-rule bg-osso px-3 text-[16px]"
            >
              <option value="">{t("edit.noArmada")}</option>
              {armadas.map((a) => (
                <option key={a.id} value={a.id}>
                  {title(a)}
                </option>
              ))}
            </select>
          </label>
          {!p.armada && (
            <NumberField label={t("edit.number")} value={p.n ?? null} onCommit={commands.number} />
          )}
        </div>
      )}

      {p.kind === "route" && p.type === "armada" && (
        portasOn > 0 ? (
          <button
            type="button"
            onClick={commands.numberPortas}
            className="flex min-h-12 items-center justify-center gap-2 rounded-[10px] bg-anil px-4 text-[15px] font-semibold text-white"
          >
            <ListOrdered size={20} />
            {tn("edit.numberPortas", portasOn)}
          </button>
        ) : (
          <p className="text-[15px] text-xisto-soft">{t("edit.noPortas")}</p>
        )
      )}

      {g.type !== "Point" && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 text-[15px]">
          <dt className="text-xisto-soft">{g.type === "LineString" ? t("edit.length") : t("edit.area")}</dt>
          <dd className="tabular-nums">
            {g.type === "LineString" ? formatLength(lineLength(g.coordinates), locale) : formatArea(ringArea(g.coordinates[0]), locale)}
          </dd>
        </dl>
      )}

      <TextField
        label={t("edit.note")}
        initial={p.note ?? ""}
        multiline
        maxLength={500}
        onCommit={(v) => commands.note(v.trim() || null)}
      />

      <p className="text-[14px] text-xisto-soft">{g.type === "Point" ? t("edit.pinHint") : t("edit.shapeHint")}</p>

      <div className="flex flex-wrap gap-2">
        {vertex !== null && g.type !== "Point" && (
          <button
            type="button"
            onClick={commands.deleteVertex}
            className="min-h-12 flex-1 rounded-[10px] bg-cal-deep px-4 text-[15px] font-semibold active:bg-rule"
          >
            {t("edit.deleteVertex")}
          </button>
        )}
        <button
          type="button"
          onClick={commands.remove}
          className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[10px] border-2 border-[#c23a2b] px-4 text-[15px] font-semibold text-[#a32a1d] active:bg-[#c23a2b]/10"
        >
          <Trash2 size={18} />
          {t("edit.delete")}
        </button>
      </div>
    </div>
  );
}

/** "Go here" for a pin, "Follow this route" for a route. */
export function NavigateButton({ feature, onNavigate }: { feature: MapFeature; onNavigate: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onNavigate}
      className="flex min-h-12 items-center justify-center gap-2 rounded-[10px] bg-anil px-4 text-[15px] font-semibold text-white"
    >
      <Navigation2 size={18} fill="currentColor" />
      {feature.geometry.type === "LineString" ? t("nav.follow") : t("nav.go")}
    </button>
  );
}

/** A text field that commits on blur and on Enter, and only a value that validates. */
function TextField({
  label,
  initial,
  placeholder,
  multiline = false,
  maxLength,
  validate = () => true,
  error,
  onCommit,
}: {
  label: string;
  initial: string;
  placeholder?: string;
  multiline?: boolean;
  maxLength: number;
  validate?: (v: string) => boolean;
  error?: string;
  onCommit: (v: string) => void;
}) {
  const [value, setValue] = useState(initial);
  // An undo, or the hunt's own version, changes the feature under the field: the field follows.
  const [shown, setShown] = useState(initial);
  if (initial !== shown) {
    setShown(initial);
    setValue(initial);
  }
  const valid = validate(value.trim());
  const commit = () => {
    if (valid && value !== initial) onCommit(value);
  };
  const common = {
    value,
    placeholder,
    maxLength,
    "aria-invalid": !valid,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValue(e.target.value),
    onBlur: commit,
    className: "w-full rounded-[8px] border border-rule bg-osso px-3 py-2.5 text-[16px] aria-invalid:border-[#c23a2b]",
  };
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[15px] font-semibold">{label}</span>
      {multiline ? (
        <textarea rows={3} {...common} />
      ) : (
        <input type="text" enterKeyHint="done" onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()} {...common} />
      )}
      {!valid && error && <span className="text-[14px] text-[#a32a1d]">{error}</span>}
    </label>
  );
}

/** A whole number field that lets an empty value or a partial one stand while typing. */
function NumberField({ label, value, onCommit }: { label: string; value: number | null; onCommit: (n: number | null) => void }) {
  const [text, setText] = useState(value === null ? "" : String(value));
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    setText(value === null ? "" : String(value));
  }
  const commit = () => {
    const n = text.trim() === "" ? null : Number.parseInt(text, 10);
    if (n === null || (Number.isFinite(n) && n >= 1 && n <= 999)) {
      if (n !== value) onCommit(n);
    } else {
      setText(value === null ? "" : String(value));
    }
  };
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[15px] font-semibold">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        enterKeyHint="done"
        value={text}
        onChange={(e) => setText(e.target.value.replace(/\D/g, "").slice(0, 3))}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="w-28 rounded-[8px] border border-rule bg-osso px-3 py-2.5 text-[16px] tabular-nums"
      />
    </label>
  );
}
