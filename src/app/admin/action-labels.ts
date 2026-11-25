// Actions `recordAudit()` is called with today (dashboard/transactions/actions.ts,
// dashboard/bookings/actions.ts, api/merqo/vendor-provision/route.ts) plus the retired plan and pricing actions, kept
// so historical audit rows still render a readable label.
const ACTION_LABELS: Record<string, string> = {
  set_vendor_plan: "Set vendor plan",
  merqo_vendor_provision: "Provisioned vendor",
  set_pricing: "Set pricing",
  record_refund: "Recorded refund",
  create_booking: "Created booking",
  create_balance_checkout: "Created balance payment",
  cancel_booking: "Cancelled booking",
  reschedule_booking: "Rescheduled booking",
};

/** Every action the filter offers; includes retired ones so old rows stay findable. */
export const KNOWN_ACTIONS = Object.keys(ACTION_LABELS);

export function formatAction(action: string): string {
  return ACTION_LABELS[action] ?? action;
}
