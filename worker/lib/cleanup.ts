/** The daily sweep: expired sessions, links and transfer codes, and devices unused for 90 days with what they own. */

import { DEVICE_TTL_S } from "./limits";

export async function sweep(env: Env, now: number): Promise<void> {
  const stale = now - DEVICE_TTL_S;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?1").bind(now),
    env.DB.prepare("DELETE FROM email_tokens WHERE expires_at <= ?1").bind(now),
    env.DB.prepare("DELETE FROM device_transfers WHERE expires_at <= ?1").bind(now),
    env.DB.prepare("DELETE FROM maps WHERE owner_device_id IN (SELECT id FROM devices WHERE last_seen_at <= ?1)").bind(stale),
    env.DB.prepare("DELETE FROM device_tokens WHERE device_id IN (SELECT id FROM devices WHERE last_seen_at <= ?1)").bind(stale),
    env.DB.prepare("DELETE FROM devices WHERE last_seen_at <= ?1").bind(stale),
  ]);
}
