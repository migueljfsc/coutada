# Coutada — Decision Log

Why the design is what it is: each entry is the decision and the reasoning that still constrains
the code. Numbers are stable because code cites them. Pitchboard's decisions are cited as `pb-Dn`.
Architecture: [`architecture.md`](architecture.md); phases: [`implementation-plan.md`](implementation-plan.md).

---

## Foundations

## D1 — Stack and hosting follow pitchboard
Vite + React 19 + TypeScript strict + Tailwind 4, pnpm, Vitest, ESLint; one Cloudflare Worker
serving `dist/` as static assets, with `run_worker_first: ["/api/*"]` — the API and the hunt
WebSocket (`/api/hunts/:id/ws`) are the only paths that spend the request budget. OpenTofu owns
durable infra (D1, Turnstile widget, mail DNS); wrangler owns the deploy, the bindings, the D1
schema and the Durable Object class (pb-D40). `workers.dev` is off; the app is
`coutada.migueljfsc.dev`, one origin for cookies, OAuth, Turnstile and the WebSocket.

**No KV and no R2 in v1.** Nothing is published as an immutable blob, and offline imagery is not
redistributed (D16). R2 joins the stack only if a source with a redistribution licence is added.

## D2 — The map engine is pure and tested before React touches it
`src/geo/` (distance, bearing, cross-track, route progress, trail metrics, simplification, tile
covers) and `src/doc/` (the map document, its validator, its operations) have no DOM, React, clock
or randomness: time and ids are arguments. `worker/hunt/state.ts` is the hunt as a reducer over
messages, tested without the runtime. React, MapLibre and the Durable Object are shells around them.

## D3 — English and Portuguese, Portuguese first
pb-D38: a pure module returns a `Message`, never prose; `pt.ts` answers every key `en.ts` declares.
The default is the browser's language, falling back to Portuguese. Hunting vocabulary stays
Portuguese in both (porta, armada, mancha, batida, montaria, salto) — it is what the group says.

---

## Identity

## D4 — Accounts work exactly like pitchboard
pb-D109, pb-D110 and the Google flow, copied: the KDF runs in the browser (PBKDF2-SHA256, 600k),
the Worker stores `v2$salt$HMAC(PASSWORD_PEPPER, salt$key)`, no `users` row before the address is
verified, Turnstile on the two mail-sending routes, `AUTH_LIMIT` per client and per address,
JSON-only auth bodies, Resend from `noreply@coutada.migueljfsc.dev` (the free plan allows three
domains), sessions as SHA-256 digests sliding daily. What differs is only naming: the salt prefix
is `coutada:v1:`, cookies are `ct_*`. The salt prefix is frozen by a test vector from the first
commit.

## D5 — Anonymous use is first-class: a device token
Anyone can draw a map, host a hunt or join one without an account.

- **A device is an identity with a username**; each browser holding it has a 256-bit token in an
  HttpOnly, Secure, SameSite=Lax cookie `ct_device`, stored as its SHA-256 in `device_tokens` —
  the same shape as a session. One device, one token per browser, so a transfer can give a second
  browser a credential of its own.
- **A device is created on its first server write** (saving a map, hosting, joining), not on page
  load, through `POST /api/device` with a username and a Turnstile token. Browsing creates nothing.
- **The username** is 1–24 characters, NFC, trimmed, no control characters. It is a display name,
  not an identity: two devices may share one; a hunt may not (D10).
- **What a device may own:** up to 3 maps. Hunts are owned by nobody (D9).
- **Lifetime:** 90 days since last use. `last_seen_at` slides at most daily; the daily sweep deletes
  an expired device with everything it owns. The cookie's `Max-Age` is 400 days (Chrome's cap) and
  is not what expires the data — the row is.
- **Moving to another browser:** `POST /api/device/transfer` mints a single-use code, valid 10
  minutes, shown as text and as a QR of `/transfer?c=<code>`; redeeming it on the other browser sets
  the same device cookie there. On iOS a home-screen PWA has its own cookie jar, separate from
  Safari's, so this is how an anonymous map follows the user into the installed app. Redeeming
  mints that browser its own token; the code is stored as a digest, like every bearer value here.

