/**
 * The app's routes: `/` the map you were on, `/map/<id>` a saved map, `/m/<slug>` a shared map,
 * `/hunt/<id>` a live hunt, `/transfer?c=<code>` a device handed over, `/admin` the operator's
 * view, `/privacidade` what is kept. History is the browser's; `navigate` pushes.
 */

import { useSyncExternalStore } from "react";

export type Route =
  | { kind: "home" }
  | { kind: "map"; id: string }
  | { kind: "shared"; slug: string }
  | { kind: "hunt"; id: string }
  | { kind: "transfer"; code: string }
  | { kind: "admin" }
  | { kind: "privacy" };

const MAP = /^\/map\/([A-Za-z0-9_-]{22})\/?$/;
const SHARED = /^\/m\/([2-9bcdfghjkmnpqrstvwxz]{8})\/?$/;
const HUNT = /^\/hunt\/([A-Za-z0-9_-]{22})\/?$/;

export function parseRoute(pathname: string, search: string): Route {
  const map = MAP.exec(pathname);
  if (map) return { kind: "map", id: map[1] };
  const hunt = HUNT.exec(pathname);
  if (hunt) return { kind: "hunt", id: hunt[1] };
  const shared = SHARED.exec(pathname);
  if (shared) return { kind: "shared", slug: shared[1] };
  if (pathname === "/transfer") return { kind: "transfer", code: new URLSearchParams(search).get("c") ?? "" };
  if (pathname === "/admin" || pathname === "/admin/") return { kind: "admin" };
  if (/^\/(privacidade|privacy)\/?$/.test(pathname)) return { kind: "privacy" };
  return { kind: "home" };
}

export const mapPath = (id: string) => `/map/${id}`;
export const huntPath = (id: string) => `/hunt/${id}`;
export const sharedUrl = (slug: string) => `${location.origin}/m/${slug}`;
export const transferUrl = (code: string) => `${location.origin}/transfer?c=${code}`;

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function navigate(path: string, replace = false) {
  if (replace) history.replaceState(null, "", path);
  else history.pushState(null, "", path);
  notify();
}

/** Drops query parameters a link brought in, once the app has acted on them. */
export function dropParams(...names: string[]) {
  const url = new URL(location.href);
  names.forEach((n) => url.searchParams.delete(n));
  history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

let cached: { key: string; route: Route } | null = null;

export function useRoute(): Route {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      window.addEventListener("popstate", onChange);
      return () => {
        listeners.delete(onChange);
        window.removeEventListener("popstate", onChange);
      };
    },
    () => {
      const key = `${location.pathname}${location.search}`;
      if (cached?.key !== key) cached = { key, route: parseRoute(location.pathname, location.search) };
      return cached.route;
    },
    () => ({ kind: "home" }) as Route,
  );
}
