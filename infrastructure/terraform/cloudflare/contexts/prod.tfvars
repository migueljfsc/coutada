environment = "prod"

# cloudflare_account_id comes from TF_VAR_cloudflare_account_id (locally, or the
# CLOUDFLARE_ACCOUNT_ID secret in CI); the API token from CLOUDFLARE_API_TOKEN.

d1_jurisdiction = "eu"

# Shared across projects; this stack owns coutada.migueljfsc.dev only.
domain = "migueljfsc.dev"

# Add coutada.migueljfsc.dev in Resend, then paste its `resend._domainkey` value.
resend_dkim_public_key = ""

turnstile_extra_domains = []