## D6 — Claiming anonymous data is an offer, not a side effect of signing in
`/api/me` answers everybody with `{ user, device, claimable }`, never a 401. When a request
carries both a session and a device cookie, `claimable` says what the device owns. The client offers once per sign-in to move it into the account
(pb-D30's adoption pattern). `POST /api/me/claim` moves maps in one D1 batch — refused
whole if it would exceed the account's caps — then deletes the device row and clears the cookie.
Declining leaves the device as it was; it expires on its own clock.

Not automatic, because signing in on a borrowed phone must not sweep its owner's anonymous maps into
the visitor's account.

---

## Maps

## D7 — A map is one GeoJSON FeatureCollection
The document is RFC 7946 GeoJSON — WGS84, `[lon, lat]` — with the map's own fields in a foreign
member, so a map exports as GeoJSON with nothing to convert (D21).

```
{ type: "FeatureCollection",
  coutada: { v: 1, name, imagery?, view?: { center, zoom } },
  features: Feature[] }
```

Each feature's `id` is a 22-character random id (128 bits) and `properties` carry
`{ kind, type, name?, note?, color?, n?, armada?, updatedAt }`. `kind` is the geometry's role and
`type` its meaning:

| kind | geometry | types |
|---|---|---|
| `pin` | Point | `porta`, `landmark`, `gate`, `parking`, `meeting`, `danger`, `water` |
| `route` | LineString | `walk`, `armada` |
| `zone` | Polygon (no holes) | `mancha`, `no_shoot`, `boundary` |

A porta is a pin that may name its `armada` (a route id) and its number `n`; numbering along an
armada is an operation, never inferred at render time. `color` is a palette key, never a free hex.
Coordinates are rounded to 6 decimals (~0.1 m) on write. Caps: 500 features, 2,000 vertices per
feature, 256 KB serialised (`MAX_DOC_BYTES`), all checked by the shared zod schema in the browser
and the Worker.

**Absent is the old behaviour**, as in pitchboard: a new optional property needs no migration; a
real change bumps `coutada.v` and `src/doc/migrate.ts` converts before validation.

## D8 — Maps live in D1, owned by a user or a device, and can be shown by link
One row per map, `doc` as TEXT, `version` for optimistic concurrency (a write carries what it read;
409 on mismatch). Owner is exactly one of `owner_user_id` / `owner_device_id` (a CHECK). Caps: 50
maps per account, 3 per device.

**A view link** works like pb-D7's live link: publishing mints `/m/<slug>` (8 characters from
`23456789bcdfghjkmnpqrstvwxz`), showing the map as it is now, read-only; withdrawing clears the slug
and a new publish mints a new one. `GET /api/shares/:slug` is sessionless. It shows drawings only —
never a hunt, a position or a trail.

**While a hunt on a map is active, its REST writes answer 409 `hunt_active`.** Edits go through the
hunt (D12), which writes back; two writers to one document is the conflict this removes.

---

## Hunts

## D9 — One Durable Object per hunt, in the EU, gone when the hunt ends
`POST /api/hunts { mapId, type }` by the map's owner creates a `hunts` row (id, code, map, type,
expiry) and a `Hunt` object at `env.HUNT.jurisdiction("eu").idFromName(huntId)`. The object is
SQLite-backed (the only kind on the free plan) and uses the WebSocket Hibernation API.

**What the object stores:** the member list (token digests, names, roles), the map document while
the hunt runs, observations (D11), the lock flag and the expiry alarm. **What it never stores:**
positions and trails (D13).

**Ending:** the host ends it, or the alarm does at `expires_at` (18 hours after creation). The
object writes the document back to D1, broadcasts `ended`, closes every socket, and calls
`storage.deleteAll()`; the Worker deletes the `hunts` row, which frees the code. A principal hosts
at most one active hunt.

## D10 — Hunt codes: four characters, and guessing one is made expensive
A code is the only thing between a stranger and the live positions of armed people on a property
whose layout the map reveals. Four characters are short enough to read across a car bonnet and short
enough to guess, so the defence is layered:

1. **Alphabet without look-alikes or vowels:** `23456789BCDFGHJKMNPQRSTVWXZ` — no 0/O, 1/I/L, no
   vowels so no word is spelled. 27⁴ = 531,441 codes. Typed case-insensitively.
2. **A code exists only while its hunt is active,** and at most 18 hours. The `hunts` row is the
   index (a unique partial index on `code`); ending deletes it. With 20 hunts active at once — far
   above this project's use — one guess succeeds with probability 20 / 531,441 ≈ 1 in 26,600.
3. **Rate limited** per client address by the `JOIN_LIMIT` binding (5 per 60 s, per Cloudflare
   location, eventually consistent): ~7,200 guesses a day per address per location, ~0.27 expected
   hits a day at 20 active hunts — not enough alone.
