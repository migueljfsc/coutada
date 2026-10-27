# Coutada — Implementation Plan

What is built and what is open. Architecture: [`architecture.md`](./architecture.md); reasoning:
[`decisions.md`](./decisions.md).

**Sequencing:** the pure modules (`src/geo`, `src/doc`, `worker/hunt/state.ts`) are built and
tested before the React, MapLibre or Durable Object shell around them (D2), and every phase ends
deployed at something you can open on a phone in the field.

## Status

| Phase | State |
|---|---|
| P0 | Shipped (v0.1.0) |
| P1 | Shipped: map document and geometry; the map screen, imagery and the GPS dot with heading; drawing and editing; accounts, anonymous devices, transfer and claim; maps saved with conflict handling; view links |
| P2 | Shipped: go to a pin, follow a route with the off-route warning; the app opens offline and keeps imagery seen; the area download with estimate, progress and removal; installable, with the iOS hint |
| P3 | P3.1 shipped: the hunt object, codes, join, the live protocol, host controls, expiry. P3.2 shipped: the hunt screen — start, join, everyone's positions and trails, staleness and `away`, the host's controls. P3.3 shipped: the host draws during the hunt and everyone sees it at once; sightings by species and event, kept by the host as game pins; game pins by species. Next: P4, GPX import first |
| P4 | Shipped: GPX, KML and GeoJSON in and out (D21); the panel redesign (D25); `/admin` and usage counters (D26); your data as a zip and the privacy page (D27) |

## Phases

### P0 — Scaffold
Conventions from pitchboard, no features.

- `AGENTS.md` with a `CLAUDE.md` symlink, `docs/`, `CHANGELOG.md`, `.cz.yaml` (from 0.1.0),
  `.pre-commit-config.yaml`, `README.md`, MIT `LICENSE`.
- Vite + React + TS + Tailwind 4 + ESLint + Vitest config, pnpm workspace; i18n skeleton (PT, EN).
- `infrastructure/terraform/cloudflare`: D1 (jurisdiction `eu` if the provider supports it, else
  `weur`), Turnstile widget, Resend DNS for `coutada.migueljfsc.dev`; state key
  `coutada/cloudflare/terraform.tfstate` in the shared bucket.
- `.github/workflows/{ci,deploy-worker,release,terraform}.yml`; the hand-made CI token widened to
  Durable Objects (and R2 only if D19 ever changes).
- Worker with `/api/me` → 401 and the security headers; an empty page at the custom domain.

Ends at: CI green, `https://coutada.migueljfsc.dev` serves the shell.

### P1 — Map, imagery, drawing, saving, my GPS dot
- `src/doc` (schema, operations, migrate) and `src/geo` basics, tested.
- MapLibre with `ortosat2023`, `ortos2021`, `esri`; switcher; attribution (D18).
- Drawing on MapLibre's own events, touch first (D20): typed pins, routes, armadas with numbered portas, zones;
  names, colours, notes (D20).
- Accounts copied from pitchboard (D4); devices, transfer codes and claim (D5, D6).
- Maps in D1 with caps and optimistic concurrency; view links (D8).
- GPS dot with accuracy and heading; Wake Lock while it is on.
- "Não é um sistema de segurança" notice (D17).

Ends at: your dad draws the property on a computer, you open the link on your phone in the field and
see yourself on it.

### P2 — Navigation and offline
- Navigate to pin; follow route with progress and the off-route indicator (§8).
- Service worker: app shell, tile cache; prefetch planner and runner with estimate, caps and
  progress (D19); opened maps in IndexedDB, read-only offline.
- PWA manifest and install prompt; the iOS install note in the download dialog.

Ends at: in flight mode at the property, the map, your dot, navigation and drawings all work.

### P3 — Live hunts
- `worker/hunt/state.ts` reducer and `protocol.ts`, tested first; the `Hunt` object in the EU
  jurisdiction with hibernation; `hunts` table; code generation and rotation (D9, D10).
- Join page: code, username, Turnstile; `JOIN_LIMIT`; lock, kick, rotate, end.
- Position sampler with the per-type intervals; positions, staleness, `away` (D15).
- Trails: own trail in `localStorage`, relay cache, `trail.request` / `trail.sync` (D13).
- Live drawing sync with write-back; observations, keeping one (D11, D12).

Ends at: a salto with three phones — everyone sees everyone, trails survive a phone losing signal
and a redeploy of the Worker, and nothing about positions is in D1 or object storage afterwards.

### P4 — Import, export, operator, polish
- GPX, KML and GeoJSON import and export (D21); a walk from a watch or Strava as a route (D14).
- `/admin` (pb-D108) and anonymous usage counters (pb-D119), extended to maps and hunts by count.
- Account zip export (pb-D120); privacy page (tile servers, device lifetime, trails).

## Dependencies to approve before install

| package | for | phase |
|---|---|---|
| react, react-dom, zod, tailwind-merge, clsx, class-variance-authority, lucide-react | as pitchboard | P0 |
| vite, @vitejs/plugin-react, typescript, eslint (+ plugins), tailwindcss, @tailwindcss/postcss, postcss, vitest, wrangler, globals, @types/* | as pitchboard | P0 |
| maplibre-gl | map | P1 |
| qrcode (or a hand-rolled encoder) | transfer QR (D5) | P1 |
| @cloudflare/vitest-plugin (formerly `@cloudflare/vitest-pool-workers`) | testing the Worker and the object shell against the runtime | P0 |
| Atkinson Hyperlegible Next, woff2 (static files, OFL, not a package) | UI and map labels (D24) | P1 |

`pmtiles` is no longer needed: offline is per-phone prefetch (D19). No PWA plugin — the service
worker is hand-written and built as a Vite entry.

## Testing

Vitest. `src/geo` numerically (distances against known pairs, cross-track on fixtures, tile covers
counted); `src/doc` through its operations and the schema; `worker/hunt/state.ts` by replaying
message sequences — join, lock, kick, stale `base`, hibernation wake, end — and asserting the sends
and effects; Worker libs as pitchboard tests them. The password salt prefix is frozen by a test
vector from the first commit.

## Definition of done

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` clean.
- On a phone at narrow width: the map pans and the drawn layers stay put; touch drawing works
  without a mouse.

## Open

- Esri static tile endpoint and key scopes, confirmed against ArcGIS Location Platform docs (D18).
- Licence of OrtoSat 2023 and Ortos 2021, from DGT (D18, D19).
- The property's size, which sets the pack estimate shown in P2 (D19).
