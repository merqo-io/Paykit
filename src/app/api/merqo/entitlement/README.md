# entitlement

## Purpose

`POST /api/merqo/entitlement` is where merqo hub pushes a vendor's entitlement
(tier, founder flag, stats window, event pass, expiry). Merqo owns pricing, so
paykit only caches the push in `paykit.vendor_entitlements` and gates Pro
features on that cache. Bearer-secret gated with `provisionBearerOk`
(`MERQO_PROVISION_SECRET`), because it writes.

## Contents

- `route.ts`: checks the bearer (401), parses the body with
  `entitlementPayloadSchema` (`@/lib/merqo-entitlement-contract`, copied from
  merqo; 400 on a malformed body), rejects any kit other than `paykit` (400),
  then calls the service-role-only `apply_vendor_entitlement` RPC. The RPC maps
  the email to `auth.users` and upserts under an `issued_at` guard: an unknown
  email answers 404 `unknown_vendor`, a stale or replayed push answers 200 as
  a no-op, a store failure answers 500.
- `route.test.ts`: 401, 400 (bad JSON, bad body, wrong kit), 404, 200, the
  stale no-op and the store failure.

## Parent

See the repo root [README.md](../../../../../README.md) for the full layout.
