// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/admin", () => ({ requireAdmin: vi.fn(async () => ({})) }));
vi.mock("@/lib/admin-data", () => ({
  platformTotals: vi.fn(async () => ({
    vendors: 4,
    free_vendors: 2,
    pro_vendors: 2,
    transactions: 120,
    confirmed_transactions: 90,
    confirmed_volume_cents: 456700,
    confirmed_7d: 12,
    confirmed_prev_7d: 8,
    confirmed_volume_cents_30d: 250000,
    confirmed_volume_cents_prev_30d: 200000,
    refund_count_30d: 3,
    refund_volume_cents_30d: 9900,
  })),
  securityStats: vi.fn(async () => ({
    failed_auth_24h: 5,
    rate_limited_kits_24h: 1,
  })),
  recentActivity: vi.fn(async () => [
    {
      id: "t1",
      vendor_id: "v1",
      email: "kopitiam@example.com",
      kit_slug: "qkit",
      amount_cents: 500,
      status: "confirmed",
      created_at: "2026-07-10T00:00:00Z",
    },
    {
      id: "t2",
      vendor_id: "v2",
      email: "bakery@example.com",
      kit_slug: "loopkit",
      amount_cents: 900,
      status: "pending",
      created_at: "2026-07-11T00:00:00Z",
    },
  ]),
}));

import AdminOverviewPage from "./page";

describe("AdminOverviewPage", () => {
  it("renders platform totals and recent activity", async () => {
    render(await AdminOverviewPage());
    expect(
      screen.getByRole("heading", { level: 1, name: "Overview" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Received")).toBeInTheDocument();
    expect(screen.getByText("Awaiting payment")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("kopitiam@example.com")).toBeInTheDocument();
    expect(screen.getByText("bakery@example.com")).toBeInTheDocument();
    expect(screen.getByText("qkit")).toBeInTheDocument();
  });

  it("renders windowed confirmed/volume deltas and the refund stat", async () => {
    render(await AdminOverviewPage());
    expect(screen.getByText("Confirmed · 7d")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Confirmed volume · 30d")).toBeInTheDocument();
    expect(screen.getByText("Refunds · 30d")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("$99.00")).toBeInTheDocument();
  });

  it("renders the Security stat block", async () => {
    render(await AdminOverviewPage());
    expect(screen.getByText("Security")).toBeInTheDocument();
    expect(screen.getByText("Failed sign-ins, last 24h")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Rate-limited kits · 24h")).toBeInTheDocument();
  });

  it("no longer renders a Pricing section", async () => {
    render(await AdminOverviewPage());
    expect(screen.queryByText(/pricing/i)).not.toBeInTheDocument();
  });

  it("falls back to Not set when a row has no email", async () => {
    const { recentActivity } = await import("@/lib/admin-data");
    vi.mocked(recentActivity).mockResolvedValueOnce([
      {
        id: "t3",
        vendor_id: "v3",
        email: null,
        kit_slug: "qkit",
        amount_cents: 100,
        status: "claimed",
        created_at: "2026-07-12T00:00:00Z",
      },
    ] as Awaited<ReturnType<typeof recentActivity>>);
    render(await AdminOverviewPage());
    expect(screen.getByText("Not set")).toBeInTheDocument();
    expect(screen.getByText("Marked paid")).toBeInTheDocument();
  });

  it("shows an empty state when there is no activity yet", async () => {
    const { recentActivity } = await import("@/lib/admin-data");
    vi.mocked(recentActivity).mockResolvedValueOnce([]);
    render(await AdminOverviewPage());
    expect(
      screen.getByRole("heading", { name: "No activity yet" }),
    ).toBeInTheDocument();
  });
});
