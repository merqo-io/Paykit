# migrations

## Purpose

SQL schema for the `paykit` schema in the shared Merqo Supabase project —
tables, RLS policies, RPCs, and grants, applied in order.

## Contents

- `0001_paykit_core.sql` — `vendor_payment_config`, `transactions`, `refunds`, `kit_api_keys`, `tx_count_this_month()`, base RLS + grants.
- `0002_feedback.sql` — vendor feedback (NPS) submission plumbing.
- `0003_paykit_multi_method.sql` — adds the `pointer` payment-method kind (a vendor's own link/QR image) alongside `paynow`, with the kind-shape CHECK constraint.
- `0004_vendor_feedback_backfill.sql` — backfills existing feedback rows into the cross-kit `merqo.vendor_feedback` convergence table.
- `0005_paykit_vendor_prefs.sql` — `vendor_prefs` (currently just `tour_seen_at`, dashboard onboarding-tour state).
- `0006_paykit_admin.sql` — `admins` (allow-list) + `is_admin(uid)` + `admin_audit`, backing the Merqo-team `/admin` console's gate and audit trail.
- `0007_paykit_checkout_idempotency.sql` — unique constraint on `transactions (kit_slug, order_ref)`, so a retried `POST /api/v1/checkout` call can't create a duplicate pending transaction.
- `0008_paykit_pricing.sql` — `pricing`, a single-row (`id` pinned to 1) admin-editable price config (`monthly_cents`, `currency`), seeded at 499 ($4.99). Public-read RLS (the price isn't secret); no write policy — writes go through the service-role `setPricing` admin action only.
- `0009_paykit_admin_audit_immutable.sql` — revokes `UPDATE`/`DELETE` on `admin_audit` from `service_role` (remaining schema privileges removed by `0019`) — the app only ever inserts, so this closes off tampering at the grant level, independent of RLS (which never binds `service_role`).
- `0010_paykit_bookings.sql` — `bookings` (deposit-now/balance-later event-cart bookings), linking up to two `transactions` rows by id (`deposit_transaction_id`/`balance_transaction_id`). `sync_booking_status()` is an `after update of status on transactions` trigger that flips a linked booking to `deposit_paid`/`fully_paid` once its transaction(s) confirm, regardless of which path (dashboard or bearer-secret API) did the confirming. RLS mirrors `vendor_payment_config_own`; the two transaction-id columns are excluded from the vendor's own `INSERT`/`UPDATE` grant (same instinct as `plan` in 0001) since the policy only checks `vendor_id`, not that the linked transaction is actually this vendor's own.

- `0011_paykit_payment_audit.sql` — `payment_audit`, an immutable (grant-level `UPDATE`/`DELETE` revoked from `service_role`, same treatment as `0009`) audit trail for the payment-lifecycle API (`checkout_created`/`claimed`/`confirmed`/`unclaimed`), attributed by `kit_slug` rather than a human `auth.users` actor — kept as its own table rather than widening `admin_audit`'s `admin_id not null` semantics, since the bearer-secret routes have no signed-in session.
- `0012_paykit_rate_limit.sql` — `rate_limits` + `check_rate_limit()`, a DB-backed fixed-window limiter ported from qkit's own `0017_rate_limit.sql`/`0036_rate_limit_cleanup.sql` (index-backed probabilistic cleanup, not an unindexed `DELETE` on every call). `EXECUTE` was explicitly granted to `service_role`, but inherited PUBLIC execution remained until `0019`; the intended caller is the trusted server-to-server API.

- `0013_paykit_kit_key_last_used.sql` — adds `kit_api_keys.last_used_at` (nullable, touched on every successful `verifyKitAuth` call) — see `docs/SECRET_ROTATION.md` for what it's for.
- `0014_paykit_auth_failures.sql` — `auth_failures`, logging every failed `verifyKitAuth` call (`kit_slug` nullable — an unknown/malformed attempt has none — `reason`, `ip`, `created_at`). Same immutable-from-creation shape as `payment_audit`/`admin_audit`: no RLS policies (service-role only), and only `select`/`insert` ever granted (no `update`/`delete` to revoke later, unlike `0009`/`0011`'s after-the-fact tightening). Backs the admin Overview's Security stat block (`securityStats()` in `src/lib/admin-data.ts`).
- `0015_legal_check_state.sql` — `legal_check_state`, a TTL cache (`email` PK, `checked_at`, `is_current`) for "is this vendor's terms/privacy acceptance current with merqo?" — paykit owns no acceptance record itself, so `src/lib/legal-gate.ts` calls merqo's `GET /api/merqo/legal-status` and caches the result here for 5 minutes, mirroring merqo's own `vendor_sync_state` throttle. Service-role only (RLS on, zero policies), same shape as `auth_failures`.

- `0016_recover_booking_deposit.sql` — validates and atomically links deposit
  checkouts to their matching bookings, preserving recovery after a failed
  checkout request. The helper is restricted to the service role.
- `0017_link_booking_balance.sql` — validates and atomically links the balance
  checkout, with booking/vendor identity checks and service-only execution.
- `0018_checkout_snapshot.sql` — preserves the payment destination snapshot
  used by a checkout so later configuration changes cannot silently redirect it.
- `0019_private_rate_limiter_and_audit_grants.sql` — revokes inherited public
  execution on the limiter, validates bounded inputs and retains all supported
  windows during cleanup. Removes audit writer privileges beyond SELECT/INSERT.

- `0020_refund_total_integrity.sql` — serializes refund accounting, caps cumulative refunds at the confirmed checkout amount, and preserves refund identity and attribution.
- `0021_kit_api_keys_callback.sql` — adds nullable `kit_api_keys.callback_url`
  and `callback_secret`: where paykit posts a payment-status callback for that
  kit's transactions, and the secret it presents there. Stored readable, unlike
  `secret_hash`, because paykit has to send it; the table stays service-role
  only.
- `0022_payment_evidence.sql` — the private storage bucket
  `paykit-payment-proofs` (1 MB, JPEG/PNG/WebP; named apart from qkit's
  `payment-proofs` in the shared project), a read policy scoping objects to
  the vendor's own folder, and `payment_evidence`: one row per transaction
  and kind (`screenshot` today) with the file's path, its sha256 and a
  `detail` JSON. A vendor reads their own rows through the transaction;
  the service role is the only writer and has no delete.
- `0023_transactions_expires_at.sql` — `transactions.expires_at`
  (nullable): when the calling kit gives up on the order. Backfills every
  unpaid `qkit` transaction to 30 minutes after its creation, the window
  qkit already applies, so no stale row can match a later payment. It
  gates automatic matching only; nothing reads it yet.
- `0024_hosted_pay_page.sql` — `pay_token_hash` (a sha256 hex digest, never
  the token), `return_url` and `pay_title` on `transactions`, and
  `return_origin` on `kit_api_keys`. No new grant or policy: a vendor can
  already read their own transactions, nobody but the service role writes
  them. A kit with no `return_origin` cannot use the pay page.
- `0025_booking_inquiries.sql`: `inquiry_forms` (one per vendor: a random
  16-hex `public_id` the vendor cannot write, `business_name`, `enabled`,
  an optional `https://` `terms_url` with `terms_version`) and `inquiries`
  (client name, phone, optional event date, message, `status`
  `new`/`contacted`/`converted`/`declined`, the terms snapshot the client
  accepted, `booking_id` once converted). Vendors read and write their own
  form; on inquiries they may read, delete and change `status` only. No
  client insert: the public form writes with the service role, as does
  conversion's `booking_id`.

## Parent

See the repo root [README.md](../../README.md) for the full layout.
