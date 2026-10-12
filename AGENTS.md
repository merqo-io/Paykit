<!-- templateCentral: nextjs@6.0.4 (Supabase variant — shared project, schema per kit) -->

# AGENTS.md — paykit

> STOP — This project diverges from the stock templateCentral Next.js stack on
> the data layer only. Auth/DB/realtime are **Supabase** (`@supabase/ssr`), not
> better-auth + Drizzle. Authorization is enforced in Postgres via **RLS**, not
> an app repository layer. Runtime matches tc: Next 16, route protection in
> `src/proxy.ts`, and `cookies()`/`headers()`/`params`/`searchParams` are async.

## What paykit is

The Merqo family's shared vendor payment engine. A standalone kit; owns the
`paykit` schema in the shared Supabase project; any other kit requests a
PayNow QR + tracks payment status over paykit's bearer-secret HTTP API
(`/api/v1/*`). paykit never touches funds — it renders a QR the customer
scans in their own bank app and tracks a status a human confirms. merqo
calls paykit's admin-facing `/api/merqo/vendor-provision` and
`/api/merqo/vendor-status` routes (shipped 2026-07-28). The qkit→paykit
checkout cutover started 2026-08-11: qkit was minted a `kit_api_keys`
bearer secret and paykit now exposes `POST /api/v1/vendors/{vendor_id}/config`
so qkit can write a vendor's `vendor_payment_config` server-to-server (for
a "quick add PayNow details" UI inside qkit's own dashboard, instead of
redirecting to paykit's). **Cutover complete (verified 2026-08-15):** qkit's
checkout flow itself (`booths.payment`, `claimPayment`/`confirmPayment`) now
calls `POST /api/v1/checkout` and the claim/confirm/unclaim endpoints —
shipped in `qkit #66`/`#70`; qkit's local PayNow builder is no longer what's
live for real checkouts. Checkout now also routes through a pluggable
`PaymentProvider` seam (`src/lib/payments/provider.ts`, `paykit #48`) —
today's EMVCo builder is the only ("direct") provider, selected by
`PAYKIT_PROVIDER` (unset/unknown → `direct`), so a real gateway can be added
later as config, not a redesign.

## Stack

Next.js 16 · App Router · Turbopack · TypeScript strict · Tailwind v4 · shadcn/ui
(new-york) · Zod · Supabase (`@supabase/ssr`) · Vitest · pnpm 11 · Node ≥24 ·
deploy target: Vercel

## Commands

```bash
pnpm dev          # dev server — http://localhost:3000
pnpm build        # production build
pnpm test         # run test suite (vitest)
pnpm test:mutation # stryker mutation testing (scoped to src/lib; advisory)
pnpm test:e2e     # playwright public smoke + auth guard (no live database)
pnpm check        # prettier --check + eslint + tsc --noEmit
pnpm format       # prettier --write
```

This kit's testing surface is Unit (mutation-tested `src/lib`), a Contract
test on the HTTP API surface, RLS (pgTAP), DOM, and a Playwright public smoke
(`e2e/`: landing, login and the signed-out auth guard). There is no e2e
coverage of signed-in flows.

## File Layout

```
src/app/                          — app router (dashboard, login, API routes)
src/app/api/v1/checkout/          — POST /api/v1/checkout, GET/POST /api/v1/checkout/{id}[/claim|/confirm]
src/app/api/v1/vendors/           — GET/POST /api/v1/vendors/{vendor_id}/config
src/app/api/v1/bookings/          — GET /api/v1/bookings/{booking_id}
src/app/dashboard/                — vendor dashboard (config, transactions, stats)
src/proxy.ts                      — Supabase session refresh + /dashboard guard (Next 16)
src/lib/supabase/                 — browser / server / service clients + mw helper (schema=paykit)
src/lib/payments/paynow.ts        — EMVCo PayNow QR builder (ported verbatim from qkit)
src/lib/payments/adapter.ts       — renderCheckout (paynow|pointer) + reserved-but-dark auto-verify stub
src/lib/payments/provider.ts      — PaymentProvider seam: direct provider (wraps renderCheckout, unchanged) + getProvider() (PAYKIT_PROVIDER-selected, defaults/falls back to direct)
src/lib/tx-state.ts               — pure pending→claimed→confirmed transition logic
src/lib/checkout.ts               — createCheckout(): shared by POST /api/v1/checkout and dashboard/bookings/actions.ts
src/lib/booking-status.ts         — pure balanceDueBadge(): dashboard-badge-only "balance due soon" reminder
src/lib/kit-auth.ts               — bearer-secret verification for calling kits
src/lib/schemas.ts                — Zod: vendor payment config write schema (paynow|pointer)
src/lib/api-schemas.ts            — Zod: HTTP API request/response contracts + shared uuidSchema path-param validator
src/lib/vendor-session.ts         — shared dashboard auth guard (getVendorSession) + plan lookup (getVendorPlan)
src/lib/pricing.ts                — PricingConfig, DEFAULT_PRICING, getPricing() (shared by admin/dashboard/landing)
src/app/admin/pricing-section.tsx — @merqo/ui PricingForm wired to setPricing + toast
src/lib/types.ts                  — DB types (mirror of supabase/migrations)
scripts/create-kit-key.mjs        — mint + store a hashed bearer secret for a calling kit
supabase/migrations/              — SQL schema + RLS + grants
supabase/tests/rls.test.sql       — pgTAP RLS suite
test/contract/                    — HTTP API contract test (mirrors merqo's qkit-metrics precedent)
```

