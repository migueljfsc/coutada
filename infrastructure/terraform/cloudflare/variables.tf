###################### CLOUDFLARE ACCOUNT ######################

variable "cloudflare_api_token" {
  type        = string
  description = "Cloudflare API token. Prefer the CLOUDFLARE_API_TOKEN env var over passing this."
  sensitive   = true
  default     = null
}

variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account ID."
  nullable    = false

  validation {
    condition     = var.cloudflare_account_id != ""
    error_message = "Cloudflare account ID cannot be empty."
  }
}

###################### NAMING ######################

variable "project_name" {
  type        = string
  default     = "coutada"
  description = "Base name of every resource, and the app's subdomain."
}

variable "environment" {
  type        = string
  default     = "prod"
  description = "Deployment environment, carried in resource names."
}

###################### D1 ######################

variable "d1_jurisdiction" {
  type        = string
  default     = "eu"
  description = "Where the D1 database runs and stores data (eu | us | fedramp) (D16)."
}

###################### CUSTOM DOMAIN ######################

variable "domain" {
  type        = string
  default     = ""
  description = <<-EOT
    Personal apex domain in this Cloudflare account, shared with other projects; this stack only
    creates records under `project_name`. The Worker is served from <project_name>.<domain>
    (wrangler.jsonc `routes`) and mail is sent from it. Empty skips every DNS resource.
  EOT
}

###################### EMAIL (Resend) ######################

variable "resend_dkim_public_key" {
  type        = string
  default     = ""
  description = <<-EOT
    The `resend._domainkey` TXT value Resend shows once the domain is added there (starts `p=`).
    Public by nature. Empty skips every email record.
  EOT
}

variable "resend_send_target" {
  type        = string
  default     = "send.forge.rmta.net"
  description = "Where Resend's `send.` record points, as its dashboard lists it for the domain."
}

variable "resend_rsend_target" {
  type        = string
  default     = "rsend-euw1.forge.rmta.net"
  description = "Where Resend's regional `rsend.` record points, as its dashboard lists it for the domain."
}

###################### TURNSTILE ######################

variable "turnstile_extra_domains" {
  type        = list(string)
  default     = []
  description = "Hostnames besides the app's own that serve a Turnstile challenge."
}
