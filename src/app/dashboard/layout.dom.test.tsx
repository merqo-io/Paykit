// @vitest-environment jsdom
// Render the async layout to verify shared navigation landmark composition.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardLayout from "./layout";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("@/lib/vendor-session", () => ({
  getVendorSession: vi.fn(async () => ({
    supabase: {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { tour_seen_at: "2026-01-01T00:00:00Z" },
            }),
          }),
        }),
      }),
    },
    user: { id: "v1", email: "vendor@example.com", user_metadata: {} },
  })),
  getVendorPlan: vi.fn(async () => ({ plan: "free" })),
}));
vi.mock("@/lib/merqo-vendor-profile", () => ({
  getOrCreateVendorProfile: vi.fn(async () => ({
    stall_name: "Kopitiam Cart",
    social_links: {},
  })),
}));
vi.mock("@/app/actions/auth", () => ({
  signOutAction: vi.fn(async () => {}),
}));
// The onboarding tour's own auto-run/driver.js behavior is covered by
// dashboard-tour.dom.test.tsx; stubbed here so this test stays focused on
// layout.tsx's header composition.
vi.mock("@/components/dashboard-tour", () => ({
  DashboardTour: () => null,
}));

describe("DashboardLayout", () => {
  it("renders exactly one <header> landmark (@merqo/ui's DashboardNav owns it — layout.tsx must not wrap it in its own)", async () => {
    const jsx = await DashboardLayout({ children: <div>page content</div> });
    const { container } = render(jsx);

    expect(container.querySelectorAll("header")).toHaveLength(1);
  });

  // jsdom cannot measure sticky layout; verify its containing-block structure.
  it("wraps the header in a display:contents div, not a plain div, so sticky positioning has room to work", async () => {
    const jsx = await DashboardLayout({ children: <div>page content</div> });
    const { container } = render(jsx);

    const header = container.querySelector("header");
    expect(header?.parentElement).toHaveClass("contents", "print:hidden");
  });

  it("ends with the family footer, hidden in print, without a sign-in link", async () => {
    const jsx = await DashboardLayout({ children: <div>page content</div> });
    const { container } = render(jsx);

    const footer = container.querySelector("footer");
    expect(footer?.parentElement).toHaveClass("contents", "print:hidden");
    expect(
      screen.queryByRole("link", { name: "Vendor sign in →" }),
    ).not.toBeInTheDocument();
  });
});
