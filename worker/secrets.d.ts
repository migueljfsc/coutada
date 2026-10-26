/**
 * Secrets, which wrangler.jsonc cannot hold; merged into the `Env` that `wrangler types`
 * generates. Set with `wrangler secret put <NAME>`.
 */

interface Env {
  /** Google OAuth client id; public, it travels in the authorize URL. */
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  /** Resend API key, sending access only. */
  RESEND_API_KEY: string;
  /** The Turnstile widget's secret. */
  TURNSTILE_SECRET_KEY: string;
  /** Keys the stored password MACs (D4). Never rotated: losing it locks out every password account. */
  PASSWORD_PEPPER: string;
}
