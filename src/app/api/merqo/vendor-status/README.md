# vendor-status

## Purpose

`GET /api/merqo/vendor-status?email=…` — merqo hub's own lookup of whether a
vendor has an active paykit payment config and, if so, their plan
(`free`/`pro`). Bearer-secret gated (`bearerOk`, `MERQO_METRICS_SECRET`) —
merqo hub is the only caller.

## Contents

- `route.ts`, resolves the email to an auth user via `listAllUsers` (paginated, `src/lib/list-all-users.ts`), reads `vendor_payment_config` for that user and their plan from the entitlement cache (`readVendorPlan`), and returns `{ active, plan }` via `resolveVendorStatus`.
- `route.test.ts` — auth/validation/upstream-failure cases for the route above.

## Parent

See the repo root [README.md](../../../../../README.md) for the full layout.

## Boundary and coverage

Validate email before database work and resolve the account through the bounded, paginated administrator listing. Failed or incomplete account lookup must not report an inactive vendor as though the lookup succeeded; route tests cover these failure cases.
