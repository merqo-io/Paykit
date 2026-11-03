# vendor-provision

## Purpose

`POST /api/merqo/vendor-provision` — merqo hub's push-provisioning hook,
called (bearer-secret, `provisionBearerOk`) whenever a vendor is granted
paykit access. Never writes `vendor_payment_config` (a placeholder PayNow
proxy could misdirect a real payment) — it only reports whether the vendor
already has a config and, if so, their plan. Logs the call via
`recordAudit` under the `merqo_system` actor sentinel (see
`src/lib/admin-audit.ts`'s `recordAudit` docstring) so a merqo-initiated
provision shows up in the admin Activity tab distinctly from a
vendor-initiated action.

## Contents

- `route.ts`, validates `{ user_id }`, reads `vendor_payment_config` and, when
  it exists, the vendor's plan from the entitlement cache, records an audit row, and reports
  `{ ok, already_existed, needs_setup, plan }`.
- `route.test.ts` — auth/validation/upstream-failure and audit-logging cases
  for the route above.

## Parent

See the repo root [README.md](../../../../../README.md) for the full layout.
