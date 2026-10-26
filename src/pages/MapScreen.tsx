/**
 * The map screen: imagery full bleed, the tool rail on the right within thumb reach, the sheet at
 * the bottom (a left panel on wide screens) showing whatever is in hand — the map, a type to pick,
 * the line being drawn, or the selected feature. The document is kept by `useMapDocument`.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { Layers, Locate, LocateFixed, MapPin, Pentagon, Redo2, Spline, Undo2 } from "lucide-react";
import { AuthDialog, type AuthMode } from "../account/AuthDialog";
import { ConfirmDelete } from "../account/ConfirmDelete";
import { hasIdentity, useAccount } from "../account/context";
import { DeviceDialog } from "../account/DeviceDialog";
import { errorKey } from "../account/errors";
import { ShareDialog } from "../account/ShareDialog";
import { TransferDialog } from "../account/TransferDialog";
import { DEFAULT_IMAGERY, type ImageryId, type PinType, type RouteType, type ZoneType } from "../doc/catalogue";
import { newFeatureId } from "../doc/ids";
import { featureById } from "../doc/operations";
import type { FeatureId } from "../doc/types";
import { bboxOf, type Position } from "../geo/geo";
import { type MessageKey } from "../i18n/core";
import { useI18n } from "../i18n/context";
import { useMedia } from "../lib/useMedia";
import { dragShape, render, withoutVertex } from "../map/drawing";
import { imageryOf } from "../map/imagery";
import { MapView, type DragPhase, type Handle, type View } from "../map/MapView";
import { useFollow } from "../map/useFollow";
import type { LocationStatus } from "../map/useLocation";
import { api } from "../share/api";
import { PORTUGAL, storedImagery, storedView, storeImagery, storeView } from "../share/prefs";
import { useMapDocument } from "../sync/useMapDocument";
import { ImageryPicker } from "../components/ImageryPicker";
import { MapPanel, type PanelActions } from "../components/MapPanel";
import { Notice } from "../components/Notice";
import { RailButton } from "../components/RailButton";
import { Sheet } from "../components/Sheet";
import { noticeButton, noticeQuiet } from "../components/ui";
import { DrawBar } from "../components/editor/DrawBar";
import { FeatureDetails, FeatureHeader, type EditCommands } from "../components/editor/FeatureEditor";
import { TypePicker, type Picking } from "../components/editor/TypePicker";
import type { FeatureType } from "../components/editor/TypeIcon";

/** The left panel's width plus its margins, on wide screens. */
const PANEL_PX = 392;

const STATUS: Record<Exclude<LocationStatus, "on">, MessageKey> = {
  off: "locate.off",
  asking: "locate.asking",
  denied: "locate.denied",
  unavailable: "locate.unavailable",
};

type DialogState =
  | { kind: "auth"; mode: AuthMode }
  | { kind: "device" }
  | { kind: "transfer" }
  | { kind: "share" }
  | { kind: "deleteAccount" }
  | { kind: "deleteDevice" }
  | null;

