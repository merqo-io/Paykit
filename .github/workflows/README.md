# workflows

## Purpose

GitHub Actions CI pipelines: `ci.yml` (harness integrity, check, unit tests,
coverage gate, build, e2e public smoke, mutation, db migrations + RLS, changelog gate,
README-freshness gate, comment-hygiene gate) and `security.yml` (gitleaks
secret scan, dependency audit).

## Contents

- `ci.yml` — triggers on push to `main` and on every PR. Jobs: `test`
  ("check + unit" — harness-integrity check, `pnpm check`, `pnpm exec vitest --run --coverage`, then
  a changed-line coverage gate via `diff-cover` against `origin/main`,
  failing under 80%); `db` ("db (migrations + pgTAP RLS)"); `build` ("build
  (next build)" — `pnpm build` with dummy Supabase env vars); `mutation`
  ("mutation (changed lib)" — Stryker against changed `src/lib` files,
  passing `--diff-filter=d` so deleted paths are dropped: a PR that only
  removes lib files, e.g. code promoted into `@merqo/ui` with its tests,
  would otherwise hand Stryker paths that no longer exist and fail with
  "No tests were executed");
  `changelog` (PR-only — if `src/` changed, `CHANGELOG.md` must also be in
  the PR diff; skippable via `skip-changelog`); `readme-freshness` (PR-only
  — if a folder's files changed, that folder's `README.md` must also be in
  the PR diff; skippable via `skip-readme-check`); `comment-hygiene`
  (PR-only — hard-fails on change-narration comments in _added_ lines only,
  via the keyword patterns in `.claude/comment-hygiene-patterns.txt`;
  skippable via `skip-comment-check`).
  Also `e2e` ("e2e (public smoke)": installs Chromium and runs the Playwright specs in `e2e/` against `pnpm dev` with dummy Supabase values).
- `security.yml` — gitleaks secret scan + `pnpm audit`, triggered on push to
  `main` and every PR. Its weekly schedule runs only the CodeQL job, which is disabled for private repositories; the secret scan and audit skip scheduled events.
  The gitleaks job installs the pinned release binary and checks its SHA-256, because gitleaks-action needs a paid license on organization-owned repos. It scans the PR commits, or the pushed range on `main`.

## Connectivity

`ci.yml`'s `test` job depends on `.claude/verify-harness.sh` and
`.claude/harness.json` (see `.claude/README.md`) staying in sync.
`security.yml` is what husky's `pre-commit` gitleaks step mirrors locally.

The `readme-freshness` gate skips `.claude/.harness-base/`, a snapshot of seeded harness files with no READMEs of its own.

## Parent

[.github](../README.md)

The unit suite runs once with coverage. Vitest enforces at least 80% statements, branches, functions and lines over production source; any existing changed-line coverage gate remains in place.

The three PR-only gates in `ci.yml` (changelog, README freshness, comment hygiene) fail when `origin/<base>` is missing, and read the base branch from `env`.
