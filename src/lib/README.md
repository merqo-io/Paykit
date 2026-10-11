# lib

Shared payment logic, database access and boundary validation. Route handlers and
server actions provide caller identity; database grants, RLS and constrained RPCs
provide authorization.

## Contracts

- `schemas.ts` validates dashboard forms and actions; `api-schemas.ts` validates
  the peer-kit API. Monetary values are integer cents. `types.ts` mirrors the
  migration schema and RPC signatures.
- `checkout.ts` creates and renders a transaction through `payments/provider.ts`.
  A replay of the same kit and order reference must match the vendor, amount,
  checkout kind and payload; a conflicting replay fails. `checkout-kind.ts`
  reads persisted display identity without guessing an unknown legacy pointer.
- `checkout-lookup.ts` — `toLookupResponse(row)`: maps a `transactions` row to
  the `GET /api/v1/checkout?order_ref=` wire shape, building `view` from the
  stored snapshot through `checkoutKind`, and passes `vendor_id` through. Also
  holds the column list that route selects and the fallback label for a link
  stored without one.
- `tx-state.ts` defines claim, unclaim and confirm transitions. Confirmation
  cannot be undone by unclaim. Routes use conditional writes and re-read a
  concurrent winner; returned or rejected write failures are not success.
- `kit-auth.ts` verifies peer-kit bearer secrets, records failures without logging
  credentials and touches last-use metadata best-effort. Ambiguous duplicate
  active keys fail closed. `merqo-auth.ts` separately authenticates hub metrics
  and provisioning routes.
- `rate-limit.ts` calls the database fixed-window limiter after authentication.
  Limiter failure permits the request and logs degradation; the forwarded IP is
  a fairness key, never authorization. Migration 0019 prepares the bounded atomic
  implementation. Pending migrations require real database validation.
- `payment-audit.ts` appends real checkout transitions; idempotent no-ops add no
  transition row. `admin-audit.ts` records administrative and vendor operations
  without exposing its helper as a remotely callable Server Action.

## Reads and reports

`transactions.ts` and `bookings.ts` read vendor-owned records with the session
client. `read-all-rows.ts` follows ordered numeric ranges to an empty page and rejects
partial collections on later errors; it does not provide a transaction snapshot.
`list-all-users.ts` paginates auth users and reports its safety ceiling as failure.
`admin-data.ts` performs team-console service-role reads; callers must apply the
admin gate before invoking it.

`metrics.ts` and `merqo-vendor-activity.ts` derive hub payloads.
`merqo-vendor-status.ts` resolves a known auth user to that user's config.
`vendor-health.ts` owns triage bands. `revenue-report.ts` groups confirmed
transactions by day; `earnings-report.ts` groups booking revenue by event date,
falling back to transaction creation for unlinked checkouts. These are revenue
records, not profit or tax submissions. `earnings-csv.ts` escapes customer text
that could become a spreadsheet formula.

`booking-status.ts` provides dashboard-only due badges. `usage.ts` and
`plan-view.ts` derive the Free/Pro nudge and view; `pricing.ts` reads the
admin-configured price. Refund tracking is Pro-gated bookkeeping, not money
movement. Migration 0020 prepares serialized cumulative-refund enforcement;
mocked tests do not verify its database locking.

## Session and shared profile

`vendor-session.ts` establishes the vendor session and current legal acceptance.
`admin.ts` establishes team authorization. `legal-gate.ts` validates Merqo's
legal-status response and caches it briefly; lookup failures fail closed.
Sheet feedback/support actions use an inline session check to return an error
instead of redirecting an open dialog.

`merqo-rpc.ts` is the typed cross-schema RPC boundary used by shared profile,
feedback and support adapters. `merqo-vendor-profile.ts` uses field-specific
patches: omitted columns stay unchanged and empty social links clear links.
`tour-prefs.ts` contains best-effort onboarding timestamps.

## Storage and shared UI

`image-upload-adapter.ts` uploads images and contains best-effort cleanup.
`qr-image-cleanup.ts` accepts only supported public buckets and the current
vendor's object folder, including when called with the service-role client.
External URLs and other vendors' objects are never deletion targets.
Deferred QR uploads occur on Save; failed saves clean up unused uploads.
Uncertain network outcomes are not proof that a metadata write did not commit.

Redirect validation and image resizing come from `@merqo/ui`; there are no
local `safe-redirect.ts` or `image-resize.ts` copies. `utils.ts` holds local
formatters and class composition; `brand-icon.tsx` supplies icon-route markup.
`env.ts` exposes required public configuration. The `supabase/` README explains
session/service client separation; `payments/` explains checkout builders.

## Parent

[paykit](../../README.md)

`money.ts` converts form dollars into integer cents for booking/refund actions; their schemas validate range and finite values. Empty/null form values retain the existing Number conversion to zero.