4. **Turnstile on every join** (managed mode, usually invisible). Each guess spends a single-use
   token verified by `siteverify`, which is what makes a script's guesses cost what a person's do.
   Checked after the rate limit, before any lookup.
5. **The host sees every join** as it happens, and can **lock** the hunt (no new members; existing
   members still reconnect with their token), **kick** a member (socket closed with 4003, token
   revoked, name freed), and **rotate** the code (new code, old one dead at once).
6. **A failed join and a locked hunt answer the same** `404 not_found`, so a guess cannot tell a
   valid locked code from an unused one.

Joining returns `{ huntId, memberId, token }`; the token (256 bits, stored as a digest in the
object) is what the WebSocket authenticates with — offered as a subprotocol beside `coutada.v1`
and checked before the socket is accepted, so no unauthenticated socket is ever open — and what
reconnects after a dropped signal. A name already used in the hunt is suffixed ("João (2)")
rather than refused, which would confirm that a guessed code is live. A signed-in member's name
carries a mark the anonymous cannot fake. Cap: 30 members.

## D11 — Roles: the host edits, members see and share; members may add observations
- **Host** — whoever created the hunt; edits drawings, locks, kicks, rotates, ends.
- **Member** — sees everything, shares their position, and adds **observations**: hunt-scoped
  marks of a subject (a species from the catalogue, or a dog) and an event (`seen`, `flushed`,
  `down`). A member deletes their own; the host deletes any and may **keep** one, which turns it
  into a `game` pin of that species (a landmark for a dog). Unkept observations are deleted with
  the hunt.
- **Game pins name their species** (`species` on a `game` pin, nowhere else): partridge, quail,
  pheasant, pigeon, turtle dove, thrush, woodcock, duck, rabbit, hare, fox, mongoose, boar, red
  deer, fallow deer, roe deer, mouflon. Each wears its own silhouette (`src/map/species.ts`).
- **In a montaria, each member is `porta` or `batedor`** (batedor covers matilheiros): the role
  sets the update interval and whether a trail is drawn (D15). The host assigns it; a member may
  change their own. A salto has one role.

Members never edit the host's drawings.

## D12 — Drawings sync live through the hunt, host-authoritative
During a hunt the object holds the map document. The host sends `feature.put` / `feature.del`
carrying the document revision it was based on; the object applies it, bumps `rev`, broadcasts it,
and schedules a write-back to D1 (alarm, 5 s after the last change, and at the end). A stale `base`
on the same feature is refused with the current feature, so a host on two devices cannot silently
overwrite themselves. Last writer wins only across different features.

---

## Live positions and privacy

## D13 — Positions are relayed in memory and never stored
A position goes from a phone to the object to the other members and nowhere else: not to Durable
Object storage, not to D1, not to logs. Hibernation means the object's memory can vanish mid-hunt,
so what must survive it lives where storage is not:

- **The last position of each member** rides in their socket's attachment
  (`serializeAttachment`, ≤ 2 KB), which the runtime holds with the connection.
- **Each phone is the authority for its own trail.** It keeps it in `localStorage` for the hunt, so it
  survives the app being killed by the OS. When the object wakes without trails in memory, it
  broadcasts `trail.request` and each phone sends its own (`trail.sync`); a phone that reconnects
  after losing signal does the same for the gap.
- **The object's memory is a relay cache** — enough for a late joiner to see the ground covered.

When the hunt ends, phones delete their local trail (D14). No Worker or
object code logs a coordinate; `observability` sees request metadata only.

## D14 — A trail lasts as long as the hunt
A trail exists for the hunt only: in the object's memory and on each phone, which deletes its own
when the person leaves the hunt screen. A web page records position only while it is open and in
front, so the record of a walk is the hunter's own watch or app (Apple Watch, Strava); its GPX
comes onto a map by import (D21).

## D15 — Update interval adapts to movement, per hunt type and role
A phone sends a position when the time **or** the distance since the last send is reached, and
switches to the sparse interval after 30 s below 0.5 m/s:

| hunt / role | moving | stationary | trail |
|---|---|---|---|
| salto | 5 s or 15 m | 30 s | on |
| montaria · batedor | 5 s or 15 m | 30 s | on |
| montaria · porta | 10 s or 25 m | 60 s | off (toggle) |

Fixes worse than 50 m accuracy are shown as a dot with its circle but never sent into a trail;
trail points need ≤ 25 m and ≥ 5 m from the previous point.

