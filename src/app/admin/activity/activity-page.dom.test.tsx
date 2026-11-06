// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/admin", () => ({ requireAdmin: vi.fn(async () => ({})) }));
vi.mock("@/lib/admin-data", () => ({
  auditLog: vi.fn(async () => [
    {
      id: "a1",
      admin_id: "u1",
      email: "admin@example.com",
      action: "set_vendor_plan",
      target_id: "v1",
      detail: { plan: "pro" },
      created_at: "2026-08-20T00:00:00Z",
    },
    {
      id: "a2",
      admin_id: "u2",
      email: null,
      action: "record_refund",
      target_id: "t1",
      detail: { refunded_amount_cents: 500, reason: null },
      created_at: "2026-08-21T00:00:00Z",
    },
  ]),
}));

import AdminActivityPage from "./page";

describe("AdminActivityPage", () => {
  it("renders audit rows with human-readable action labels", async () => {
    render(await AdminActivityPage());
    expect(
      screen.getByRole("heading", { level: 1, name: "Activity" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Set vendor plan")).toBeInTheDocument();
    expect(screen.getByText("Recorded refund")).toBeInTheDocument();
    expect(screen.getByText("admin@example.com")).toBeInTheDocument();
  });

  it("falls back to the raw admin id when no email resolves", async () => {
    render(await AdminActivityPage());
    expect(screen.getByText("u2")).toBeInTheDocument();
  });

  it("renders a readable detail line under each action", async () => {
    render(await AdminActivityPage());
    expect(screen.getByText("plan: pro")).toBeInTheDocument();
    expect(
      screen.getByText("refunded_amount_cents: 500, reason: None"),
    ).toBeInTheDocument();
  });

  it("shows an empty state when there is no activity yet", async () => {
    const { auditLog } = await import("@/lib/admin-data");
    vi.mocked(auditLog).mockResolvedValueOnce([]);
    render(await AdminActivityPage());
    expect(screen.getByText(/no activity recorded yet/i)).toBeInTheDocument();
  });
});
