/**
 * The drawing controls a screen wires to its map and sheet: picking a type, taps and drags on the
 * map, choosing a feature, and the commands on the one chosen.
 */

import { useCallback, useRef, useState, type Dispatch, type RefObject } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { PinType, RouteType, ZoneType } from "../../doc/catalogue";
import { newFeatureId } from "../../doc/ids";
import { featureById } from "../../doc/operations";
import type { FeatureId } from "../../doc/types";
import type { Action, EditorState } from "../../draw/editor";
import { bboxOf, type Position } from "../../geo/geo";
import { dragShape, withoutVertex } from "../../map/drawing";
import type { DragPhase, Handle } from "../../map/MapView";
import type { EditCommands } from "./FeatureEditor";
import type { Picking } from "./TypePicker";
import type { FeatureType } from "./TypeIcon";

type Options = {
  map: RefObject<MapLibreMap | null>;
  /** Wide screens keep the panel open beside the map. */
  wide: boolean;
  setSheetOpen: (open: boolean) => void;
};

export function useEditing(editor: EditorState, dispatch: Dispatch<Action>, { map, wide, setSheetOpen }: Options) {
  const [picking, setPicking] = useState<Picking | null>(null);
  const [vertex, setVertex] = useState<number | null>(null);
  const { doc, tool, selected } = editor;
  const selectedFeature = selected ? featureById(doc, selected) : undefined;
  const now = () => Date.now();

  const openPicker = (kind: Picking) => {
    dispatch({ type: "tool", tool: { kind: "idle" } });
    dispatch({ type: "select", id: null });
    setPicking((p) => (p === kind ? null : kind));
    setSheetOpen(true);
  };

  const pickType = (type: FeatureType) => {
    const kind = picking;
    setPicking(null);
    setSheetOpen(false);
    if (kind === "pin") dispatch({ type: "tool", tool: { kind: "pin", type: type as PinType } });
    if (kind === "line") dispatch({ type: "tool", tool: { kind: "line", type: type as RouteType, points: [] } });
    if (kind === "area") dispatch({ type: "tool", tool: { kind: "area", type: type as ZoneType, points: [] } });
  };

  const onTap = useCallback(
    (at: Position, hit: FeatureId | null, handle: Handle | null) => {
      if (editor.tool.kind === "idle" && handle?.role === "vertex" && editor.selected) {
        setVertex(handle.i);
        return;
      }
      setVertex(null);
      setPicking(null);
      dispatch({ type: "tap", at, hit, id: newFeatureId(), now: Date.now() });
    },
    [editor.tool.kind, editor.selected, dispatch],
  );

  /** The vertex a midpoint drag inserted, which the rest of that drag moves. */
  const midDrag = useRef<number | null>(null);
  const onDrag = useCallback(
    (handle: Handle, to: Position, phase: DragPhase) => {
      const record = phase === "start";
      if (handle.role === "pin") {
        if (phase !== "end") dispatch({ type: "move", id: handle.fid, at: to, now: Date.now(), record });
        return;
      }
      const feature = editor.selected ? featureById(editor.doc, editor.selected) : undefined;
      if (!feature) return;
      if (phase === "end") {
        midDrag.current = null;
        return;
      }
      let role = handle.role;
      let i = handle.i;
      if (role === "mid" && midDrag.current !== null) {
        role = "vertex";
        i = midDrag.current;
      } else if (role === "mid") {
        midDrag.current = i + 1;
      }
      const positions = dragShape(feature, role, i, to);
      if (positions) dispatch({ type: "shape", id: feature.id, positions, now: Date.now(), record });
      setVertex(null);
    },
    [editor.selected, editor.doc, dispatch],
  );

  const select = (id: FeatureId) => {
    dispatch({ type: "select", id });
    setVertex(null);
    const f = featureById(doc, id);
    const m = map.current;
    if (!f || !m) return;
    const g = f.geometry;
    const points = g.type === "Point" ? [g.coordinates] : g.type === "LineString" ? g.coordinates : g.coordinates[0];
    const box = bboxOf(points);
    if (!box) return;
    if (g.type === "Point") m.easeTo({ center: [g.coordinates[0], g.coordinates[1]], zoom: Math.max(m.getZoom(), 17) });
    else m.fitBounds([box[0], box[1], box[2], box[3]], { padding: 60, maxZoom: 18 });
    if (!wide) setSheetOpen(false);
  };

  const commands: EditCommands | null = selectedFeature
    ? {
        rename: (name) => dispatch({ type: "props", id: selectedFeature.id, patch: { name }, now: now() }),
        note: (note) => dispatch({ type: "props", id: selectedFeature.id, patch: { note }, now: now() }),
        colour: (color) => dispatch({ type: "props", id: selectedFeature.id, patch: { color }, now: now() }),
        number: (n) => dispatch({ type: "number", id: selectedFeature.id, n, now: now() }),
        armada: (armada) => dispatch({ type: "armada", id: selectedFeature.id, armada, now: now() }),
        numberPortas: () => dispatch({ type: "numberPortas", armada: selectedFeature.id, now: now() }),
        deleteVertex: () => {
          const positions = vertex !== null ? withoutVertex(selectedFeature, vertex) : null;
          if (positions) dispatch({ type: "shape", id: selectedFeature.id, positions, now: now(), record: true });
          setVertex(null);
        },
        remove: () => dispatch({ type: "delete", id: selectedFeature.id, now: now() }),
        close: () => {
          dispatch({ type: "select", id: null });
          setVertex(null);
        },
      }
    : null;

  const toolKind: Picking | null = picking ?? (tool.kind === "idle" ? null : tool.kind);

  return { picking, setPicking, vertex, selectedFeature, openPicker, pickType, onTap, onDrag, select, commands, toolKind };
}
