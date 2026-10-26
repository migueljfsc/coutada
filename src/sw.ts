/**
 * The service worker (D19): the app opens with no signal, and imagery already seen or downloaded
 * is served from the phone. The API is never cached — the map in use is kept by the page itself.
 */

/// <reference lib="webworker" />

import { CACHES, PACK_CACHE, RUNTIME_CACHE, RUNTIME_MAX, SHELL_CACHE } from "./offline/caches";
import { tileKey } from "./offline/tiles";

declare const self: ServiceWorkerGlobalScope;

const SHELL_PATHS = /^\/(assets|fonts|icons)\/|^\/(favicon\.svg|manifest\.webmanifest)$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.add("/"))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (!CACHES.includes(name)) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  const key = tileKey(request.url);
  if (key) {
    event.respondWith(tile(request, key));
    return;
  }
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") event.respondWith(page(request));
  else if (SHELL_PATHS.test(url.pathname)) event.respondWith(cacheFirst(request));
});

/** The page from the network, kept for when there is none; every route is the same page. */
async function page(request: Request): Promise<Response> {
  const shell = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await shell.put("/", response.clone());
    return response;
  } catch {
    return (await shell.match("/")) ?? Response.error();
  }
}

/** Hashed assets never change, so the first copy is good for ever. */
async function cacheFirst(request: Request): Promise<Response> {
  const shell = await caches.open(SHELL_CACHE);
  const cached = await shell.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await shell.put(request, response.clone());
  return response;
}

/** A downloaded or already-seen tile from the phone; otherwise from DGT, then kept. */
async function tile(request: Request, key: string): Promise<Response> {
  const cached = (await (await caches.open(PACK_CACHE)).match(key)) ?? (await (await caches.open(RUNTIME_CACHE)).match(key));
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const runtime = await caches.open(RUNTIME_CACHE);
    await runtime.put(key, response.clone());
    await trim(runtime);
  }
  return response;
}

/** Keeps the runtime cache to `RUNTIME_MAX`, oldest first out (Cache Storage lists in insertion order). */
async function trim(cache: Cache): Promise<void> {
  const keys = await cache.keys();
  for (const old of keys.slice(0, Math.max(0, keys.length - RUNTIME_MAX))) await cache.delete(old);
}
