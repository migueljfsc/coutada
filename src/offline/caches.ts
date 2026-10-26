/** The Cache Storage names the page and the service worker share (D19). A new version is a new name. */

/** The app itself: the page, its assets, the font, the icons. */
export const SHELL_CACHE = "shell-v1";
/** Tiles downloaded on purpose for an area; kept until removed. */
export const PACK_CACHE = "tiles-pack-v1";
/** Tiles seen while panning; the oldest go once there are more than `RUNTIME_MAX`. */
export const RUNTIME_CACHE = "tiles-runtime-v1";
export const RUNTIME_MAX = 2000;

export const CACHES = [SHELL_CACHE, PACK_CACHE, RUNTIME_CACHE];
