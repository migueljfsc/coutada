/**
 * Maps in D1 (D8): owned by a user or a device, validated by the same schema as the browser (D7),
 * written with optimistic concurrency, and shown read-only by a view link.
 */

import { parseMapDoc } from "../../src/doc/schema";
import { randomCode, newId } from "./crypto";
import { fail, json, limited, readJson } from "./http";
import { MAX_MAP_REQUEST_BYTES, MAX_MAPS_PER_DEVICE, MAX_MAPS_PER_USER, SLUG_ALPHABET, SLUG_ATTEMPTS, SLUG_LENGTH } from "./limits";
import { huntOnMap } from "./hunts";
import { ownerColumn, principalKey, type Principal } from "./principal";

export interface MapCtx {
  env: Env;
  request: Request;
  principal: Principal;
  now: number;
}

const cap = (p: Principal) => (p.kind === "user" ? MAX_MAPS_PER_USER : MAX_MAPS_PER_DEVICE);

async function writeAllowed(ctx: MapCtx): Promise<boolean> {
  return !(await limited(ctx.env.MAP_LIMIT, [`map:${principalKey(ctx.principal)}`]));
}

export async function listMaps(ctx: MapCtx): Promise<Response> {
  const [column, owner] = ownerColumn(ctx.principal);
  const { results } = await ctx.env.DB.prepare(
    `SELECT id, name, version, share_slug, updated_at FROM maps WHERE ${column} = ?1 ORDER BY updated_at DESC`,
  )
    .bind(owner)
    .all();
  return json({ maps: results, limit: cap(ctx.principal) });
}

export async function createMap(ctx: MapCtx): Promise<Response> {
  if (!(await writeAllowed(ctx))) return fail("rate_limited", 429);
  const doc = parseMapDoc((await readJson(ctx.request, MAX_MAP_REQUEST_BYTES))?.doc);
  if (!doc) return fail("invalid_document", 400);

  const [column, owner] = ownerColumn(ctx.principal);
  const id = newId();
  // The cap is in the statement: a count then an insert would let two requests both fit.
  const result = await ctx.env.DB.prepare(
    `INSERT INTO maps (id, ${column}, name, doc, version, created_at, updated_at)
     SELECT ?1, ?2, ?3, ?4, 1, ?5, ?5
      WHERE (SELECT count(*) FROM maps WHERE ${column} = ?2) < ?6`,
  )
    .bind(id, owner, doc.coutada.name, JSON.stringify(doc), ctx.now, cap(ctx.principal))
    .run();
  if (result.meta.changes === 0) return fail("map_limit_reached", 409);
  return json({ map: { id, name: doc.coutada.name, version: 1, updated_at: ctx.now } }, 201);
}

export async function getMap(ctx: MapCtx, id: string): Promise<Response> {
  const [column, owner] = ownerColumn(ctx.principal);
  const row = await ctx.env.DB.prepare(
    `SELECT id, name, doc, version, share_slug, updated_at FROM maps WHERE id = ?1 AND ${column} = ?2`,
  )
    .bind(id, owner)
    .first<{ id: string; name: string; doc: string; version: number; share_slug: string | null; updated_at: number }>();
  return row ? json({ map: { ...row, doc: JSON.parse(row.doc) } }) : fail("not_found", 404);
}

/** The version is in the WHERE clause: a read-then-write would leave a gap for the other tab. */
export async function updateMap(ctx: MapCtx, id: string): Promise<Response> {
  if (!(await writeAllowed(ctx))) return fail("rate_limited", 429);
  const body = await readJson(ctx.request, MAX_MAP_REQUEST_BYTES);
  const doc = parseMapDoc(body?.doc);
  const version = body?.version;
  if (!doc) return fail("invalid_document", 400);
  if (typeof version !== "number" || !Number.isInteger(version)) return fail("invalid_version", 400);

  // While a hunt runs on the map, its edits go through the hunt, which writes them back (D8, D12).
  if (await huntOnMap(ctx.env, id, ctx.now)) return fail("hunt_active", 409);

  const [column, owner] = ownerColumn(ctx.principal);
  const result = await ctx.env.DB.prepare(
    `UPDATE maps SET doc = ?1, name = ?2, version = version + 1, updated_at = ?3
      WHERE id = ?4 AND ${column} = ?5 AND version = ?6`,
  )
    .bind(JSON.stringify(doc), doc.coutada.name, ctx.now, id, owner, version)
    .run();

  if (result.meta.changes === 0) {
    const current = await ctx.env.DB.prepare(`SELECT version FROM maps WHERE id = ?1 AND ${column} = ?2`)
      .bind(id, owner)
      .first<{ version: number }>();
    return current ? json({ error: "version_conflict", version: current.version }, 409) : fail("not_found", 404);
  }
  return json({ map: { id, version: version + 1, updated_at: ctx.now } });
}

export async function deleteMap(ctx: MapCtx, id: string): Promise<Response> {
  const [column, owner] = ownerColumn(ctx.principal);
  const result = await ctx.env.DB.prepare(`DELETE FROM maps WHERE id = ?1 AND ${column} = ?2`).bind(id, owner).run();
  return result.meta.changes === 0 ? fail("not_found", 404) : json({ ok: true });
}

/** Mints a view link, or returns the one the map already has: a sent link must keep working. */
export async function publishMap(ctx: MapCtx, id: string): Promise<Response> {
  const [column, owner] = ownerColumn(ctx.principal);
  const map = await ctx.env.DB.prepare(`SELECT share_slug FROM maps WHERE id = ?1 AND ${column} = ?2`)
    .bind(id, owner)
    .first<{ share_slug: string | null }>();
  if (!map) return fail("not_found", 404);
  if (map.share_slug) return json({ slug: map.share_slug });

  for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt++) {
    const slug = randomCode(SLUG_ALPHABET, SLUG_LENGTH);
    try {
      await ctx.env.DB.prepare("UPDATE maps SET share_slug = ?1 WHERE id = ?2").bind(slug, id).run();
      return json({ slug });
    } catch {
      // The unique index decides a collision; try another slug.
    }
  }
  return fail("slug_unavailable", 503);
}

/** Withdraws the link; publishing again mints a new one, so a withdrawn link stays dead. */
export async function unpublishMap(ctx: MapCtx, id: string): Promise<Response> {
  const [column, owner] = ownerColumn(ctx.principal);
  const result = await ctx.env.DB.prepare(`UPDATE maps SET share_slug = NULL WHERE id = ?1 AND ${column} = ?2`)
    .bind(id, owner)
    .run();
  return result.meta.changes === 0 ? fail("not_found", 404) : json({ ok: true });
}

/** The one sessionless read: the map as it is now, and nothing about who owns it. */
export async function readShare(env: Env, slug: string): Promise<Response> {
  const row = await env.DB.prepare("SELECT name, doc FROM maps WHERE share_slug = ?1").bind(slug).first<{ name: string; doc: string }>();
  return row ? json({ share: { name: row.name, doc: JSON.parse(row.doc) } }) : fail("not_found", 404);
}
