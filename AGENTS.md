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
   phone; the only stored trail is one its owner saves (D14).
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
src/map/ src/draw/ src/live/ src/nav/ src/offline/   shells around them (P1–P3)
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
- **Auth bodies must be `application/json`** — a `text/plain` form POST is the login CSRF
  (pb-D109).
- **Never mix a bare `?` with `?N` in one statement** — SQLite binds the wrong value, silently.
- **A new table that stores anything about a person joins `deleteAccount`'s list** (D22); a new
  table with an expiry joins the daily sweep.

### Map (D18, D24)
- **MapLibre's stylesheet is unlayered, so it beats Tailwind utilities.** `.maplibregl-map` sets
  `position: relative`; position the map with a wrapper, never with classes on its container.
- **`tileUrl` in `src/map/imagery.ts` is the one place a tile URL is built** — the map and the
  offline prefetch must ask for byte-identical URLs, or the cache misses.
- **Orange is for people.** `PERSON` marks you and other hunters; no drawing colour may be orange.
- **`src/doc` and `src/geo` use relative imports** — the Worker imports the schema, and its bundler
  does not know the `@/` alias.
- **The write tool turns `\uXXXX` escapes into raw characters.** Write regex ranges with `\xXX`
  or check the bytes; ESLint's `no-irregular-whitespace` catches a raw NBSP.

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
