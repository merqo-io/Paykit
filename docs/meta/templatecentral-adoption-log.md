# templateCentral adoption log

Moved from AGENTS.md. History of templateCentral harness reviews and dated project notes.

## templateCentral 7.2.2 review (2026-11-04)

`harness.json` moved 6.0.4 → 7.2.2 by 3-way merge (6.0.4 upstream → 7.2.2
upstream, applied onto this repo's files so its local lines are kept), mirroring
merqo-io/Merqo#128. Adopted:

- **6.0.5 `block-no-verify.sh` strict `&&` chain:** `cd <repo> && git commit` is
  judged only by the directories git runs in, so it passes from a `main`
  checkout when the `cd` lands on a feature branch. Anything that is not a
  strict chain of literal `cd`s keeps the starting directory as a candidate.
  Upstream's test cases are ported into `block-no-verify.test.sh`.
- **7.0.0 `session-context.sh`:** no longer prints `head -30 AGENTS.md`
  (`CLAUDE.md` already imports `@AGENTS.md`); the always-on invariants stay.
- **7.2.2 security:** `engines.node >=24.22.1` in `package.json` so no runtime
  trusts the compromised eMudhra intermediate CAs. Every `setup-node` step in
  `ci.yml` and `security.yml` is pinned to `node-version: 24.22.1`, because a
  bare `24` does not enforce the floor; bump the pin deliberately.
- **6.1.0/6.1.1 deps gate:** the `deps` case of upstream `ci-gates.sh` ported
  as a standalone `.claude/deps-gate.sh` (pnpm branch only; no `ci-gates.sh`
  here). Fail-closed on high/critical advisories, a missing tool, no network or
  an unparseable report; rejects pnpm-native suppressions; expiring allowlist in
  `.claude/dep-audit-allow.txt`. `security.yml` runs it in place of
  `pnpm audit --prod --audit-level=high` and the informational `|| true` step.
  `protect-files.sh` asks before edits to the allowlist.

Not adopted:

- Authz helpers: better-auth only; authorization here is RLS.
- Portal `frame-ancestors`: appCentral only.
- Azure DevOps and OpenCode items.
- Template trees, `tc-copy.sh` and scaffold internals.
- Lefthook-only items (this repo's `.husky` layer is kept).
- Prose prune of upstream docs.

**templateCentral 6.0.4 review (2026-10-12):** `harness.json` moved 5.15.0 →
6.0.4, porting the harness qkit adopted in its own 6.0.1 and 6.0.4 reviews
(qkit's `AGENTS.md` holds the full reasoning). The scripts were 3-way merged
against qkit's, so this repo's local lines are kept. Adopted:

- Hook commands anchored on `${CLAUDE_PROJECT_DIR}`, each with a timeout. The
  old relative paths resolved against the shell's current directory.
- `stop-checks.sh` skips the test run on a clean tree; `subagent-stop.sh`
  skips read-only agents; `post-edit-typecheck.sh` reports through
  `additionalContext`.
- The skill-usage matcher (`Skill__.*` never matched; now `Skill`), and
  `NotebookEdit` on the `protect-files.sh` matcher.
- The per-segment `block-no-verify.sh`: closes a hook-skipping flag on push,
  `--force-with-lease`, `HEAD:main`, deleting a protected branch and
  `bash -c` wrappers. A bare `git commit` / `git push` is judged by the
  branch it can land on (the hook input's `cwd` plus every literal `cd`
  target), so a worktree commit is no longer blocked by the main checkout
  sitting on `main`. Anything the hook cannot resolve also judges the
  project root: use a bare `git commit` or `git -C <literal path>`.
- `protect-files.sh`: symlinked parents resolved, `notebook_path` read,
  relative paths anchored on the project root.
- `verify-harness.sh` fails on an unreadable or empty manifest.
- The commit-msg gate accepts `type(scope)!:` and the messages git writes
  itself (`Revert "…"`, `fixup!`, `squash!`, `amend!`).
- The PR-only CI gates (changelog, readme, comment hygiene) fail when
  `origin/<base>` is missing and read the base branch from `env`.
- `post-tool-failure.sh` removed (the agent already sees tool errors).

Not adopted, for qkit's reasons: exec-form hooks (`"command": "bash",
"args": [...]`; a bare `bash` resolved without a shell on Windows can be
the WSL launcher, so any hook that used that form here is now a shell
string), the gitleaks command and allowlist syntax changes, the shared
`.claude/ci-gates.sh`, `.claude/hooks/local/`, and every Azure DevOps and
OpenCode item.

## Project-specific notes

- This repo is a fresh harness seeded from the sibling project `qkit` (same
  templateCentral Supabase variant, same shared Supabase project, different
  schema) — same seeding precedent loopkit used. The EMVCo PayNow QR builder
  (`src/lib/payments/paynow.ts`) is ported **verbatim** from qkit; it originated
  in qkit's own
  `docs/superpowers/specs/2026-06-28-qkit-payments-seam-design.md`.
- Design: `docs/superpowers/specs/2026-07-15-paykit-mvp-design.md`. Plan of
  record: `docs/superpowers/plans/2026-07-15-paykit-mvp.md`.
- Cutting qkit (or any other kit) over to actually call paykit started
  2026-08-11 with `POST /api/v1/vendors/{vendor_id}/config` (kit-auth
  config write, for qkit's own "quick add PayNow details" dashboard UI).
  qkit's checkout flow itself completed its own cutover to
  `POST /api/v1/checkout` (see "What paykit is" above).
- **Booking-status read for qkit's booth dashboard (2026-08-26):** qkit
  event-mode booths now store a vendor-pasted `paykit_booking_id` on their
  own `booths` row (vendor already owns both sides; no lookup/matching by
  name/phone — a prior fuzzy-match design was rejected as a cross-tenant
  leak risk). `GET /api/v1/bookings/{booking_id}` exposes that booking's
  live status read-only, same bearer-kit-auth/service-role pattern as the
  vendor-config route above, and — like every other `/api/v1/*` route —
  trusts the calling kit server-to-server rather than verifying vendor
  ownership of the booking.
