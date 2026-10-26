# The Worker

Serves the SPA and the `/api/*` surface at https://coutada.migueljfsc.dev. `wrangler.jsonc` sits
at the repository root, beside `package.json`.

```
index.ts           the router — /api/*
lib/
  http.ts          JSON responses, all no-store; `secured` adds the security headers
  headers.ts       the security headers and CSP, also written to dist/_headers
migrations/        D1 schema, forward-only
```

## What costs what

The free tier refuses work rather than billing; budgets are in
[`docs/architecture.md`](../docs/architecture.md#12-free-tier-budget).

- **10 ms CPU per request.** Waiting on D1 or `fetch` does not count.
- **100,000 requests a day.** Static assets do not count, which is why `run_worker_first` is
  `["/api/*"]` and not `true`.

## Bindings

Declared in `wrangler.jsonc` and nowhere else. `pnpm types` regenerates the gitignored
`worker-configuration.d.ts` from it, ahead of `typecheck`, `test` and `build`. The D1 id comes
from `tofu output d1_database_id` after the stack's first apply.

## Migrations

Forward-only, applied by CI before the script is deployed.

```sh
wrangler d1 migrations apply coutada-prod --remote
```

## Deploying

CI, on a push to `main`. Locally, only ever as a dry run:

```sh
pnpm build && pnpm deploy:worker --dry-run
```
