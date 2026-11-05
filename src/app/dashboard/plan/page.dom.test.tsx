// @vitest-environment jsdom
//
// PlanPage is an async Server Component, same pattern as
// layout.dom.test.tsx: await it directly and render the returned element
// tree with RTL. The free/pro branching itself is unit-tested in
// plan-view.test.ts; this test proves PlanPage wires the session, usage and
// entitlement lookups into `resolvePlanView`, and that the merqo catalog (mocked
// fetch) renders through PricingLadder, with a calm, price-free fallback when
// the catalog is unavailable.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PlanPage from "./page";

const {
  getVendorSessionMock,
  readVendorPlanMock,
  txCountThisMonthMock,
  fetchPlanCatalogMock,
} = vi.hoisted(() => ({
  getVendorSessionMock: vi.fn(),
  readVendorPlanMock: vi.fn(),
  txCountThisMonthMock: vi.fn(),
  fetchPlanCatalogMock: vi.fn(),
}));

vi.mock("@merqo/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@merqo/ui")>()),
  fetchPlanCatalog: fetchPlanCatalogMock,
}));

const catalog = {
  plans: [
    {
      slug: "all_access",
      kind: "bundle",
      name: "All-Access",
      monthly_cents: 4321,
      annual_cents: 43210,
      kits: ["qkit", "paykit"],
    },
  ],
  event_pass: { per_cup_cents: 50, min_cents: 1000, cap_cents: 5000, days: 3 },
};

vi.mock("@/lib/vendor-session", () => ({
  getVendorSession: getVendorSessionMock,
}));
vi.mock("@/lib/vendor-entitlement", () => ({
  readVendorPlan: readVendorPlanMock,
}));
vi.mock("@/lib/transactions", () => ({
  txCountThisMonth: txCountThisMonthMock,
}));

beforeEach(() => {
  getVendorSessionMock.mockReset().mockResolvedValue({
    supabase: {},
    user: { id: "v1" },
  });
  readVendorPlanMock.mockReset();
  txCountThisMonthMock.mockReset();
  fetchPlanCatalogMock.mockReset().mockResolvedValue(null);
});

describe("PlanPage", () => {
  it("shows the Free plan, the Merqo account pointer and the catalog prices from merqo", async () => {
    readVendorPlanMock.mockResolvedValue("free");
    txCountThisMonthMock.mockResolvedValue(3);
    fetchPlanCatalogMock.mockResolvedValue(catalog);

    render(await PlanPage());

    expect(screen.getByText("Current plan:")).toBeInTheDocument();
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("3 transactions this month")).toBeInTheDocument();
    expect(
      screen.getByText("Change plan from your Merqo account."),
    ).toBeInTheDocument();
    expect(fetchPlanCatalogMock).toHaveBeenCalledWith(
      expect.stringMatching(/^https?:\/\//),
    );
    expect(screen.getByText(/43\.21/)).toBeInTheDocument();
    expect(screen.queryByText(/unavailable/i)).not.toBeInTheDocument();
  });

  it("shows the plan and a calm line, with no price, when the catalog is null", async () => {
    readVendorPlanMock.mockResolvedValue("free");
    txCountThisMonthMock.mockResolvedValue(3);

    render(await PlanPage());

    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Prices are unavailable right now. Your plan is unaffected.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\$\s?\d/)).not.toBeInTheDocument();
  });

  it("treats a rejected catalog fetch like an unavailable catalog", async () => {
    readVendorPlanMock.mockResolvedValue("free");
    txCountThisMonthMock.mockResolvedValue(0);
    fetchPlanCatalogMock.mockRejectedValue(new Error("boom"));

    render(await PlanPage());

    expect(screen.getByText("0 transactions this month")).toBeInTheDocument();
    expect(screen.getByText(/Prices are unavailable/)).toBeInTheDocument();
  });

  it("shows the Pro plan", async () => {
    readVendorPlanMock.mockResolvedValue("pro");
    txCountThisMonthMock.mockResolvedValue(120);

    render(await PlanPage());

    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(
      screen.getByText("Change plan from your Merqo account."),
    ).toBeInTheDocument();
  });

  it("falls back to Free when the entitlement read fails", async () => {
    readVendorPlanMock.mockResolvedValue(null);
    txCountThisMonthMock.mockResolvedValue(0);

    render(await PlanPage());

    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("0 transactions this month")).toBeInTheDocument();
  });
});
