/**
 * The map screen: imagery full bleed, the tool rail on the right within thumb reach, the sheet at
 * the bottom (a left panel on wide screens) showing whatever is in hand — the map, a type to pick,
 * the line being drawn, or the selected feature. The document is kept by `useMapDocument`.
 */

import { useEffect, useMemo, useState } from "react";
import { Layers, Locate, LocateFixed } from "lucide-react";
import { AuthDialog, type AuthMode } from "../account/AuthDialog";
import { ConfirmDelete } from "../account/ConfirmDelete";
import { hasIdentity, useAccount } from "../account/context";
import { DeviceDialog } from "../account/DeviceDialog";
import { errorKey } from "../account/errors";
import { ShareDialog } from "../account/ShareDialog";
import { TransferDialog } from "../account/TransferDialog";
import { DEFAULT_IMAGERY, type ImageryId } from "../doc/catalogue";
import { newFeatureId } from "../doc/ids";
import { featureById } from "../doc/operations";
import type { FeatureId } from "../doc/types";
import { bboxOf } from "../geo/geo";
import { type MessageKey } from "../i18n/core";
import { useI18n } from "../i18n/context";
import { useMedia } from "../lib/useMedia";
import { render } from "../map/drawing";
import { imageryOf } from "../map/imagery";
import { MapView, type View } from "../map/MapView";
import { useFollow } from "../map/useFollow";
import { useNavigation } from "../nav/useNavigation";
import { NavPanel } from "../components/NavPanel";
import { MAX_IMPORT_BYTES } from "../io/incoming";
import { readInto } from "../io/read";
import { lastHunt, storedPass } from "../live/huntStore";
import { api } from "../share/api";
import { huntPath, navigate } from "../share/routes";
import { PORTUGAL, storedImagery, storedView, storeImagery, storeView } from "../share/prefs";
import { count } from "../share/usage";
import { useMapDocument } from "../sync/useMapDocument";
import { ImageryPicker } from "../components/ImageryPicker";
import { AccountSheet, MenuButton, type AccountActions } from "../components/AccountSheet";
import { MapBody, MapPeek, type PanelActions } from "../components/MapPanel";
import { MapSwitcher } from "../components/MapSwitcher";
import { FilesDialog } from "../components/FilesDialog";
import { Notice } from "../components/Notice";
import { OfflineDialog } from "../components/OfflineDialog";
import { HuntChooser, JoinHuntDialog, StartHuntDialog } from "../components/hunt/HuntDialogs";
import { RailButton } from "../components/RailButton";
import { Sheet } from "../components/Sheet";
import { noticeButton, noticeQuiet, topLeft, topRight } from "../components/ui";
import { DrawBar } from "../components/editor/DrawBar";
import { HistoryButtons, ToolRail } from "../components/editor/EditRail";
import { FeatureDetails, FeatureHeader } from "../components/editor/FeatureEditor";
import { TypePicker } from "../components/editor/TypePicker";
import { useEditing } from "../components/editor/useEditing";

/** The left panel's width plus its margins, on wide screens. */
const PANEL_PX = 392;

type DialogState =
  | { kind: "auth"; mode: AuthMode }
  | { kind: "device" }
  | { kind: "transfer" }
  | { kind: "share" }
  | { kind: "deleteAccount" }
  | { kind: "deleteDevice" }
  | { kind: "offline" }
  | { kind: "startHunt" }
  | { kind: "joinHunt" }
  | { kind: "hunt" }
  | { kind: "maps" }
  | { kind: "menu" }
  | { kind: "files" }
  | null;

