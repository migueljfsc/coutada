# Infrastructure

One stack: [`terraform/cloudflare/`](terraform/cloudflare/) owns the D1 database (jurisdiction
`eu`), the Turnstile widget and the DNS records for mail, applied by
`.github/workflows/terraform.yml`.

## Where the Worker is

In [`worker/`](../worker/), with `wrangler.jsonc` at the repository root. It is application code.
The deploy is `.github/workflows/deploy-worker.yml`: it builds, migrates and ships.

## What is outside the stack

- **The Worker script.** A Worker with static assets is deployed in three calls ending in a
  completion JWT that expires in an hour; `cloudflare_workers_script` accepts only that finished
  token, which Terraform can neither produce nor hold (pb-D40).
- **Secrets**, via `wrangler secret put`, so they never reach the state bucket.
- **The CI API token**, made by hand in the dashboard: a stack that owns its own credential can
  revoke itself mid-apply.

## First apply

1. `tofu init` with the R2 state credentials (see `terraform/cloudflare/backend.tf`).
2. `tofu apply -var-file=contexts/prod.tfvars`.
3. Paste `tofu output d1_database_id` into `wrangler.jsonc`.
4. Add `coutada.migueljfsc.dev` in Resend (manual setup), paste its DKIM value into
   `contexts/prod.tfvars`, apply again, press Verify in Resend.

After that, both the stack and the Worker are applied by CI on a push to `main`, gated on the
`cloudflare-production` environment.
