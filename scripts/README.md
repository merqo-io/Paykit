# scripts

create-kit-key.mjs creates a calling-kit bearer key and stores its hash. Existing kit names fail closed unless rotation is explicitly requested. Use the secret rotation runbook for the operational cutover; tests replace randomness and database calls without loading deployment secrets.

staging-migrate.sh applies `supabase/migrations` to the shared staging Supabase project with psql, one transaction per file. Run it inside `postgres:17.6-alpine` with the repo mounted at `/repo` (merqo's `docs/STAGING.md`). With no arguments it bootstraps every file and refuses if the `paykit` schema already exists; with file arguments it applies only those, for the staging-first migration gate.
