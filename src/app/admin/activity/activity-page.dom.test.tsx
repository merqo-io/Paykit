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

const ROWS = [
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
];

vi.mock("@/lib/admin-data", () => ({
  auditLog: vi.fn(async () => ({
    rows: ROWS,
    total: 2,
    page: 1,
    pageCount: 1,
  })),
}));

import AdminActivityPage from "./page";

async function auditLogMock() {
  const { auditLog } = await import("@/lib/admin-data");
  return vi.mocked(auditLog);
}

describe("AdminActivityPage", () => {
  it("renders audit rows with human-readable action labels", async () => {
    render(await AdminActivityPage({ searchParams: Promise.resolve({}) }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Activity" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Set vendor plan").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Recorded refund").length).toBeGreaterThan(0);
    expect(screen.getByText("admin@example.com")).toBeInTheDocument();
    expect(screen.getByText("2 actions")).toBeInTheDocument();
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
    (await auditLogMock()).mockResolvedValueOnce({
      rows: [],
      total: 0,
      page: 1,
      pageCount: 1,
    });
    render(await AdminActivityPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText(/no activity yet/i)).toBeInTheDocument();
  });

  it("passes the action filter and page size to the query", async () => {
    const mock = await auditLogMock();
    mock.mockClear();
    render(
      await AdminActivityPage({
        searchParams: Promise.resolve({ action: "record_refund" }),
      }),
    );
    expect(mock).toHaveBeenCalledWith({
      action: "record_refund",
      since: undefined,
      until: undefined,
      page: 1,
      pageSize: 25,
    });
    expect(screen.getByLabelText("Action")).toHaveValue("record_refund");
    expect(
      screen.getByRole("option", { name: "Set vendor plan" }),
    ).toBeInTheDocument();
  });

  it("passes the date range as Singapore-day ISO bounds", async () => {
    const mock = await auditLogMock();
    mock.mockClear();
    render(
      await AdminActivityPage({
        searchParams: Promise.resolve({ from: "2026-08-21", to: "2026-08-21" }),
      }),
    );
    expect(mock).toHaveBeenCalledWith(
      expect.objectContaining({
        since: "2026-08-20T16:00:00.000Z",
        until: "2026-08-21T15:59:59.999Z",
      }),
    );
  });

  it("shows a no-match state with the filter form intact", async () => {
    (await auditLogMock()).mockResolvedValueOnce({
      rows: [],
      total: 0,
      page: 1,
      pageCount: 1,
    });
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
    (await auditLogMock()).mockResolvedValueOnce({
      rows: ROWS,
      total: 60,
      page: 3,
      pageCount: 3,
    });
    await expect(
      AdminActivityPage({
        searchParams: Promise.resolve({ action: "record_refund", page: "4" }),
      }),
    ).rejects.toThrow("REDIRECT /admin/activity?action=record_refund&page=3");
  });

  it("shows an error state with retry, not the empty state, when the read fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    (await auditLogMock()).mockRejectedValueOnce(new Error("db down"));
    render(await AdminActivityPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/admin/activity",
    );
    expect(screen.queryByText(/no activity yet/i)).not.toBeInTheDocument();
  });

  it("pages long histories with the total and Page X of Y", async () => {
    (await auditLogMock()).mockResolvedValueOnce({
      rows: ROWS,
      total: 60,
      page: 2,
      pageCount: 3,
    });
    render(
      await AdminActivityPage({
        searchParams: Promise.resolve({ page: "2", action: "record_refund" }),
      }),
    );
    expect(screen.getByText("60 actions")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/admin/activity?action=record_refund&page=3",
    );
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/admin/activity?action=record_refund",
    );
  });

  it("links each target to the vendor search, encoded", async () => {
    (await auditLogMock()).mockResolvedValueOnce({
      rows: [{ ...ROWS[0], id: "a9", target_id: "ven dor/1", detail: null }],
      total: 1,
      page: 1,
      pageCount: 1,
    });
    render(await AdminActivityPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("link", { name: "ven dor/1" })).toHaveAttribute(
      "href",
      "/admin/vendors?q=ven+dor%2F1",
    );
  });

  it("no longer caps the window or shows a truncation notice", async () => {
    (await auditLogMock()).mockResolvedValueOnce({
      rows: ROWS,
      total: 5000,
      page: 1,
      pageCount: 200,
    });
    render(await AdminActivityPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("5000 actions")).toBeInTheDocument();
    expect(screen.queryByText(/older entries/i)).not.toBeInTheDocument();
  });
});
