// @vitest-environment jsdom
//
// TransactionsPage is an async Server Component: await it with search params
// and render the returned tree. The table and filters render for real; the
// router is stubbed because the ui pager navigates through a client callback.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import TransactionsPage from "./page";
import type { Transaction } from "@/lib/types";

const {
  getVendorSessionMock,
  readVendorPlanMock,
  queryTransactionsMock,
  countBeforeMock,
} = vi.hoisted(() => ({
  getVendorSessionMock: vi.fn(),
  readVendorPlanMock: vi.fn(),
  queryTransactionsMock: vi.fn(),
  countBeforeMock: vi.fn(),
}));

vi.mock("@/lib/vendor-session", () => ({
  getVendorSession: getVendorSessionMock,
}));
vi.mock("@/lib/vendor-entitlement", () => ({
  readVendorPlan: readVendorPlanMock,
}));
vi.mock("@/lib/transactions", () => ({
  queryTransactions: queryTransactionsMock,
  countTransactionsBefore: countBeforeMock,
}));
const { redirectMock } = vi.hoisted(() => ({ redirectMock: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  redirect: redirectMock,
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

const ok = (rows: Transaction[], total = rows.length) => ({
  rows,
  total,
  failed: false,
});
const renderPage = async (sp: Record<string, string> = {}) =>
  render(await TransactionsPage({ searchParams: Promise.resolve(sp) }));

beforeEach(() => {
  getVendorSessionMock.mockReset().mockResolvedValue({
    supabase: {},
    user: { id: "v1" },
  });
  readVendorPlanMock.mockReset();
  queryTransactionsMock.mockReset();
  countBeforeMock.mockReset().mockResolvedValue(0);
  redirectMock.mockReset();
});

describe("TransactionsPage", () => {
  it("shows the empty state with no transactions", async () => {
    readVendorPlanMock.mockResolvedValue("free");
    queryTransactionsMock.mockResolvedValue(ok([]));
    await renderPage();
    expect(
      screen.getByRole("heading", { name: "Payments" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/no payments yet/i)).toBeInTheDocument();
    expect(screen.queryByText("Ledger")).not.toBeInTheDocument();
  });

  it("hides the Refund column for a Free vendor and treats a null plan as Free", async () => {
    queryTransactionsMock.mockResolvedValue(ok([TX]));
    for (const plan of ["free", null]) {
      readVendorPlanMock.mockResolvedValue(plan);
      const { unmount } = await renderPage();
      expect(screen.getByText("A-001")).toBeInTheDocument();
      expect(
        screen.queryByRole("columnheader", { name: /refund/i }),
      ).not.toBeInTheDocument();
      unmount();
    }
  });

  it("shows the Refund column and enabled search for a paid vendor", async () => {
    readVendorPlanMock.mockResolvedValue("pro");
    queryTransactionsMock.mockResolvedValue(ok([TX]));
    await renderPage();
    expect(
      screen.getByRole("columnheader", { name: /refund/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toBeEnabled();
    expect(countBeforeMock).not.toHaveBeenCalled();
  });

  it("passes the status deep link, search and dates to a paid query", async () => {
    readVendorPlanMock.mockResolvedValue("pro");
    queryTransactionsMock.mockResolvedValue(ok([TX]));
    await renderPage({
      status: "claimed",
      q: "A-001",
      from: "2026-11-01",
      to: "2026-11-25",
      page: "2",
    });
    expect(queryTransactionsMock).toHaveBeenCalledWith("v1", {
      gteIso: "2026-10-31T16:00:00.000Z",
      ltIso: "2026-11-25T16:00:00.000Z",
      status: "claimed",
      search: "A-001",
      page: 2,
      pageSize: 25,
    });
    expect(screen.getByLabelText("Status")).toHaveValue("claimed");
  });

  it("never lets a Free vendor reach past the cutoff or search via params", async () => {
    readVendorPlanMock.mockResolvedValue("free");
    queryTransactionsMock.mockResolvedValue(ok([TX]));
    await renderPage({ from: "2020-01-01", q: "A-001" });
    const arg = queryTransactionsMock.mock.calls[0][1] as {
      gteIso: string;
      search?: string;
    };
    const ageDays = (Date.now() - Date.parse(arg.gteIso)) / 86_400_000;
    expect(ageDays).toBeCloseTo(30, 1);
    expect(arg.search).toBeUndefined();
  });

  it("locks search for Free with an upgrade note", async () => {
    readVendorPlanMock.mockResolvedValue("free");
    queryTransactionsMock.mockResolvedValue(ok([TX]));
    await renderPage();
    expect(screen.getByLabelText("Search")).toBeDisabled();
    expect(
      screen.getByText(/search comes with starter or pro/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "See plans" })[0],
    ).toHaveAttribute("href", "/dashboard/plan");
  });

  it("notes hidden older payments for Free using the RLS-scoped count", async () => {
    readVendorPlanMock.mockResolvedValue("free");
    queryTransactionsMock.mockResolvedValue(ok([TX]));
    countBeforeMock.mockResolvedValue(3);
    await renderPage();
    const since = countBeforeMock.mock.calls[0][1] as string;
    expect((Date.now() - Date.parse(since)) / 86_400_000).toBeCloseTo(30, 1);
    expect(screen.getByText(/3 older payments hidden on/i)).toBeInTheDocument();
  });

  it("uses the singular for one hidden payment and omits the note at zero", async () => {
    readVendorPlanMock.mockResolvedValue("free");
    queryTransactionsMock.mockResolvedValue(ok([TX]));
    countBeforeMock.mockResolvedValue(1);
    const { unmount } = await renderPage();
    expect(screen.getByText(/1 older payment hidden on/i)).toBeInTheDocument();
    unmount();
    countBeforeMock.mockResolvedValue(0);
    await renderPage();
    expect(screen.queryByText(/older payment/i)).not.toBeInTheDocument();
  });

  it("shows No payments match with a clear link when a filter finds nothing", async () => {
    readVendorPlanMock.mockResolvedValue("pro");
    queryTransactionsMock.mockResolvedValue(ok([]));
    await renderPage({ status: "claimed" });
    expect(screen.getByText("No payments match")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "Clear filters" });
    expect(links[0]).toHaveAttribute("href", "/dashboard/transactions");
  });

  it("shows an error state when the read fails", async () => {
    readVendorPlanMock.mockResolvedValue("pro");
    queryTransactionsMock.mockResolvedValue({
      rows: [],
      total: 0,
      failed: true,
    });
    await renderPage();
    expect(screen.getByText("Couldn't load payments")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load payments",
    );
  });

  it("limits the date pickers for Free and says so when a range was cut short", async () => {
    readVendorPlanMock.mockResolvedValue("free");
    queryTransactionsMock.mockResolvedValue(ok([TX]));
    const { unmount } = await renderPage({ from: "2020-01-01" });
    expect(screen.getByLabelText("From")).toHaveAttribute("min");
    expect(screen.getByLabelText("To")).toHaveAttribute("min");
    expect(
      screen.getByText(/free shows the last 30 days/i),
    ).toBeInTheDocument();
    unmount();
    await renderPage();
    expect(screen.queryByText(/free shows the last/i)).not.toBeInTheDocument();
  });

  it("leaves the date pickers open for a paid vendor", async () => {
    readVendorPlanMock.mockResolvedValue("pro");
    queryTransactionsMock.mockResolvedValue(ok([TX]));
    await renderPage({ from: "2020-01-01" });
    expect(screen.getByLabelText("From")).not.toHaveAttribute("min");
    expect(screen.queryByText(/free shows the last/i)).not.toBeInTheDocument();
  });

  it("redirects a page past the end to the last page, keeping filters", async () => {
    readVendorPlanMock.mockResolvedValue("pro");
    queryTransactionsMock.mockResolvedValue(ok([], 60));
    await renderPage({ page: "9", status: "claimed" });
    expect(redirectMock).toHaveBeenCalledWith(
      "/dashboard/transactions?status=claimed&page=3",
    );
  });

  it("redirects to the bare ledger when nothing matches and the page is past the end", async () => {
    readVendorPlanMock.mockResolvedValue("pro");
    queryTransactionsMock.mockResolvedValue(ok([], 0));
    await renderPage({ page: "4" });
    expect(redirectMock).toHaveBeenCalledWith("/dashboard/transactions");
  });

  it("does not redirect on a failed read or an in-range page", async () => {
    readVendorPlanMock.mockResolvedValue("pro");
    queryTransactionsMock.mockResolvedValue({
      rows: [],
      total: 0,
      failed: true,
    });
    const { unmount } = await renderPage({ page: "4" });
    unmount();
    queryTransactionsMock.mockResolvedValue(ok([TX], 60));
    await renderPage({ page: "2" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("drops a stale q from links for a Free vendor", async () => {
    readVendorPlanMock.mockResolvedValue("free");
    queryTransactionsMock.mockResolvedValue({
      rows: [],
      total: 0,
      failed: true,
    });
    await renderPage({ q: "old", status: "claimed" });
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/dashboard/transactions?status=claimed",
    );
  });

  it("uses one clock for the window and the hidden count", async () => {
    readVendorPlanMock.mockResolvedValue("free");
    queryTransactionsMock.mockResolvedValue(ok([TX]));
    await renderPage();
    const arg = queryTransactionsMock.mock.calls[0][1] as { gteIso: string };
    expect(countBeforeMock.mock.calls[0][1]).toBe(arg.gteIso);
  });

  it("renders a pager when there is more than one page", async () => {
    readVendorPlanMock.mockResolvedValue("pro");
    queryTransactionsMock.mockResolvedValue(ok([TX], 60));
    await renderPage();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });
});