**Staleness:** the object stamps each position with its receive time; phones compare against a clock
offset taken from `welcome`. A position older than twice its expected interval fades; older than
5 minutes it greys out with "visto há X min". A phone whose page goes hidden sends `away`, so the
group reads "app em segundo plano" rather than a silent fade.

## D16 — EU jurisdiction, no third-party analytics
The `Hunt` namespace is used through the jurisdiction in `HUNT_JURISDICTION`, `"eu"` in
wrangler.jsonc and held there by a test; local workerd does not implement jurisdictions, so tests
and `.dev.vars` blank it. D1 is created with jurisdiction `eu` (`cloudflare_d1_database.jurisdiction`). No analytics script; the daily
usage counters of pb-D119 (no person, device, map or hunt named) arrive in phase 4 with `/admin`
(pb-D108).

The tile servers are the one place a user's address and the area they look at leave the app: DGT's
and Esri's servers see the tiles requested. The privacy page says so.

## D17 — It says it is not a safety system
Positions are self-reported, delayed, and stop when a phone sleeps. The hunt screen carries a
permanent line — "Não é um sistema de segurança. Confirme sempre à vista e por rádio." — and the
first join in a browser shows it as a dismissible notice. No feature claims to warn about lines of
fire; `no_shoot` zones are drawings.

---

## The map

## D18 — Imagery: OrtoSat 2023 by default, DGT 2021 aerial, Esri behind a key
All three cover Salvaterra do Extremo; all three answer `Access-Control-Allow-Origin: *`.

| id | source | resolution | how | licence |
|---|---|---|---|---|
| `ortosat2023` (default) | DGT OrtoSat 2023, Pléiades-Neo (Airbus) | 30 cm | WMS `ortos.dgterritorio.gov.pt/wms/ortosat2023`, layer `ortoSat2023-CorVerdadeira`, EPSG:3857 | public viewing; dados.gov: "licença não especificada"; downloads restricted to public administration |
| `ortos2021` | DGT Ortos 2021 aerial (IFAP) | 25 cm | WMS `cartografia.dgterritorio.gov.pt/wms/ortos2021`, layer `Ortos2021-RGB` | DGT open-data policy; licence not named |
| `esri` | Esri World Imagery | varies | tiles with an ArcGIS Location Platform API key | Esri terms; "not intended to export tiles for offline" |

- **DGT is WMS, used as tiles:** MapLibre requests `BBOX={bbox-epsg-3857}` at 512 px, one request
  per four 256 px tiles. DGT's WMTS sets are PT-TM06 only, which MapLibre cannot draw.
- **Esri through a free ArcGIS Location Platform key** rather than the keyless legacy endpoint: the
  free tier (2M basemap tiles a month) is enough, and a key is the terms' supported way in. The key
  is public in the bundle by design, restricted by referrer to the app's origin and scoped to
  basemaps; stolen, it spends a free quota that stops rather than bills.
- **Attribution** is always on screen for the active source: "© DGT — OrtoSat 2023", "© DGT —
  Ortofotos 2021", "Esri, Maxar, Earthstar Geographics, and the GIS User Community".
- A cached tile is found by a key — host, layer and the bounding box rounded to 0.1 m
  (`src/offline/tiles.ts`) — never by its URL: MapLibre and the prefetch write the box's numbers
  differently, and both must hit the same entry (D19).
- **`cartografia.dgterritorio.gov.pt` is unreliable** (most requests timed out when measured), so
  `ortos2021` is a secondary source: its failures show as a source notice, and prefetch retries
  with backoff and resumes.

## D19 — Offline: each phone prefetches its own area; nothing is redistributed
Before the hunt, "Descarregar área" prefetches the map's area from the source directly into the
phone's Cache Storage; a service worker answers those URLs cache-first, offline or not.

**Not an R2 pack.** OrtoSat's public access is viewing, its downloads are restricted, and Esri's
terms exclude offline export; a pack in our bucket would be redistribution. A phone fetching the
tiles of one property for its own use is what panning over it does. If a source with a
redistribution licence is added, a PMTiles pack in R2 becomes possible (D1) — the cache seam is the
same.

