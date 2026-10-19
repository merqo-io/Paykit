// @vitest-environment jsdom
//
// PlanPage is an async Server Component, same pattern as
// layout.dom.test.tsx: await it directly and render the returned element
// tree with RTL. The free/pro branching itself is unit-tested in
// plan-view.test.ts; this test proves PlanPage actually wires the session
// + usage + pricing lookups into `resolvePlanView` and renders its result,
// including the child `BackButton`/`UpgradeCta`.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PlanPage from "./page";

const {
  getVendorSessionMock,
  getVendorPlanMock,
  txCountThisMonthMock,
  getPricingMock,
  requestProUpgradeActionMock,
} = vi.hoisted(() => ({
  getVendorSessionMock: vi.fn(),
  getVendorPlanMock: vi.fn(),
  txCountThisMonthMock: vi.fn(),
  getPricingMock: vi.fn(),
  requestProUpgradeActionMock: vi.fn(),
}));

vi.mock("@/lib/vendor-session", () => ({
  getVendorSession: getVendorSessionMock,
  getVendorPlan: getVendorPlanMock,
}));
vi.mock("@/lib/transactions", () => ({
  txCountThisMonth: txCountThisMonthMock,
}));
vi.mock("@/lib/pricing", () => ({
  getPricing: getPricingMock,
}));
vi.mock("@/app/actions/plan", () => ({
  requestProUpgradeAction: requestProUpgradeActionMock,
}));

beforeEach(() => {
  getVendorSessionMock.mockReset().mockResolvedValue({
    supabase: {},
    user: { id: "v1" },
  });
  getVendorPlanMock.mockReset();
  txCountThisMonthMock.mockReset();
  getPricingMock.mockReset().mockResolvedValue({
    monthly_cents: 499,
    currency: "SGD",
  });
  requestProUpgradeActionMock.mockReset();
});

describe("PlanPage", () => {
  it("shows the Free plan, the Free vs Pro comparison, and the upgrade CTA below the nudge threshold", async () => {
    getVendorPlanMock.mockResolvedValue({ plan: "free" });
    txCountThisMonthMock.mockResolvedValue(3);

    const jsx = await PlanPage();
    render(jsx);

    expect(screen.getByText("Current plan:")).toBeInTheDocument();
    expect(screen.getByText("free")).toBeInTheDocument();
    expect(screen.getByText("3 transactions this month")).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Plan comparison" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Unlimited transactions")).toBeInTheDocument();
    expect(screen.getByText("Refund tracking")).toBeInTheDocument();
    expect(screen.getByText("$4.99/mo")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /ask us to upgrade to pro/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/ask us to upgrade.*for refund tracking.*\$4\.99\/mo/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/doing real volume/i)).not.toBeInTheDocument();
  });

  it("shows the Pro nudge with the live price once a Free vendor crosses the usage threshold", async () => {
    getVendorPlanMock.mockResolvedValue({ plan: "free" });
    txCountThisMonthMock.mockResolvedValue(50);

    const jsx = await PlanPage();
    render(jsx);

    expect(
      screen.getByText(/doing real volume.*adds refund tracking.*\$4\.99\/mo/i),
    ).toBeInTheDocument();
  });

  it("shows the Pro plan, the same comparison, and no upgrade CTA", async () => {
    getVendorPlanMock.mockResolvedValue({ plan: "pro" });
    txCountThisMonthMock.mockResolvedValue(120);

    const jsx = await PlanPage();
    render(jsx);

    expect(screen.getByText("pro")).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Plan comparison" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Refund tracking")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /ask us to upgrade to pro/i }),
    ).not.toBeInTheDocument();
  });

  it("defaults to the Free plan when the vendor has no config yet", async () => {
    getVendorPlanMock.mockResolvedValue(null);
    txCountThisMonthMock.mockResolvedValue(0);

    const jsx = await PlanPage();
    render(jsx);

    expect(screen.getByText("free")).toBeInTheDocument();
    expect(screen.getByText("0 transactions this month")).toBeInTheDocument();
  });

  it("renders whatever live price getPricing returns", async () => {
    getVendorPlanMock.mockResolvedValue({ plan: "free" });
    txCountThisMonthMock.mockResolvedValue(3);
    getPricingMock.mockResolvedValue({ monthly_cents: 1200, currency: "SGD" });

    const jsx = await PlanPage();
    render(jsx);

    expect(
      screen.getByText(/refund tracking, \$12\.00\/mo/i),
    ).toBeInTheDocument();
  });
});
