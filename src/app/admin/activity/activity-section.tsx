"use client";

import { AuditLogTable, type AuditLogEntry } from "@merqo/ui";

// Actions `recordAudit()` is called with today (dashboard/transactions/actions.ts,
// dashboard/bookings/actions.ts) plus the retired plan and pricing actions, kept
// so historical audit rows still render a readable label.
const ACTION_LABELS: Record<string, string> = {
  set_vendor_plan: "Set vendor plan",
  set_pricing: "Set pricing",
  record_refund: "Recorded refund",
  create_booking: "Created booking",
  create_balance_checkout: "Created balance payment",
  cancel_booking: "Cancelled booking",
  reschedule_booking: "Rescheduled booking",
};

function formatAction(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

// `formatAction` is a function prop, so `AuditLogTable` (a `@merqo/ui`
// Client Component) can only be rendered from another Client Component, not
// passed the function directly from `page.tsx`'s Server Component — same
// reasoning as `vendors-table.tsx`'s own `"use client"`.
export function ActivitySection({ entries }: { entries: AuditLogEntry[] }) {
  return <AuditLogTable entries={entries} formatAction={formatAction} />;
}
