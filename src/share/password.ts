/**
 * Turning a password into what the server sees (D4, pb-D109): PBKDF2-SHA256 at 600,000 iterations,
 * salted with a site prefix and the normalised address, so no endpoint has to say whether an
 * address exists. Every constant here is frozen by a test vector — changing one derives a
 * different key from the same password, and every account stops signing in.
 */

export const PBKDF2_ITERATIONS = 600_000;
const SALT_PREFIX = "coutada:v1:";

/** NIST's floor; no composition rules. */
export const MIN_PASSWORD = 8;

/** Must match `normaliseEmail` in `worker/lib/password.ts`, or the salts differ. */
export const normaliseEmail = (email: string): string => email.trim().toLowerCase();

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function deriveKey(email: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const material = await crypto.subtle.importKey("raw", encoder.encode(password.normalize("NFC")), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(SALT_PREFIX + normaliseEmail(email)), iterations: PBKDF2_ITERATIONS },
    material,
    256,
  );
  return base64url(new Uint8Array(bits));
}
