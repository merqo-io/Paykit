# AI harness reference

Moved from AGENTS.md. Full description of the hooks, permissions, git hooks and CI gates.

PreToolUse(Read|Edit|Write): normalize Windows and relative paths; hard-block
secret-file reads and writes (environment files except the blank templates,
secret directories and certificate/credential files). Governance and CI/CD
writes require human approval; their reads are allowed. Ordinary application
code, skills and specifications remain unrestricted. The Bash guard continues
to block hook bypasses, protected-branch force pushes and destructive guard edits.
UserPromptSubmit: credential-shaped input is blocked; injection-phrase matches
produce advisory context so quoted security research can proceed.
PostToolUse: `tsc --noEmit --incremental` after every Edit/Write, plus a
comment-hygiene scan (`post-edit-comment-check.sh`) flagging change-narration
comments (`was`/`added`/dated/ticket-ref-shaped openers, per
`.claude/comment-hygiene-patterns.txt`) and oversized comment blocks on the
edited file. Both feedback-only, never block.
Stop: exits 0 when `stop_hook_active` (no re-entry loop); else runs the test
suite, exit 2 feeds failures back, exit 0 on pass.
SessionStart (startup|resume|compact): re-injects first 30 lines of this file.
`permissions`: max-privilege — bare-tool `allow` (Bash/Read/Edit/Write/web/Skill/
Task) so common work doesn't prompt; `deny` covers secret reads/edits (`.env.local`
and other `.env.<env>` variants, `./secrets/**` — `.env.example` is the one
whitelisted env file) and irreversible ops (`rm -rf`, `git push --force`/`-f`,
`git reset --hard`, `git clean -fd/-fx`, `git filter-branch`, ref-delete). `ask`
gates `Edit(...)` (covers both Edit and Write) on the medium-security governance
files: `AGENTS.md`, `CLAUDE.md`, `docs/CONSTITUTION.md`, `.claude/harness.json`,
`.claude/settings.json`, `.claude/settings.local.json`. Deny always wins (enforced
even under bypass); it's a guardrail, not a sandbox.
Git hooks (husky): pre-commit runs format/lint/typecheck, a
`--frozen-lockfile` install gated on `package.json` changes
(lockfile-in-sync — also re-checked in CI), gitleaks secret-scan on staged
files, a readme-coupling staleness warning, and a comment-hygiene warning
(same pattern list as the PostToolUse hook, both warn-only); commit-msg enforces
Conventional Commits; pre-push runs the harness integrity check + quality
gate. Hard-local; coverage/changed-line gates run in CI. Migrated
2026-08-01 off lefthook, whose unsigned `lefthook.exe` Windows Smart App
Control blocks unconditionally — see
`docs/superpowers/specs/2026-08-01-lefthook-to-husky-migration-design.md`.
CI (GitHub Actions): `test` (check + unit + coverage) with a hard gate on
changed-line coverage (`diff-cover` ≥80%), `build` (`next build` — the one
job that catches Next.js client/server bundle-boundary errors `pnpm
check`/`pnpm test` miss), `e2e` ("e2e (public smoke)", the Playwright specs
in `e2e/`), existing `db` (pgTAP RLS) and `mutation`
(Stryker, advisory) jobs, a lockfile-in-sync re-check, a changelog-touched
check, a readme-freshness check, a comment-hygiene check (hard gate, scoped
to added lines only, against the first 10 lines of
`.claude/comment-hygiene-patterns.txt` — the narration-keyword patterns, not
the lower-precision date/ticket-ref ones; `skip-comment-check` label
bypasses), harness integrity, and (via `security.yml`) a full-history
gitleaks scan + `pnpm audit` + CodeQL.
RLS isolation: `supabase/tests/rls.test.sql` via `supabase test db`.
Project skills (directory form, `<name>/SKILL.md`): `.claude/skills/` |
Manifest: `.claude/harness.json`. Fully armed: every `.claude/harness.json`
entry carries a real sha256 as of the 2026-08-01 husky migration's
`regen-harness.sh` run.
