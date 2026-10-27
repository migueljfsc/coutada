# Coutada — the hunt on the map

Working conventions. Architecture: [`docs/architecture.md`](docs/architecture.md); what is built:
[`docs/implementation-plan.md`](docs/implementation-plan.md); every choice's reasoning:
[`docs/decisions.md`](docs/decisions.md), cited as Dn. Pitchboard's decisions are cited as `pb-Dn`.

## Mission

A mobile-first PWA for coordinating a hunt on a satellite map. The host draws named spots
(portas, gates, meeting points), routes, lines of posts (armadas) and zones (manchas, no-shoot,
boundary); members open it on their phones, see themselves, navigate to a spot or follow a route;
during a hunt everyone sees everyone's live position and trail, and the drawings sync live. Two
hunt types: montaria/batida (mostly stationary) and salto (walked up, on the move).

## The invariants

1. **Positions are never stored** (D13). A position goes phone → hunt object → other phones. Not
   to Durable Object storage, not to D1, not to a log. Trails live in memory and on each owner's
   phone, for the hunt only (D14).
2. **The pure modules stay pure** (D2). `src/geo/`, `src/doc/` and `worker/hunt/state.ts` take
   time and ids as arguments: no DOM, React, `Date.now()`, `Math.random()` or module state.
3. **The map document is GeoJSON, `[lon, lat]`, WGS84** (D7). Nothing else enters it — no view
   state, no positions, no imagery cache.

## Hard decisions — do not relitigate without asking

- **No imagery is redistributed.** Offline is each phone prefetching from the source; no R2 pack
  of DGT or Esri tiles (D19).
- **OpenTofu owns durable infra; wrangler owns the deploy**, the bindings, the schema and the
  Durable Object class. Never add `cloudflare_workers_script` (pb-D40).
- **Hunt codes are four characters from `23456789BCDFGHJKMNPQRSTVWXZ`**, protected by expiry,
  `JOIN_LIMIT`, Turnstile on every join and host controls (D10).
- **Claiming anonymous data is an explicit offer**, never a side effect of signing in (D6).

## Repository layout

```
docs/                     architecture, implementation plan, decisions
src/geo/  src/doc/        pure modules (P1)
src/draw/                 the editor reducer (pure)
src/io/                   file formats in and out (pure: text in, features out)
src/map/ src/live/ src/nav/ src/offline/   shells around them (P1–P3)
src/i18n/                 PT and EN; en.ts declares the keys
src/share/                storage.ts (the ONLY localStorage access; never throws)
worker/index.ts           routes /api/*
worker/lib/               by concern
worker/hunt/              the Hunt Durable Object (P3)
worker/migrations/        D1, applied by CI before deploy
wrangler.jsonc            the ONLY place a binding is declared
infrastructure/terraform/cloudflare/   OpenTofu — D1, Turnstile, mail DNS
```

`pnpm types` regenerates the Worker's `Env` from `wrangler.jsonc`; `pnpm deploy:worker` is a
local dry run — CI owns the deploy.

## Engineering conventions

- pnpm, Node >= 22.12, TypeScript strict; React 19, Vite 8, Tailwind v4.
- Conventional Commits via commitizen (`cz commit`), enforced in `commit-msg` and CI;
  `pre-commit install` after cloning, and `pre-commit run --all-files` before a commit.
- Vitest in two projects: `app` (node) for `src/`, `worker` (workerd, `@cloudflare/vitest-plugin`)
  for `worker/`. Test behaviour through public operations; keep a test for every trap below.
- Dependencies are added only when asked for. A new version must be older than pnpm's minimum
  release age; never add a `minimumReleaseAgeExclude`.
- Match the surrounding style; do not refactor beyond the task.

## Known traps

### Worker
- **Every response goes through `secured`** — the CSP and `Permissions-Policy` are on every
  response, and `_headers` copies them to static files. A new third-party origin goes in
  `SECURITY_HEADERS`.
- **`Permissions-Policy` allows geolocation and the wake lock for `self`.** Pitchboard's turns
  geolocation off; copying that header back breaks the GPS dot silently.
- **Every body is read with `readJson`** — JSON by content type, size-capped. A `text/plain` POST is
  how a cross-site form would act on the session or device cookie (pb-D109).
- **Ownership is a WHERE clause** (`ownerColumn`), never a check after reading; a cap is in the
  INSERT itself, never a count before it.
