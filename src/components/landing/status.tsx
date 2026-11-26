export type Status = "pending" | "claimed" | "confirmed";

// Same labels and tones as the dashboard's TransactionStatusBadge, so one
// colour means one state everywhere on the landing page.
export const STATUS: Record<Status, { label: string; className: string }> = {
  pending: {
    label: "Awaiting payment",
    className: "border-secondary/35 bg-secondary/12 text-secondary",
  },
  claimed: {
    label: "Marked paid",
    className: "border-mint/35 bg-mint/12 text-mint",
  },
  confirmed: {
    label: "Received",
    className: "border-primary/35 bg-primary/12 text-primary-text",
  },
};

export function StatusPill({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS[status].className}`}
    >
      {STATUS[status].label}
    </span>
  );
}