- **Area:** everything drawn plus 500 m, tile zooms 9–17 (512 px tiles). DGT sources stop at tile
  zoom 17 (~0.46 m per pixel against OrtoSat's 0.3 m): a deeper level is the server upsampling at
  four times the data, and offline it would leave the deepest zoom without a tile; MapLibre zooms
  past it on the last level. "Mais leve" stops at 16, about a quarter of the requests.
- **Size:** OrtoSat answers 50–90 KB per 512 px JPEG close in, less for the region-wide levels;
  estimated at 65 KB a tile. A 1,000 ha property is a few hundred tiles, tens of megabytes; a test
  area of a few hectares measured 65 tiles, 3.8 MB against an estimate of 4.1 MB.

- **Once per phone.** Imagery does not change, so a pack never expires; it is downloaded again only
  when asked. Inside a pack the map spends no data, online or not. The dialog recommends Wi-Fi and,
  where the browser reports it (`navigator.connection`), warns on a cellular connection.
- **Viewed tiles are kept too:** DGT tiles fetched while panning go into a runtime cache capped at
  2,000 entries, oldest first out, so an area looked at once is there next time without a pack.
- **Caps:** 3,000 requests per pack per source (~10,000 ha, ~195 MB); the dialog shows the estimate
  before starting and the quota (`navigator.storage.estimate()`) after;
  `navigator.storage.persist()` is requested.
- **Esri is online-only.** Its tiles go through the browser's HTTP cache like any page, never into
  the prefetch.
- **Politeness:** 4 requests in flight, three retries with backoff; a tile already in the pack is
  not fetched again, so a cancelled or partial download resumes.
- **Drawings offline:** the map being worked on is the browser's draft, with its server version;
  offline it opens and edits as usual, and the edits are sent when a connection returns. A live hunt
  needs signal; GPS, the map, navigation and the user's own trail do not.
- **The service worker** (`src/sw.ts`) serves the page network-first with the cached copy as the
  fallback, hashed assets and the font cache-first, and tiles from the pack cache, then the runtime
  cache, then DGT. It never caches `/api/*`.
- **iOS** evicts script-writable storage of a site not used for 7 days unless it is installed to
  the home screen; the download dialog says to install first.

## D20 — Drawing is our own, on MapLibre's events; the document is the store
Drawing and reshaping are a pure reducer (`src/draw/editor.ts`) over the map document, driven by
MapLibre's tap and drag events, and everything is drawn by MapLibre layers from the document —
typed pin badges, labels (D24), lines, fills, the line in progress and the edit handles — so
drawing, editing and viewing render one way.

Terra Draw was rejected: a line or area finishes only by a double-tap or a keyboard key, and the
finish here is a button; and editing with it means a second store of the same geometry and a
second owner of the map's pointer events.

Touch rules: a pin is placed by a tap with its type already chosen, never by a long-press (it fights
panning); a line or area grows a point per tap and finishes from the sheet; the selected shape shows
vertex handles to drag and midpoint handles that become a new vertex when dragged; a tapped vertex
can be deleted from the sheet. A drag is one undo step. A porta placed within 40 m of an armada
stands on it and the armada is renumbered along its length.

## D24 — Labels and icons are images the app draws
Pin names, porta numbers and zone names are MapLibre symbol layers, not DOM markers: MapLibre
places them on the GPU, hides colliding ones and keeps them on the map while it pans. DOM markers
re-layout on every frame of a pan and cannot collide, which on a phone with a hundred portas is
jank and overlap.

The symbols are images, not text: each label is drawn on a canvas in the UI's own face (Atkinson
Hyperlegible Next, self-hosted, OFL) and registered with `addImage`, as are the pin silhouettes and
the heading cone. The style therefore has no `glyphs` and no `sprite` — no glyph PBFs to generate,
no build tool, one face across the chrome and the map, and the same font files the service worker
already precaches for offline. Names are limited to what that face's two subsets cover (Latin with
every Portuguese accent); the schema rejects anything else at input.

**The look is a field kit's.** A pin is a schist disc edged in bone, its type's colour a thin
ring, its symbol in bone; a sighting is the same in a diamond; a label is a dark tag with bone
text. The drawing palette is earth tones (bone, ochre, steel blue, heather, moss, red), stored by
key so a tone can change without touching a map. The chrome is hunting-canvas beige (`cal`,
`cal-deep`) with bone (`osso`) for fields and cards; white is left only where a scanner needs it
(the transfer QR).

