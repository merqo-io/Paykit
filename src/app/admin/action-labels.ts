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

export function formatAction(action: string): string {
  return ACTION_LABELS[action] ?? action;
}
