# File layout

Moved from AGENTS.md. Where things live in paykit.

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
src/lib/vendor-session.ts        , shared dashboard auth guard (getVendorSession)
src/lib/vendor-entitlement.ts    , entitlement cache readers: resolvePlan, readVendorPlan, readAllVendorPlans
src/lib/merqo-entitlement-contract.ts, Zod schema of merqo's entitlement push (copied from merqo)
src/app/api/merqo/entitlement/   , POST receiver for merqo's entitlement push
src/lib/types.ts                  — DB types (mirror of supabase/migrations)
scripts/create-kit-key.mjs        — mint + store a hashed bearer secret for a calling kit
supabase/migrations/              — SQL schema + RLS + grants
supabase/tests/rls.test.sql       — pgTAP RLS suite
test/contract/                    — HTTP API contract test (mirrors merqo's qkit-metrics precedent)
```
