// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { BookingTable } from "./booking-table";
import type { Booking } from "@/lib/types";

const BOOKING: Booking = {
  id: "b1",
  vendor_id: "v1",
  customer_name: "Jane Tan",
  customer_phone: "+6591234567",
  event_date: "2026-12-01",
  total_amount_cents: 100000,
  deposit_amount_cents: 30000,
  balance_amount_cents: 70000,
  balance_due_date: "2026-11-24",
  status: "pending_deposit",
  deposit_transaction_id: "tx-deposit",
  balance_transaction_id: null,
  created_at: "2026-08-20T00:00:00Z",
  updated_at: "2026-08-20T00:00:00Z",
};

describe("BookingTable", () => {
  it("renders one row per booking with customer, total, and a link to the detail page", () => {
    render(<BookingTable bookings={[BOOKING]} />);
    const link = screen.getByRole("link", { name: "Jane Tan" });
    expect(link).toHaveAttribute("href", "/dashboard/bookings/b1");
    expect(screen.getByText("$1,000.00")).toBeInTheDocument();
    expect(screen.getByText("Awaiting deposit")).toBeInTheDocument();
  });

  it("shows an empty state with no bookings", () => {
    render(<BookingTable bookings={[]} />);
    expect(screen.getByText(/no bookings yet/i)).toBeInTheDocument();
  });

  it("shows a balance-due badge for a deposit_paid booking due soon", () => {
    // Computed relative to "now" (BookingTable doesn't thread a fixed `now`
    // through) so this stays true regardless of when the suite runs.
    const dueSoon = new Date();
    dueSoon.setUTCDate(dueSoon.getUTCDate() + 5);
    render(
      <BookingTable
        bookings={[
          {
            ...BOOKING,
            status: "deposit_paid",
            balance_due_date: dueSoon.toISOString().slice(0, 10),
          },
        ]}
      />,
    );
    const row = screen.getByRole("row", { name: /jane tan/i });
    expect(within(row).getByText(/balance due in/i)).toBeInTheDocument();
  });
});
