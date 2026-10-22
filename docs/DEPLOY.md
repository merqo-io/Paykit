# paykit — Deploy Notes

paykit uses the shared Merqo Supabase project and owns the `paykit` schema.

## Deployment prerequisites

1. Expose `paykit` through the Data API. Apply pending Paykit migrations in
   order; follow the project `supabase-migrate` safety gate before any hosted
   database change. Do not rerun only the original core migration as an upgrade.
2. Apply the required Merqo shared profile, support, feedback and legal RPC
   migrations before deploying callers. The profile table belongs to
   `merqo.vendor_profile`; shared `vendor-images` Storage policies must also exist.
3. Configure the blank values listed in `.env.example`. Supabase service and
   cross-kit bearer secrets stay server-only. Metrics and provisioning secrets
   must be distinct; Merqo's outbound legal integration requires its base URL
   and customer secret so signed-in vendors can pass the legal gate.
4. Scope `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN=.merqo.io` to Production, plus Preview
   for Git branch `staging` only (see Staging). Leave it unset for localhost
   and `*.vercel.app` previews, where that domain cookie would be rejected. Rebuild after changing public environment values.
5. Register each real calling kit's API key using `scripts/create-kit-key.mjs`.
   Its default insert rejects an existing key; use `--rotate` only for an
   intentional coordinated replacement and update the caller's secret.

## Payment and rollout checks

qkit's checkout calls Paykit's HTTP API. Validate creation, customer claim/undo
and vendor confirmation with a local fixture before rollout. Unit mocks do not
prove RLS or migration behavior; run the focused SQL suites against a local
database as described in `supabase/tests/README.md`.

Paykit records payment state and refunds; vendors move funds through their own
payment method. Its default direct provider has no payment-provider webhook.
An enabled alternative provider requires its own documented setup.

Preview and Production deployment behavior should be verified independently;
this runbook does not establish which migrations or secrets are currently live.

## Staging

Vercel `Preview` deployments use the shared staging Supabase project
(`merqo-staging`), not production. The `staging` branch, kept on `main` by
the `staging sync` workflow, is served at `paykit-staging.merqo.io`. Full
setup, the env model and the rollout checklist live in merqo's
`docs/STAGING.md`. paykit's `Preview` values:

- `NEXT_PUBLIC_SUPABASE_URL` (team shared), `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SECRET_KEY`: the staging project.
- `MERQO_BASE_URL` (`https://staging.merqo.io`) and `MERQO_CUSTOMER_SECRET`:
  the team shared Preview copies, which hold staging values.
- `MERQO_METRICS_SECRET`, `MERQO_PROVISION_SECRET`: staging-only values,
  never the production ones, matching paykit's row in the staging
  `merqo.products` (merqo's `supabase/seed/staging-registry.sql`).
- `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN`: `.merqo.io` for Git branch `staging` only,
  so one sign-in covers the staging hosts. Never on other previews, where the
  browser rejects the cookie and sign-in breaks.
- qkit's staging caller row in `paykit.kit_api_keys` comes from
  `supabase/seed/staging-kit-keys.sql` (run in the staging SQL Editor), not
  from `scripts/create-kit-key.mjs`. Its two secrets must equal qkit's
  Preview `PAYKIT_KIT_SECRET` and `PAYKIT_CALLBACK_SECRET`.

Vercel Deployment Protection must be off on this project (it still challenges
a branch-assigned domain), and the sync workflow needs the repo secret
`VERCEL_STAGING_DEPLOY_HOOK`: Vercel does not git-deploy a commit it already
built for production, so the workflow calls the deploy hook instead.

Load the `paykit` schema on staging with `scripts/staging-migrate.sh`, after
merqo's and qkit's, not with `supabase db push`: every kit shares one
migration history table and reuses the same version numbers.

### Migration-bearing PRs: staging first

Before merging a PR that adds a file under `supabase/migrations/`:

1. Apply only the new file(s) to staging, from the PR branch checkout, with
   `STAGING_DB_URL` set to the staging session pooler URI (merqo's
   `docs/STAGING.md`, setup step 2):
   `docker run --rm -e STAGING_DB_URL -v "${PWD}:/repo:ro" postgres:17.6-alpine sh /repo/scripts/staging-migrate.sh supabase/migrations/<new-file>.sql`
2. Check the PR's own Vercel preview end to end. It already uses the staging
   database and the other apps' staging hosts.
3. Merge the PR.
4. Apply the same file to production the usual way (Supabase SQL Editor).
