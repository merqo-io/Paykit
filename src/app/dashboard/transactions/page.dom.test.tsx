// @vitest-environment jsdom
//
// TransactionsPage is an async Server Component, same pattern as
// layout.dom.test.tsx: await it directly and render the returned element
// tree with RTL. `TransactionTable` already has its own full DOM coverage
// (transaction-table.dom.test.tsx) and renders safely under jsdom with no
// external deps, so it's rendered for real here — this test proves
// TransactionsPage wires the session + `listTransactions` fetch and the
// Pro-plan flag into it correctly.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import TransactionsPage from "./page";
import type { Transaction } from "@/lib/types";

const { getVendorSessionMock, readVendorPlanMock, listTransactionsMock } =
  vi.hoisted(() => ({
    getVendorSessionMock: vi.fn(),
    readVendorPlanMock: vi.fn(),
    listTransactionsMock: vi.fn(),
  }));

vi.mock("@/lib/vendor-session", () => ({
  getVendorSession: getVendorSessionMock,
}));
vi.mock("@/lib/vendor-entitlement", () => ({
  readVendorPlan: readVendorPlanMock,
}));
vi.mock("@/lib/transactions", () => ({
  listTransactions: listTransactionsMock,
}));

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

beforeEach(() => {
  getVendorSessionMock.mockReset().mockResolvedValue({
    supabase: {},
    user: { id: "v1" },
  });
  readVendorPlanMock.mockReset();
  listTransactionsMock.mockReset();
});

describe("TransactionsPage", () => {
  it("shows the empty state with no transactions", async () => {
    readVendorPlanMock.mockResolvedValue("free");
    listTransactionsMock.mockResolvedValue([]);

    const jsx = await TransactionsPage();
    render(jsx);

    expect(
      screen.getByRole("heading", { name: "Payments" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/no payments yet/i)).toBeInTheDocument();
  });

  it("hides the Refund column for a Free vendor", async () => {
    readVendorPlanMock.mockResolvedValue("free");
    listTransactionsMock.mockResolvedValue([TX]);

    const jsx = await TransactionsPage();
    render(jsx);

    expect(screen.getByText("A-001")).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: /refund/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the Refund column for a Pro vendor's confirmed transaction", async () => {
    readVendorPlanMock.mockResolvedValue("pro");
    listTransactionsMock.mockResolvedValue([TX]);

    const jsx = await TransactionsPage();
    render(jsx);

    expect(
      screen.getByRole("columnheader", { name: /refund/i }),
    ).toBeInTheDocument();
    expect(listTransactionsMock).toHaveBeenCalledWith("v1");
  });

  it("treats a vendor with no config yet as Free (no Refund column)", async () => {
    readVendorPlanMock.mockResolvedValue(null);
    listTransactionsMock.mockResolvedValue([TX]);

    const jsx = await TransactionsPage();
    render(jsx);

    expect(
      screen.queryByRole("columnheader", { name: /refund/i }),
    ).not.toBeInTheDocument();
  });
});
