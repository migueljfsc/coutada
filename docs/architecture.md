# Coutada — Architecture

A mobile-first PWA for coordinating a hunt on a satellite map: the host draws named spots, routes,
lines of posts and zones; members open it on their phones, see themselves, navigate to a spot or
follow a route; during a hunt everyone sees everyone's live position and trail. Why:
[`decisions.md`](decisions.md). Phases: [`implementation-plan.md`](implementation-plan.md).

## Glossary

| term | meaning |
|---|---|
| coutada | a hunting estate; here, the app |
| montaria / batida | driven hunt: hunters stand at posts while beaters and dogs push game |
| porta | a hunter's post (stand) |
| armada | a line of portas |
| mancha | a block of cover that is driven |
| batedor / matilheiro | beater / dog handler — moves through the mancha |
| caça de salto | walked-up hunt (here: perdizes, partridge), the group in a moving line |
| host / member | the hunt's creator, who edits / everyone else, who views and shares position |

## 1. Shape

```
                      coutada.migueljfsc.dev  (one origin)
 ┌───────────────────────────────────────────────────────────────────────────┐
 │ Worker                                                                    │
 │   static assets (dist/) ── free, never invokes the script                 │
 │   /api/*  ── auth, devices, maps, shares, trails, hunts (run_worker_first)│
 │   /api/hunts/:id/ws ──upgrade──▶ Hunt DO (jurisdiction "eu")              │
 └──────────┬──────────────────────────────────────┬─────────────────────────┘
            │                                      │
        D1 (accounts, devices, maps,          Hunt Durable Object, one per hunt
            hunts index, trails)                SQLite: members, map doc, observations,
                                                lock, alarm — never positions
                                                memory: positions relay, trails cache

 Phone (PWA)
   MapLibre ◀── tiles ── DGT WMS (ortosat2023, ortos2021), Esri (keyed)  — direct, CORS *
   service worker: app shell + prefetched tiles (Cache Storage)
   IndexedDB: opened maps, own trail during a hunt
   geolocation.watchPosition, Wake Lock, DeviceOrientation
```

Tiles never pass through the Worker: they would spend the request budget one tile at a time.

## 2. Repository layout

```
docs/                       architecture, implementation plan, decisions
src/geo/                    pure: distance, bearing, cross-track, route progress, trail filter
                            and length, simplification, tile covers for prefetch
src/doc/                    pure: MapDoc types, zod schema (shared with the Worker), migrate,
                            operations (add/move/renumber/delete), feature catalogue
src/map/                    MapLibre setup, imagery sources (one URL builder per source), layers,
                            icons, attribution
src/draw/                   the editor: tools, selection, undo — a pure reducer (D20)
src/live/                   WebSocket client, reconnect, position sampler (D15), own trail store
src/nav/                    navigate-to-pin and follow-route state over src/geo
src/offline/                prefetch planner and runner, map cache (IndexedDB)
src/sw.ts                   service worker, built as its own entry
src/share/                  storage.ts (the ONLY localStorage access, never throws),
                            password.ts (browser KDF, pb-D109)
src/i18n/                   PT and EN; en.ts declares the keys
src/pages/                  Landing, Map (view/edit/hunt), Shared map, Join, Trails, Admin (P4)
src/components/             React chrome; ui/ holds primitives
worker/index.ts             routes /api/*
worker/lib/                 by concern, copied from pitchboard where it exists: auth, session,
                            password, google, turnstile, limits, crypto, http, headers, mail,
                            cleanup, account; new: devices, maps, shares, trails, hunts
worker/hunt/                Hunt Durable Object: object.ts (runtime shell), state.ts (pure
                            reducer over messages), protocol.ts (message types, shared with src/)
worker/migrations/          D1, applied by CI before deploy
wrangler.jsonc              bindings, DO class and migration, rate limiters, cron
infrastructure/terraform/cloudflare/   OpenTofu — D1, Turnstile, mail DNS
```

## 3. The map document

`src/doc/types.ts` is the schema; `schema.ts` is its zod validator, imported by the Worker. One
GeoJSON FeatureCollection (D7):

