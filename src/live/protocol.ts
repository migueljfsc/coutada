/**
 * The hunt's WebSocket protocol (architecture §7): one JSON message per frame, told apart by `t`.
 * The Worker validates what a phone sends with these schemas; the phone reads the server's
 * messages as typed. Coordinates are `[lon, lat]`; times are ms since epoch unless named seconds.
 */

import { z } from "zod";
import { mapFeatureSchema } from "../doc/schema";
import type { MapDoc, MapFeature } from "../doc/types";
import type { TrailPoint } from "./trail";

/** The subprotocol a phone asks for, beside its member token. */
export const PROTOCOL = "coutada.v1";

export const HUNT_TYPES = ["montaria", "salto"] as const;
export type HuntType = (typeof HUNT_TYPES)[number];

export const ROLES = ["porta", "batedor", "member"] as const;
export type Role = (typeof ROLES)[number];

export const OBSERVATION_TYPES = ["covey", "game_seen", "game_down", "dog"] as const;
export type ObservationType = (typeof OBSERVATION_TYPES)[number];

/** Frames larger than this are refused; a trail sync may be larger. */
export const MAX_FRAME_BYTES = 64 * 1024;
export const MAX_TRAIL_FRAME_BYTES = 1024 * 1024;
export const MAX_MEMBERS = 30;
export const MAX_OBSERVATIONS = 300;

/** Close codes. */
export const CLOSE = { unauthenticated: 4001, kicked: 4003, ended: 4004, overLimit: 4008 } as const;

const lon = z.number().min(-180).max(180);
const lat = z.number().min(-90).max(90);
const coord = z.tuple([lon, lat]).readonly();
const id = z.string().regex(/^[A-Za-z0-9_-]{22}$/);

export const positionSchema = z.object({
  c: coord,
  acc: z.number().min(0).max(10_000),
  hdg: z.number().min(0).max(360).optional(),
  spd: z.number().min(0).max(100).optional(),
  at: z.number().int().nonnegative(),
});
export type Pos = z.infer<typeof positionSchema>;

const trailPoint = z.tuple([lon, lat, z.number().int().nonnegative()]);

export const observationInput = z.object({
  id,
  type: z.enum(OBSERVATION_TYPES),
  c: coord,
  note: z.string().max(200).regex(/^[^\p{Cc}]*$/u).optional(),
});

export const clientMessageSchema = z.discriminatedUnion("t", [
  positionSchema.extend({ t: z.literal("pos") }),
  z.object({ t: z.literal("away") }),
  z.object({ t: z.literal("back") }),
  z.object({ t: z.literal("trail.sync"), pts: z.array(trailPoint).max(20_000) }),
  z.object({ t: z.literal("obs.put"), obs: observationInput }),
  z.object({ t: z.literal("obs.del"), id }),
  z.object({ t: z.literal("role"), member: id.optional(), role: z.enum(ROLES) }),
  z.object({ t: z.literal("feature.put"), f: mapFeatureSchema, base: z.number().int().nonnegative() }),
  z.object({ t: z.literal("feature.del"), id, base: z.number().int().nonnegative() }),
  z.object({ t: z.literal("hunt.lock"), on: z.boolean() }),
  z.object({ t: z.literal("hunt.kick"), member: id }),
  z.object({ t: z.literal("hunt.rotate") }),
  z.object({ t: z.literal("hunt.end") }),
]);
/** What a phone may send; a feature is the map's own type, which the schema checks. */
export type ClientMessage =
  | Exclude<z.infer<typeof clientMessageSchema>, { t: "feature.put" }>
  | { t: "feature.put"; f: MapFeature; base: number };

/** A frame's message, or null when it is not one. */
export function parseClientMessage(raw: unknown): ClientMessage | null {
  const result = clientMessageSchema.safeParse(raw);
  return result.success ? (result.data as ClientMessage) : null;
}

export type MemberInfo = {
  id: string;
  name: string;
  role: Role;
  host: boolean;
  /** Signed in with an account: a name an anonymous member cannot fake. */
  verified: boolean;
  online: boolean;
  away: boolean;
};

export type Observation = z.infer<typeof observationInput> & { by: string; at: number };

export type HuntInfo = { type: HuntType; code: string; locked: boolean; endsAt: number; mapId: string };

/** A position as relayed, with the time the hunt object received it. */
export type Seen = Pos & { rt: number };

export type ServerMessage =
  | {
      t: "welcome";
      you: { id: string; role: Role; host: boolean };
      now: number;
      hunt: HuntInfo;
      members: MemberInfo[];
      positions: Record<string, Seen>;
      doc: MapDoc;
      rev: number;
      obs: Observation[];
      trails: Record<string, TrailPoint[]>;
    }
  | { t: "member"; m: MemberInfo }
  | { t: "member.gone"; id: string }
  | ({ t: "pos"; m: string } & Seen)
  | { t: "away"; m: string; away: boolean }
  | { t: "trail"; m: string; pts: TrailPoint[] }
  | { t: "trail.request" }
  | { t: "feature.put"; f: MapFeature; rev: number }
  | { t: "feature.del"; id: string; rev: number }
  | { t: "feature.reject"; id: string; f: MapFeature | null; rev: number }
  | { t: "obs.put"; obs: Observation }
  | { t: "obs.del"; id: string }
  | { t: "hunt"; code: string; locked: boolean; endsAt: number }
  | { t: "ended"; reason: "host" | "expired" }
  | { t: "error"; code: string };

/** Whether a role draws a trail: everyone in a salto, the batedores in a montaria (D15). */
export const tracksTrail = (type: HuntType, role: Role): boolean => type === "salto" || role === "batedor";

/** The role a new member starts with. */
export const firstRole = (type: HuntType): Role => (type === "salto" ? "member" : "porta");
