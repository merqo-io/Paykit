<!-- templateCentral: nextjs@7.2.2 (Supabase variant — shared project, schema per kit) -->

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
(new-york) · Zod · Supabase (`@supabase/ssr`) · Vitest · pnpm 11 · Node ≥24.22.1 ·
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

## File layout

Full tree with one-line descriptions: [`docs/FILE-LAYOUT.md`](docs/FILE-LAYOUT.md).

## Data model

Tables, constraints and RLS detail: [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md). The invariants that matter:

- Authorization is RLS in Postgres; a vendor reads/writes only their own rows. `kit_api_keys` and `admin_audit` writes, and the cross-kit API (`/checkout`, `/claim`, `/confirm`), are service-role + bearer-secret, server-only.
- `plan` (`free`|`pro`) gates refund tracking only; `bookings` transaction-id link columns are service-role only.
- Schema edits update both `supabase/migrations/` and the matching file in `src/lib/db-types/`.
- Keep `admin_audit` rows for 5 years (IRAS norm); the service role cannot `update`/`delete` them.

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
  the matching file in `src/lib/db-types/`.

## Git Workflow

- Branch `feat/*` or `fix/*` from `staging`; open the PR into `staging` (squash is fine). CI runs on it.
- After merge, Vercel's git integration deploys `paykit-staging.merqo.io` (Preview env, staging Supabase). Test there, not on `*.vercel.app`: the sign-in cookie only works on merqo.io hosts and branch previews are disabled.
- Promote with a PR `staging` -> `main` merged as a **merge commit** (never squash or rebase) so `staging-sync` can fast-forward `staging` to `main`.
- Never commit directly to `main` or `staging`.

## Skills

### Project skills — check here first (`.claude/skills/`)

| Skill               | What it does                                                 |
| ------------------- | ------------------------------------------------------------ |
| `/next-verify`      | typecheck + lint + test in one pass                          |
| `/supabase-migrate` | apply `supabase/migrations`, types edited by hand (safety gate) |

### templateCentral plugin skills

templateCentral has **no Supabase support** (auth=better-auth, db=Drizzle/Kysely/Mongoose,
no realtime). Use only the stack-agnostic ones here:

| Skill                       | When to use                                                          |
| --------------------------- | -------------------------------------------------------------------- |
| `templatecentral:standards` | naming/validation/drift-check (expect Supabase-vs-tc drift findings) |

Do **not** run `templatecentral:add (auth)` or `(database)` — they install
better-auth / Drizzle and will break RLS.

templateCentral 7.2.2 review history (what was adopted and not): [`docs/meta/templatecentral-adoption-log.md`](docs/meta/templatecentral-adoption-log.md).

## Skills Security

- Review `SKILL.md` before installing any third-party skill — treat skills like packages.
- Scope `allowed-tools:` to the minimum (e.g. `Bash(git *)` not `Bash`).
- Never install skills that hardcode secrets or make unlisted outbound calls.

## AI Harness

Full reference (hooks, permissions, git hooks, CI gates): [`docs/meta/ai-harness-reference.md`](docs/meta/ai-harness-reference.md). Manifest: `.claude/harness.json`. What it enforces:

- Secret files are hard-blocked for read and write (`.env.example` excepted); governance and CI/CD writes (`AGENTS.md`, `CLAUDE.md`, `.claude/settings*.json`, `.claude/harness.json`, `docs/CONSTITUTION.md`) need human approval.
- The Bash guard blocks hook bypasses (`--no-verify`), protected-branch force pushes and destructive guard edits; `deny` rules cover `rm -rf`, force push, `reset --hard`, `clean`, `filter-branch`, ref delete.
- Credential-shaped prompts are blocked; injection phrases only add advisory context.
- PostToolUse runs `tsc --noEmit` and a comment-hygiene scan (feedback only). The Stop hook runs the test suite and feeds failures back.
- SessionStart prints the always-on invariants only (this file is loaded through the `CLAUDE.md` import).
- Husky: pre-commit format/lint/typecheck/gitleaks, commit-msg Conventional Commits, pre-push harness integrity check + quality gate. CI adds coverage, build, e2e, db (pgTAP), mutation, lockfile, changelog, readme-freshness, comment-hygiene and security gates.
- After editing `AGENTS.md` or other seeded files, a human runs `bash .claude/regen-harness.sh` (or updates the hash in `.claude/harness.json`); `bash .claude/verify-harness.sh` must pass.

## Project notes

Seeding history, design/plan pointers and the qkit cutover notes: [`docs/meta/templatecentral-adoption-log.md`](docs/meta/templatecentral-adoption-log.md#project-specific-notes).

<!-- [[post-harness]] — reserved for trace capture and meta-harness integration -->

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
