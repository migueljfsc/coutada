# ==============================================================================
# D1 — accounts, devices, maps, the hunts index and saved trails. OpenTofu owns
# the database; wrangler owns its schema (worker/migrations) (D1).
# ==============================================================================

resource "cloudflare_d1_database" "app" {
  account_id   = var.cloudflare_account_id
  name         = local.d1_database_name
  jurisdiction = var.d1_jurisdiction

  # Optional and not computed in the provider: omitting it plans a removal that the API refuses.
  read_replication = {
    mode = "disabled"
  }
}
