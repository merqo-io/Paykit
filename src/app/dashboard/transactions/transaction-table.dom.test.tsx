// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
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

// jsdom applies no Tailwind CSS, so both the phone list and the table are in
// the DOM; each assertion scopes to the one it means.
describe("TransactionTable", () => {
  it("renders one table row per transaction with kit, order ref, amount, status", () => {
    render(<TransactionTable transactions={[TX]} isPro={false} />);
    const table = within(screen.getByRole("table"));
    expect(table.getByText("qkit")).toBeInTheDocument();
    expect(table.getByText("A-001")).toBeInTheDocument();
    expect(table.getByText("S$4.50")).toBeInTheDocument();
    expect(table.getByText("Received")).toBeInTheDocument();
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

  it("shows the Refund column and button for a Pro vendor's confirmed transaction", () => {
    render(<TransactionTable transactions={[TX]} isPro={true} />);
    expect(
      within(screen.getByRole("table")).getByRole("button", {
        name: /refund/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /refund/i }),
    ).toBeInTheDocument();
  });

  describe("phone list", () => {
    it("shows amount, status, kit and date on the collapsed row", () => {
      render(<TransactionTable transactions={[TX]} isPro={true} />);
      const list = within(screen.getByRole("list", { name: "Payments" }));
      expect(list.getByText("S$4.50")).toBeInTheDocument();
      expect(list.getByText("Received")).toBeInTheDocument();
      expect(list.getByText("qkit")).toBeInTheDocument();
      expect(list.getByText(/2026/)).toBeInTheDocument();
      expect(list.queryByText("A-001")).not.toBeInTheDocument();
      expect(
        list.queryByRole("button", { name: /refund/i }),
      ).not.toBeInTheDocument();
    });

    it("expands to reveal the reference and the Refund action", () => {
      render(<TransactionTable transactions={[TX]} isPro={true} />);
      const list = within(screen.getByRole("list", { name: "Payments" }));
      const toggle = list.getByRole("button", { name: "S$4.50" });
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      expect(list.getByText("A-001")).toBeInTheDocument();
      expect(list.getByRole("button", { name: /refund/i })).toBeInTheDocument();
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(list.queryByText("A-001")).not.toBeInTheDocument();
    });

    it("offers no Refund on a Free vendor's expanded row", () => {
      render(<TransactionTable transactions={[TX]} isPro={false} />);
      const list = within(screen.getByRole("list", { name: "Payments" }));
      fireEvent.click(list.getByRole("button", { name: "S$4.50" }));
      expect(list.getByText("A-001")).toBeInTheDocument();
      expect(
        list.queryByRole("button", { name: /refund/i }),
      ).not.toBeInTheDocument();
    });
  });
});
