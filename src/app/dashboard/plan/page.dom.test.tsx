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
      slug: "bundle",
      kind: "bundle",
      name: "All-Access",
      monthly_cents: 4321,
      annual_cents: 43210,
      kits: ["qkit", "paykit"],
    },
  ],
  event_pass: { per_cup_cents: 50, min_cents: 1000, cap_cents: 5000, days: 3 },
};

const proCatalog = {
  ...catalog,
  plans: [
    {
      slug: "qkit",
      kind: "kit",
      name: "Pro Plan",
      monthly_cents: 1000,
      annual_cents: 10000,
      kits: ["qkit"],
    },
    ...catalog.plans,
  ],
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
      undefined,
    );
    expect(screen.getByText(/43\.21/)).toBeInTheDocument();
    expect(screen.queryByText(/unavailable/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Merqo is free during the pilot\./),
    ).toBeInTheDocument();
  });

  it("sends the kit bearer credential to the catalog when it is configured", async () => {
    vi.stubEnv("MERQO_CUSTOMER_SECRET", "test-secret");
    readVendorPlanMock.mockResolvedValue("free");
    txCountThisMonthMock.mockResolvedValue(0);

    render(await PlanPage());

    expect(fetchPlanCatalogMock).toHaveBeenCalledWith(expect.any(String), {
      headers: { Authorization: "Bearer test-secret" },
    });
    vi.unstubAllEnvs();
  });

  it("hides the Event Pass block", async () => {
    readVendorPlanMock.mockResolvedValue("free");
    txCountThisMonthMock.mockResolvedValue(0);
    fetchPlanCatalogMock.mockResolvedValue(catalog);

    render(await PlanPage());

    expect(screen.getByText(/43\.21/)).toBeInTheDocument();
    expect(screen.queryByText(/event pass/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/per cup/i)).not.toBeInTheDocument();
  });

  it("highlights the Pro plan", async () => {
    readVendorPlanMock.mockResolvedValue("free");
    txCountThisMonthMock.mockResolvedValue(0);
    fetchPlanCatalogMock.mockResolvedValue(proCatalog);

    render(await PlanPage());

    const current = screen.getByRole("listitem", { current: true });
    expect(current).toHaveTextContent("Pro Plan");
    expect(current).toHaveTextContent("Recommended");
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
