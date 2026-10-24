import type { Booking, Transaction } from "@/lib/types";

export type EarningsMonth = { month: string; revenue_cents: number };
export type EarningsLine = {
  key: string;
  label: string;
  event_date: string;
  revenue_cents: number;
};
export type EarningsReport = {
  year: number;
  months: EarningsMonth[];
  lines: EarningsLine[];
  total_revenue_cents: number;
};

const NON_BOOKING_LABEL = "Other checkout (no linked booking)";

function indexBookingsByTransactionId(
  bookings: Booking[],
): Map<string, Booking> {
  const index = new Map<string, Booking>();
  for (const booking of bookings) {
    if (booking.deposit_transaction_id) {
      index.set(booking.deposit_transaction_id, booking);
    }
    if (booking.balance_transaction_id) {
      index.set(booking.balance_transaction_id, booking);
    }
  }
  return index;
}

function addToLine(
  lineByKey: Map<string, EarningsLine>,
  line: EarningsLine,
): void {
  const existing = lineByKey.get(line.key);
  if (existing) {
    existing.revenue_cents += line.revenue_cents;
  } else {
    lineByKey.set(line.key, line);
  }
}

function emptyMonths(year: number): EarningsMonth[] {
  return Array.from({ length: 12 }, (_, i) => ({
    month: `${year}-${String(i + 1).padStart(2, "0")}`,
    revenue_cents: 0,
  }));
}

/** Accrual-aware revenue for a given year — tagged by the event the money
 * is for (a linked booking's `event_date`), not the date it was claimed or
 * confirmed. A confirmed transaction with no linked booking (a one-shot,
 * non-booking checkout — paykit also serves those) falls back to its own
 * `created_at` date instead of being dropped. Revenue only, never profit —
 * paykit never sees a vendor's costs. Deposit and balance transactions on
 * the same booking collapse into one line. */
export function buildEarningsReport(
  transactions: Transaction[],
  bookings: Booking[],
  year: number,
): EarningsReport {
  const bookingByTxId = indexBookingsByTransactionId(bookings);
  const lineByKey = new Map<string, EarningsLine>();
  const monthTotals = new Map<string, number>();
  let totalRevenueCents = 0;

  for (const tx of transactions) {
    if (tx.status !== "confirmed") continue;
    const booking = bookingByTxId.get(tx.id);
    const eventDate = booking?.event_date ?? tx.created_at.slice(0, 10);
    if (Number(eventDate.slice(0, 4)) !== year) continue;

    const key = booking ? `booking:${booking.id}` : `tx:${tx.id}`;
    const label = booking ? booking.customer_name : NON_BOOKING_LABEL;
    addToLine(lineByKey, {
      key,
      label,
      event_date: eventDate,
      revenue_cents: tx.amount_cents,
    });

    const monthKey = eventDate.slice(0, 7);
    monthTotals.set(
      monthKey,
      (monthTotals.get(monthKey) ?? 0) + tx.amount_cents,
    );
    totalRevenueCents += tx.amount_cents;
  }

  const months = emptyMonths(year).map((m) => ({
    ...m,
    revenue_cents: monthTotals.get(m.month) ?? 0,
  }));
  const lines = [...lineByKey.values()].sort((a, b) =>
    a.event_date.localeCompare(b.event_date),
  );

  return { year, months, lines, total_revenue_cents: totalRevenueCents };
}