## D25 — The panel is about the map; the person is behind the menu
The map screen's sheet (the left panel on wide screens) holds this map only. Its peek is the map's
name, which opens the map switcher (rename, the person's maps, a new one), the save state, and
four tiles: Caçada (back to a live hunt, or a choice of starting one here or joining by code),
Partilhar or Guardar, Sem rede, Ficheiros (import and export, D21). Expanded, it lists what is drawn. Everything about the
person and the app (signing in, the phone's name, moving to another device, installing, the
language, erasing) sits behind the round menu button in the map's top-right corner. The safety
notice belongs to the hunt: its screen and its start and join dialogs.

## D26 — The operator's view and everybody's use
pb-D108 and pb-D119, for maps and hunts. `/admin` shows accounts, phones without one, maps,
shared links and live hunts, with 90 UTC days of sign-ups and maps, the sign-in split and last-seen
recency; one account's maps (features, size, link, a live hunt); and erases an account, its address
typed again. **Gated by `ADMIN_EMAILS`**, a secret, against the session's verified address: every
path under `/api/admin/` answers 404 to anyone else. **Metadata only**, computed in D1: no map's
contents, no position. English only, its own chunk, linked from the menu when `/api/me` says
`admin`.

`usage_daily` keeps one number per UTC day per event, naming no one: pages opened (map, shared map,
hunt), hunts started by type and joined, links shared, areas downloaded, files imported and exported
by format. Hunts and links are counted by the Worker as they happen; the rest by the browser,
through `POST /api/usage`, the one unauthenticated write: a fixed list (the browser's held inside
the Worker's by a test), `USAGE_LIMIT` by address, and a cap per row. Kept 400 days by the sweep.

## D27 — Your data as a zip, and a page that says what is kept
pb-D120. **Everything an account or a phone holds, as a zip**, from the menu: each map as GeoJSON
(`coutada/maps/<name>.geojson`, which opens in Coutada again and in GIS software) and
`coutada/account.json`. Built in the browser from the maps' own endpoints; there is no export
route. `share/zip.ts` writes it over `CompressionStream` with UTF-8 names, read back by a test.

**`/privacidade`** (and `/privacy`) says, in both languages, what is kept and where, that positions
never are, what the imagery hosts see, what is counted (D26), the cookies, and how to download or
erase it. It describes what the code does; a change to what is kept changes the page.

## D28 — Search: places from OpenStreetMap, coordinates and drawings on the phone
A round search button beside the menu opens one box for three things. **Coordinates**, as typed or
pasted (decimal, degrees and minutes, degrees, minutes and seconds, signs or N/S/E/W, a decimal
comma), read by a pure parser on the phone, so they work with no signal. **This map's drawings**,
by name, as you type. **Places in Portugal and Spain**, from Nominatim (OpenStreetMap), on submit,
as its policy asks: through `GET /api/places`, so Nominatim sees Coutada and not the person's
address, cached for a week by query and language, and paced by `SEARCH_LIMIT`. Google's search was
rejected for its billing account, MapTiler and Mapbox for a key, Photon for being best-effort.
Results credit OpenStreetMap; the privacy page says where a search goes. The camera frames a
place's extent or closes in on a point, and a ring marks it until the next tap.

## D21 — Import and export: GeoJSON, GPX and KML
Files are added to the open map, from the Ficheiros tile, read from a file's text (20 MB at most)
by pure readers in `src/io/`, which the tests run without a DOM. The format is told by the
content, not the name.
- **In:** GPX tracks and routes, KML lines and `gx:Track`s, and GeoJSON lines become walk routes;
  waypoints, KML points and GeoJSON points become landmarks; KML and GeoJSON polygons (the outer
  ring) become boundaries. Each shape is thinned with Douglas–Peucker from 2 m until it fits the
  vertex cap, so a walk from a watch or Strava fits (D14). A Coutada GeoJSON comes in whole, under
  new ids, its portas still on their armadas. What does not fit the map's limits is left out and
  counted. KMZ is a zip and is refused with a hint to unzip it.
- **Out:** GeoJSON is the document itself (D7); GPX has pins as waypoints and routes and areas as
  tracks; KML has every feature in its colour.

## D22 — Deleting an account or a device is one transaction, by name
pb-D110: `DELETE /api/me` empties every table naming the user — maps (and their view
links), identities, sessions, pending email links — then `users`, in one D1 batch. A device erases
itself the same way (`DELETE /api/device`). A hunt the principal hosts is ended first. The list is
the contract; `ON DELETE CASCADE` is a backstop.

## D23 — Free tier: stay inside it by construction
Every limit is a cap the code enforces, not a hope — the free plan refuses work once a limit is hit,
and one abusive client would take the app from everyone (pb-D39). Budgets are in
[`architecture.md`](architecture.md#12-free-tier-budget).
