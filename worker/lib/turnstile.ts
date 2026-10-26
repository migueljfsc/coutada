/** Turnstile: on the mail-sending auth routes, device creation and joining a hunt (D4, D5, D10). */

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function passesTurnstile(env: Env, token: unknown, ip: string | null): Promise<boolean> {
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) return false;

  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
  if (ip) body.set("remoteip", ip);

  try {
    const response = await fetch(SITEVERIFY, { method: "POST", body });
    if (!response.ok) return false;
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}
