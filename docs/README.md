# docs

- `DEPLOY.md` — Supabase/Vercel deployment runbook, including the Staging section: paykit's `Preview` values on the shared staging Supabase project, qkit's staging caller key, and the staging-first gate for PRs that add a migration. Also covers which branches deploy: only `main` and `staging` from git, previews via the `vercel` CLI.
- `SECRET_ROTATION.md` — how to safely rotate a calling kit's bearer
  secret (today's real hard-cutover constraint, using `last_used_at` to
  confirm timing), and how to rotate the separate callback secret.
- `merqo-ui-login-gaps.md`: where the shared `AuthShell` and `LoginForm` from `@merqo/ui` fall short of paykit's old login page, with the smallest change to close each gap; written for the other five kits before they adopt the shared form.
- `FILE-LAYOUT.md` (lists the entitlement receiver, cache readers, the `src/lib/db-types/` type files, and the proof-storage drain and its cron route): the repo file tree with one-line descriptions (moved from `AGENTS.md`).
- `DATA-MODEL.md` (includes `vendor_entitlements`, merqo's cached per-vendor plan): tables, constraints and RLS rules (moved from `AGENTS.md`).
- `meta/` — standing backlog / cross-cutting project-management docs.
- `superpowers/` — per-feature specs (`specs/`) and implementation plans
  (`plans/`). Granular per-task history for the MVP build itself lives at
  `.superpowers/sdd/` (repo root, outside `docs/`).

## Boundary and coverage

paykit-audit-2026-10-08.md records the security and maintainability review. Dependency fixes and application checks are distinct from database runtime validation; read the migration and concurrency test results before applying the reviewed SQL changes.
