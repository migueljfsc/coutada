/**
 * Files in and out of this map (D21): bringing in a walk or a set of places from GPX, KML or
 * GeoJSON, and taking the map away in any of the three.
 */

import { useRef } from "react";
import { FileDown, FileUp } from "lucide-react";
import type { MapDoc } from "../doc/types";
import { useI18n } from "../i18n/context";
import { toGeoJson } from "../io/geojson";
import { toGpx } from "../io/gpx";
import { toKml } from "../io/kml";
import { download, fileStem } from "../lib/download";
import { count } from "../share/usage";
import { Dialog } from "./Dialog";
import { primaryButton } from "./ui";

const ACCEPT = ".gpx,.kml,.geojson,.json,application/gpx+xml,application/vnd.google-earth.kml+xml,application/geo+json,application/json";

const EXPORTS = [
  { format: "gpx", type: "application/gpx+xml", write: toGpx },
  { format: "kml", type: "application/vnd.google-earth.kml+xml", write: toKml },
  { format: "geojson", type: "application/geo+json", write: toGeoJson },
] as const;

export function FilesDialog({ doc, onFile, onClose }: { doc: MapDoc; onFile: (file: File) => void; onClose: () => void }) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  return (
    <Dialog title={t("files.title")} onClose={onClose}>
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2">
          <button type="button" onClick={() => input.current?.click()} className={primaryButton}>
            <FileUp size={18} />
            {t("files.import")}
          </button>
          <p className="text-[14px] leading-snug text-xisto-soft">{t("files.importHint")}</p>
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) {
                onClose();
                onFile(file);
              }
            }}
          />
        </section>

        <section className="flex flex-col gap-1">
          <h3 className="text-[15px] font-semibold">{t("files.export")}</h3>
          <ul className="-mx-2 flex flex-col">
            {EXPORTS.map(({ format, type, write }) => (
              <li key={format}>
                <button
                  type="button"
                  disabled={doc.features.length === 0}
                  onClick={() => {
                    download(`${fileStem(doc.coutada.name)}.${format}`, type, write(doc));
                    count(`export.${format}`);
                  }}
                  className="flex min-h-14 w-full items-center gap-3 rounded-[8px] px-2 py-2 text-left active:bg-cal-deep disabled:opacity-50"
                >
                  <FileDown size={20} className="shrink-0" aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-[16px] font-semibold">{t(`files.${format}`)}</span>
                    <span className="block text-[14px] leading-snug text-xisto-soft">{t(`files.${format}.detail`)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Dialog>
  );
}
