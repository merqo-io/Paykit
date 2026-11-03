# Data model

Moved from AGENTS.md. Tables, constraints and RLS rules for the `paykit` schema.

- `vendor_payment_config` (PK `vendor_id`): one payment config per vendor,
  reused across every kit/booth/store that vendor runs. Since 2026-07-22,
  `kind` (`'paynow'`|`'pointer'`) splits config into a generated PayNow QR
  (exactly one of `uen`/`mobile`, `payee_name` required) or a vendor's own
  BYO payment link/QR image (`label` required, exactly one of `url`/
  `qr_image_url`) — see `docs/superpowers/specs/2026-07-22-paykit-multi-
method-byo-design.md`. `payee_name`/`uen`/`mobile` apply only to
  `'paynow'`; `label`/`url`/`qr_image_url` only to `'pointer'`. `plan`
  (`free`|`pro`) gates refund tracking only — transaction history and
  revenue stats are both free; Free tier checkout is unlimited, no
  transaction-volume cap (see
  `docs/superpowers/specs/2026-07-22-paykit-freemium-nudge-redesign-design.md`,
  `docs/superpowers/specs/2026-08-15-paykit-pro-simplification-design.md`).
  This column is a minimal addition beyond the design spec's literal table
  listing, necessary to implement the very Pro-gate the same spec
  describes (see the plan's Self-Review). Pro's price is admin-tunable via
  `/admin` (seeded at $4.99/mo) — see `paykit.pricing`. `verification_method`
  is schema-reserved (`'manual'` only is ever written).
- `transactions`: one row per checkout, `status` `pending`→`claimed`→`confirmed`,
  `kit_slug` records which kit created it, `qr_payload` stored at creation for
  replay/audit.
- `bookings` (`0010_paykit_bookings.sql`): deposit-now/balance-later
  bookings for event-cart vendors (weddings, private events), instead of a
  one-shot checkout. Links up to two `transactions` rows by id
  (`deposit_transaction_id`/`balance_transaction_id`, both nullable — the
  balance one is only created once the vendor's ready to bill it, not at
  booking time). `status` (`pending_deposit`→`deposit_paid`→`fully_paid`,
  or `cancelled`) is kept correct by a Postgres trigger
  (`sync_booking_status()`, on `transactions`' own `status` turning
  `confirmed`) rather than app code, since a transaction can be confirmed
  via the bearer-secret API too, not just this dashboard. A `deposit_
amount_cents + balance_amount_cents = total_amount_cents` CHECK constraint
  enforces the split adds up. Reminders are dashboard-badge-only (no
  cron/notification infra exists in this repo, see `src/lib/booking-
status.ts`) — not a push. `rescheduleBookingAction` updates `event_date`/
  `balance_due_date` directly on the same booking (deposit-carries-forward —
  no new status value, since a `'rescheduled'` state would conflict with
  `sync_booking_status()`'s trigger logic). `cancelBookingAction` optionally
  files a refund against a linked transaction (reuses `refunds`, the same
  Pro/confirmed/ownership `with check` as `issueRefundAction`) but on its
  own never touches either linked transaction's own status.
- `refunds` (Pro only): bookkeeping ledger row against a `confirmed`
  transaction — no real money movement.
- `pricing` (single row, `id` pinned to 1): the Pro price shown on the
  plan page, dashboard nudge, and landing site. Admin-tunable via
  `/admin` (no redeploy needed) — see `paykit.pricing`,
  `src/lib/pricing.ts`. Public-read RLS (the price isn't secret); writes
  go through the service-role `setPricing` action only. Seeded at
  `monthly_cents = 499` ($4.99).
- `kit_api_keys`: one hashed bearer secret per calling kit, service-role only
  (no RLS policy grants any access to `authenticated`/`anon`).
- `admin_audit` (`0006_paykit_admin.sql`): one row per admin- or
  vendor-initiated action worth reconstructing later (`setVendorPlan`,
  `setPricing`, a vendor's own `record_refund` — see `recordAudit()` in
  `src/app/admin/actions.ts`). RLS is admin-read-only; the service-role
  client can `select`/`insert` but not `update`/`delete`
  (`0009_paykit_admin_audit_immutable.sql`) — the app never touches a row
  once written, and closing off `update`/`delete` at the grant level means
  a compromised service-role key still can't rewrite history. **Retention:
  keep `admin_audit` rows for 5 years**, matching IRAS's record-keeping
  norm for a small Singapore business; no archival/purge job exists yet —
  this is the stated policy so retention isn't decided ad hoc later.
- `vendor_prefs` (PK `vendor_id`): dashboard UI state, currently just
  `tour_seen_at` (nullable — a missing row means "hasn't seen the
  onboarding tour yet"). Deliberately separate from
  `vendor_payment_config`, which stays payment-config-only per its own
  column contract above.
- `payment_evidence` (`0022_payment_evidence.sql`): one row per transaction
  and `kind` (`'screenshot'` today) with the file's path in the private
  `paykit-payment-proofs` bucket, its sha256 and a `detail` JSON. A calling
  kit attaches the screenshot to `POST /api/v1/checkout/{id}/claim` as a
  multipart `proof` file and reads it back with
  `GET /api/v1/checkout/{id}/evidence`. After the claim answers, the amount
  is read out of the screenshot on the server with Tesseract and stored as
  `detail.amount_match`. A vendor reads their own rows through the
  transaction; only the service role writes. Evidence is a hint for a person
  and never changes a transaction's status. `ocr-data/` and the
  `outputFileTracingIncludes` entry in `next.config.ts` must stay together:
  without the entry the check fails silently on Vercel.
- RLS: a vendor reads/writes only their own `vendor_payment_config`; reads
  (not writes) only their own `transactions`; reads/inserts `refunds` only for
  their own confirmed transactions while on Pro; reads/writes only their own
  `vendor_prefs` row; reads/inserts/updates (no delete) only their own
  `bookings` row, except its two transaction-id link columns, which are
  service-role only (same self-escalation-shaped reasoning as `plan`
  above — the policy only checks `vendor_id`, so an unrestricted grant
  would let a vendor repoint a booking at another vendor's transaction).
  The cross-kit API (`/checkout`, `/claim`, `/confirm`) is service-role +
  bearer-secret, server-only.
