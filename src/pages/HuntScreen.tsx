/**
 * A live hunt (D9–D15): the map with everyone on it and the ground covered, the code to bring
 * others in, who is there and how fresh their position is, and the host's controls. Positions
 * start being shared on arrival; the screen says so and says it is not a safety system (D17).
 * The host draws here and everyone sees it at once (D12); anyone marks a sighting (D11).
 */

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Binoculars, Crown, KeyRound, Layers, Locate, LocateFixed, Lock, LockOpen, LogOut, UserX } from "lucide-react";
import { DEFAULT_IMAGERY, type ImageryId } from "../doc/catalogue";
import { newFeatureId } from "../doc/ids";
import { canAdd } from "../doc/operations";
import type { FeatureId } from "../doc/types";
import type { Position } from "../geo/geo";
import { useI18n } from "../i18n/context";
import { useMedia } from "../lib/useMedia";
import { useNow } from "../lib/useNow";
import { render, type Person, type Trail } from "../map/drawing";
import { imageryOf } from "../map/imagery";
import { MapView, type Handle, type View } from "../map/MapView";
import { useFollow } from "../map/useFollow";
import { ageMs, type HuntView } from "../live/huntState";
import { forgetHunt, forgetTrail } from "../live/huntStore";
import type { MemberInfo, Observation, ObservationType, Role } from "../live/protocol";
import { cadence, LOST_AFTER_MS, staleAfterMs } from "../live/sampler";
import { useHunt, type Link } from "../live/useHunt";
import { useHuntEditor } from "../live/useHuntEditor";
import { storedImagery, storedView, storeImagery, PORTUGAL } from "../share/prefs";
import { navigate } from "../share/routes";
import { ImageryPicker } from "../components/ImageryPicker";
import { RailButton } from "../components/RailButton";
import { Sheet } from "../components/Sheet";
import { Dialog } from "../components/Dialog";
import { Notice } from "../components/Notice";
import { noticeQuiet, primaryButton, secondaryButton } from "../components/ui";
import { DrawBar } from "../components/editor/DrawBar";
import { HistoryButtons, ToolRail } from "../components/editor/EditRail";
import { FeatureDetails, FeatureHeader } from "../components/editor/FeatureEditor";
import { TypePicker } from "../components/editor/TypePicker";
import { useEditing } from "../components/editor/useEditing";
import { SightingActions, SightingHeader, SightingPicker, SightingPlaceBar } from "../components/hunt/Sightings";

const PANEL_PX = 392;

/** Six decimals, as the map document keeps them: about 10 cm. */
const round = (p: Position): [number, number] => [Math.round(p[0] * 1e6) / 1e6, Math.round(p[1] * 1e6) / 1e6];

