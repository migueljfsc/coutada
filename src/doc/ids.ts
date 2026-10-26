/** Feature ids: 128 random bits, base64url, 22 characters (D7). The one impure part of `src/doc`. */

type Fill = (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>;

export function newFeatureId(random: Fill = (b) => crypto.getRandomValues(b)): string {
  const bytes = random(new Uint8Array(16));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
