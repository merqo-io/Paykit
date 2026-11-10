# Fresh-eyes close-out sweep

Roadmap items X-14 (knip), X-15 (changelog), X-16 (loading states), X-20
(folder READMEs). Mechanical changes only; anything needing a product, copy,
payment or schema decision is listed under Deferred or Needs owner.

## knip

Command: `pnpm dlx knip@6.44.2 --no-progress` (pinned, same version as the
sibling repos; knip is not a dependency).

| Finding type        | Before | After |
| ------------------- | ------ | ----- |
| Unused files        | 2      | 0     |
| Unused devDeps      | 2      | 0     |
| Unused exports      | 4      | 0     |
| Unused export types | 20     | 0     |

Handled:

- Unused files were both copies of the harness hook under `.claude/`; `knip.json` ignores `.claude/**`.
- Removed dev dependencies `@eslint/eslintrc` and `@tailwindcss/typography`: no config or CSS references either (grep of src, e2e, scripts, docs, supabase and root configs).
- Un-exported (still used inside their module): `FIELD_INPUT_CLASS`, `REPORT_TABS`, `MAX_INPUT_PIXELS`, and the types `PointerPresetMode`, `VendorActivityMetric`, `WrittenKind`, `ServiceClient` and `ProviderCheckoutStatus`. Deleted outright (unused inside their module too): `InquiryFormSettingsInput` and the eight `z.infer` `*Input` types in `src/lib/schemas.ts`. In `src/lib/payment-transition.ts` and `src/lib/payments/provider.ts` only the `export` keyword was removed.

Justified leftovers (kept through `ignoreIssues` in `knip.json`, per file and per issue kind):

- `src/lib/api-schemas.ts` (exports, types): `txStatusSchema` and the request/response types describe the public HTTP contract of `/api/v1/*`, consumed by other kits over HTTP and by the contract test.
- `src/lib/metrics.ts` (types): `MetricsPayload` mirrors merqo's `metricsPayloadSchema` for `/api/merqo/*`.
- `src/lib/merqo-entitlement-contract.ts` (types): `EntitlementPayload` is the `/api/merqo/entitlement` contract type.
- `src/lib/types.ts` and `src/lib/db-types/` need no ignore: knip reports none of the schema-mirroring row types.

## Duplicates

Inside this repo:

- `MS_PER_DAY` was defined in both `src/lib/utils.ts` and `src/lib/metrics.ts`; `metrics.ts` now imports it (fixed).
- `sha256` in `src/app/legal/accept/actions.ts` is a one-line local helper; no second copy found.

Candidates across sibling kits (not extracted, no cross-repo changes): `clientIp` and rate-limit wiring (`src/lib/rate-limit.ts`), the merqo base URL helper, `formatCents`/`formatDate` in `src/lib/utils.ts`, the kit-callback poster. Most already come from `@merqo/ui`; the remaining local wrappers are thin binders.

## Server vs client components

Nine `"use client"` files use no React hook themselves: the admin and dashboard table files (`activity-section`, `vendors-table`, `booking-table`, `inquiry-table`, `earnings-tables`, `transaction-table`), `revenue-chart`, `radio-option-card` and `components/ui/radio-group`. The tables build column definitions with render functions and hand them to `@merqo/ui`'s client-only `DataTable`/`AuditLogTable`, so they must stay client. `radio-group` wraps a Radix client primitive. `radio-option-card` only composes `RadioGroupItem` and `cn`; it could drop the directive since it is rendered inside a client form, but the saving is nil. No change made.

## Sequential awaits

Scanned `src/` for await chains. `admin/page.tsx` already uses `Promise.all`. The remaining chains are dependent: `pay/[id]/page.tsx` (rate-limit gate before the read), `requireAdmin()` before queries, `checkout.ts` and `payment-transition.ts` (payment ordering). No obviously independent waterfall found; payment files are out of scope for edits.

## loading.tsx

| Route                 | Result                                                                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/dashboard/**`       | existing `dashboard/loading.tsx`                                                                                                                                                                                   |
| `/admin/**`           | added `admin/loading.tsx` plus test                                                                                                                                                                                |
| `/mfa`                | added `mfa/loading.tsx` plus test                                                                                                                                                                                  |
| `/pay/[id]`           | not needed: one service-role read after a rate-limit check, and a skeleton in front of a payment QR would mostly flash on a normal connection; the customer sees a plain blank page for a moment, not a broken one |
| `/inquire/[publicId]` | not needed: one small read; a flash of skeleton before a short form adds no information                                                                                                                            |
| `/` and `/about`      | not needed: public marketing pages, no data await                                                                                                                                                                  |
| `/legal/accept`       | not a gap: awaits only `searchParams`                                                                                                                                                                              |

New skeletons keep `<main>` as the landmark and put `role="status"`,
`aria-busy` and an sr-only "Loading" on an inner element.

Not fixed, recorded: `src/app/admin/layout.tsx:15` (`requireAdmin()`) and
`src/app/dashboard/layout.tsx:15-16` await data that their own segment's
`loading.tsx` does not cover, because a loading file wraps the page, not its
layout.

## Bundle size

This Next version prints no First Load JS column in `pnpm build` output, so no
per-route size figures are recorded. `.next` was not inspected.

## Coverage

Command: `pnpm exec vitest --run --coverage` with the report directory outside
the repo. 172 files, 1523 tests passed. Overall lines 95.37%, branches 90.36%.

Business-logic files under 70% lines: none in `src/lib` except
`src/lib/supabase/server.ts` (50%, thin client factory). Other sub-70% files are
not business logic: icon routes, `src/app/pay/[id]/leave.ts`,
`src/app/pay/[id]/qr-image.ts` (0%, QR rendering for the pay page, payment
adjacent, so left alone), `src/lib/brand-mark.ts`.

## templateCentral standards

The `templatecentral:standards` skill is not available in this session, so its
code-standards, validation-patterns and drift-check were not run. Supabase
versus templateCentral data-layer drift is expected (see
`templatecentral-adoption-log.md`).

## Folder READMEs (X-20)

All 47 folders under `src/` already had a README; this PR creates no new folder
and updates the README of each folder it touches.

## Fixed in this PR

- 28 knip findings cleared (see above); knip config added.
- Loading skeletons for `/admin` and `/mfa`, with tests (4 tests).
- Duplicate `MS_PER_DAY` removed.
- Changelog stamped `0.6.0` with an empty `[Unreleased]`; `package.json` version 0.6.0 (no git tag).

## Deferred

- `qr-image.ts` and `supabase/server.ts` coverage (payment adjacent / thin wrapper).
- Skeleton or Suspense for the admin and dashboard layouts' own awaits.
- Dropping the `"use client"` directive from `radio-option-card.tsx` (no gain).
- Cross-kit extraction of `clientIp`, `merqoBaseUrl` and format helpers (belongs in `@merqo/ui`).

## Needs owner

- Whether the hosted pay page and inquiry form should get a branded loading state (product and copy call).
- Whether to add knip to CI as a dependency and gate (changes `package.json` and workflows).
- Pushing the `0.6.0` tag after merge to `main`.
