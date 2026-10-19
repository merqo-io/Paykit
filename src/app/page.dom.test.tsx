// @vitest-environment jsdom
//
// HomePage is an async Server Component, same pattern as
// layout.dom.test.tsx: await it directly and render the returned element
// tree with RTL. The heavier/presentational landing sections (Nav, Hero,
// HowItWorks, ClosingCta, Footer, BackToTop) are stubbed so this test stays
// focused on HomePage's own job — resolving the session + live price and
// threading `monthlyPriceLabel` down to `Benefits`/`Faq`, which render for
// real so their price-prop wiring gets exercised too.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "./page";

const { createServerClientMock, getPricingMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  getPricingMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: createServerClientMock,
}));
vi.mock("@/lib/pricing", () => ({ getPricing: getPricingMock }));

vi.mock("@/components/landing/nav", () => ({ Nav: () => <div /> }));
vi.mock("@/components/landing/hero", () => ({ Hero: () => <div /> }));
vi.mock("@/components/landing/how-it-works", () => ({
  HowItWorks: () => <div />,
}));
vi.mock("@/components/landing/closing-cta", () => ({
  ClosingCta: () => <div />,
}));
vi.mock("@/components/site-footer", () => ({ SiteFooter: () => <div /> }));
vi.mock("@/components/landing/back-to-top", () => ({
  BackToTop: () => <div />,
}));

beforeEach(() => {
  createServerClientMock.mockReset().mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
  });
  getPricingMock.mockReset().mockResolvedValue({
    monthly_cents: 499,
    currency: "SGD",
  });
});

describe("HomePage", () => {
  it("threads the live formatted price down to Benefits and Faq", async () => {
    const jsx = await HomePage();
    render(jsx);

    expect(
      screen.getByText(/pro adds refund tracking — \$4\.99\/mo/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/pro adds refund tracking, \$4\.99\/mo/i),
    ).toBeInTheDocument();
  });

  it("reflects whatever live price getPricing returns", async () => {
    getPricingMock.mockResolvedValue({ monthly_cents: 1200, currency: "SGD" });

    const jsx = await HomePage();
    render(jsx);

    expect(screen.getAllByText(/\$12\.00\/mo/).length).toBeGreaterThan(0);
  });
});
