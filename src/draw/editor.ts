/**
 * The drawing editor as a reducer (D2, D20): the tool in hand, what is selected, the line or area
 * being drawn, and an undo history of whole documents. Pure — ids and time arrive in the actions.
 */

import type { Position } from "../geo/geo";
import type { PaletteKey, PinType, RouteType, ZoneType } from "../doc/catalogue";
import {
  addPin,
  addRoute,
  addZone,
  canAdd,
  deleteFeature,
  featureById,
  firstPortaNumber,
  movePin,
  nearestArmada,
  numberPortas,
  renameMap,
  setArmada,
  setPortaNumber,
  setShape,
  updateProps,
  type PropsPatch,
} from "../doc/operations";
import type { FeatureId, MapDoc } from "../doc/types";

/** A porta placed this close to an armada stands on it, and the armada is renumbered. */
export const ATTACH_M = 40;
const HISTORY = 50;

export type Tool =
  | { kind: "idle" }
  | { kind: "pin"; type: PinType }
  | { kind: "line"; type: RouteType; points: Position[] }
  | { kind: "area"; type: ZoneType; points: Position[] };

export type EditorState = {
  doc: MapDoc;
  past: MapDoc[];
  future: MapDoc[];
  tool: Tool;
  selected: FeatureId | null;
};

/** `record` says whether the change is its own undo step; a drag records only its first move. */
export type Action =
  | { type: "load"; doc: MapDoc }
  | { type: "tool"; tool: Tool }
  | { type: "tap"; at: Position; hit: FeatureId | null; id: FeatureId; now: number }
  | { type: "undoPoint" }
  | { type: "finish"; id: FeatureId; now: number }
  | { type: "select"; id: FeatureId | null }
  | { type: "props"; id: FeatureId; patch: PropsPatch; now: number }
  | { type: "move"; id: FeatureId; at: Position; now: number; record: boolean }
  | { type: "shape"; id: FeatureId; positions: Position[]; now: number; record: boolean }
  | { type: "delete"; id: FeatureId; now: number }
  | { type: "armada"; id: FeatureId; armada: FeatureId | null; now: number }
  | { type: "number"; id: FeatureId; n: number | null; now: number }
  | { type: "numberPortas"; armada: FeatureId; now: number }
  | { type: "rename"; name: string }
  | { type: "undo" }
  | { type: "redo" };

export const initialEditor = (doc: MapDoc): EditorState => ({
  doc,
  past: [],
  future: [],
  tool: { kind: "idle" },
  selected: null,
});

const IDLE: Tool = { kind: "idle" };

function commit(state: EditorState, doc: MapDoc, record = true): EditorState {
  if (doc === state.doc) return state;
  return record
    ? { ...state, doc, past: [...state.past, state.doc].slice(-HISTORY), future: [] }
    : { ...state, doc };
}

/** Adds a porta, standing it on the nearest armada within reach and renumbering that armada. */
function placePorta(doc: MapDoc, id: FeatureId, at: Position, now: number): MapDoc {
  let next = addPin(doc, { id, type: "porta", at }, now);
  const armada = nearestArmada(doc, at, ATTACH_M);
  if (armada) {
    const from = firstPortaNumber(next, armada);
    next = numberPortas(setArmada(next, id, armada, now), armada, now, from);
  }
  return next;
}

export function reduce(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case "load":
      return initialEditor(action.doc);

    case "tool":
      return { ...state, tool: action.tool, selected: action.tool.kind === "idle" ? state.selected : null };

    case "tap": {
      const { tool } = state;
      if (tool.kind === "idle") return { ...state, selected: action.hit };
      if (tool.kind === "pin") {
        if (!canAdd(state.doc)) return { ...state, tool: IDLE };
        const doc =
          tool.type === "porta"
            ? placePorta(state.doc, action.id, action.at, action.now)
            : addPin(state.doc, { id: action.id, type: tool.type, at: action.at }, action.now);
        return { ...commit(state, doc), tool: IDLE, selected: action.id };
      }
      return { ...state, tool: { ...tool, points: [...tool.points, action.at] } };
    }

    case "undoPoint": {
      const { tool } = state;
      if (tool.kind !== "line" && tool.kind !== "area") return state;
      return { ...state, tool: { ...tool, points: tool.points.slice(0, -1) } };
    }

    case "finish": {
      const { tool } = state;
      if (tool.kind === "line" && tool.points.length >= 2 && canAdd(state.doc)) {
        const doc = addRoute(state.doc, { id: action.id, type: tool.type, line: tool.points }, action.now);
        return { ...commit(state, doc), tool: IDLE, selected: action.id };
      }
      if (tool.kind === "area" && tool.points.length >= 3 && canAdd(state.doc)) {
        const doc = addZone(state.doc, { id: action.id, type: tool.type, ring: tool.points }, action.now);
        return { ...commit(state, doc), tool: IDLE, selected: action.id };
      }
      return state;
    }

    case "select":
      return { ...state, selected: action.id, tool: IDLE };

    case "props":
      return commit(state, updateProps(state.doc, action.id, action.patch, action.now));

    case "move":
      return commit(state, movePin(state.doc, action.id, action.at, action.now), action.record);

    case "shape":
      return commit(state, setShape(state.doc, action.id, action.positions, action.now), action.record);

    case "delete":
      return {
        ...commit(state, deleteFeature(state.doc, action.id, action.now)),
        selected: state.selected === action.id ? null : state.selected,
      };

    case "armada": {
      let doc = setArmada(state.doc, action.id, action.armada, action.now);
      if (action.armada) doc = numberPortas(doc, action.armada, action.now, firstPortaNumber(doc, action.armada));
      return commit(state, doc);
    }

    case "number":
      return commit(state, setPortaNumber(state.doc, action.id, action.n, action.now));

    case "numberPortas":
      return commit(state, numberPortas(state.doc, action.armada, action.now, firstPortaNumber(state.doc, action.armada)));

    case "rename":
      return commit(state, renameMap(state.doc, action.name));

    case "undo": {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return {
        ...state,
        doc: previous,
        past: state.past.slice(0, -1),
        future: [state.doc, ...state.future],
        selected: state.selected && featureById(previous, state.selected) ? state.selected : null,
      };
    }

    case "redo": {
      const [next, ...rest] = state.future;
      if (!next) return state;
      return {
        ...state,
        doc: next,
        past: [...state.past, state.doc],
        future: rest,
        selected: state.selected && featureById(next, state.selected) ? state.selected : null,
      };
    }
  }
}

/** The colour a picker shows as chosen: the feature's own, or none for its type's default. */
export const colourOf = (doc: MapDoc, id: FeatureId): PaletteKey | undefined => featureById(doc, id)?.properties.color;
