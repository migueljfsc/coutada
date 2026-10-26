/**
 * A Google identity to an account: by `(provider, subject)` first, then by verified email, linking
 * rather than duplicating — two accounts for one person is the failure designed out.
 */

import { newId } from "./crypto";
import type { GoogleIdentity } from "./google";
import type { SessionUser } from "./session";

type Row = { id: string; email: string; display_name: string | null };
const toUser = (r: Row): SessionUser => ({ id: r.id, email: r.email, displayName: r.display_name });

export async function userForGoogleIdentity(env: Env, identity: GoogleIdentity, now: number): Promise<SessionUser> {
  const linked = await env.DB.prepare(
    `SELECT u.id, u.email, u.display_name FROM identities i JOIN users u ON u.id = i.user_id
      WHERE i.provider = 'google' AND i.subject = ?1`,
  )
    .bind(identity.subject)
    .first<Row>();
  if (linked) return toUser(linked);

  const byEmail = await env.DB.prepare("SELECT id, email, display_name FROM users WHERE email = ?1")
    .bind(identity.email)
    .first<Row>();
  if (byEmail) {
    await env.DB.prepare("INSERT INTO identities (provider, subject, user_id, created_at) VALUES ('google', ?1, ?2, ?3)")
      .bind(identity.subject, byEmail.id, now)
      .run();
    return toUser(byEmail);
  }

  const id = newId();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?1, ?2, NULL, ?3, ?4)").bind(
      id,
      identity.email,
      identity.displayName,
      now,
    ),
    env.DB.prepare("INSERT INTO identities (provider, subject, user_id, created_at) VALUES ('google', ?1, ?2, ?3)").bind(
      identity.subject,
      id,
      now,
    ),
  ]);
  return { id, email: identity.email, displayName: identity.displayName };
}
