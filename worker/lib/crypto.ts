/**
 * Random identifiers and hashing on WebCrypto. Nothing here is a password KDF: that runs in the
 * browser (D4, pb-D109).
 */

export function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 128 bits, for rows: users, devices, maps. */
export function newId(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(16)));
}

/** 256 bits, for bearer credentials: session and device tokens, email links. */
export function newToken(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

/** The key a bearer credential is stored under; the database never holds the credential. */
export async function tokenDigest(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return base64url(new Uint8Array(digest));
}

/** Uniform characters from `alphabet`, by rejection sampling rather than a biased modulo. */
export function randomCode(alphabet: string, length: number): string {
  const limit = 256 - (256 % alphabet.length);
  const out: string[] = [];
  while (out.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length))) {
      if (byte >= limit) continue;
      out.push(alphabet[byte % alphabet.length]);
      if (out.length === length) break;
    }
  }
  return out.join("");
}

/** Constant-time for equal lengths, which is all that is compared here. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
