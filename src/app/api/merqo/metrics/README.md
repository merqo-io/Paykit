# metrics

## Purpose

`GET /api/merqo/metrics` — merqo hub's polling endpoint for paykit's
cross-kit health/revenue dashboard (`/admin/products`). Bearer-secret gated
(`bearerOk`, `MERQO_METRICS_SECRET`) — merqo hub is the only caller.

## Contents

- `route.ts`, reads `vendor_payment_config`, `transactions` and the entitlement cache (`readAllVendorPlans`) concurrently, calls `computePaykitMetrics` (`src/lib/metrics.ts`), and returns the result shaped to merqo's `metricsPayloadSchema`. paykit has no `orders`/`booths` concept, `src/lib/metrics.ts`'s own header comment documents how each field maps onto paykit's payment-config/transaction domain, including the two fields with no real paykit equivalent (`pending_upgrade_requests` is always `0`; `funnel.with_booth` equals `funnel.signed_up`).
- `route.test.ts` — auth/success/upstream-failure cases for the route above.

## Parent

See the repo root [README.md](../../../../../README.md) for the full layout.

## Boundary and coverage

Collection reads page through deterministic IDs rather than silently trusting the first database page. Authenticate before database work; database failures produce an error response instead of a misleading zero-count snapshot. Route tests cover the authorization and complete-read boundaries.