## Data model

- `vendor_payment_config` (PK `vendor_id`): one payment config per vendor,
  reused across every kit/booth/store that vendor runs. Since 2026-07-22,
  `kind` (`'paynow'`|`'pointer'`) splits config into a generated PayNow QR
  (exactly one of `uen`/`mobile`, `payee_name` required) or a vendor's own
  BYO payment link/QR image (`label` required, exactly one of `url`/
  `qr_image_url`) — see `docs/superpowers/specs/2026-07-22-paykit-multi-
method-byo-design.md`. `payee_name`/`uen`/`mobile` apply only to
  `'paynow'`; `label`/`url`/`qr_image_url` only to `'pointer'`. `plan`
  (`free`|`pro`) gates refund tracking only — transaction history and
  revenue stats are both free; Free tier checkout is unlimited, no
  transaction-volume cap (see
  `docs/superpowers/specs/2026-07-22-paykit-freemium-nudge-redesign-design.md`,
  `docs/superpowers/specs/2026-08-15-paykit-pro-simplification-design.md`).
  This column is a minimal addition beyond the design spec's literal table
  listing, necessary to implement the very Pro-gate the same spec
  describes (see the plan's Self-Review). Pro's price is admin-tunable via
  `/admin` (seeded at $4.99/mo) — see `paykit.pricing`. `verification_method`
  is schema-reserved (`'manual'` only is ever written).
- `transactions`: one row per checkout, `status` `pending`→`claimed`→`confirmed`,
  `kit_slug` records which kit created it, `qr_payload` stored at creation for
  replay/audit.
- `bookings` (`0010_paykit_bookings.sql`): deposit-now/balance-later
  bookings for event-cart vendors (weddings, private events), instead of a
  one-shot checkout. Links up to two `transactions` rows by id
  (`deposit_transaction_id`/`balance_transaction_id`, both nullable — the
  balance one is only created once the vendor's ready to bill it, not at
  booking time). `status` (`pending_deposit`→`deposit_paid`→`fully_paid`,
  or `cancelled`) is kept correct by a Postgres trigger
  (`sync_booking_status()`, on `transactions`' own `status` turning
  `confirmed`) rather than app code, since a transaction can be confirmed
  via the bearer-secret API too, not just this dashboard. A `deposit_
amount_cents + balance_amount_cents = total_amount_cents` CHECK constraint
  enforces the split adds up. Reminders are dashboard-badge-only (no
  cron/notification infra exists in this repo, see `src/lib/booking-
status.ts`) — not a push. `rescheduleBookingAction` updates `event_date`/
  `balance_due_date` directly on the same booking (deposit-carries-forward —
  no new status value, since a `'rescheduled'` state would conflict with
  `sync_booking_status()`'s trigger logic). `cancelBookingAction` optionally
  files a refund against a linked transaction (reuses `refunds`, the same
  Pro/confirmed/ownership `with check` as `issueRefundAction`) but on its
  own never touches either linked transaction's own status.
- `refunds` (Pro only): bookkeeping ledger row against a `confirmed`
  transaction — no real money movement.
- `pricing` (single row, `id` pinned to 1): the Pro price shown on the
  plan page, dashboard nudge, and landing site. Admin-tunable via
  `/admin` (no redeploy needed) — see `paykit.pricing`,
  `src/lib/pricing.ts`. Public-read RLS (the price isn't secret); writes
  go through the service-role `setPricing` action only. Seeded at
  `monthly_cents = 499` ($4.99).
- `kit_api_keys`: one hashed bearer secret per calling kit, service-role only
  (no RLS policy grants any access to `authenticated`/`anon`).
- `admin_audit` (`0006_paykit_admin.sql`): one row per admin- or
  vendor-initiated action worth reconstructing later (`setVendorPlan`,
  `setPricing`, a vendor's own `record_refund` — see `recordAudit()` in
  `src/app/admin/actions.ts`). RLS is admin-read-only; the service-role
  client can `select`/`insert` but not `update`/`delete`
  (`0009_paykit_admin_audit_immutable.sql`) — the app never touches a row
  once written, and closing off `update`/`delete` at the grant level means
  a compromised service-role key still can't rewrite history. **Retention:
  keep `admin_audit` rows for 5 years**, matching IRAS's record-keeping
  norm for a small Singapore business; no archival/purge job exists yet —
  this is the stated policy so retention isn't decided ad hoc later.
- `vendor_prefs` (PK `vendor_id`): dashboard UI state, currently just
  `tour_seen_at` (nullable — a missing row means "hasn't seen the
  onboarding tour yet"). Deliberately separate from
  `vendor_payment_config`, which stays payment-config-only per its own
  column contract above.
- RLS: a vendor reads/writes only their own `vendor_payment_config`; reads
  (not writes) only their own `transactions`; reads/inserts `refunds` only for
  their own confirmed transactions while on Pro; reads/writes only their own
  `vendor_prefs` row; reads/inserts/updates (no delete) only their own
  `bookings` row, except its two transaction-id link columns, which are
  service-role only (same self-escalation-shaped reasoning as `plan`
  above — the policy only checks `vendor_id`, so an unrestricted grant
  would let a vendor repoint a booking at another vendor's transaction).
  The cross-kit API (`/checkout`, `/claim`, `/confirm`) is service-role +
  bearer-secret, server-only.

## Rules (always)

- TypeScript strict — no `any`, no `@ts-ignore`.
- Validate all user input with Zod at every boundary (forms + server actions + API routes).
- Authorization lives in **RLS policies**, not in app code. Never widen a policy
  to "fix" a query — fix the query or the session instead.
- Use the **service-role client only** in Server Actions / Route Handlers, never
  in client components. It bypasses RLS.
- No secrets in `NEXT_PUBLIC_*`. `NEXT_PUBLIC_SUPABASE_*` are inlined at build —
  rebuild after changing them.
- `@supabase/ssr` and `@supabase/supabase-js` versions must stay compatible
  (currently ssr 0.10.x ↔ supabase-js 2.48.x — check package.json, not this
  number) or every query degrades to `never`.
- Every `/api/v1/*` route verifies the caller's bearer secret via
  `verifyKitAuth` before touching the database — never trust an unauthenticated
  `vendor_id` in a request body.
- paykit never touches funds. Do not add a payment-provider SDK, a webhook
  that moves money, or a real auto-verify integration.
- After editing the schema, update both `supabase/migrations/` and
  `src/lib/types.ts`.

## Skills

### Project skills — check here first (`.claude/skills/`)

| Skill               | What it does                                                 |
| ------------------- | ------------------------------------------------------------ |
| `/next-verify`      | typecheck + lint + test in one pass                          |
| `/supabase-migrate` | apply `supabase/migrations` + regenerate types (safety gate) |

### templateCentral plugin skills

templateCentral has **no Supabase support** (auth=better-auth, db=Drizzle/Kysely/Mongoose,
no realtime). Use only the stack-agnostic ones here:

| Skill                       | When to use                                                          |
| --------------------------- | -------------------------------------------------------------------- |
| `templatecentral:standards` | naming/validation/drift-check (expect Supabase-vs-tc drift findings) |

Do **not** run `templatecentral:add (auth)` or `(database)` — they install
better-auth / Drizzle and will break RLS.

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

## AI Harness

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

## Skills Security

- Review `SKILL.md` before installing any third-party skill — treat skills like packages.
- Scope `allowed-tools:` to the minimum (e.g. `Bash(git *)` not `Bash`).
- Never install skills that hardcode secrets or make unlisted outbound calls.

## Project-Specific Notes

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

<!-- [[post-harness]] — reserved for trace capture and meta-harness integration -->