- **Worker tests share one D1 per file.** Give each test its own address, email and username, or a
  rate limiter or a UNIQUE index fails the next test.
- **Never mix a bare `?` with `?N` in one statement** — SQLite binds the wrong value, silently.
- **A new table that stores anything about a person joins `deleteAccount`'s list** (D22); a new
  table with an expiry joins the daily sweep.

### Map (D18, D24)
- **MapLibre's stylesheet is unlayered, so it beats Tailwind utilities.** `.maplibregl-map` sets
  `position: relative`; position the map with a wrapper, never with classes on its container.
- **A cached tile is found by `tileKey`, never by URL** — MapLibre and the prefetch format the
  bounding box differently; the key rounds it. A new imagery host joins `TILE_HOSTS` or it is
  never cached.
- **The service worker is its own entry and tsconfig** (`src/sw.ts`, `tsconfig.sw.json`, WebWorker
  lib) and registers only in production. A cache layout change is a new cache name; `activate`
  deletes the rest.
- **Images come from `setMissingStyleImageResolver`**, never the `styleimagemissing` event: in
  MapLibre v6 an image added from the event is not drawn until some later repaint.
- **Pin glyphs are rendered with `flushSync` one tick after the effect that asks for them** — inside
  an effect it renders nothing, the SVG is empty and fails to decode, and every badge is blank.
- **A drag swallows the click that follows its release, and only that one** — the flag is cleared
  on the next tick, or the first tap after a drag (the first corner of an area) is lost.
- **The drawing syncs on `style.load`, never `load`** — `load` waits for the imagery's first tiles,
  which DGT can take fifteen seconds to send, and the person's own map would wait with them.
  `onReady` hands the map over at creation, so the camera can frame before any tile arrives.
- **Orange is for people.** `PERSON` marks you and other hunters; no drawing colour may be orange.
- **`src/doc` and `src/geo` use relative imports** — the Worker imports the schema, and its bundler
  does not know the `@/` alias.
- **The write tool turns `\uXXXX` escapes into raw characters.** Write regex ranges with `\xXX`
  or check the bytes; ESLint's `no-irregular-whitespace` catches a raw NBSP.

### Accounts and saving (D4–D8)
- **The browser's KDF salt (`coutada:v1:`) is frozen by a test vector** — changing it, the
  iterations or the email normalisation locks every password account out.
- **The draft is the working copy, the server the record** (`useMapDocument`): every edit goes to
  the draft at once and to the server 1.5 s later with the version it started from; a refused
  version is a conflict the person settles, never an overwrite.
- **Locally, `wrangler dev` reads `.dev.vars`** (gitignored, test values only) and the local D1
  needs `wrangler d1 migrations apply coutada-prod --local`. On localhost the app uses Turnstile's
  always-pass test sitekey, which pairs with the test secret.

### Live hunts (D9–D13)
- **The hunt reducer (`worker/hunt/state.ts`) decides; the object only carries out.** Anything
  decidable — who may do what, a stale edit, a trail — goes in the reducer and its tests.
- **`persist` names the durable fields one by one** — positions and trails must never reach
  storage (D13); spreading the state would write them.
- **Send through `sendTo`** — a kicked or dropping member's socket throws on `send`, and one
  throw ends the broadcast for everyone after it.
- **Compare features with `same` (`src/live/docSync.ts`), never as JSON strings** — the hunt
  parses every feature with zod, which can reorder keys; a string compare sees every echo as a new
  edit and resends it forever.
- **The host's edits wait for the last batch's answer** — the hunt refuses a `base` older than the
  feature's rev, so a second edit to the same feature sent before the echo is rejected.
- **`HUNT_JURISDICTION` is `"eu"` in wrangler.jsonc and blank only in tests and `.dev.vars`** —
  workerd has no jurisdictions; `src/share/deploy.test.ts` fails if production loses it.

### Language (D3)
- **A pure module must not return prose** — it returns a `Message`.
- **Never assemble a sentence from fragments** — a whole key with a placeholder.
- **`pt.ts` must answer every key `en.ts` declares**; `i18n.test.ts` checks placeholders match.

### Storage
- **Anything read from `localStorage` is untrusted** — validate and discard, never repair.

## Definition of done

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` clean.
- At phone width: the page fits without horizontal scroll and every control is ≥ 44 px.

## Git

Never create branches, commits or PRs unless asked. "Fix X" means prepare the change, not commit it.
