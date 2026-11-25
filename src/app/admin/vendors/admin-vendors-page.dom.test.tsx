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
  listVendors: vi.fn(async () => [
    {
      vendor_id: "v1",
      email: "pro@example.com",
      plan: "pro",
      kind: "paynow",
      payee_name: "Kopitiam Cart",
      label: null,
      transaction_count: 12,
      created_at: "2026-07-01T00:00:00Z",
      status: "attention",
    },
    {
      vendor_id: "v2",
      email: "free@example.com",
      plan: "free",
      kind: "pointer",
      payee_name: null,
      label: "Pay with PayLah",
      transaction_count: 0,
      created_at: "2026-07-02T00:00:00Z",
      status: "new",
    },
  ]),
}));

import AdminVendorsPage from "./page";

describe("AdminVendorsPage", () => {
  it("renders vendors with their plan, transaction count, and secondary identity", async () => {
    render(await AdminVendorsPage({ searchParams: Promise.resolve({}) }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Vendors" }),
    ).toBeInTheDocument();
    expect(screen.getByText("pro@example.com")).toBeInTheDocument();
    expect(screen.getByText("free@example.com")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("Kopitiam Cart")).toBeInTheDocument();
    expect(screen.getByText("Pay with PayLah")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("shows Not set for a vendor without an email", async () => {
    const { listVendors } = await import("@/lib/admin-data");
    vi.mocked(listVendors).mockResolvedValueOnce([
      {
        vendor_id: "v3",
        email: null,
        plan: "free",
        kind: "paynow",
        payee_name: null,
        label: null,
        transaction_count: 0,
        created_at: "2026-07-03T00:00:00Z",
        status: "healthy",
      },
    ] as Awaited<ReturnType<typeof listVendors>>);
    render(await AdminVendorsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Not set")).toBeInTheDocument();
  });

  it("shows an empty state when there are no vendors", async () => {
    const { listVendors } = await import("@/lib/admin-data");
    vi.mocked(listVendors).mockResolvedValueOnce([]);
    render(await AdminVendorsPage({ searchParams: Promise.resolve({}) }));
    expect(
      screen.getByRole("heading", { name: "No vendors yet" }),
    ).toBeInTheDocument();
  });

  it("filters by stall name or email from the q param", async () => {
    render(
      await AdminVendorsPage({ searchParams: Promise.resolve({ q: "KOPI" }) }),
    );
    expect(screen.getByText("pro@example.com")).toBeInTheDocument();
    expect(screen.queryByText("free@example.com")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/search by stall name/i)).toHaveValue("KOPI");
    expect(screen.getByRole("link", { name: "Clear" })).toHaveAttribute(
      "href",
      "/admin/vendors",
    );
  });

  it("shows a no-match state that keeps the search box", async () => {
    render(
      await AdminVendorsPage({ searchParams: Promise.resolve({ q: "zzz" }) }),
    );
    expect(
      screen.getByRole("heading", { name: "No vendors match" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("search")).toBeInTheDocument();
  });

  it("pages the list and keeps the search in page links", async () => {
    const { listVendors } = await import("@/lib/admin-data");
    const many = Array.from({ length: 30 }, (_, i) => ({
      vendor_id: `v${i}`,
      email: `shop${i}@example.com`,
      plan: "free",
      kind: "paynow",
      payee_name: null,
      label: null,
      transaction_count: i,
      created_at: "2026-07-01T00:00:00Z",
      status: "healthy",
    })) as Awaited<ReturnType<typeof listVendors>>;
    vi.mocked(listVendors).mockResolvedValueOnce(many);
    render(
      await AdminVendorsPage({ searchParams: Promise.resolve({ q: "shop" }) }),
    );
    expect(screen.getByText("30 vendors")).toBeInTheDocument();
    expect(screen.queryByText("shop29@example.com")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/admin/vendors?q=shop&page=2",
    );
  });

  it("redirects a page past the end to the last page", async () => {
    await expect(
      AdminVendorsPage({ searchParams: Promise.resolve({ page: "9" }) }),
    ).rejects.toThrow("REDIRECT /admin/vendors");
  });

  it("shows an error state with retry, not the empty state, when the read fails", async () => {
    const { listVendors } = await import("@/lib/admin-data");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(listVendors).mockRejectedValueOnce(new Error("db down"));
    render(
      await AdminVendorsPage({ searchParams: Promise.resolve({ q: "a" }) }),
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/admin/vendors?q=a",
    );
    expect(screen.queryByText("No vendors yet")).not.toBeInTheDocument();
  });
});
