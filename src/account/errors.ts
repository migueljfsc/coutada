import type { MessageKey } from "../i18n/core";

const KEYS: Record<string, MessageKey> = {
  network: "error.network",
  rate_limited: "error.rateLimited",
  captcha_failed: "error.captcha",
  invalid_credentials: "auth.wrong",
  invalid_token: "auth.linkExpired",
  invalid_request: "auth.invalid",
  map_limit_reached: "maps.limit",
  invalid_username: "device.nameInvalid",
  invalid_code: "transfer.invalid",
  confirmation_mismatch: "delete.mismatch",
  invalid_document: "doc.invalid",
};

/** The words for an API error code; anything unforeseen reads as a generic failure. */
export const errorKey = (code: string): MessageKey => KEYS[code] ?? "error.unknown";