export function MapScreen({ mapId }: { mapId: string | null }) {
  const { t, tn } = useI18n();
  const { me, refresh } = useAccount();
  const [imagery, setImagery] = useState<ImageryId>(() => storedImagery() ?? DEFAULT_IMAGERY);
  const [initialView] = useState<View>(() => storedView() ?? PORTUGAL);
  const { editor, dispatch, remote, status: sync, huntId, shareSlug, setShareSlug, saveAsNew, resolve, startNew } = useMapDocument(
    mapId,
    t("map.untitled"),
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [peek, setPeek] = useState(96);
  const [picker, setPicker] = useState(false);
  const [imageryFailing, setImageryFailing] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [imported, setImported] = useState<string | null>(null);
  const [locateNoticeShut, setLocateNoticeShut] = useState(false);
  const follow = useFollow();
  const wide = useMedia("(min-width: 48rem)");

  const { doc, tool, selected } = editor;
  const { picking, setPicking, vertex, selectedFeature, openPicker, pickType, onTap, onDrag, select, commands, toolKind } = useEditing(
    editor,
    dispatch,
    { map: follow.map, wide, setSheetOpen },
  );

  // While a hunt holds the map, its drawings change through the hunt (D12): a phone in it goes there.
  const hunting = sync === "hunting";
  useEffect(() => {
    if (hunting && huntId && storedPass(huntId)) navigate(huntPath(huntId), true);
  }, [hunting, huntId]);

  const { navigation, start: startNavigation, stop: stopNavigation } = useNavigation(doc, follow.fix);
  const navTarget = navigation ? featureById(doc, navigation.target.id) : undefined;
  const shown = navigation ? navigation.target.id : selected;
  const rendered = useMemo(
    () => render(doc, { selected: shown, tool, editing: !navigation, vertex, guide: navigation?.guide ?? null }),
    [doc, shown, tool, vertex, navigation],
  );

  const navigateTo = (id: FeatureId) => {
    follow.ensure();
    startNavigation(id);
    dispatch({ type: "select", id: null });
    setSheetOpen(false);
  };
  const now = () => Date.now();

  const chooseImagery = (id: ImageryId) => {
    setImagery(id);
    storeImagery(id);
    setPicker(false);
  };

  // --------------------------------------------------------------- drawing

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

  const ownHunt = lastHunt();
  const inHunt = !!ownHunt && !!storedPass(ownHunt);

  const actions: PanelActions = {
    openMaps: () => setDialog({ kind: "maps" }),
    choose: select,
    save: () => void save(),
    share: () => setDialog({ kind: "share" }),
    offline: () => setDialog({ kind: "offline" }),
    hunt: () => (inHunt && ownHunt ? navigate(huntPath(ownHunt)) : setDialog({ kind: "hunt" })),
    files: () => setDialog({ kind: "files" }),
  };

  const accountActions: AccountActions = {
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

  /** A GPX, KML or GeoJSON file onto this map, framed once it is in. */
  const importFile = async (file: File) => {
    setImported(null);
    if (file.size > MAX_IMPORT_BYTES) return setImported(t("import.tooBig"));
    const read = readInto(doc, file.name, await file.text(), newFeatureId, Date.now());
    if (!read.ok) return setImported(t(`import.${read.error}`));
    count(`import.${read.format}`);
    const result = read.imported;
    dispatch({ type: "import", doc: result.doc });
    const box = bboxOf(
      result.added.flatMap((id) => {
        const g = featureById(result.doc, id)?.geometry;
        return !g ? [] : g.type === "Point" ? [g.coordinates] : g.type === "LineString" ? g.coordinates : g.coordinates[0];
      }),
    );
    if (box) follow.map.current?.fitBounds([box[0], box[1], box[2], box[3]], { padding: 60, maxZoom: 17 });
    if (!wide) setSheetOpen(false);
    setImported(result.left > 0 ? t("import.partial", { n: result.added.length, left: result.left }) : tn("import.added", result.added.length));
  };

  const afterErase = async () => {
    setDialog(null);
    await refresh();
    startNew();
  };

  // ---------------------------------------------------------------- render

  const drawing = tool.kind !== "idle";
  const fix = follow.fix;

  let peekContent: React.ReactNode;
  let body: React.ReactNode;
  if (navigation && navTarget) {
    peekContent = <NavPanel navigation={navigation} feature={navTarget} fix={fix} status={follow.status} onStop={stopNavigation} />;
    body = null;
  } else if (picking) {
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
    body = (
      <FeatureDetails
        feature={selectedFeature}
        doc={doc}
        vertex={vertex}
        commands={commands}
        onNavigate={selectedFeature.geometry.type === "Polygon" ? undefined : () => navigateTo(selectedFeature.id)}
      />
    );
  } else {
    peekContent = <MapPeek doc={doc} status={sync} saved={!!remote} inHunt={inHunt} actions={actions} />;
    body = <MapBody doc={doc} onChoose={select} />;
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
        onDrag={hunting ? undefined : onDrag}
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
      ) : sync === "hunting" ? (
        <Notice
          actions={
            huntId &&
            storedPass(huntId) && (
              <button type="button" className={noticeButton} onClick={() => navigate(huntPath(huntId))}>
                {t("hunt.open")}
              </button>
            )
          }
        >
          {t("sync.hunting")}
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
      ) : saveError ? (
        <Notice
          actions={
            <button type="button" className={noticeQuiet} onClick={() => setSaveError(null)}>
              {t("edit.close")}
            </button>
          }
        >
          {saveError}
        </Notice>
      ) : imported ? (
        <Notice
          actions={
            <button type="button" className={noticeQuiet} onClick={() => setImported(null)}>
              {t("edit.close")}
            </button>
          }
        >
          {imported}
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
      ) : (follow.status === "denied" || follow.status === "unavailable") && !locateNoticeShut ? (
        <Notice
          actions={
            <button type="button" className={noticeQuiet} onClick={() => setLocateNoticeShut(true)}>
              {t("edit.close")}
            </button>
          }
        >
          {t(follow.status === "denied" ? "locate.denied" : "locate.unavailable")}
        </Notice>
      ) : null}

      {!hunting && (
        <div className={topLeft}>
          <HistoryButtons editor={editor} dispatch={dispatch} />
        </div>
      )}
      <div className={topRight}>
        <MenuButton onClick={() => setDialog({ kind: "menu" })} />
      </div>

      <p className="pointer-events-none absolute bottom-[calc(var(--peek)+0.5rem)] left-3 z-10 rounded-md bg-cal/80 px-2 py-0.5 text-[11px] text-xisto md:bottom-3 md:left-[404px]">
        {imageryOf(imagery).attribution}
      </p>

      <div className="absolute right-3 bottom-[calc(var(--peek)+1rem)] z-10 flex flex-col items-end gap-3 md:bottom-6">
        {!hunting && <ToolRail active={toolKind} onPick={openPicker} />}
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
      {dialog?.kind === "offline" && <OfflineDialog doc={doc} imagery={imagery} onClose={() => setDialog(null)} />}
      {dialog?.kind === "startHunt" && remote && <StartHuntDialog mapId={remote.id} onClose={() => setDialog(null)} />}
      {dialog?.kind === "joinHunt" && <JoinHuntDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === "hunt" && (
        <HuntChooser
          canStart={!!remote && hasIdentity(me)}
          onStart={() => setDialog({ kind: "startHunt" })}
          onJoin={() => setDialog({ kind: "joinHunt" })}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "maps" && (
        <MapSwitcher
          name={doc.coutada.name}
          mapId={remote?.id ?? null}
          unsavedLocal={sync === "local" && doc.features.length > 0}
          onRename={(name) => dispatch({ type: "rename", name })}
          onNew={startNew}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "menu" && <AccountSheet actions={accountActions} onClose={() => setDialog(null)} />}
      {dialog?.kind === "files" && <FilesDialog doc={doc} onFile={(file) => void importFile(file)} onClose={() => setDialog(null)} />}
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
