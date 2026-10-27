/**
 * The operator's view (D26, pb-D108): who has an account, how many phones use the app without
 * one, the maps and hunts, and how much the site is used.
 *
 * METADATA ONLY. Counts, dates and sizes, computed inside D1 so a map's document never crosses
 * into the Worker; never a map's contents, a position or a session. The one write erases an
 * account, for a deletion request that arrives by email (D22).
 *
 * INVISIBLE TO EVERYONE ELSE. A stranger, a signed-in user and an unknown admin path get the same
 * 404, so the surface cannot be found by probing it. An admin is an address in `ADMIN_EMAILS`,
 * compared with the session's, which was verified at sign-in.
 */

import { eraseAccount } from "./account";
import { fail, json, readJson } from "./http";
import { usageDay } from "./usage";

/** Newest first; a bound on the response. */
export const ADMIN_USER_LIMIT = 500;

const DAY_S = 24 * 60 * 60;

/** How far back the charts reach. */
export const SERIES_DAYS = 90;

/** An account's footprint, shared by the list and the drill-down so the two agree. */
const USER_COLUMNS = `
  u.id, u.email, u.display_name, u.created_at, u.last_login_at, u.last_seen_at,
  (SELECT COUNT(*) FROM maps m WHERE m.owner_user_id = u.id) AS maps,
  (SELECT COUNT(*) FROM maps m WHERE m.owner_user_id = u.id AND m.share_slug IS NOT NULL) AS shared,
  (SELECT COALESCE(SUM(length(CAST(m.doc AS BLOB))), 0) FROM maps m WHERE m.owner_user_id = u.id) AS bytes,
  (SELECT MAX(m.updated_at) FROM maps m WHERE m.owner_user_id = u.id) AS last_map_at`;

export async function adminStats(env: Env, now: number): Promise<Response> {
  // Whole UTC days, today included.
  const since = now - (now % DAY_S) - (SERIES_DAYS - 1) * DAY_S;
  const [totals, users, signups, mapsCreated, before, methods, usage] = await env.DB.batch([
    env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM users) AS users,
         (SELECT COUNT(*) FROM users WHERE created_at >= ?2) AS signups_7d,
         (SELECT COUNT(*) FROM users WHERE created_at >= ?3) AS signups_30d,
         (SELECT COUNT(*) FROM users WHERE last_seen_at >= ?1) AS active_1d,
         (SELECT COUNT(*) FROM users WHERE last_seen_at >= ?2) AS active_7d,
         (SELECT COUNT(*) FROM users WHERE last_seen_at >= ?3) AS active_30d,
         (SELECT COUNT(*) FROM devices) AS devices,
         (SELECT COUNT(*) FROM devices WHERE created_at >= ?2) AS devices_new_7d,
         (SELECT COUNT(*) FROM devices WHERE last_seen_at >= ?2) AS devices_active_7d,
         (SELECT COUNT(*) FROM maps) AS maps,
         (SELECT COUNT(*) FROM maps WHERE owner_device_id IS NOT NULL) AS maps_on_devices,
         (SELECT COUNT(*) FROM maps WHERE created_at >= ?2) AS maps_created_7d,
         (SELECT COUNT(*) FROM maps WHERE updated_at >= ?2) AS maps_updated_7d,
         (SELECT COUNT(*) FROM maps WHERE share_slug IS NOT NULL) AS shared,
         (SELECT COUNT(*) FROM hunts WHERE expires_at > ?4) AS hunts_live,
         (SELECT COUNT(*) FROM sessions WHERE expires_at > ?4) AS sessions,
         (SELECT COALESCE(SUM(length(CAST(doc AS BLOB))), 0) FROM maps) AS bytes`,
    ).bind(now - DAY_S, now - 7 * DAY_S, now - 30 * DAY_S, now),
    env.DB.prepare(`SELECT ${USER_COLUMNS} FROM users u ORDER BY u.created_at DESC LIMIT ?1`).bind(ADMIN_USER_LIMIT),
    // Per UTC day, only the days that had any; the page fills the gaps with zero.
    env.DB.prepare(
      `SELECT date(created_at, 'unixepoch') AS day, COUNT(*) AS n FROM users WHERE created_at >= ?1 GROUP BY day ORDER BY day`,
    ).bind(since),
    env.DB.prepare(
      `SELECT date(created_at, 'unixepoch') AS day, COUNT(*) AS n FROM maps WHERE created_at >= ?1 GROUP BY day ORDER BY day`,
    ).bind(since),
    env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE created_at < ?1").bind(since),
    env.DB.prepare(
      `SELECT
         COALESCE(SUM(g AND NOT p), 0) AS google,
         COALESCE(SUM(p AND NOT g), 0) AS password,
         COALESCE(SUM(g AND p), 0) AS both
       FROM (SELECT password_hash IS NOT NULL AS p,
                    EXISTS (SELECT 1 FROM identities i WHERE i.user_id = u.id) AS g
               FROM users u)`,
    ),
    env.DB.prepare("SELECT day, event, n FROM usage_daily WHERE day >= ?1 ORDER BY day").bind(usageDay(since)),
  ]);

  return json({
    totals: totals.results[0],
    users: users.results,
    series: {
      since,
      days: SERIES_DAYS,
      signups: signups.results,
      maps: mapsCreated.results,
      usersBefore: (before.results[0] as { n: number }).n,
    },
    methods: methods.results[0],
    usage: usage.results,
  });
}

export async function adminUser(env: Env, now: number, userId: string): Promise<Response> {
  const [user, maps] = await env.DB.batch([
    env.DB.prepare(`SELECT ${USER_COLUMNS} FROM users u WHERE u.id = ?1`).bind(userId),
    // json_valid first: json_array_length on a malformed document is an error that would fail
    // the whole page.
    env.DB.prepare(
      `SELECT m.id, m.name, m.share_slug, m.version, m.created_at, m.updated_at,
              length(CAST(m.doc AS BLOB)) AS bytes,
              CASE WHEN json_valid(m.doc) THEN json_array_length(m.doc, '$.features') END AS features,
              EXISTS (SELECT 1 FROM hunts h WHERE h.map_id = m.id AND h.expires_at > ?2) AS hunting
         FROM maps m WHERE m.owner_user_id = ?1 ORDER BY m.updated_at DESC`,
    ).bind(userId, now),
  ]);
  if (user.results.length === 0) return fail("not_found", 404);
  return json({ user: user.results[0], maps: maps.results });
}

/**
 * Erasing someone else's account (D22). The request repeats that account's address, as the
 * owner's own delete does, so a stale page or a mistyped id cannot take the wrong one. Logged
 * by id only: the log outlives the account, and the address was the personal data.
 */
export async function adminDeleteUser(env: Env, request: Request, userId: string): Promise<Response> {
  const user = await env.DB.prepare("SELECT email FROM users WHERE id = ?1").bind(userId).first<{ email: string }>();
  if (!user) return fail("not_found", 404);
  const confirm = (await readJson(request))?.confirm;
  if (typeof confirm !== "string" || confirm.trim().toLowerCase() !== user.email) return fail("confirmation_mismatch", 400);
  await eraseAccount(env, userId, user.email);
  console.log("admin erased account", userId);
  return json({ ok: true });
}
