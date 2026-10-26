/**
 * The server's half of password hashing (D4, pb-D109). What arrives is the browser's PBKDF2 key,
 * not the password; what is stored is `v2$<salt>$HMAC(PASSWORD_PEPPER, salt$key)`. Losing the
 * pepper locks out every password account, so it is never rotated casually.
 */

import { base64url, timingSafeEqual } from "./crypto";

/** 32 bytes, base64url without padding — the only shape the browser's `deriveKey` produces. */
const KEY = /^[A-Za-z0-9_-]{43}$/;

export const isKey = (value: unknown): value is string => typeof value === "string" && KEY.test(value);

const encoder = new TextEncoder();

async function mac(pepper: string, salt: string, key: string): Promise<string> {
  if (!pepper) throw new Error("missing_pepper");
  const hmac = await crypto.subtle.importKey("raw", encoder.encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", hmac, encoder.encode(`${salt}$${key}`))));
}

export async function hashKey(key: string, pepper: string): Promise<string> {
  const salt = base64url(crypto.getRandomValues(new Uint8Array(16)));
  return `v2$${salt}$${await mac(pepper, salt, key)}`;
}

/** False for anything not a well-formed row, including NULL: "no password" never matches. */
export async function verifyKey(key: string, stored: string | null, pepper: string): Promise<boolean> {
  const [version, salt, expected] = (stored ?? "").split("$");
  if (version !== "v2" || !salt || !expected) return false;
  return timingSafeEqual(await mac(pepper, salt, key), expected);
}

/** Lowercased and trimmed, or null. Must match the browser's, or the salts differ. */
export function normaliseEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
