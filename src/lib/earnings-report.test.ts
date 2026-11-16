import { describe, it, expect } from "vitest";
import { buildEarningsReport } from "./earnings-report";
import type { Booking, Transaction } from "@/lib/types";

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx1",
    vendor_id: "v1",
    kit_slug: "paykit",
    order_ref: "booking:b1:deposit",
    amount_cents: 30000,
    status: "confirmed",
    qr_payload: "0002...",
    claimed_at: "2026-06-01T00:00:00Z",
    confirmed_at: "2026-06-01T00:01:00Z",
    created_at: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "b1",
    vendor_id: "v1",
    customer_name: "Jane Tan",
    customer_phone: null,
    event_date: "2026-12-25",
    total_amount_cents: 100000,
    deposit_amount_cents: 30000,
    balance_amount_cents: 70000,
    balance_due_date: "2026-12-18",
    status: "deposit_paid",
    deposit_transaction_id: "tx1",
    balance_transaction_id: null,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

describe("buildEarningsReport", () => {
  it("tags a booking-linked transaction by the booking's event_date, not its own created_at", () => {
    const report = buildEarningsReport(
      [tx({ id: "tx1", created_at: "2026-06-01T00:00:00Z" })],
      [booking({ event_date: "2026-12-25", deposit_transaction_id: "tx1" })],
      2026,
    );
    expect(
      report.months.find((m) => m.month === "2026-12")?.revenue_cents,
    ).toBe(30000);
    expect(
      report.months.find((m) => m.month === "2026-06")?.revenue_cents,
    ).toBe(0);
    expect(report.total_revenue_cents).toBe(30000);
    expect(report.lines).toEqual([
      {
        key: "booking:b1",
        label: "Jane Tan",
        event_date: "2026-12-25",
        revenue_cents: 30000,
      },
    ]);
  });

  it("falls back to the transaction's own created_at when it has no linked booking", () => {
    const report = buildEarningsReport(
      [
        tx({
          id: "tx-standalone",
          order_ref: "qkit-order:abc",
          created_at: "2026-03-15T00:00:00Z",
        }),
      ],
      [],
      2026,
    );
    expect(
      report.months.find((m) => m.month === "2026-03")?.revenue_cents,
    ).toBe(30000);
    expect(report.lines[0].label).toBe("Other checkout (no linked booking)");
  });

  it("files a standalone checkout made after 16:00 UTC under the next Singapore month and year", () => {
    const report = buildEarningsReport(
      [
        tx({ id: "a", created_at: "2026-03-31T16:00:00Z" }),
        tx({ id: "b", created_at: "2026-12-31T16:00:00Z" }),
      ],
      [],
      2026,
    );
    expect(report.lines.map((l) => l.event_date)).toEqual(["2026-04-01"]);
    expect(
      report.months.find((m) => m.month === "2026-04")?.revenue_cents,
    ).toBe(30000);
  });

  it("collapses a booking's deposit and balance transactions into one line", () => {
    const report = buildEarningsReport(
      [
        tx({ id: "tx-deposit", amount_cents: 30000 }),
        tx({ id: "tx-balance", amount_cents: 70000 }),
      ],
      [
        booking({
          deposit_transaction_id: "tx-deposit",
          balance_transaction_id: "tx-balance",
        }),
      ],
      2026,
    );
    expect(report.lines).toHaveLength(1);
    expect(report.lines[0].revenue_cents).toBe(100000);
    expect(report.total_revenue_cents).toBe(100000);
  });

  it("excludes transactions from a different year", () => {
    const report = buildEarningsReport(
      [tx({ id: "tx1" })],
      [booking({ event_date: "2025-12-25", deposit_transaction_id: "tx1" })],
      2026,
    );
    expect(report.total_revenue_cents).toBe(0);
    expect(report.lines).toHaveLength(0);
  });

  it("excludes non-confirmed transactions", () => {
    const report = buildEarningsReport(
      [tx({ id: "tx1", status: "claimed" })],
      [booking({ deposit_transaction_id: "tx1" })],
      2026,
    );
    expect(report.total_revenue_cents).toBe(0);
  });

  it("returns all 12 months even when several have no revenue", () => {
    const report = buildEarningsReport([], [], 2026);
    expect(report.months).toHaveLength(12);
    expect(report.months.every((m) => m.revenue_cents === 0)).toBe(true);
  });
});