export function HuntScreen({ huntId }: { huntId: string }) {
  const { t, tn, locale } = useI18n();
  const follow = useFollow();
  const { view, link, send } = useHunt(huntId, follow.fix);
  const host = view.you?.host === true;
  const { editor, dispatch, notice, dismiss } = useHuntEditor(view, send, host);
  const [imagery, setImagery] = useState<ImageryId>(() => storedImagery() ?? DEFAULT_IMAGERY);
  const [initialView] = useState<View>(() => storedView() ?? PORTUGAL);
  const [picker, setPicker] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [peek, setPeek] = useState(96);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const wide = useMedia("(min-width: 48rem)");
  const now = useNow(5000);
  const editing = useEditing(editor, dispatch, { map: follow.map, wide, setSheetOpen });
  const [choosingSighting, setChoosingSighting] = useState(false);
  const [placing, setPlacing] = useState<ObservationType | null>(null);
  const [sightingId, setSightingId] = useState<string | null>(null);
  const sighting = sightingId ? view.obs.find((o) => o.id === sightingId) : undefined;

  // Sharing the position is what being in a hunt means; it starts on arrival (D15).
  const { ensure } = follow;
  useEffect(() => {
    if (link === "live") ensure();
  }, [link, ensure]);

  const people = useMemo(() => peopleOf(view, now), [view, now]);
  const trails = useMemo<Trail[]>(
    () => Object.entries(view.trails).map(([id, pts]) => ({ id, points: pts.map((p): Position => [p[0], p[1]]) })),
    [view.trails],
  );
  const observations = useMemo(() => view.obs.map((o) => ({ id: o.id, type: o.type, at: o.c })), [view.obs]);
  const rendered = useMemo(
    () =>
      render(editor.doc, {
        selected: editor.selected,
        tool: editor.tool,
        editing: host,
        vertex: editing.vertex,
        people,
        trails,
        observations,
        sighting: sighting?.id ?? null,
      }),
    [editor.doc, editor.selected, editor.tool, host, editing.vertex, people, trails, observations, sighting],
  );

  const stopAll = () => {
    setChoosingSighting(false);
    setPlacing(null);
    setSightingId(null);
    editing.setPicking(null);
    dispatch({ type: "tool", tool: { kind: "idle" } });
    dispatch({ type: "select", id: null });
  };

  const mark = (type: ObservationType, at: Position) => {
    send({ t: "obs.put", obs: { id: newFeatureId(), type, c: round(at) } });
    setPlacing(null);
  };

  const onTap = (at: Position, hit: FeatureId | null, handle: Handle | null) => {
    if (placing) return mark(placing, at);
    if (hit && editor.tool.kind === "idle" && view.obs.some((o) => o.id === hit)) {
      dispatch({ type: "select", id: null });
      setSightingId(hit);
      return;
    }
    setSightingId(null);
    if (host) editing.onTap(at, hit, handle);
  };

  /** The host keeps a sighting: a landmark where it was, named for what and when (D11). */
  const keep = (o: Observation) => {
    if (!canAdd(editor.doc)) return;
    const id = newFeatureId();
    const time = new Date(o.at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    const at = Date.now();
    dispatch({ type: "tool", tool: { kind: "pin", type: "landmark" } });
    dispatch({ type: "tap", at: o.c, hit: null, id, now: at });
    dispatch({ type: "props", id, patch: { name: t("obs.keptName", { type: t(`obs.type.${o.type}`), time }), ...(o.note ? { note: o.note } : {}) }, now: at });
    send({ t: "obs.del", id: o.id });
    setSightingId(null);
  };

  const leave = () => {
    forgetHunt(huntId);
    forgetTrail(huntId);
    navigate(view.hunt ? `/map/${view.hunt.mapId}` : "/");
  };

  const over: Link[] = ["ended", "kicked", "denied"];
  const done = over.includes(link);
  const members = Object.values(view.members).sort((a, b) => Number(b.host) - Number(a.host) || a.name.localeCompare(b.name));

  const { picking, selectedFeature, commands } = editing;
  const tool = editor.tool;
  let tools: { peek: React.ReactNode; body: React.ReactNode } | null = null;
  if (done) tools = null;
  else if (placing) {
    const fix = follow.fix;
    tools = { peek: <SightingPlaceBar type={placing} onHere={fix ? () => mark(placing, fix.at) : null} onCancel={() => setPlacing(null)} />, body: null };
  } else if (choosingSighting) {
    tools = {
      peek: (
        <SightingPicker
          onPick={(type) => {
            setChoosingSighting(false);
            setPlacing(type);
            setSheetOpen(false);
          }}
          onCancel={() => setChoosingSighting(false)}
        />
      ),
      body: null,
    };
  } else if (sighting) {
    const mine = sighting.by === view.you?.id;
    tools = {
      peek: (
        <SightingHeader
          obs={sighting}
          by={view.members[sighting.by]?.name ?? "—"}
          ageMs={Math.max(0, now + view.offset - sighting.at)}
          onClose={() => setSightingId(null)}
        />
      ),
      body: (
        <SightingActions
          onKeep={host ? () => keep(sighting) : null}
          onRemove={
            mine || host
              ? () => {
                  send({ t: "obs.del", id: sighting.id });
                  setSightingId(null);
                }
              : null
          }
        />
      ),
    };
  } else if (host && picking) {
    tools = { peek: <TypePicker picking={picking} onPick={editing.pickType} onCancel={() => editing.setPicking(null)} />, body: null };
  } else if (host && tool.kind !== "idle") {
    tools = {
      peek: (
        <DrawBar
          tool={tool}
          onUndoPoint={() => dispatch({ type: "undoPoint" })}
          onCancel={() => dispatch({ type: "tool", tool: { kind: "idle" } })}
          onFinish={() => dispatch({ type: "finish", id: newFeatureId(), now: Date.now() })}
        />
      ),
      body: null,
    };
  } else if (host && selectedFeature && commands) {
    tools = {
      peek: <FeatureHeader feature={selectedFeature} onClose={commands.close} />,
      body: <FeatureDetails feature={selectedFeature} doc={editor.doc} vertex={editing.vertex} commands={commands} />,
    };
  }

  const peekContent = tools ? tools.peek : done ? (
    <div>
      <h1 className="text-xl leading-tight font-bold">{t(`hunt.over.${link as "ended" | "kicked" | "denied"}`)}</h1>
      <p className="mt-1 text-[15px] text-xisto-soft">{t(`hunt.over.${link as "ended" | "kicked" | "denied"}.detail`)}</p>
    </div>
  ) : (
    <div className="flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-xisto-soft">{view.hunt ? t(`hunt.type.${view.hunt.type}`) : t("auth.working")}</p>
        <p className="font-mono text-[30px] leading-none font-bold tracking-[0.25em]" aria-label={t("hunt.codeIs", { code: view.hunt?.code.split("").join(" ") ?? "" })}>
          {view.hunt?.code ?? "····"}
        </p>
        <p className="mt-1 flex items-center gap-2 text-[14px] text-xisto-soft" role="status">
          <span className={`size-2.5 shrink-0 rounded-full ${link === "live" ? "bg-[#2f9e44]" : "bg-[#c9a227]"}`} aria-hidden />
          {link === "live" ? tn("hunt.people", members.filter((m) => m.online).length) : t("hunt.reconnecting")}
          {view.hunt?.locked && (
            <span className="inline-flex items-center gap-1">
              <Lock size={14} /> {t("hunt.locked")}
            </span>
          )}
        </p>
      </div>
    </div>
  );

  const body = tools ? tools.body : done ? (
    <button type="button" onClick={leave} className={primaryButton}>
      {t("hunt.backToMap")}
    </button>
  ) : (
    <div className="flex flex-col gap-5">
      <p className="border-l-4 border-person pl-3 text-[15px] leading-snug">
        {t("hunt.sharing")} {t("safety.notice")}
      </p>

      {view.hunt?.type === "montaria" && view.you && (
        <div role="group" aria-label={t("hunt.myRole")} className="flex flex-col gap-1.5">
          <span className="text-[15px] font-semibold">{t("hunt.myRole")}</span>
          <div className="inline-flex self-start rounded-xl bg-cal-deep p-1">
            {(["porta", "batedor"] as const).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={view.you?.role === r}
                onClick={() => send({ t: "role", role: r })}
                className="min-h-11 min-w-24 rounded-lg px-3 text-[15px] font-semibold text-xisto-soft aria-pressed:bg-cal aria-pressed:text-xisto aria-pressed:shadow-sm"
              >
                {t(`role.${r}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      <section className="flex flex-col gap-1">
        <h3 className="text-[15px] font-semibold">{t("hunt.members")}</h3>
        <ul className="-mx-2">
          {members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              you={m.id === view.you?.id}
              view={view}
              now={now}
              canKick={host && !m.host}
              onKick={() => send({ t: "hunt.kick", member: m.id })}
            />
          ))}
        </ul>
      </section>

      {host && (
        <section className="flex flex-col gap-2">
          <h3 className="text-[15px] font-semibold">{t("hunt.hostControls")}</h3>
          <button type="button" onClick={() => send({ t: "hunt.lock", on: !view.hunt?.locked })} className={secondaryButton}>
            {view.hunt?.locked ? <LockOpen size={18} /> : <Lock size={18} />}
            {view.hunt?.locked ? t("hunt.unlock") : t("hunt.lock")}
          </button>
          <button type="button" onClick={() => send({ t: "hunt.rotate" })} className={secondaryButton}>
            <KeyRound size={18} />
            {t("hunt.newCode")}
          </button>
          <button
            type="button"
            onClick={() => setConfirmEnd(true)}
            className="flex min-h-12 items-center justify-center gap-2 rounded-[14px] border-2 border-[#c23a2b] px-4 text-[15px] font-semibold text-[#a32a1d]"
          >
            {t("hunt.end")}
          </button>
        </section>
      )}

      {!host && (
        <button type="button" onClick={leave} className={secondaryButton}>
          <LogOut size={18} />
          {t("hunt.leave")}
        </button>
      )}
    </div>
  );

  return (
    <main className="fixed inset-0 overflow-hidden font-sans" style={{ "--peek": `${peek}px` } as React.CSSProperties}>
      <MapView
        imagery={imagery}
        initialView={initialView}
        fix={follow.fix}
        rendered={rendered}
        drawing={tool.kind !== "idle" || placing !== null}
        inset={wide ? { bottom: 0, left: PANEL_PX } : { bottom: sheetOpen ? 0 : peek, left: 0 }}
        onReady={follow.attach}
        onTap={done ? undefined : onTap}
        onDrag={host && !done ? editing.onDrag : undefined}
      />

      {notice && !done && (
        <Notice
          actions={
            <button type="button" className={noticeQuiet} onClick={dismiss}>
              {t("edit.close")}
            </button>
          }
        >
          {t(notice === "rejected" ? "hunt.edit.rejected" : "hunt.edit.refused")}
        </Notice>
      )}

      {host && !done && <HistoryButtons editor={editor} dispatch={dispatch} />}

      <p className="pointer-events-none absolute bottom-[calc(var(--peek)+0.5rem)] left-3 z-10 rounded-md bg-cal/80 px-2 py-0.5 text-[11px] text-xisto md:bottom-3 md:left-[404px]">
        {imageryOf(imagery).attribution}
      </p>

      <div className="absolute right-3 bottom-[calc(var(--peek)+1rem)] z-10 flex flex-col items-end gap-3 md:bottom-6">
        {!done && (
          <div className="flex flex-col gap-2">
            <RailButton
              label={t("obs.add")}
              active={choosingSighting || placing !== null}
              onClick={() => {
                const open = !(choosingSighting || placing);
                stopAll();
                setChoosingSighting(open);
                setSheetOpen(true);
              }}
            >
              <Binoculars size={22} strokeWidth={2.2} />
            </RailButton>
          </div>
        )}
        {host && !done && (
          <ToolRail
            active={editing.toolKind}
            onPick={(kind) => {
              setChoosingSighting(false);
              setPlacing(null);
              setSightingId(null);
              editing.openPicker(kind);
            }}
          />
        )}
        <div className="relative">
          <RailButton label={t("imagery.title")} active={picker} aria-expanded={picker} onClick={() => setPicker((p) => !p)}>
            <Layers size={22} strokeWidth={2.2} />
          </RailButton>
          {picker && (
            <ImageryPicker
              current={imagery}
              onChoose={(id) => {
                setImagery(id);
                storeImagery(id);
                setPicker(false);
              }}
              onClose={() => setPicker(false)}
            />
          )}
        </div>
        <RailButton label={follow.label} active={follow.status === "on"} tone="person" onClick={follow.onLocate} className="size-14 rounded-full">
          {follow.status === "on" && follow.following ? <LocateFixed size={24} strokeWidth={2.2} /> : <Locate size={24} strokeWidth={2.2} />}
        </RailButton>
      </div>

      <Sheet open={(sheetOpen && body !== null) || done} onOpenChange={setSheetOpen} onPeekHeight={setPeek} peek={peekContent}>
        {body}
      </Sheet>

      {confirmEnd && (
        <Dialog title={t("hunt.end")} onClose={() => setConfirmEnd(false)}>
          <p className="text-[16px] leading-snug">{t("hunt.endExplain")}</p>
          <button
            type="button"
            onClick={() => {
              setConfirmEnd(false);
              send({ t: "hunt.end" });
            }}
            className="mt-5 flex min-h-12 w-full items-center justify-center rounded-[14px] bg-[#a32a1d] px-4 text-[15px] font-semibold text-white"
          >
            {t("hunt.endConfirm")}
          </button>
        </Dialog>
      )}
    </main>
  );
}

/** Everyone but this phone, as dots: fresh, stale after twice their interval, lost after five minutes (D15). */
function peopleOf(view: HuntView, now: number): Person[] {
  if (!view.hunt) return [];
  const out: Person[] = [];
  for (const [id, seen] of Object.entries(view.positions)) {
    const m = view.members[id];
    if (!m || id === view.you?.id) continue;
    const age = ageMs(seen, view.offset, now);
    const state = age > LOST_AFTER_MS ? "lost" : age > staleAfterMs(cadence(view.hunt.type, m.role)) ? "stale" : "fresh";
    out.push({ id, name: m.name, at: seen.c, state, away: m.away });
  }
  return out;
}

function MemberRow({
  member,
  you,
  view,
  now,
  canKick,
  onKick,
}: {
  member: MemberInfo;
  you: boolean;
  view: HuntView;
  now: number;
  canKick: boolean;
  onKick: () => void;
}) {
  const { t } = useI18n();
  const seen = view.positions[member.id];
  const age = seen ? Math.max(0, ageMs(seen, view.offset, now)) : null;
  const status = !member.online
    ? t("hunt.offline")
    : member.away
      ? t("hunt.away")
      : age === null
        ? t("hunt.noPosition")
        : age < 60_000
          ? t("hunt.seenSeconds", { s: Math.round(age / 1000) })
          : t("hunt.seenMinutes", { m: Math.round(age / 60_000) });
  return (
    <li className="flex min-h-12 items-center gap-3 rounded-[12px] px-2">
      <span
        aria-hidden
        className={`size-3 shrink-0 rounded-full ${member.online && !member.away ? "bg-person" : "bg-[#9aa093]"}`}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[16px] font-semibold">
          <span className="truncate">{you ? t("hunt.you", { name: member.name }) : member.name}</span>
          {member.host && <Crown size={15} aria-label={t("hunt.host")} className="shrink-0 text-anil" />}
          {member.verified && <BadgeCheck size={15} aria-label={t("hunt.verified")} className="shrink-0 text-anil" />}
        </span>
        <span className="block text-[13px] text-xisto-soft">
          {view.hunt?.type === "montaria" ? `${t(`role.${member.role as Exclude<Role, "member">}`)}, ` : ""}
          {you ? t("hunt.thisPhone") : status}
        </span>
      </span>
      {canKick && (
        <button
          type="button"
          onClick={onKick}
          aria-label={t("hunt.kick", { name: member.name })}
          title={t("hunt.kick", { name: member.name })}
          className="flex size-11 items-center justify-center rounded-full text-[#a32a1d] active:bg-cal-deep"
        >
          <UserX size={20} />
        </button>
      )}
    </li>
  );
}
