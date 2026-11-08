# merqo

## Purpose

Merqo-facing route handlers — bearer-token-authenticated endpoints the
Merqo hub polls for platform metrics, single-vendor status, per-vendor
activity, push-provisions a vendor onto paykit, and receives merqo's
per-vendor entitlement push.

## Contents

- `metrics/` — `GET` endpoint returning platform-wide health/revenue counts
  for merqo's cross-kit dashboard.
- `vendor-activity/` — `GET` endpoint resolving one vendor's plan, triage
  status, and payment-activity metrics by email, for merqo's cross-kit
  `/admin/vendors/[email]` detail view.
- `vendor-provision/` — `POST` endpoint reporting (never writing) whether a
  vendor already has a `vendor_payment_config` row, called whenever merqo
  grants a vendor paykit access.
- `vendor-status/` — `GET` endpoint resolving one vendor's `{active, plan}`
  by email.
- `entitlement/`, `POST` endpoint caching merqo's entitlement push for a
  vendor in `paykit.vendor_entitlements`.

## Connectivity

`metrics/`, `vendor-status/`, and `vendor-activity/` each expose a single
GET `route.ts` and share the same constant-time bearer-token check —
`bearerOk(request)` (`@/lib/merqo-auth`; the sibling `src/app/api/cron/` route uses `cronBearerOk` instead) — against `MERQO_METRICS_SECRET`.
`vendor-provision/` instead uses `provisionBearerOk(request)` (a thin
`bearerOk` wrapper pinned to `MERQO_PROVISION_SECRET`, same file) — it can
trigger a real audit-logged action, so it's deliberately not gated by the
same secret as the read-only/reporting routes. `entitlement/` writes, so it
uses the same `provisionBearerOk` guard.

The `plan` these routes report (`free`/`pro`) is derived from the entitlement
cache by `resolvePlan` (`@/lib/vendor-entitlement`): paid and unexpired, or an
event pass running, reads as `pro`.

`vendor-status/` resolves a single vendor's `{active, plan}` by email
(`resolveVendorStatus`, `@/lib/merqo-vendor-status.ts`) via `listAllUsers`
(`@/lib/list-all-users.ts`) plus a `vendor_payment_config` read.
`vendor-activity/` generalizes that same email-to-vendor lookup into a
richer per-vendor payload — `{active, plan, status, metrics,
lastActivityAt}` — computed by the pure `computeVendorActivity`
(`@/lib/merqo-vendor-activity.ts`) from that vendor's own
`vendor_payment_config`/`transactions`/`refunds` rows. `status` reuses the
exact `VendorStatus` triage vocabulary `src/lib/vendor-health.ts` already
produces for the admin Vendors table (`attention`/`stuck`/`quiet`/`new`/
`healthy`) rather than a second classification rule, and a vendor absent
from `auth.users` entirely 404s rather than returning `active: false` — see
`docs/business/2026-08-26-cross-kit-vendor-activity-design.md` for the
shared cross-kit contract every kit implements.

`metrics/` returns platform-wide counts (`computePaykitMetrics`,
`@/lib/metrics.ts`) shaped to merqo's `metricsPayloadSchema`.
`vendor-provision/` never writes `vendor_payment_config` (a placeholder
PayNow proxy could misdirect a real payment) and is the only one of the
four that calls `recordAudit` (`@/lib/admin-audit`) — attributed to
the provisioned vendor's own id with `detail.actor: "merqo_system"`, since
there's no signed-in admin behind this call.

## Parent

See the repo root [README.md](../../../../README.md) for the full layout.
