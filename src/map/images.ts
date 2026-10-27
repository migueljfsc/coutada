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
const INK = "#23281f";
const CAL = "#f2f4f0";
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
const EVENT_MARK: Record<SightingEvent, string | null> = { seen: null, flushed: "#1e4fa0", down: "#c23a2b" };

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
  flushSync(() => root.render(createElement(icon, { size: 24, color: INK, strokeWidth: 2.4 })));
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
        subjectImages.set(subject, await decoded(speciesSvg(subject, INK, 64)));
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

function badge(fill: string): ReturnType<typeof canvas> {
  const size = 38;
  const r = size / 2;
  const out = canvas(size, size);
  const { ctx } = out;
  ctx.beginPath();
  ctx.arc(r, r, r - 0.5, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(r, r, r - 3.5, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  return out;
}

function pin(type: PinType, colour: PaletteKey): ImageData {
  const out = badge(PALETTE[colour]);
  const glyph = glyphImages.get(type);
  if (glyph) out.ctx.drawImage(glyph, 9, 9, 20, 20);
  return out.done();
}

function game(subject: Subject, colour: PaletteKey): ImageData {
  const out = badge(PALETTE[colour]);
  const glyph = subjectImages.get(subject);
  if (glyph) out.ctx.drawImage(glyph, 6, 6, 26, 26);
  return out.done();
}

/** A white diamond, so a mark made during the hunt is not mistaken for a pin on the map. */
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
  ctx.fillStyle = INK;
  ctx.fill();
  diamond(c - 3.5);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  const glyph = subjectImages.get(subject);
  if (glyph) ctx.drawImage(glyph, c - 11, c - 11, 22, 22);
  const mark = EVENT_MARK[event];
  if (mark) {
    ctx.beginPath();
    ctx.arc(size - 8, 8, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(size - 8, 8, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = mark;
    ctx.fill();
  }
  return out.done();
}

function porta(n: string): ImageData {
  const out = badge("#ffffff");
  const { ctx } = out;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${n.length > 2 ? 14 : 18}px ${FONT}`;
  ctx.fillText(n || "P", 19, 20);
  return out.done();
}

function label(text: string): ImageData {
  const probe = canvas(1, 1).ctx;
  probe.font = `700 14px ${FONT}`;
  const max = 180;
  let shown = text;
  while (probe.measureText(shown).width > max && shown.length > 1) shown = shown.slice(0, -1);
  if (shown !== text) shown = `${shown.trimEnd()}…`;
  const w = Math.ceil(probe.measureText(shown).width) + 12;
  const h = 22;
  const out = canvas(w, h);
  const { ctx } = out;
  ctx.fillStyle = CAL;
  ctx.globalAlpha = 0.94;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 6);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = INK;
  ctx.font = `700 14px ${FONT}`;
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
