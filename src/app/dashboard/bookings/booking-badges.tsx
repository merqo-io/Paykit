import { StatusBadge } from "@merqo/ui";
import { Badge, cn } from "@merqo/ui/primitives";

import { balanceDueBadge } from "@/lib/booking-status";
import type { Booking, BookingStatus } from "@/lib/types";

// Same chip as the payment status badge so a booking and its payment read as
// one family; `cancelled` stays muted.
const STATUS_CONFIG: Record<
  BookingStatus,
  { label: string; className: string }
> = {
  pending_deposit: {
    label: "Awaiting deposit",
    className: "text-secondary border-secondary/35 bg-secondary/12",
  },
  deposit_paid: {
    label: "Deposit paid",
    className: "text-mint border-mint/35 bg-mint/12",
  },
  fully_paid: {
    label: "Fully paid",
    className: "text-primary border-primary/35 bg-primary/12",
  },
  cancelled: {
    label: "Cancelled",
    className: "text-muted-foreground border-border bg-muted/40",
  },
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <StatusBadge status={status} config={STATUS_CONFIG} />;
}

/**
 * Dashboard-badge-only reminder — this repo has no cron/notification infra
 * (see `AGENTS.md`), so this is the whole V1 "reminder": a visible pill once
 * the balance is within 14 days of `balance_due_date`, or overdue.
 */
export function BalanceDueIndicator({
  booking,
  now,
}: {
  booking: Pick<Booking, "status" | "balance_due_date">;
  now?: Date;
}) {
  const badge = balanceDueBadge(booking.status, booking.balance_due_date, now);
  if (!badge) return null;
  return (
    <Badge
      variant="outline"
      className={cn(
        badge.urgency === "overdue"
          ? "border-destructive/40 text-destructive"
          : "border-amber-500/40 text-amber-600 dark:text-amber-500",
      )}
    >
      {badge.label}
    </Badge>
  );
}
