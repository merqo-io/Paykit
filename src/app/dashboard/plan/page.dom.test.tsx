// @vitest-environment jsdom
//
// PlanPage is an async Server Component, same pattern as
// layout.dom.test.tsx: await it directly and render the returned element
// tree with RTL. The free/pro branching itself is unit-tested in
// plan-view.test.ts; this test proves PlanPage wires the session, usage and
// entitlement lookups into `resolvePlanView` and shows no price or upgrade CTA.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PlanPage from "./page";

const { getVendorSessionMock, readVendorPlanMock, txCountThisMonthMock } =
  vi.hoisted(() => ({
    getVendorSessionMock: vi.fn(),
    readVendorPlanMock: vi.fn(),
    txCountThisMonthMock: vi.fn(),
  }));

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
});

describe("PlanPage", () => {
  it("shows the Free plan, the comparison and the Merqo account pointer, with no price", async () => {
    readVendorPlanMock.mockResolvedValue("free");
    txCountThisMonthMock.mockResolvedValue(3);

    render(await PlanPage());

    expect(screen.getByText("Current plan:")).toBeInTheDocument();
    expect(screen.getByText("free")).toBeInTheDocument();
    expect(screen.getByText("3 transactions this month")).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Plan comparison" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Refund tracking")).toBeInTheDocument();
    expect(
      screen.getByText("Change plan from your Merqo account."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\$\d/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the Pro plan", async () => {
    readVendorPlanMock.mockResolvedValue("pro");
    txCountThisMonthMock.mockResolvedValue(120);

    render(await PlanPage());

    expect(screen.getByText("pro")).toBeInTheDocument();
    expect(
      screen.getByText("Change plan from your Merqo account."),
    ).toBeInTheDocument();
  });

  it("falls back to Free when the entitlement read fails", async () => {
    readVendorPlanMock.mockResolvedValue(null);
    txCountThisMonthMock.mockResolvedValue(0);

    render(await PlanPage());

    expect(screen.getByText("free")).toBeInTheDocument();
    expect(screen.getByText("0 transactions this month")).toBeInTheDocument();
  });
});
