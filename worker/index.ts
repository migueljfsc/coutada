/**
 * Coutada Worker — the API surface. The SPA is served by the static-asset layer ahead of this
 * script (`run_worker_first` in wrangler.jsonc), so a page load never reaches here.
 *
 * `Env` is generated from wrangler.jsonc by `pnpm types`; a binding is declared there only.
 */

import { fail, secured } from "./lib/http";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return secured(await route(request, env));
  },
} satisfies ExportedHandler<Env>;

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

  switch (`${request.method} ${url.pathname}`) {
    case "GET /api/me":
      return fail("unauthorized", 401);
    default:
      return fail("not_found", 404);
  }
}
