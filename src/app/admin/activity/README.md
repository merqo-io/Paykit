# activity

## Purpose

Admin activity console — the read-only viewer over `admin_audit`,
the trail `recordAudit()` has written since `0006_paykit_admin.sql` but
that, until this folder existed, no page ever read back.

## Contents

- `page.tsx` — `AdminActivityPage`: `requireAdmin()`, then reads the latest
  1000 `admin_audit` rows via `auditLog()` (`@/lib/admin-data`) and filters
  (action, Singapore-day range) and pages them 25 at a time in memory. A
  notice says older entries aren't searched whenever the window is full. Actor
  resolves to email, falling back to the raw `admin_id`; `detail`'s jsonb
  renders as a flat `key: value` list (`None` for null). A failed read shows a
  retry state, not the empty state; a page past the end redirects to the last.
- The action filter `<select>` uses the ledger filters' select style at 44px.
- `activity-section.tsx` — `ActivitySection`: client component (`columns` are
  render callbacks) over the shared `DataTable`. Each target links to
  `/admin/vendors?q=<target>` because `AuditLogTable` renders targets as text.
  Action labels come from `../action-labels.ts`.

## Tab title

`page.tsx` exports `metadata.title = "Activity"`, which the root layout's `%s | paykit` template turns into "Activity | paykit". `src/app/page-titles.test.ts` checks it.

## Parent

[admin](../README.md)

Page chrome here (PageHeader) comes from `@merqo/ui`; paykit keeps no local copy.

The action select uses `FILTER_SELECT_CLASS` (with a `sm:w-56` override); paging and the failed-read card are the shared `UrlPager` and `ListError` from `@/components/list/`.
