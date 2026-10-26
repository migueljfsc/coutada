# Remote state in the shared R2 bucket, through the S3-compatible backend. The endpoint comes from
# the environment:
#
#   export AWS_ENDPOINT_URL_S3="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
#   export AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=...   # an R2 API token
#   tofu init
terraform {
  backend "s3" {
    bucket = "terraform-tfstate"
    key    = "coutada/cloudflare/terraform.tfstate"
    region = "auto"

    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
    use_path_style              = true
  }
}
