# docs

- `DEPLOY.md` — Supabase/Vercel deployment runbook.
- `SECRET_ROTATION.md` — how to safely rotate a calling kit's bearer
  secret (today's real hard-cutover constraint, using `last_used_at` to
  confirm timing), and how to rotate the separate callback secret.
- `meta/` — standing backlog / cross-cutting project-management docs.
- `superpowers/` — per-feature specs (`specs/`) and implementation plans
  (`plans/`). Granular per-task history for the MVP build itself lives at
  `.superpowers/sdd/` (repo root, outside `docs/`).

## Boundary and coverage

paykit-audit-2026-10-08.md records the security and maintainability review. Dependency fixes and application checks are distinct from database runtime validation; read the migration and concurrency test results before applying the reviewed SQL changes.
