# vendor-activity

## Purpose

`GET /api/merqo/vendor-activity?email=…` — merqo hub's per-vendor detail
lookup, backing `/admin/vendors/[email]`'s paykit card. Bearer-secret gated
(`bearerOk`, `MERQO_METRICS_SECRET`, the same secret `/api/merqo/metrics`
already uses) — merqo hub is the only caller. See
`docs/business/2026-08-26-cross-kit-vendor-activity-design.md` for the
shared cross-kit contract every kit implements.

Distinct from `/api/merqo/vendor-status`: that route is a cheap
`{active, plan}` lookup with no per-vendor detail; this one is the richer
`{active, plan, status, metrics, lastActivityAt}` shape merqo renders a
whole card from.

## Contents

- `route.ts` — resolves the email to an auth user via `listAllUsers`
  (paginated, `src/lib/list-all-users.ts`); 404s if no such user exists in
  this kit at all. For a known user, reads that vendor's
  `vendor_payment_config` row (may not exist — "known but inactive"),
  their `transactions`, and — only if they have any transactions — the
  `refunds` rows against those transaction ids (`refunds` has no
  `vendor_id` column of its own), then calls `computeVendorActivity`
  (`src/lib/merqo-vendor-activity.ts`) and adds `incidents` and `recent`
  from `summarizeIncidents` (`src/lib/ops-events.ts`, last 72 hours). The
  body parses with `vendorActivityPayloadSchema` from `@merqo/ui/contracts`.
- `route.test.ts` — auth/validation/404/200/upstream-failure cases for the
  route above (a failed incidents read is a 503 too), the incidents payload
  checked against the shared contract, including the "no transactions ⇒ never queries refunds"
  short-circuit.

## Parent

See the repo root [README.md](../../../../../README.md) for the full layout.

## Boundary and coverage

The email lookup validates input and rejects incomplete administrator listings. Transactions and refunds are paged through their own deterministic IDs; refund reads remain limited to the resolved vendor transaction IDs. A partial or failed read is an error, not a valid activity summary.

The route reads its data through `readConfigAndTransactions` and `readRefunds`, and answers any failed read, incidents included, with `upstreamUnavailable`.
