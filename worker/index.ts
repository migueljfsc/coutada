/**
 * Coutada Worker — the API surface. The SPA is served by the static-asset layer ahead of this
 * script (`run_worker_first` in wrangler.jsonc), so a page load never reaches here.
 *
 * `Env` is generated from wrangler.jsonc by `pnpm types`, with the secrets in secrets.d.ts.
 */

import { claim, deleteAccount, me } from "./lib/account";
import { adminDeleteUser, adminStats, adminUser } from "./lib/admin";
import { login, register, requestReset, resetPassword, verifyEmail, type AuthCtx } from "./lib/auth";
import { sweep } from "./lib/cleanup";
import { readCookie } from "./lib/cookies";
import { createDevice, deleteDevice, redeemTransfer, renameDevice, resolveDevice, startTransfer } from "./lib/devices";
import {
  authorizeUrl,
  clearedNextCookie,
  clearedOauthCookie,
  exchangeCode,
  newOauthChallenge,
  NEXT_COOKIE,
  nextCookie,
  OAUTH_COOKIE,
  oauthCookie,
  parseOauthCookie,
  safeNext,
} from "./lib/google";
import { timingSafeEqual } from "./lib/crypto";
import { fail, json, secured } from "./lib/http";
import { connectHunt, createHunt, joinHunt } from "./lib/hunts";
import { createMap, deleteMap, getMap, listMaps, publishMap, readShare, unpublishMap, updateMap, type MapCtx } from "./lib/maps";
import { isAdmin } from "./lib/operator";
import { resolvePrincipal } from "./lib/principal";
import { clearedSessionCookie, createSession, destroySession, resolveSession, sessionCookie, SESSION_TTL_S } from "./lib/session";
import { countUsage } from "./lib/usage";
import { userForGoogleIdentity } from "./lib/users";

export { Hunt } from "./hunt/object";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return secured(await route(request, env, ctx));
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(sweep(env, Math.floor(Date.now() / 1000)));
  },
} satisfies ExportedHandler<Env>;

const ID = "([A-Za-z0-9_-]{22})";
const MAP = new RegExp(`^/api/maps/${ID}$`);
const MAP_PUBLISH = new RegExp(`^/api/maps/${ID}/publish$`);
const SHARE = /^\/api\/shares\/([2-9bcdfghjkmnpqrstvwxz]{8})$/;
const HUNT_WS = new RegExp(`^/api/hunts/${ID}/ws$`);

/** Sign-in by Google ends in a navigation, so a failure is a query parameter the page can show. */
function backToApp(origin: string, error?: string): Response {
  const headers = new Headers({ location: error ? `${origin}/?auth_error=${encodeURIComponent(error)}` : `${origin}/`, "cache-control": "no-store" });
  headers.append("set-cookie", clearedOauthCookie());
  headers.append("set-cookie", clearedNextCookie());
  return new Response(null, { status: 302, headers });
}

