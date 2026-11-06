// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Booking, Transaction } from "@/lib/types";

const {
  getVendorSessionMock,
  listAllTransactionsMock,
  listAllBookingsMock,
  RevenueChartMock,
} = vi.hoisted(() => ({
  getVendorSessionMock: vi.fn(),
  listAllTransactionsMock: vi.fn(),
  listAllBookingsMock: vi.fn(),
  RevenueChartMock: vi.fn(() => <div data-testid="revenue-chart" />),
}));

vi.mock("@/lib/vendor-session", () => ({
  getVendorSession: getVendorSessionMock,
}));
vi.mock("@/lib/transactions", () => ({
  listAllTransactions: listAllTransactionsMock,
}));
vi.mock("@/lib/bookings", () => ({ listAllBookings: listAllBookingsMock }));
// ResponsiveContainer needs real layout, which jsdom does not provide.
vi.mock("../stats/revenue-chart", () => ({ RevenueChart: RevenueChartMock }));

import ReportsPage from "./page";

const TX: Transaction = {
  id: "tx1",
  vendor_id: "v1",
  kit_slug: "paykit",
  order_ref: "booking:b1:deposit",
  amount_cents: 100000,
  status: "confirmed",
  qr_payload: "0002...",
  claimed_at: "2026-06-01T00:00:00Z",
  confirmed_at: "2026-06-01T00:01:00Z",
  created_at: "2026-06-01T00:00:00Z",
};

const BOOKING: Booking = {
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
};

async function renderPage(params: Record<string, string> = {}) {
  render(await ReportsPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  getVendorSessionMock
    .mockReset()
    .mockResolvedValue({ supabase: {}, user: { id: "v1" } });
  listAllTransactionsMock.mockReset().mockResolvedValue([TX]);
  listAllBookingsMock.mockReset().mockResolvedValue([BOOKING]);
  RevenueChartMock.mockClear();
});

describe("ReportsPage", () => {
  it("renders one Reports heading with deep-linkable tabs", async () => {
    await renderPage();
    expect(
      screen.getByRole("heading", { level: 1, name: "Reports" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "href",
      "/dashboard/reports",
    );
    expect(screen.getByRole("link", { name: "Earnings" })).toHaveAttribute(
      "href",
      "/dashboard/reports?tab=earnings",
    );
  });

  it("shows the revenue chart on the overview tab for every plan", async () => {
    await renderPage();
    expect(screen.getByTestId("revenue-chart")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByText(/pro/i)).not.toBeInTheDocument();
  });

  it("shows a dashed empty state on the overview tab with no revenue", async () => {
    listAllTransactionsMock.mockResolvedValue([]);
    await renderPage();
    expect(
      screen.getByRole("heading", { name: "No revenue yet" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("revenue-chart")).not.toBeInTheDocument();
  });

  it("renders the requested year's earnings on the earnings tab", async () => {
    await renderPage({ tab: "earnings", year: "2026" });
    expect(screen.getByRole("link", { name: "Earnings" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("2026")).toBeInTheDocument();
    expect(screen.getByText("Jane Tan")).toBeInTheDocument();
    expect(screen.getByText("2026-12-25")).toBeInTheDocument();
    expect(screen.getAllByText("$1,000.00").length).toBeGreaterThan(0);
  });

  it("labels the year arrows and links them to the neighbouring years", async () => {
    await renderPage({ tab: "earnings", year: "2026" });
    expect(screen.getByRole("link", { name: "Previous year" })).toHaveAttribute(
      "href",
      "/dashboard/reports?tab=earnings&year=2025",
    );
    expect(screen.getByRole("link", { name: "Next year" })).toHaveAttribute(
      "href",
      "/dashboard/reports?tab=earnings&year=2027",
    );
  });

  it("defaults the earnings year to the current year", async () => {
    await renderPage({ tab: "earnings" });
    expect(
      screen.getByText(String(new Date().getUTCFullYear())),
    ).toBeInTheDocument();
  });

  it("shows a dashed empty state for a year with no earnings", async () => {
    listAllBookingsMock.mockResolvedValue([]);
    await renderPage({ tab: "earnings", year: "2020" });
    expect(
      screen.getByRole("heading", { name: "No earnings in 2020" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Customer")).not.toBeInTheDocument();
  });

  it("falls back to Overview for an unknown tab", async () => {
    await renderPage({ tab: "nope" });
    expect(screen.getByTestId("revenue-chart")).toBeInTheDocument();
  });
});
