# activity

## Purpose

Admin activity console — the read-only viewer over `admin_audit`,
the trail `recordAudit()` has written since `0006_paykit_admin.sql` but
that, until this folder existed, no page ever read back.

## Contents

- `page.tsx` — `AdminActivityPage`: fetches the 100 most recent
  `admin_audit` rows via `auditLog()` (`@/lib/admin-data`), maps each to
  `@merqo/ui`'s `AuditLogEntry` (actor resolved to email, falling back to
  the raw `admin_id`; `detail`'s jsonb rendered as a flat `key: value`
  list), and hands the mapped entries to `ActivitySection`.
- `activity-section.tsx` — `ActivitySection`: client component (function
  props, like `formatAction`, can't cross the server/client boundary
  directly from `page.tsx` — same reasoning as `../pricing-section.tsx`)
  wrapping `@merqo/ui`'s `AuditLogTable`, mapping every real action string
  `recordAudit()` is actually called with today (`set_vendor_plan`,
  `set_pricing`, `record_refund`, `create_booking`,
  `create_balance_checkout`, `cancel_booking`, `reschedule_booking`) to a
  human-readable label.

## Tab title

`page.tsx` exports `metadata.title = "Activity"`, which the root layout's `%s | Paykit` template turns into "Activity | Paykit". `src/app/page-titles.test.ts` checks it.

## Parent

[admin](../README.md)
