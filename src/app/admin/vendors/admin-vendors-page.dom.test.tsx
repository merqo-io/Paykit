// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
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
    render(await AdminVendorsPage());
    expect(screen.getByText("Vendors")).toBeInTheDocument();
    expect(screen.getByText("pro@example.com")).toBeInTheDocument();
    expect(screen.getByText("free@example.com")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("Kopitiam Cart")).toBeInTheDocument();
    expect(screen.getByText("Pay with PayLah")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows an empty state when there are no vendors", async () => {
    const { listVendors } = await import("@/lib/admin-data");
    vi.mocked(listVendors).mockResolvedValueOnce([]);
    render(await AdminVendorsPage());
    expect(screen.getByText("No vendors yet.")).toBeInTheDocument();
  });
});
