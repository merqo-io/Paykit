// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TransactionTable } from "./transaction-table";
import type { Transaction } from "@/lib/types";

const TX: Transaction = {
  id: "tx1",
  vendor_id: "v1",
  kit_slug: "qkit",
  order_ref: "A-001",
  amount_cents: 450,
  status: "confirmed",
  qr_payload: "0002...",
  claimed_at: "2026-07-15T00:01:00Z",
  confirmed_at: "2026-07-15T00:02:00Z",
  created_at: "2026-07-15T00:00:00Z",
};

describe("TransactionTable", () => {
  it("renders one row per transaction with kit, order ref, amount, status", () => {
    render(<TransactionTable transactions={[TX]} isPro={false} />);
    expect(screen.getByText("qkit")).toBeInTheDocument();
    expect(screen.getByText("A-001")).toBeInTheDocument();
    expect(screen.getByText("$4.50")).toBeInTheDocument();
    expect(screen.getByText("Received")).toBeInTheDocument();
  });

  it("shows an empty state with no transactions", () => {
    render(<TransactionTable transactions={[]} isPro={false} />);
    expect(screen.getByText(/no payments yet/i)).toBeInTheDocument();
  });

  it("hides the Refund column and button for a free-tier vendor", () => {
    render(<TransactionTable transactions={[TX]} isPro={false} />);
    expect(
      screen.queryByRole("button", { name: /refund/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: /refund/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the Refund button for a Pro vendor's confirmed transaction", () => {
    render(<TransactionTable transactions={[TX]} isPro={true} />);
    expect(screen.getByRole("button", { name: /refund/i })).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /refund/i }),
    ).toBeInTheDocument();
  });
});
