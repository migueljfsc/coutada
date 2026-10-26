/**
 * The page's security headers. Static assets get the same set from the `_headers` file the build
 * writes from this list (`headersFile`). A new third-party origin is added here.
 *
 * Imagery tiles come from DGT's two hosts (D18). Geolocation and the screen wake lock are the
 * app's own; every other powerful feature is off.
 */
const TILES = "https://ortos.dgterritorio.gov.pt https://cartografia.dgterritorio.gov.pt";

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "content-security-policy": [
    "default-src 'self'",
    "script-src 'self' https://challenges.cloudflare.com",
    "frame-src https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${TILES}`,
    "worker-src 'self' blob:",
    `connect-src 'self' ${TILES}`,
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; "),
  "strict-transport-security": "max-age=31536000",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy":
    "geolocation=(self), screen-wake-lock=(self), camera=(), microphone=(), payment=(), usb=()",
};

/** The `_headers` file that applies `headers` to every static asset. */
export function headersFile(headers: Readonly<Record<string, string>>): string {
  const lines = Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`);
  return ["/*", ...lines, ""].join("\n");
}