```ts
type MapDoc = {
  type: "FeatureCollection";
  coutada: { v: 1; name: string; imagery?: ImageryId; view?: { center: [number, number]; zoom: number } };
  features: MapFeature[];
};

type MapFeature =
  | Feature<Point,      Props & { kind: "pin";   type: PinType;   n?: number; armada?: Id }>
  | Feature<LineString, Props & { kind: "route"; type: RouteType }>
  | Feature<Polygon,    Props & { kind: "zone";  type: ZoneType }>;

type Props    = { name?: string; note?: string; color?: PaletteKey; updatedAt: number };
type PinType  = "porta" | "landmark" | "gate" | "parking" | "meeting" | "danger" | "water";
type RouteType = "walk" | "armada";
type ZoneType = "mancha" | "no_shoot" | "boundary";
type ObservationType = "covey" | "game_seen" | "game_down" | "dog";   // hunt-scoped, D11
```

`id` is on the Feature (22-char base64url). Coordinates `[lon, lat]`, 6 decimals. Names ≤ 60
characters, notes ≤ 500. Caps in D7. Absent optional properties mean the old behaviour.

## 4. D1 schema

Timestamps are unix seconds. Tables naming a person are on `deleteAccount`'s list (D22).

```sql
-- From pitchboard, in their final shape (fresh database, no history to replay)
users        (id PK, email UNIQUE, password_hash NULL, display_name, created_at,
              last_login_at, last_seen_at)
sessions     (id PK = sha256(token), user_id → users CASCADE, created_at, expires_at)
identities   (provider, subject, user_id → users CASCADE, created_at, PK(provider, subject))
email_tokens (id PK = sha256(token), purpose CHECK IN ('verify','reset'), email,
              password_hash NULL, created_at, expires_at)

-- Anonymous identity (D5)
devices      (id PK = sha256(token), username, created_at, last_seen_at)
device_transfers (id PK = sha256(code), device_id → devices CASCADE, expires_at)

-- Maps (D7, D8)
maps         (id PK, owner_user_id NULL → users CASCADE, owner_device_id NULL → devices CASCADE,
              name, doc TEXT, version INTEGER DEFAULT 1, share_slug NULL, created_at, updated_at,
              CHECK ((owner_user_id IS NULL) != (owner_device_id IS NULL)))
              UNIQUE INDEX maps_share_slug ON maps(share_slug) WHERE share_slug IS NOT NULL

-- Active hunts only; the row is the code index (D9, D10)
hunts        (id PK, code NULL, map_id → maps CASCADE, type CHECK IN ('montaria','salto'),
              host_user_id NULL, host_device_id NULL, created_at, expires_at)
              UNIQUE INDEX hunts_code ON hunts(code) WHERE code IS NOT NULL

-- Saved own trails (D14)
trails       (id PK, owner_user_id NULL, owner_device_id NULL, map_id NULL → maps SET NULL,
              hunt_type, started_at, ended_at, distance_m, points INTEGER, line TEXT,
              created_at, CHECK one owner)

-- Phase 4 (pb-D119)
usage_daily  (day, event, n, PK(day, event)) WITHOUT ROWID
```

`trails.line` is an encoded polyline (precision 5) of `[lon, lat]` plus a parallel delta-encoded
seconds array — a 6-hour walk is tens of KB, one row.

## 5. Identity

Every API request resolves to a **principal**: `{ kind: "user", id }` from `ct_session`, else
`{ kind: "device", id }` from `ct_device`, else none. Ownership checks compare a row's owner
column to the principal, in the statement (`WHERE id = ?1 AND owner_user_id = ?2`), never after
reading.

```
first write ── POST /api/device {username, turnstile} ──▶ Set-Cookie ct_device (400 d)
                                                        devices row, last_seen_at slides daily
sign in (password / Google) ──▶ /api/me { user, claimable: {maps, trails} }
                              └─ offer ──▶ POST /api/me/claim ──▶ one batch: move rows,
                                                                 delete device, clear cookie
other browser ── POST /api/device/transfer ──▶ code (10 min, single use)
              ── POST /api/device/transfer/redeem {code} ──▶ Set-Cookie ct_device (same device)
```

