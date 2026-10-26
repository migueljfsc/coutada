# ==============================================================================
# Turnstile — the bot check on joining a hunt, creating a device, and the two
# mail-sending auth routes (D4, D5, D10).
#
# The sitekey is public and goes into the app; the secret goes to the Worker with
# `wrangler secret put TURNSTILE_SECRET_KEY`. The secret sits in state (private R2),
# never in the repository.
# ==============================================================================

resource "cloudflare_turnstile_widget" "app" {
  account_id = var.cloudflare_account_id
  name       = "${local.name_prefix}-app"
  domains    = local.turnstile_domains
  mode       = "managed"
}
