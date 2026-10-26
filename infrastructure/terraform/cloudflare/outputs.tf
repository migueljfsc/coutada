# The D1 id is pasted into wrangler.jsonc's d1_databases binding after the first apply.
output "d1_database_id" {
  value       = cloudflare_d1_database.app.id
  description = "D1 database id, for the d1_databases binding in wrangler.jsonc."
}

output "d1_database_name" {
  value       = cloudflare_d1_database.app.name
  description = "D1 database name, for the binding and `wrangler d1` commands."
}

output "turnstile_sitekey" {
  value       = cloudflare_turnstile_widget.app.sitekey
  description = "Turnstile sitekey — public, used by the app."
}

output "turnstile_secret_key" {
  value       = cloudflare_turnstile_widget.app.secret
  sensitive   = true
  description = "Turnstile secret, for `wrangler secret put TURNSTILE_SECRET_KEY`. Read with -raw."
}
