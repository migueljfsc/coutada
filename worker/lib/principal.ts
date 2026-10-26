/**
 * Who a request acts for: the signed-in user, else the browser's anonymous device, else nobody
 * (architecture §5). Ownership is always checked in the statement, with `ownerColumn`.
 */

import { resolveDevice, type Device } from "./devices";
import { resolveSession, type SessionUser } from "./session";

export type Principal = { kind: "user"; user: SessionUser } | { kind: "device"; device: Device };

export async function resolvePrincipal(env: Env, request: Request, now: number): Promise<Principal | null> {
  const user = await resolveSession(env, request, now);
  if (user) return { kind: "user", user };
  const device = await resolveDevice(env, request, now);
  return device ? { kind: "device", device } : null;
}

/** The owner column and value a row must carry to belong to `p`. */
export const ownerColumn = (p: Principal): ["owner_user_id" | "owner_device_id", string] =>
  p.kind === "user" ? ["owner_user_id", p.user.id] : ["owner_device_id", p.device.id];

export const principalKey = (p: Principal): string => (p.kind === "user" ? `user:${p.user.id}` : `device:${p.device.id}`);
