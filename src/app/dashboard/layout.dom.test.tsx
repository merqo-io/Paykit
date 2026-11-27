// @vitest-environment jsdom
// Render the async layout to verify shared navigation landmark composition.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardLayout from "./layout";
import { getOrCreateVendorProfile } from "@/lib/merqo-vendor-profile";

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
}));
vi.mock("@/lib/merqo-vendor-profile", () => ({
  getOrCreateVendorProfile: vi.fn(async () => ({
    stall_name: "Kopitiam Cart",
    social_links: {},
  })),
}));
vi.mock("@/lib/transactions", () => ({
  claimedTxSummary: vi.fn(async () => ({ count: 4, cents: 1200 })),
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

  it("hides the footer on phones and in print", async () => {
    const jsx = await DashboardLayout({ children: <div>page content</div> });
    const { container } = render(jsx);

    expect(container.querySelector("footer")?.parentElement).toHaveClass(
      "hidden",
      "sm:contents",
      "print:hidden",
    );
  });

  it("mounts the phone tab bar with the waiting-payments badge, and the rail", async () => {
    const jsx = await DashboardLayout({ children: <div>page content</div> });
    render(jsx);

    expect(
      screen.getByRole("navigation", { name: "Primary" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /Payments, 4 waiting to confirm/ })
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("navigation", { name: "Sections" }),
    ).toBeInTheDocument();
  });

  it("ends with the family footer, hidden in print, without a sign-in link", async () => {
    const jsx = await DashboardLayout({ children: <div>page content</div> });
    const { container } = render(jsx);

    const footer = container.querySelector("footer");
    expect(footer?.parentElement).toHaveClass("sm:contents", "print:hidden");
    expect(
      screen.queryByRole("link", { name: "Vendor sign in →" }),
    ).not.toBeInTheDocument();
  });

  it("labels the account menu with the stall name", async () => {
    const jsx = await DashboardLayout({ children: <div>page content</div> });
    render(jsx);

    expect(screen.getAllByText("Kopitiam Cart").length).toBeGreaterThan(0);
  });

  it("falls back to the email local part, never the full email, when the stall name is empty", async () => {
    vi.mocked(getOrCreateVendorProfile).mockResolvedValueOnce({
      stall_name: "",
      social_links: {},
    } as Awaited<ReturnType<typeof getOrCreateVendorProfile>>);
    const jsx = await DashboardLayout({ children: <div>page content</div> });
    render(jsx);

    expect(screen.getAllByText("vendor").length).toBeGreaterThan(0);
    expect(screen.queryByText("vendor@example.com")).not.toBeInTheDocument();
    expect(screen.queryByText("Your account")).not.toBeInTheDocument();
  });
});
