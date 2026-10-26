locals {
  # Cloudflare resources take no tags, so the name carries project and environment.
  name_prefix = "${var.project_name}-${var.environment}"

  d1_database_name = local.name_prefix

  has_domain = var.domain != ""

  # The domain is shared across projects; this stack claims only <project_name>.<domain>.
  app_fqdn = local.has_domain ? "${var.project_name}.${var.domain}" : null

  # Every hostname that serves a Turnstile challenge (D4, D5, D10).
  turnstile_domains = compact(concat([local.app_fqdn], var.turnstile_extra_domains))
}
