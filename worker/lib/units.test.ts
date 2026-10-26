import { describe, expect, it } from "vitest";
import { cookie, readCookie } from "./cookies";
import { randomCode } from "./crypto";
import { cleanUsername } from "./devices";
import { decodeJwtPayload, identityFromClaims, safeNext } from "./google";
import { composeMail } from "./mail";
import { hashKey, isKey, normaliseEmail, verifyKey } from "./password";
import { SESSION_SLIDE_AFTER_S, SESSION_TTL_S, sessionCookie, shouldRenew } from "./session";

const KEY = "a".repeat(43);

describe("cookies", () => {
  it("finds one among others, by whole name, splitting on the first equals only", () => {
    expect(readCookie("a=1; ct_session=tok; b=2", "ct_session")).toBe("tok");
    expect(readCookie("xct_session=no; ct_session_old=no", "ct_session")).toBeNull();
    expect(readCookie("ct_session=a=b", "ct_session")).toBe("a=b");
    expect(readCookie(null, "ct_session")).toBeNull();
  });

  it("are HttpOnly, Secure and SameSite=Lax", () => {
    const c = sessionCookie("tok", SESSION_TTL_S);
    for (const flag of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/", `Max-Age=${SESSION_TTL_S}`]) expect(c).toContain(flag);
    expect(cookie("x", "", 0)).toContain("Max-Age=0");
  });
});

describe("sessions", () => {
  const now = 1_800_000_000;
  it("slide only once they have lost a day", () => {
    expect(shouldRenew(now + SESSION_TTL_S, now)).toBe(false);
    expect(shouldRenew(now - SESSION_SLIDE_AFTER_S + SESSION_TTL_S, now)).toBe(false);
    expect(shouldRenew(now - SESSION_SLIDE_AFTER_S - 1 + SESSION_TTL_S, now)).toBe(true);
  });
});

describe("passwords", () => {
  it("verify the key they hashed, under the same pepper, and nothing else", async () => {
    const stored = await hashKey(KEY, "pepper");
    expect(stored.startsWith("v2$")).toBe(true);
    expect(await verifyKey(KEY, stored, "pepper")).toBe(true);
    expect(await verifyKey("b".repeat(43), stored, "pepper")).toBe(false);
    expect(await verifyKey(KEY, stored, "other")).toBe(false);
    expect(await hashKey(KEY, "pepper")).not.toBe(stored);
  });

  it("refuse to hash without a pepper, and never match a missing row", async () => {
    await expect(hashKey(KEY, "")).rejects.toThrow();
    for (const stored of [null, "", "v1$a$b", "v2$$"]) expect(await verifyKey(KEY, stored, "pepper")).toBe(false);
  });

  it("accept only 32-byte base64url keys and plain addresses", () => {
    expect(isKey(KEY)).toBe(true);
    expect(isKey("a".repeat(42))).toBe(false);
    expect(normaliseEmail("  Pai@Example.PT ")).toBe("pai@example.pt");
    expect(normaliseEmail("pai@example")).toBeNull();
  });
});

describe("google", () => {
  it("decodes a UTF-8 payload and accepts only a verified address from Google for this client", () => {
    const payload = { iss: "https://accounts.google.com", aud: "client", sub: "1", email: "Pai@Example.pt", email_verified: true, name: "João Caçador" };
    const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payload)))).replace(/=+$/, "");
    expect(decodeJwtPayload(`h.${b64}.s`)).toEqual(payload);
    expect(identityFromClaims(payload, "client")).toEqual({ subject: "1", email: "pai@example.pt", displayName: "João Caçador" });
    expect(() => identityFromClaims({ ...payload, email_verified: false }, "client")).toThrow("email_unverified");
    expect(() => identityFromClaims(payload, "other")).toThrow("bad_audience");
  });

  it("returns only to a same-origin path", () => {
    expect(safeNext("/m/abc?x=1")).toBe("/m/abc?x=1");
    for (const bad of [null, "", "https://evil.test", "//evil.test", "/\\evil.test"]) expect(safeNext(bad)).toBe("/");
  });
});

describe("the rest", () => {
  it("draws codes only from their alphabet", () => {
    const code = randomCode("23456789bcd", 200);
    expect(code).toMatch(/^[2-9bcd]{200}$/);
  });

  it("escapes the link in the mail's HTML", () => {
    const mail = composeMail("verify", "pt", 'https://coutada.test/?verify=a&b="c"');
    expect(mail.html).toContain("verify=a&amp;b=&quot;c&quot;");
    expect(mail.subject).toContain("Coutada");
  });

  it("cleans usernames", () => {
    expect(cleanUsername("  João  ")).toBe("João");
    for (const bad of ["", "   ", "a".repeat(25), "tab\there", 3]) expect(cleanUsername(bad)).toBeNull();
  });
});
