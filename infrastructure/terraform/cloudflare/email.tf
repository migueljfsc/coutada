# ==============================================================================
# DNS for sending the verification and reset links through Resend (D4). Nothing
# here receives mail.
#
# Mail is sent from the app's hostname, coutada.<domain>, verified in Resend as a
# domain of its own. Add it in Resend choosing MANUAL setup, copy the
# `resend._domainkey` value into `resend_dkim_public_key`, apply, then press
# Verify in Resend.
# ==============================================================================

locals {
  has_mail = local.has_domain && var.resend_dkim_public_key != ""
}

resource "cloudflare_dns_record" "resend_dkim" {
  count = local.has_mail ? 1 : 0

  zone_id = data.cloudflare_zone.this[0].zone_id
  name    = "resend._domainkey.${local.app_fqdn}"
  type    = "TXT"
  content = "\"${var.resend_dkim_public_key}\""
  ttl     = 1
}

# Resend's bounce and SPF domain. A CNAME cannot share its name with any other record.
resource "cloudflare_dns_record" "resend_send" {
  count = local.has_mail ? 1 : 0

  zone_id = data.cloudflare_zone.this[0].zone_id
  name    = "send.${local.app_fqdn}"
  type    = "CNAME"
  content = var.resend_send_target
  proxied = false
  ttl     = 1
}

# Monitoring only (`p=none`).
resource "cloudflare_dns_record" "dmarc" {
  count = local.has_mail ? 1 : 0

  zone_id = data.cloudflare_zone.this[0].zone_id
  name    = "_dmarc.${local.app_fqdn}"
  type    = "TXT"
  content = "\"v=DMARC1; p=none;\""
  ttl     = 1
}
