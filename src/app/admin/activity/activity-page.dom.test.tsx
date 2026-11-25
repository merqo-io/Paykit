// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));
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
    render(await AdminActivityPage({ searchParams: Promise.resolve({}) }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Activity" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Set vendor plan")).toHaveLength(2);
    expect(screen.getAllByText("Recorded refund")).toHaveLength(2);
    expect(screen.getByText("admin@example.com")).toBeInTheDocument();
  });

  it("falls back to the raw admin id when no email resolves", async () => {
    render(await AdminActivityPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("u2")).toBeInTheDocument();
  });

  it("renders a readable detail line under each action", async () => {
    render(await AdminActivityPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("plan: pro")).toBeInTheDocument();
    expect(
      screen.getByText("refunded_amount_cents: 500, reason: None"),
    ).toBeInTheDocument();
  });

  it("shows an empty state when there is no activity yet", async () => {
    const { auditLog } = await import("@/lib/admin-data");
    vi.mocked(auditLog).mockResolvedValueOnce([]);
    render(await AdminActivityPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText(/no activity yet/i)).toBeInTheDocument();
  });

  it("filters by action and offers only actions present in the data", async () => {
    render(
      await AdminActivityPage({
        searchParams: Promise.resolve({ action: "record_refund" }),
      }),
    );
    expect(screen.getByText("u2")).toBeInTheDocument();
    expect(screen.queryByText("admin@example.com")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Action")).toHaveValue("record_refund");
    expect(
      screen.getByRole("option", { name: "Set vendor plan" }),
    ).toBeInTheDocument();
  });

  it("filters by date range in Singapore time", async () => {
    render(
      await AdminActivityPage({
        searchParams: Promise.resolve({ from: "2026-08-21", to: "2026-08-21" }),
      }),
    );
    expect(screen.getByText("u2")).toBeInTheDocument();
    expect(screen.queryByText("admin@example.com")).not.toBeInTheDocument();
  });

  it("shows a no-match state with the filter form intact", async () => {
    render(
      await AdminActivityPage({
        searchParams: Promise.resolve({ from: "2030-01-01" }),
      }),
    );
    expect(
      screen.getByRole("heading", { name: "No activity matches" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("From")).toHaveValue("2030-01-01");
  });

  it("redirects a page past the end to the last page, keeping filters", async () => {
    await expect(
      AdminActivityPage({
        searchParams: Promise.resolve({ action: "record_refund", page: "4" }),
      }),
    ).rejects.toThrow("REDIRECT /admin/activity?action=record_refund");
  });

  it("shows an error state with retry, not the empty state, when the read fails", async () => {
    const { auditLog } = await import("@/lib/admin-data");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(auditLog).mockRejectedValueOnce(new Error("db down"));
    render(await AdminActivityPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/admin/activity",
    );
    expect(screen.queryByText(/no activity yet/i)).not.toBeInTheDocument();
  });

  it("pages long histories", async () => {
    const { auditLog } = await import("@/lib/admin-data");
    const many = Array.from({ length: 60 }, (_, i) => ({
      id: `a${i}`,
      admin_id: `u${i}`,
      email: `person${i}@example.com`,
      action: "record_refund",
      target_id: null,
      detail: null,
      created_at: "2026-08-21T00:00:00Z",
    }));
    vi.mocked(auditLog).mockResolvedValueOnce(many);
    render(
      await AdminActivityPage({ searchParams: Promise.resolve({ page: "2" }) }),
    );
    expect(screen.getByText("60 actions")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/admin/activity?page=3",
    );
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/admin/activity",
    );
  });

  it("links each target to the vendor search, encoded", async () => {
    const { auditLog } = await import("@/lib/admin-data");
    vi.mocked(auditLog).mockResolvedValueOnce([
      {
        id: "a9",
        admin_id: "u1",
        email: "admin@example.com",
        action: "set_vendor_plan",
        target_id: "ven dor/1",
        detail: null,
        created_at: "2026-08-20T00:00:00Z",
      },
    ]);
    render(await AdminActivityPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("link", { name: "ven dor/1" })).toHaveAttribute(
      "href",
      "/admin/vendors?q=ven+dor%2F1",
    );
  });

  it("notes the fetch window whenever it is full, even with filters on", async () => {
    const { auditLog } = await import("@/lib/admin-data");
    const full = Array.from({ length: 1000 }, (_, i) => ({
      id: `a${i}`,
      admin_id: "u1",
      email: null,
      action: "record_refund",
      target_id: null,
      detail: null,
      created_at: "2026-08-21T00:00:00Z",
    }));
    vi.mocked(auditLog).mockResolvedValueOnce(full);
    render(
      await AdminActivityPage({
        searchParams: Promise.resolve({ action: "record_refund" }),
      }),
    );
    expect(
      screen.getByText(/showing the latest 1000 entries; older entries/i),
    ).toBeInTheDocument();
  });
});
