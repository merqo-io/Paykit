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

const {
  getVendorSessionMock,
  readVendorPlanMock,
  listTransactionsMock,
  countBeforeMock,
} = vi.hoisted(() => ({
  getVendorSessionMock: vi.fn(),
  readVendorPlanMock: vi.fn(),
  listTransactionsMock: vi.fn(),
  countBeforeMock: vi.fn(),
}));

vi.mock("@/lib/vendor-session", () => ({
  getVendorSession: getVendorSessionMock,
}));
vi.mock("@/lib/vendor-entitlement", () => ({
  readVendorPlan: readVendorPlanMock,
}));
vi.mock("@/lib/transactions", () => ({
  listTransactions: listTransactionsMock,
  countTransactionsBefore: countBeforeMock,
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
  countBeforeMock.mockReset().mockResolvedValue(0);
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
    expect(listTransactionsMock).toHaveBeenCalledWith("v1", undefined);
    expect(countBeforeMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/older transactions/i)).not.toBeInTheDocument();
  });

  it("limits a Free vendor's list to the last 30 days and notes hidden rows", async () => {
    readVendorPlanMock.mockResolvedValue("free");
    listTransactionsMock.mockResolvedValue([TX]);
    countBeforeMock.mockResolvedValue(3);

    render(await TransactionsPage());

    const since = listTransactionsMock.mock.calls[0][1] as string;
    const ageDays = (Date.now() - Date.parse(since)) / 86_400_000;
    expect(ageDays).toBeCloseTo(30, 1);
    expect(countBeforeMock).toHaveBeenCalledWith("v1", since);
    expect(
      screen.getByText(
        "Older transactions are kept and show on Starter and Pro.",
      ),
    ).toBeInTheDocument();
  });

  it("shows no older-transactions line when a Free vendor has none hidden", async () => {
    readVendorPlanMock.mockResolvedValue("free");
    listTransactionsMock.mockResolvedValue([TX]);
    countBeforeMock.mockResolvedValue(0);

    render(await TransactionsPage());

    expect(screen.queryByText(/older transactions/i)).not.toBeInTheDocument();
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
