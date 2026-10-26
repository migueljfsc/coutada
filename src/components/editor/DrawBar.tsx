import { Undo2 } from "lucide-react";
import { lineLength, ringArea } from "../../geo/geo";
import { useI18n } from "../../i18n/context";
import type { MessageKey } from "../../i18n/core";
import type { Tool } from "../../draw/editor";
import { formatArea, formatLength } from "../../lib/format";
import { TypeIcon } from "./TypeIcon";

/** What the sheet shows while a tool is in hand: what to do next, and how to finish or stop. */
export function DrawBar({ tool, onUndoPoint, onCancel, onFinish }: { tool: Exclude<Tool, { kind: "idle" }>; onUndoPoint: () => void; onCancel: () => void; onFinish: () => void }) {
  const { t, tn, locale } = useI18n();
  const shaped = tool.kind === "line" || tool.kind === "area";
  const points = shaped ? tool.points : [];
  const enough = tool.kind === "line" ? points.length >= 2 : points.length >= 3;
  const measure =
    tool.kind === "line" && points.length >= 2
      ? formatLength(lineLength(points), locale)
      : tool.kind === "area" && points.length >= 3
        ? formatArea(ringArea([...points, points[0]]), locale)
        : null;

  return (
    <div>
      <div className="flex items-center gap-3">
        <TypeIcon type={tool.type} size={36} />
        <div className="min-w-0">
          <h2 className="text-xl leading-tight font-bold">{t(`type.${tool.type}` as MessageKey)}</h2>
          <p className="text-[15px] text-xisto-soft" role="status">
            {shaped && points.length > 0
              ? [tn("draw.points", points.length), measure].filter(Boolean).join(", ")
              : t(shaped ? "draw.tapLine" : "draw.tapPin")}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-12 flex-1 rounded-[14px] bg-cal-deep px-3 text-[15px] font-semibold active:bg-rule"
        >
          {t("draw.cancel")}
        </button>
        {shaped && (
          <>
            <button
              type="button"
              onClick={onUndoPoint}
              disabled={points.length === 0}
              aria-label={t("draw.undoPoint")}
              title={t("draw.undoPoint")}
              className="flex min-h-12 w-14 items-center justify-center rounded-[14px] bg-cal-deep active:bg-rule disabled:opacity-40"
            >
              <Undo2 size={22} />
            </button>
            <button
              type="button"
              onClick={onFinish}
              disabled={!enough}
              className="min-h-12 flex-1 rounded-[14px] bg-anil px-3 text-[15px] font-semibold text-white disabled:opacity-40"
            >
              {t("draw.finish")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
