/**
 * Caps the Worker enforces. The free tier refuses work rather than billing, so a cap is what keeps
 * one client from taking the service from everyone (D23).
 */

export const MAX_MAPS_PER_USER = 50;
export const MAX_MAPS_PER_DEVICE = 3;

/** A map document, serialised: the schema's own cap plus room for the request around it. */
export const MAX_MAP_REQUEST_BYTES = 260 * 1024;

/** An anonymous device's lifetime after its last use (D5). */
export const DEVICE_TTL_S = 90 * 24 * 60 * 60;
/** The cookie outlives the row; the row is what expires (Chrome caps cookies at 400 days). */
export const DEVICE_COOKIE_MAX_AGE_S = 400 * 24 * 60 * 60;
/** `last_seen_at` slides at most once a day. */
export const DEVICE_SLIDE_AFTER_S = 24 * 60 * 60;

export const TRANSFER_TTL_S = 10 * 60;
export const TRANSFER_LENGTH = 8;

/** Codes and slugs read aloud or typed: no vowels, no look-alikes (D8, D10). */
export const SLUG_ALPHABET = "23456789bcdfghjkmnpqrstvwxz";
export const SLUG_LENGTH = 8;
export const SLUG_ATTEMPTS = 5;

export const USERNAME_MAX = 24;