export function MapScreen({ mapId }: { mapId: string | null }) {
  const { t } = useI18n();
  const { me, refresh } = useAccount();
  const [imagery, setImagery] = useState<ImageryId>(() => storedImagery() ?? DEFAULT_IMAGERY);
  const [initialView] = useState<View>(() => storedView() ?? PORTUGAL);
  const { editor, dispatch, remote, status: sync, shareSlug, setShareSlug, saveAsNew, resolve, startNew } = useMapDocument(
    mapId,
    t("map.untitled"),
  );
  const [picking, setPicking] = useState<Picking | null>(null);
  const [vertex, setVertex] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [peek, setPeek] = useState(96);
  const [picker, setPicker] = useState(false);
  const [imageryFailing, setImageryFailing] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const follow = useFollow();
  const wide = useMedia("(min-width: 48rem)");

  const { doc, tool, selected } = editor;
  const selectedFeature = selected ? featureById(doc, selected) : undefined;
  const rendered = useMemo(() => render(doc, selected, tool, vertex), [doc, selected, tool, vertex]);
  const now = () => Date.now();

  const chooseImagery = (id: ImageryId) => {
    setImagery(id);
    storeImagery(id);
    setPicker(false);
  };

  // --------------------------------------------------------------- drawing

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
    const m = follow.map.current;
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

  // ----------------------------------------------------------- the account

  const save = async () => {
    setSaveError(null);
    if (!hasIdentity(me)) {
      setDialog({ kind: "device" });
      return;
    }
    const error = await saveAsNew();
    if (error) setSaveError(t(errorKey(error)));
  };

  const actions: PanelActions = {
    rename: (name) => dispatch({ type: "rename", name }),
    choose: select,
    save: () => void save(),
    share: () => setDialog({ kind: "share" }),
    startNew,
    signIn: () => setDialog({ kind: "auth", mode: "signin" }),
    register: () => setDialog({ kind: "auth", mode: "register" }),
    transfer: () => setDialog({ kind: "transfer" }),
    signOut: () =>
      void api("POST", "/api/auth/logout").then(async () => {
        await refresh();
        startNew();
      }),
    deleteAccount: () => setDialog({ kind: "deleteAccount" }),
    deleteDevice: () => setDialog({ kind: "deleteDevice" }),
  };

  const afterErase = async () => {
    setDialog(null);
    await refresh();
    startNew();
  };

  // ---------------------------------------------------------------- render

  const drawing = tool.kind !== "idle";
  const toolKind: Picking | null = picking ?? (tool.kind === "idle" ? null : tool.kind);
  const fix = follow.fix;

  let peekContent: React.ReactNode;
  let body: React.ReactNode;
  if (picking) {
    peekContent = <TypePicker picking={picking} onPick={pickType} onCancel={() => setPicking(null)} />;
    body = null;
  } else if (tool.kind !== "idle") {
    peekContent = (
      <DrawBar
        tool={tool}
        onUndoPoint={() => dispatch({ type: "undoPoint" })}
        onCancel={() => dispatch({ type: "tool", tool: { kind: "idle" } })}
        onFinish={() => dispatch({ type: "finish", id: newFeatureId(), now: now() })}
      />
    );
    body = null;
  } else if (selectedFeature && commands) {
    peekContent = <FeatureHeader feature={selectedFeature} onClose={commands.close} />;
    body = <FeatureDetails feature={selectedFeature} doc={doc} vertex={vertex} commands={commands} />;
  } else {
    peekContent = (
      <div>
        <h1 className="truncate text-xl leading-tight font-bold">{doc.coutada.name}</h1>
        <p className="mt-1 flex items-center gap-2 text-[15px] text-xisto-soft" role="status">
          {follow.status === "on" && <span className="size-2.5 shrink-0 rounded-full bg-person" aria-hidden />}
          {follow.status === "on" && fix
            ? t("locate.accuracy", { m: Math.round(fix.accuracy) })
            : t(STATUS[follow.status as Exclude<LocationStatus, "on">] ?? "locate.off")}
        </p>
        <p className="mt-0.5 text-[13px] text-xisto-soft">{t(`sync.${sync}`)}</p>
      </div>
    );
    body = (
      <>
        {saveError && (
          <p role="alert" className="mb-4 text-[15px] text-[#a32a1d]">
            {saveError}
          </p>
        )}
        <MapPanel doc={doc} mapId={remote?.id ?? null} status={sync} fix={fix} actions={actions} />
      </>
    );
  }

  return (
    <main className="fixed inset-0 overflow-hidden font-sans" style={{ "--peek": `${peek}px` } as React.CSSProperties}>
      <MapView
        imagery={imagery}
        initialView={initialView}
        fix={fix}
        rendered={rendered}
        drawing={drawing}
        inset={wide ? { bottom: 0, left: PANEL_PX } : { bottom: sheetOpen ? 0 : peek, left: 0 }}
        onReady={follow.attach}
        onViewChange={storeView}
        onImageryFailing={setImageryFailing}
        onTap={onTap}
        onDrag={onDrag}
      />

      {sync === "conflict" ? (
        <Notice
          actions={
            <>
              <button type="button" className={noticeQuiet} onClick={() => void resolve(false)}>
                {t("sync.takeTheirs")}
              </button>
              <button type="button" className={noticeButton} onClick={() => void resolve(true)}>
                {t("sync.keepMine")}
              </button>
            </>
          }
        >
          {t("sync.conflict")}
        </Notice>
      ) : sync === "missing" ? (
        <Notice
          actions={
            <button type="button" className={noticeButton} onClick={() => void save()}>
              {t("maps.saveAsNew")}
            </button>
          }
        >
          {t("sync.missing")}
        </Notice>
      ) : imageryFailing ? (
        <Notice
          actions={
            imagery !== DEFAULT_IMAGERY && (
              <button type="button" onClick={() => chooseImagery(DEFAULT_IMAGERY)} className={noticeButton}>
                {t("imagery.useDefault")}
              </button>
            )
          }
        >
          {t("imagery.failing", { source: t(`imagery.${imagery}` as MessageKey) })}
        </Notice>
      ) : null}

      {(editor.past.length > 0 || editor.future.length > 0) && (
        <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] left-3 z-10 flex gap-2 md:left-[404px]">
          <RailButton label={t("history.undo")} disabled={editor.past.length === 0} onClick={() => dispatch({ type: "undo" })} className="disabled:opacity-50">
            <Undo2 size={22} />
          </RailButton>
          <RailButton label={t("history.redo")} disabled={editor.future.length === 0} onClick={() => dispatch({ type: "redo" })} className="disabled:opacity-50">
            <Redo2 size={22} />
          </RailButton>
        </div>
      )}

      <p className="pointer-events-none absolute bottom-[calc(var(--peek)+0.5rem)] left-3 z-10 rounded-md bg-cal/80 px-2 py-0.5 text-[11px] text-xisto md:bottom-3 md:left-[404px]">
        {imageryOf(imagery).attribution}
      </p>

      <div className="absolute right-3 bottom-[calc(var(--peek)+1rem)] z-10 flex flex-col items-end gap-3 md:bottom-6">
        <div className="flex flex-col gap-2">
          <RailButton label={t("tool.pin")} active={toolKind === "pin"} onClick={() => openPicker("pin")}>
            <MapPin size={22} strokeWidth={2.2} />
          </RailButton>
          <RailButton label={t("tool.line")} active={toolKind === "line"} onClick={() => openPicker("line")}>
            <Spline size={22} strokeWidth={2.2} />
          </RailButton>
          <RailButton label={t("tool.area")} active={toolKind === "area"} onClick={() => openPicker("area")}>
            <Pentagon size={22} strokeWidth={2.2} />
          </RailButton>
        </div>
        <div className="relative">
          <RailButton label={t("imagery.title")} active={picker} aria-expanded={picker} onClick={() => setPicker((p) => !p)}>
            <Layers size={22} strokeWidth={2.2} />
          </RailButton>
          {picker && <ImageryPicker current={imagery} onChoose={chooseImagery} onClose={() => setPicker(false)} />}
        </div>
        <RailButton label={follow.label} active={follow.status === "on"} tone="person" onClick={follow.onLocate} className="size-14 rounded-full">
          {follow.status === "on" && follow.following ? <LocateFixed size={24} strokeWidth={2.2} /> : <Locate size={24} strokeWidth={2.2} />}
        </RailButton>
      </div>

      <Sheet open={sheetOpen && body !== null} onOpenChange={setSheetOpen} onPeekHeight={setPeek} peek={peekContent}>
        {body}
      </Sheet>

      {dialog?.kind === "auth" && <AuthDialog initial={dialog.mode} onClose={() => setDialog(null)} />}
      {dialog?.kind === "device" && (
        <DeviceDialog
          onClose={() => setDialog(null)}
          onSignIn={() => setDialog({ kind: "auth", mode: "register" })}
          onDone={() => {
            setDialog(null);
            void saveAsNew().then((error) => error && setSaveError(t(errorKey(error))));
          }}
        />
      )}
      {dialog?.kind === "transfer" && <TransferDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === "share" && remote && (
        <ShareDialog mapId={remote.id} slug={shareSlug} onSlug={setShareSlug} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "deleteAccount" && me?.user && (
        <ConfirmDelete
          path="/api/me"
          expected={me.user.email}
          prompt={t("delete.account", { email: me.user.email })}
          onClose={() => setDialog(null)}
          onDone={() => void afterErase()}
        />
      )}
      {dialog?.kind === "deleteDevice" && me?.device && (
        <ConfirmDelete
          path="/api/device"
          expected={me.device.username}
          prompt={t("delete.device", { name: me.device.username })}
          onClose={() => setDialog(null)}
          onDone={() => void afterErase()}
        />
      )}
    </main>
  );
}
