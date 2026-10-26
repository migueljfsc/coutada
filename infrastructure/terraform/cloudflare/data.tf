data "cloudflare_zone" "this" {
  count = local.has_domain ? 1 : 0

  filter = {
    name = var.domain
  }
}
