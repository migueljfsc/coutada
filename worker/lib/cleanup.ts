/**
 * The daily sweep: expired sessions, links, transfer codes and hunts, usage counters past their
 * keep, and devices unused for 90 days with what they own.
 */

import { DEVICE_TTL_S } from "./limits";
import { usageDay } from "./usage";

/** How long the anonymous counters are kept (D26): a year and a season, for year-on-year. */
export const USAGE_KEEP_DAYS = 400;

export async function sweep(env: Env, now: number): Promise<void> {
  const stale = now - DEVICE_TTL_S;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?1").bind(now),
    env.DB.prepare("DELETE FROM email_tokens WHERE expires_at <= ?1").bind(now),
    env.DB.prepare("DELETE FROM device_transfers WHERE expires_at <= ?1").bind(now),
    env.DB.prepare("DELETE FROM usage_daily WHERE day < ?1").bind(usageDay(now - USAGE_KEEP_DAYS * 24 * 60 * 60)),
    // A hunt's object ends it by its own alarm; a row it left behind still frees its code here.
    env.DB.prepare("DELETE FROM hunts WHERE expires_at <= ?1").bind(now),
    env.DB.prepare("DELETE FROM hunts WHERE host_device_id IN (SELECT id FROM devices WHERE last_seen_at <= ?1)").bind(stale),
    env.DB.prepare("DELETE FROM maps WHERE owner_device_id IN (SELECT id FROM devices WHERE last_seen_at <= ?1)").bind(stale),
    env.DB.prepare("DELETE FROM device_tokens WHERE device_id IN (SELECT id FROM devices WHERE last_seen_at <= ?1)").bind(stale),
    env.DB.prepare("DELETE FROM devices WHERE last_seen_at <= ?1").bind(stale),
  ]);
}
