import { InfoTooltip, StatusBadge } from "@merqo/ui";
import type { TxStatus } from "@/lib/types";

// `claimed` (shown as "Marked paid") keeps the brand mint accent — it's the one status needing the
// vendor's attention right now (pending→claimed→confirmed, `@/lib/tx-state`).
const STATUS_CONFIG: Record<TxStatus, { label: string; className: string }> = {
  pending: {
    label: "Awaiting payment",
    className: "text-secondary border-secondary/35 bg-secondary/12",
  },
  claimed: {
    label: "Marked paid",
    className: "text-mint border-mint/35 bg-mint/12",
  },
  confirmed: {
    label: "Received",
    className: "text-primary border-primary/35 bg-primary/12",
  },
};

// trigger="tap" (not InfoTooltip's "hover" default): hover has no touch equivalent, and vendors mostly check this on a phone.
const STATUS_HINT: Record<TxStatus, string> = {
  pending: "The customer hasn't marked this as paid yet.",
  claimed:
    "The customer says they've paid. Check the money actually landed, then confirm it.",
  confirmed: "You've confirmed the money arrived. This can't be undone.",
};

export function TransactionStatusBadge({ status }: { status: TxStatus }) {
  return (
    <span className="inline-flex items-center gap-1">
      <StatusBadge status={status} config={STATUS_CONFIG} />
      <InfoTooltip
        content={STATUS_HINT[status]}
        ariaLabel={`What "${STATUS_CONFIG[status].label}" means`}
        trigger="tap"
      />
    </span>
  );
}
