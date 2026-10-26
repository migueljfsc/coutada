# Coutada

[![ci](https://github.com/migueljfsc/coutada/actions/workflows/ci.yml/badge.svg)](https://github.com/migueljfsc/coutada/actions/workflows/ci.yml)
[![deploy](https://github.com/migueljfsc/coutada/actions/workflows/deploy-worker.yml/badge.svg)](https://github.com/migueljfsc/coutada/actions/workflows/deploy-worker.yml)

The hunt on a satellite map. The host marks portas, armadas, manchas, gates and meeting points on
real imagery; everyone opens it on their phone, sees where they are, and walks to a spot or along a
route — offline, at the property. During a hunt, everyone sees everyone's live position and the
ground already covered.

**Live:** https://coutada.migueljfsc.dev — one Cloudflare Worker serving the app and its API,
deployed by [`deploy-worker.yml`](.github/workflows/deploy-worker.yml) on every push to `main`.

## Design

| Piece | Approach |
|---|---|
| **Map** | MapLibre GL over DGT OrtoSat 2023 (30 cm), DGT 2021 aerial (25 cm) and Esri World Imagery. |
| **Drawing** | Terra Draw edits geometry, touch first; the map document is one GeoJSON FeatureCollection. |
| **Offline** | Each phone prefetches its property's tiles into the service worker's cache; drawings in IndexedDB. |
| **Live hunts** | One Durable Object per hunt in the EU, WebSocket hibernation, a four-character join code. |
| **Privacy** | Positions are relayed in memory and never stored; a member may save only their own trail. |
| **Identity** | Accounts as in [pitchboard](https://github.com/migueljfsc/pitchboard) (browser-side KDF, Google, Turnstile); anonymous use by device token. |

## Stack

React 19, TypeScript (strict), Vite 8, Tailwind v4. The Worker in [`worker/`](worker/) serves the
app and `/api/*`. OpenTofu in [`infrastructure/terraform/cloudflare`](infrastructure/terraform/cloudflare)
owns D1, Turnstile and mail DNS, and not the deploy.

## Develop

```bash
pnpm install
pnpm dev                   # http://localhost:5173
pnpm test                  # vitest: app in node, Worker in workerd
pnpm lint && pnpm typecheck && pnpm build
pre-commit install         # hooks; commits are Conventional (`cz commit`), enforced in CI
```

Node >= 22.12, pnpm.

## Documentation

| Document | Contents |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Shape, document, schema, hunts, protocol, imagery, security, free-tier budget |
| [`docs/implementation-plan.md`](docs/implementation-plan.md) | Phases, dependencies, testing |
| [`docs/decisions.md`](docs/decisions.md) | Why the design is what it is |
| [`AGENTS.md`](AGENTS.md) | Conventions and the invariants that must not break |

## Licence

[MIT](LICENSE).