async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

  // One clock reading per request, passed down.
  const now = Math.floor(Date.now() / 1000);
  const auth = (): AuthCtx => ({ env, request, waitUntil: (p) => ctx.waitUntil(p), origin: url.origin, now });

  switch (`${request.method} ${url.pathname}`) {
    case "GET /api/me":
      return me(env, request, now);

    case "DELETE /api/me": {
      const user = await resolveSession(env, request, now);
      return user ? deleteAccount(env, request, user) : fail("unauthorized", 401);
    }

    case "POST /api/me/claim": {
      const user = await resolveSession(env, request, now);
      const device = await resolveDevice(env, request, now);
      if (!user) return fail("unauthorized", 401);
      return device ? claim(env, user, device) : fail("no_device", 409);
    }

    case "POST /api/auth/logout":
      await destroySession(env, request);
      return json({ ok: true }, 200, { "set-cookie": clearedSessionCookie() });

    case "POST /api/auth/register":
      return register(auth());
    case "POST /api/auth/verify":
      return verifyEmail(auth());
    case "POST /api/auth/login":
      return login(auth());
    case "POST /api/auth/reset/request":
      return requestReset(auth());
    case "POST /api/auth/reset":
      return resetPassword(auth());

    case "GET /api/auth/google/start": {
      const { state, verifier } = newOauthChallenge();
      const headers = new Headers({
        location: await authorizeUrl(env.GOOGLE_CLIENT_ID, url.origin, state, verifier),
        "cache-control": "no-store",
      });
      headers.append("set-cookie", oauthCookie(state, verifier));
      headers.append("set-cookie", nextCookie(safeNext(url.searchParams.get("next"))));
      return new Response(null, { status: 302, headers });
    }

    case "GET /api/auth/google/callback": {
      const denied = url.searchParams.get("error");
      if (denied) return backToApp(url.origin, denied);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const challenge = parseOauthCookie(readCookie(request.headers.get("cookie"), OAUTH_COOKIE));
      // The state check is the CSRF defence of the sign-in.
      if (!code || !state || !challenge || !timingSafeEqual(state, challenge.state)) return backToApp(url.origin, "invalid_state");

      let userId: string;
      try {
        const identity = await exchangeCode(env, code, url.origin, challenge.verifier);
        userId = (await userForGoogleIdentity(env, identity, now)).id;
      } catch (cause) {
        return backToApp(url.origin, cause instanceof Error ? cause.message : "sign_in_failed");
      }

      const { token } = await createSession(env, userId, now);
      const next = safeNext(decodeURIComponent(readCookie(request.headers.get("cookie"), NEXT_COOKIE) ?? ""));
      const headers = new Headers({ location: `${url.origin}${next}${next.includes("?") ? "&" : "?"}welcome=1`, "cache-control": "no-store" });
      headers.append("set-cookie", sessionCookie(token, SESSION_TTL_S));
      headers.append("set-cookie", clearedOauthCookie());
      headers.append("set-cookie", clearedNextCookie());
      return new Response(null, { status: 302, headers });
    }

    case "POST /api/device":
      return createDevice(env, request, now);
    case "POST /api/device/transfer/redeem":
      return redeemTransfer(env, request, now);
    case "PATCH /api/device":
    case "DELETE /api/device":
    case "POST /api/device/transfer": {
      const device = await resolveDevice(env, request, now);
      if (!device) return fail("unauthorized", 401);
      if (request.method === "PATCH") return renameDevice(env, request, device);
      if (request.method === "DELETE") return deleteDevice(env, request, device);
      return startTransfer(env, device, now);
    }

    case "POST /api/hunts": {
      const principal = await resolvePrincipal(env, request, now);
      return principal ? createHunt(env, request, principal, now) : fail("unauthorized", 401);
    }
    // Anonymous usage counters (D26): no session, a fixed list of events, capped rows.
    case "POST /api/usage":
      return countUsage(env, request, now);

    case "POST /api/hunts/join":
      return joinHunt(env, request, await resolvePrincipal(env, request, now), now);

    case "GET /api/maps":
    case "POST /api/maps": {
      const principal = await resolvePrincipal(env, request, now);
      if (!principal) return fail("unauthorized", 401);
      const mapCtx: MapCtx = { env, request, principal, now };
      return request.method === "GET" ? listMaps(mapCtx) : createMap(mapCtx);
    }
  }

  const admin = await adminRoute(env, request, url, now);
  if (admin) return admin;

  const huntWs = HUNT_WS.exec(url.pathname);
  if (huntWs && request.method === "GET") return connectHunt(env, request, huntWs[1], url.origin);

  const share = SHARE.exec(url.pathname);
  if (share && request.method === "GET") return readShare(env, share[1]);

  const map = MAP.exec(url.pathname);
  const publish = MAP_PUBLISH.exec(url.pathname);
  if (map || publish) {
    const handlers: Record<string, (c: MapCtx, id: string) => Promise<Response>> = map
      ? { GET: getMap, PUT: updateMap, DELETE: deleteMap }
      : { POST: publishMap, DELETE: unpublishMap };
    const handle = handlers[request.method];
    if (!handle) return fail("not_found", 404);
    // Authenticated last, so an unknown path never costs a lookup.
    const principal = await resolvePrincipal(env, request, now);
    if (!principal) return fail("unauthorized", 401);
    return handle({ env, request, principal, now }, (map ?? publish)![1]);
  }

  return fail("not_found", 404);
}

const ADMIN_STATS = /^\/api\/admin\/stats$/;
const ADMIN_USER = new RegExp(`^/api/admin/users/${ID}$`);

/**
 * The operator's surface (D26). Reads are GETs; the one write is DELETE on a user. Anything under
 * /api/admin/ that is not one of those, not signed in or not an admin answers the same 404, so
 * none of it can be told apart from a path that does not exist.
 */
async function adminRoute(env: Env, request: Request, url: URL, now: number): Promise<Response | null> {
  if (!url.pathname.startsWith("/api/admin/")) return null;
  const userId = ADMIN_USER.exec(url.pathname)?.[1];
  const read = request.method === "GET" && (ADMIN_STATS.test(url.pathname) || userId !== undefined);
  const erase = request.method === "DELETE" && userId !== undefined;
  if (!read && !erase) return fail("not_found", 404);
  if (!isAdmin(await resolveSession(env, request, now), env.ADMIN_EMAILS)) return fail("not_found", 404);
  if (erase) return adminDeleteUser(env, request, userId);
  return userId ? adminUser(env, now, userId) : adminStats(env, now);
}