Account code is pitchboard's (`worker/lib/{auth,session,password,google,turnstile,crypto,http,
headers,mail}.ts`, `src/share/password.ts`), renamed and stripped of its narrative comments.

## 6. Hunts

### Lifecycle

```
host: POST /api/hunts {mapId, type}
      Worker: owns map? no active hunt? → hunts row (code, expires_at = now + 18 h)
              → stub.init({ map doc, type, host }) → { huntId, code, memberId, token }

member: POST /api/hunts/join {code, username, turnstile}
      Worker: JOIN_LIMIT(ip) → Turnstile → hunts row by code, unexpired
              → stub.join({ username, principal kind }) → { huntId, memberId, token }
              (unknown code, expired, locked, full: all 404 not_found)

both: GET /api/hunts/:id/ws (Upgrade)
      Worker: Origin must be the app's → stub.fetch → ctx.acceptWebSocket
      first message must be hello{token} within 10 s, else close 4001

end:  host `hunt.end` or alarm at expires_at
      → write doc to D1 → broadcast ended → close all (4004) → storage.deleteAll()
      → Worker deletes hunts row
```

### Hunt types (D11, D15)

| | montaria / batida | salto |
|---|---|---|
| roles | porta, batedor | member |
| interval moving / stationary | porta 10 s·25 m / 60 s; batedor 5 s·15 m / 30 s | 5 s·15 m / 30 s |
| trails | batedor on, porta off | on |
| distance walked | shown for batedores | shown for everyone |
| suggested pins | porta, meeting, parking, danger, gate | meeting, water, gate, parking, danger |
| suggested routes / zones | armada; mancha, no_shoot, boundary | walk; boundary, no_shoot |
| observations | game_seen, game_down, dog | covey, game_seen, game_down, dog |

"Suggested" orders the palette; every type stays available.

### The object

`worker/hunt/object.ts` is a thin shell: it decodes a frame, calls
`state.ts`'s `reduce(state, member, message, now) → { state, sends, effects }`, and performs the
sends (to one, to all, to all but one) and effects (store members, store doc, schedule write-back,
close a socket). Everything decidable is in the reducer and tested there.

| | where | survives hibernation | survives the hunt |
|---|---|---|---|
| members (token digest, name, role, kicked) | DO SQLite | yes | no — deleteAll |
| map doc + rev | DO SQLite, written back to D1 | yes | in D1 |
| observations | DO SQLite | yes | only if kept |
| lock, code, expiry | DO SQLite + alarm | yes | no |
| last position per member | socket attachment | yes | no |
| trails | memory; each phone holds its own | no — re-requested | only if saved by its owner |

The runtime answers `ping` with `pong` (`setWebSocketAutoResponse`) without waking the object.

## 7. WebSocket protocol

JSON text frames, one message each, discriminated by `t`. `worker/hunt/protocol.ts` declares them
and both sides import it. Positions are `[lon, lat]` at 5 decimals (~1 m); times are ms since epoch.

**Client → object**

| t | fields | who |
|---|---|---|
| `hello` | `v: 1, token, trailSince?` | all, first frame |
| `pos` | `c, acc, hdg?, spd?, at` | all |
| `away` / `back` | — | all (page hidden / shown) |
| `trail.sync` | `pts: [lon, lat, t][]` (own trail from `trailSince` or the start) | all |
| `obs.put` / `obs.del` | `obs: { id, type, c, note? }` / `id` | all (own); host (any) |
| `role` | `member?, role` | self, or host for anyone |
| `feature.put` / `feature.del` | `f` / `id`, `base: rev` | host |
| `obs.keep` | `id` | host |
| `hunt.lock` | `on` | host |
| `hunt.kick` | `member` | host |
| `hunt.rotate` / `hunt.end` | — | host |

**Object → client**

| t | fields |
|---|---|
| `welcome` | `you: { id, role, host }, now, hunt: { type, code, locked, endsAt }, members[], doc, rev, obs[], trails: { [member]: pts }` |
| `member` | `m: { id, name, role, host, verified, online, away }` (join, change, leave) |
| `pos` | `m, c, acc, hdg?, spd?, at, rt` (`rt`: object receive time) |
| `trail` | `m, pts` (a member's sync, for gap filling) |
| `trail.request` | `since?` — the object woke without trails |
| `feature.put` / `feature.del` | `f` / `id`, `rev` |
| `feature.reject` | `f` (current), `rev` — stale `base` |
| `obs.put` / `obs.del` | `obs` / `id` |
| `hunt` | `code, locked, endsAt` |
| `ended` | `reason: "host" | "expired"` |
| `error` | `code` |

Close codes: 4001 unauthenticated, 4003 kicked, 4004 ended, 4008 over a limit. Limits per socket:
frames ≤ 64 KB (`trail.sync` ≤ 1 MB), ≤ 4 frames a second averaged over 10 s.

**Reconnect:** exponential backoff with jitter, `hello` with the same token and `trailSince` = the
last point the object acknowledged seeing; `welcome` replaces all live state. Positions taken while
disconnected are not queued — only the trail catches up.

## 8. Position, navigation and the phone

- `watchPosition({ enableHighAccuracy: true })` while the map is open; the dot shows the accuracy
  circle and heading. The sampler (D15) decides what is sent and what enters the trail.
- **Heading:** DeviceOrientation compass (`webkitCompassHeading` on iOS, which needs a permission
  asked from a tap), else GPS course while moving.
- **Navigate to pin:** distance and bearing from `src/geo`, an arrow rotated by bearing − heading,
  accuracy shown beside the distance; "arrived" within max(10 m, accuracy).
- **Follow route:** nearest point on the polyline, along-track progress, distance remaining,
  bearing to a point 30 m ahead along the line; **off route** when cross-track > max(25 m, 1.5 ×
  accuracy) for 10 s. Direction is chosen at start (nearest end) and reversible.
- **Wake Lock** is held while tracking and re-acquired on `visibilitychange`. Background location
  stops on iOS and Android; the `away` message tells the group.

## 9. Imagery and offline

```ts
tileUrl(source: ImageryId): string   // the ONE builder; map sources and prefetch both call it
// ortosat2023:
// https://ortos.dgterritorio.gov.pt/wms/ortosat2023?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap
//   &LAYERS=ortoSat2023-CorVerdadeira&STYLES=&CRS=EPSG:3857&BBOX={bbox-epsg-3857}
//   &WIDTH=512&HEIGHT=512&FORMAT=image/jpeg
```

Prefetch (D19): `src/geo` covers the map's bbox + 500 m at z10–18 with 512 px tiles, `src/offline`
substitutes each tile's bbox into the same template, fetches 4 at a time into Cache Storage
`tiles-<source>-v1`, and records the pack (map, source, bbox, zooms, count, bytes, date) in
IndexedDB. The service worker serves `tiles-*` cache-first, keeps DGT tiles viewed online in
`tiles-runtime-v1` (2,000 entries, oldest out), precaches the app shell and the font (D24)
from the build manifest, and never caches `/api/*`. Opened maps are kept in IndexedDB with their
version.

## 10. Worker API

`worker/index.ts` answers `/api/*`. Writes are JSON-only (the login-CSRF guard, pb-D109),
size-capped and zod-validated.

| Routes | |
|---|---|
| `GET/DELETE /api/me`, `POST /api/me/claim`, `POST /api/auth/logout` | session; erasure; claim (D6, D22) |
| `POST /api/auth/{register,verify,login,reset/request,reset}`, `GET /api/auth/google/{start,callback}` | pitchboard's (D4) |
| `POST/PATCH/DELETE /api/device`, `POST /api/device/transfer`, `POST /api/device/transfer/redeem` | anonymous identity (D5) |
| `GET/POST /api/maps`, `GET/PUT/PATCH/DELETE /api/maps/:id` | maps; PUT carries `version` (D8) |
| `POST/DELETE /api/maps/:id/publish`, `GET /api/shares/:slug` | view link (D8) |
| `POST /api/hunts`, `POST /api/hunts/join`, `GET /api/hunts/:id/ws` | hunts (D9, D10) |
| `GET/POST /api/trails`, `GET/DELETE /api/trails/:id` | saved own trails (D14) |
| `POST /api/usage`, `GET /api/admin/…` | phase 4 (pb-D119, pb-D108) |

Rate limiters (`ratelimits` in wrangler.jsonc, per location, 10 or 60 s periods): `AUTH_LIMIT`
(10/60 s), `JOIN_LIMIT` (5/60 s per address), `WRITE_LIMIT` (device creation, hunt creation,
transfers: 10/60 s per address). Daily cron: expired sessions, email tokens, device transfers,
expired devices with what they own, hunts past `expires_at` whose object did not clean up.

## 11. Security

- **Hunt codes are guessable by design;** the layers in D10 (alphabet, expiry, `JOIN_LIMIT`,
  Turnstile on every join, lock/kick/rotate, one answer for every failure) are the defence. What a
  successful guess yields is the live positions of armed people and the property's layout.
- **Cross-site WebSocket hijacking:** the upgrade is refused unless `Origin` is the app's origin,
  and the socket authenticates by token in its first frame, not by cookie.
- **Bearer values are stored as SHA-256 digests:** sessions, device tokens, transfer codes, member
  tokens, email tokens. Device and session cookies are HttpOnly, Secure, SameSite=Lax.
- **The device cookie is an account without a password.** Whoever holds it holds the anonymous
  maps; transfer codes are single-use and expire in 10 minutes; the UI says that signing up is the
  way to keep things safely.
- **View links expose a property's layout** to anyone with the slug; publishing is explicit,
  withdrawing kills the slug, and hunts and positions are never reachable from one.
- **Third-party tile servers** (DGT, Esri) see the user's address and the area viewed — stated on
  the privacy page. The Esri key is public, referrer-restricted and scoped to basemaps.
- **Positions are self-reported and spoofable;** members are a trusted group and the app is not a
  safety system (D17).
- **CSP** (pitchboard's `SECURITY_HEADERS`, extended): `img-src` and `connect-src` add
  `https://ortos.dgterritorio.gov.pt https://cartografia.dgterritorio.gov.pt` and the Esri tile
  host; `connect-src` adds `wss://coutada.migueljfsc.dev`; `worker-src 'self' blob:` for MapLibre;
  Turnstile as in pitchboard. **`Permissions-Policy` changes from pitchboard's:**
  `geolocation=(self), screen-wake-lock=(self)`, everything else off.
- **User text** (names, notes, observations) is rendered by React and MapLibre text layers, never
  as HTML. Imported files (phase 4) are size-capped and validated by the schema before use.
- **Abuse of the free tier** is bounded by caps (§12) and the rate limiters; a socket over its
  frame rate or size is closed with 4008.
- **No coordinate is logged** by the Worker or the object.

## 12. Free-tier budget

| resource | free limit | use | cap that holds it |
|---|---|---|---|
| Worker requests | 100k/day | API calls; tiles and assets are not requests | per-route limiters |
| Worker CPU | 10 ms/request | KDF in the browser (pb-D109); no server-side imagery | — |
| Worker subrequests | 50 external/invocation | Turnstile, Google, Resend: ≤ 2 | — |
| DO requests | 100k/day, WS messages at 20:1 | 30-member salto, 6 h, 5 s: ~130k frames ≈ 6.5k requests | 30 members, frame rate |
| DO duration | 13,000 GB-s/day | billed only while not hibernation-eligible; a fully awake 6 h hunt is 2,765 GB-s | 1 active hunt per principal, 18 h expiry |
| D1 | 5M rows read, 100k written/day, 5 GB | doc write-back debounced 5 s; sessions slide daily | map, trail and feature caps |
| Turnstile | free | joins, device creation, mail routes | — |
| Resend | 100/day, 3,000/month, 3 domains | verification and reset only | Turnstile, `AUTH_LIMIT` |
| Esri tiles | 2M basemap tiles/month | online viewing only | not prefetched |
| DGT | public service, no stated quota | viewing + per-phone prefetch, once per phone | 3,000 requests per pack, 4 in flight |

Worst case for DO duration (nothing hibernates) is ~4 six-hour hunts a day; with hibernation it is
dominated by message handling time.
