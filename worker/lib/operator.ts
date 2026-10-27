/** Who the operator is (D26): an address in `ADMIN_EMAILS`, matched against a verified session. */

import type { SessionUser } from "./session";

export function adminEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0),
  );
}

export const isAdmin = (user: SessionUser | null, raw: string | undefined): boolean =>
  user !== null && adminEmails(raw).has(user.email.toLowerCase());
