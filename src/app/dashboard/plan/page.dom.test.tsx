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
  countBeforeMock,
} = vi.hoisted(() => ({
  getVendorSessionMock: vi.fn(),
  readVendorPlanMock: vi.fn(),
  txCountThisMonthMock: vi.fn(),
  fetchPlanCatalogMock: vi.fn(),
  countBeforeMock: vi.fn(),
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
  countTransactionsBefore: countBeforeMock,
}));

beforeEach(() => {
  getVendorSessionMock.mockReset().mockResolvedValue({
    supabase: {},
    user: { id: "v1" },
  });
  readVendorPlanMock.mockReset();
  txCountThisMonthMock.mockReset();
  fetchPlanCatalogMock.mockReset().mockResolvedValue(null);
  countBeforeMock.mockReset().mockResolvedValue(0);
});

describe("PlanPage", () => {
  it("shows the Free plan, the Merqo account pointer and the catalog prices from merqo", async () => {
    readVendorPlanMock.mockResolvedValue("free");
    txCountThisMonthMock.mockResolvedValue(3);
    fetchPlanCatalogMock.mockResolvedValue(catalog);

    render(await PlanPage());

    expect(screen.getByText("You are on Free")).toBeInTheDocument();
    expect(screen.getByText("3 transactions this month")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Change plan in your Merqo account" }),
    ).toHaveAttribute(
      "href",
      expect.stringMatching(/^https?:\/\/.+\/account$/),
    );
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

    expect(screen.getByText("You are on Free")).toBeInTheDocument();
    expect(
      screen.getByText(/Prices are unavailable right now\./),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/dashboard/plan",
    );
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

    expect(screen.getByText("You are on Pro")).toBeInTheDocument();
    expect(screen.queryByText("What paid plans add")).not.toBeInTheDocument();
    expect(countBeforeMock).not.toHaveBeenCalled();
  });

  it("falls back to Free when the entitlement read fails", async () => {
    readVendorPlanMock.mockResolvedValue(null);
    txCountThisMonthMock.mockResolvedValue(0);

    render(await PlanPage());

    expect(screen.getByText("You are on Free")).toBeInTheDocument();
    expect(screen.getByText("0 transactions this month")).toBeInTheDocument();
  });

  it("lists what paid plans add and how many older payments Free hides", async () => {
    readVendorPlanMock.mockResolvedValue("free");
    txCountThisMonthMock.mockResolvedValue(0);
    countBeforeMock.mockResolvedValue(12);

    render(await PlanPage());

    expect(screen.getByText("What paid plans add")).toBeInTheDocument();
    expect(screen.getByText(/Refund tracking/)).toBeInTheDocument();
    expect(
      screen.getByText("12 older payments are hidden on Free."),
    ).toBeInTheDocument();
  });

  it("omits the hidden-payments line when nothing is hidden", async () => {
    readVendorPlanMock.mockResolvedValue("free");
    txCountThisMonthMock.mockResolvedValue(0);

    render(await PlanPage());

    expect(screen.queryByText(/hidden on Free/)).not.toBeInTheDocument();
  });

  it("uses the singular for one hidden payment", async () => {
    readVendorPlanMock.mockResolvedValue("free");
    txCountThisMonthMock.mockResolvedValue(0);
    countBeforeMock.mockResolvedValue(1);

    render(await PlanPage());

    expect(
      screen.getByText("1 older payment is hidden on Free."),
    ).toBeInTheDocument();
  });

  it("has no Billing eyebrow", async () => {
    readVendorPlanMock.mockResolvedValue("free");
    txCountThisMonthMock.mockResolvedValue(0);

    render(await PlanPage());

    expect(screen.queryByText("Billing")).not.toBeInTheDocument();
  });

  it("marks a paid vendor's plan as current in the ladder", async () => {
    readVendorPlanMock.mockResolvedValue("pro");
    txCountThisMonthMock.mockResolvedValue(0);
    fetchPlanCatalogMock.mockResolvedValue(proCatalog);

    render(await PlanPage());

    expect(screen.getByText("Your current plan")).toBeInTheDocument();
    expect(
      screen.queryByText("You are on the Pro plan."),
    ).not.toBeInTheDocument();
  });

  it("notes a paid plan missing from the ladder, without repeating the heading for Free", async () => {
    readVendorPlanMock.mockResolvedValue("pro");
    txCountThisMonthMock.mockResolvedValue(0);
    fetchPlanCatalogMock.mockResolvedValue(catalog);

    const { unmount } = render(await PlanPage());
    expect(
      screen.getByText("Your Pro plan is not shown in the list below."),
    ).toBeInTheDocument();
    unmount();

    readVendorPlanMock.mockResolvedValue("free");
    render(await PlanPage());
    expect(screen.queryByText(/not shown in the list/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/You are on the Free plan/),
    ).not.toBeInTheDocument();
  });

  it("builds the paid-plans line from the catalog plan names", async () => {
    readVendorPlanMock.mockResolvedValue("free");
    txCountThisMonthMock.mockResolvedValue(0);
    fetchPlanCatalogMock.mockResolvedValue(proCatalog);

    render(await PlanPage());

    expect(
      screen.getByText(
        "Pro Plan and All-Access both include everything in paykit.",
      ),
    ).toBeInTheDocument();
  });

  it("names a single catalog plan on its own", async () => {
    readVendorPlanMock.mockResolvedValue("free");
    txCountThisMonthMock.mockResolvedValue(0);
    fetchPlanCatalogMock.mockResolvedValue(catalog);

    render(await PlanPage());

    expect(
      screen.getByText("All-Access includes everything in paykit."),
    ).toBeInTheDocument();
  });

  it("falls back to the literal Starter and Pro line when the catalog is unavailable", async () => {
    readVendorPlanMock.mockResolvedValue("free");
    txCountThisMonthMock.mockResolvedValue(0);

    render(await PlanPage());

    expect(
      screen.getByText("Starter and Pro both include everything in paykit."),
    ).toBeInTheDocument();
  });
});
