/**
 * The pictures the map's symbol layers wear, drawn on a canvas in the UI's own face (D24) and
 * registered on demand from MapLibre's `styleimagemissing`. Ids are built by `drawing.ts`.
 */

import { createElement, type ComponentType } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Car, Droplet, Fence, Flag, PawPrint, TriangleAlert, Users, type LucideProps } from "lucide-react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { PALETTE, type PaletteKey, type PinType } from "../doc/catalogue";
import { EVENTS, SUBJECTS, type SightingEvent, type Subject } from "../live/protocol";
import { speciesSvg } from "./species";

const RATIO = 2;
/** Xisto, the badges' ground, and osso, what is drawn on it (D24). */
const INK = "#23281f";
const BONE = "#e8e2d4";
const FONT = '"Atkinson Hyperlegible Next"';

const GLYPHS: Partial<Record<PinType, ComponentType<LucideProps>>> = {
  landmark: Flag,
  gate: Fence,
  parking: Car,
  meeting: Users,
  danger: TriangleAlert,
  water: Droplet,
  game: PawPrint,
};

/** The corner mark on a sighting: none for seen. */
const EVENT_MARK: Record<SightingEvent, string | null> = { seen: null, flushed: "#557945", down: "#c23a2b" };

const glyphImages = new Map<string, HTMLImageElement>();
const subjectImages = new Map<string, HTMLImageElement>();

async function decoded(svg: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  return img;
}

/** Renders a lucide icon to SVG markup without touching the document. */
function svgOf(icon: ComponentType<LucideProps>): string {
  const host = document.createElement("div");
  const root = createRoot(host);
  flushSync(() => root.render(createElement(icon, { size: 24, color: BONE, strokeWidth: 2 })));
  const markup = host.innerHTML;
  root.unmount();
  return markup;
}

/** Loads the face and the pin glyphs; the map is created once this resolves. */
export async function prepareImages(): Promise<void> {
  // Called from an effect, where `flushSync` cannot render synchronously; one tick out of React's
  // commit, it can.
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.allSettled([
    document.fonts.load(`700 28px ${FONT}`),
    document.fonts.load(`800 36px ${FONT}`),
    ...Object.entries(GLYPHS).map(async ([type, icon]) => {
      try {
        glyphImages.set(type, await decoded(svgOf(icon!)));
      } catch (cause) {
        console.error("pin glyph", type, cause);
      }
    }),
    ...SUBJECTS.map(async (subject) => {
      try {
        subjectImages.set(subject, await decoded(speciesSvg(subject, BONE, 64)));
      } catch (cause) {
        console.error("silhouette", subject, cause);
      }
    }),
  ]);
}

function canvas(w: number, h: number) {
  const c = new OffscreenCanvas(Math.ceil(w * RATIO), Math.ceil(h * RATIO));
  const ctx = c.getContext("2d")!;
  ctx.scale(RATIO, RATIO);
  return { ctx, done: () => ctx.getImageData(0, 0, c.width, c.height) };
}

const BADGE = 36;

/**
 * A pin's ground: a dark disc with a thin ring in the feature's colour, edged in bone so it holds
 * against dark woodland.
 */
function badge(ring: string): ReturnType<typeof canvas> {
  const r = BADGE / 2;
  const out = canvas(BADGE, BADGE);
  const { ctx } = out;
  ctx.beginPath();
  ctx.arc(r, r, r - 0.5, 0, Math.PI * 2);
  ctx.fillStyle = BONE;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(r, r, r - 2, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(r, r, r - 4.75, 0, Math.PI * 2);
  ctx.strokeStyle = ring;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  return out;
}

function pin(type: PinType, colour: PaletteKey): ImageData {
  const out = badge(PALETTE[colour]);
  const glyph = glyphImages.get(type);
  if (glyph) out.ctx.drawImage(glyph, 10, 10, 16, 16);
  return out.done();
}

function game(subject: Subject, colour: PaletteKey): ImageData {
  const out = badge(PALETTE[colour]);
  const glyph = subjectImages.get(subject);
  if (glyph) out.ctx.drawImage(glyph, 7, 7, 22, 22);
  return out.done();
}

/** A diamond, so a mark made during the hunt is not mistaken for a pin on the map. */
function observation(subject: Subject, event: SightingEvent): ImageData {
  const size = 40;
  const c = size / 2;
  const out = canvas(size, size);
  const { ctx } = out;
  const diamond = (r: number) => {
    ctx.beginPath();
    ctx.moveTo(c, c - r);
    ctx.lineTo(c + r, c);
    ctx.lineTo(c, c + r);
    ctx.lineTo(c - r, c);
    ctx.closePath();
  };
  diamond(c - 0.5);
  ctx.fillStyle = BONE;
  ctx.fill();
  diamond(c - 2.5);
  ctx.fillStyle = INK;
  ctx.fill();
  const glyph = subjectImages.get(subject);
  if (glyph) ctx.drawImage(glyph, c - 10, c - 10, 20, 20);
  const mark = EVENT_MARK[event];
  if (mark) {
    ctx.beginPath();
    ctx.arc(size - 8, 8, 6, 0, Math.PI * 2);
    ctx.fillStyle = BONE;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(size - 8, 8, 4.25, 0, Math.PI * 2);
    ctx.fillStyle = mark;
    ctx.fill();
  }
  return out.done();
}

function porta(n: string): ImageData {
  const out = badge(BONE);
  const { ctx } = out;
  ctx.fillStyle = BONE;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${n.length > 2 ? 12 : 15}px ${FONT}`;
  ctx.fillText(n || "P", BADGE / 2, BADGE / 2 + 1);
  return out.done();
}

function label(text: string): ImageData {
  const probe = canvas(1, 1).ctx;
  probe.font = `700 13px ${FONT}`;
  const max = 180;
  let shown = text;
  while (probe.measureText(shown).width > max && shown.length > 1) shown = shown.slice(0, -1);
  if (shown !== text) shown = `${shown.trimEnd()}…`;
  const w = Math.ceil(probe.measureText(shown).width) + 12;
  const h = 20;
  const out = canvas(w, h);
  const { ctx } = out;
  ctx.fillStyle = INK;
  ctx.globalAlpha = 0.86;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 4);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = BONE;
  ctx.font = `700 13px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.fillText(shown, 6, h / 2 + 1);
  return out.done();
}

/** Draws and registers the image `id` names, if it is one of ours. */
export function provideImage(map: MapLibreMap, id: string): void {
  const [kind, ...rest] = id.split(":");
  let image: ImageData | null = null;
  const subject = SUBJECTS.find((s) => s === rest[0]);
  if (kind === "pin" && rest.length === 2) image = pin(rest[0] as PinType, rest[1] as PaletteKey);
  else if (kind === "game" && subject && rest.length === 2) image = game(subject, rest[1] as PaletteKey);
  else if (kind === "porta") image = porta(rest.join(":"));
  else if (kind === "obs" && subject) image = observation(subject, EVENTS.find((e) => e === rest[1]) ?? "seen");
  else if (kind === "label") image = label(rest.join(":"));
  if (image && !map.hasImage(id)) map.addImage(id, image, { pixelRatio: RATIO });
}
