/** The drawing tools on the map's rail, and undo and redo, which the screen places at the top of the map. */

import type { Dispatch } from "react";
import { MapPin, Pentagon, Redo2, Spline, Undo2 } from "lucide-react";
import type { Action, EditorState } from "../../draw/editor";
import { useI18n } from "../../i18n/context";
import { RailButton } from "../RailButton";
import type { Picking } from "./TypePicker";

export function ToolRail({ active, onPick }: { active: Picking | null; onPick: (kind: Picking) => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-2">
      <RailButton label={t("tool.pin")} active={active === "pin"} onClick={() => onPick("pin")}>
        <MapPin size={22} strokeWidth={2.2} />
      </RailButton>
      <RailButton label={t("tool.line")} active={active === "line"} onClick={() => onPick("line")}>
        <Spline size={22} strokeWidth={2.2} />
      </RailButton>
      <RailButton label={t("tool.area")} active={active === "area"} onClick={() => onPick("area")}>
        <Pentagon size={22} strokeWidth={2.2} />
      </RailButton>
    </div>
  );
}

export function HistoryButtons({ editor, dispatch }: { editor: EditorState; dispatch: Dispatch<Action> }) {
  const { t } = useI18n();
  if (editor.past.length === 0 && editor.future.length === 0) return null;
  return (
    <>
      <RailButton label={t("history.undo")} disabled={editor.past.length === 0} onClick={() => dispatch({ type: "undo" })} className="disabled:opacity-50">
        <Undo2 size={22} />
      </RailButton>
      <RailButton label={t("history.redo")} disabled={editor.future.length === 0} onClick={() => dispatch({ type: "redo" })} className="disabled:opacity-50">
        <Redo2 size={22} />
      </RailButton>
    </>
  );
}
