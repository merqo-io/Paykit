// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { requireAdminMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
}));
vi.mock("@/lib/admin", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/app/actions/auth", () => ({ signOutAction: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/vendors",
}));

import AdminLayout from "./layout";

describe("AdminLayout", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
  });

  it("renders the tabs with the active section marked, plus sign out", async () => {
    requireAdminMock.mockResolvedValue({ user: {} });
    render(await AdminLayout({ children: <p>page body</p> }));
    expect(
      screen.getByRole("navigation", { name: /admin/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Vendors" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "href",
      "/admin",
    );
    expect(screen.getByRole("button", { name: /sign out/i })).toBeVisible();
    expect(screen.getByText("page body")).toBeInTheDocument();
  });

  it("renders nothing when the admin gate rejects (unauthenticated, non-admin or aal1)", async () => {
    requireAdminMock.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(AdminLayout({ children: <p>secret</p> })).rejects.toThrow(
      "NEXT_REDIRECT",
    );
  });
});
