// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "./page";

const { createServerClientMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: createServerClientMock,
}));

const WAITLIST = "https://merqo.io/waitlist?kit=paykit";
const PRICING_LINE =
  "Free during the pilot. If we start charging, you'll get at least 30 days' notice first.";

beforeEach(() => {
  createServerClientMock.mockReset().mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
  });
});

async function renderLanding() {
  const { container } = render(await HomePage());
  return container.textContent ?? "";
}

describe("HomePage copy guardrails", () => {
  it("shows the readiness badge and explainer", async () => {
    await renderLanding();
    expect(screen.getByText("In build")).toBeInTheDocument();
    expect(
      screen.getByText("Built, not yet tried with vendors."),
    ).toBeInTheDocument();
  });

  it("leads with the one-setup headline and ends with the family footer", async () => {
    await renderLanding();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "One payment setup for every kit.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("states pricing with the exact pilot line and no prices", async () => {
    const text = await renderLanding();
    expect(text).toContain(PRICING_LINE);
    expect(text).not.toMatch(/\$|\/mo\b|per month/i);
    expect(text).not.toMatch(/\b(pro|tiers?)\b/i);
  });

  it("uses no em dashes and no banned words", async () => {
    const text = await renderLanding();
    expect(text).not.toContain("—");
    expect(text).not.toMatch(
      /\b(live|now|available today|proven|tiers?|shopkit|reachkit)\b/i,
    );
    expect(text).not.toMatch(/\bPaykit\b/);
  });

  it("points every signup CTA at the waitlist", async () => {
    await renderLanding();
    const ctas = screen.getAllByRole("link", { name: /join the waitlist/i });
    expect(ctas.length).toBeGreaterThanOrEqual(3);
    for (const a of ctas) expect(a).toHaveAttribute("href", WAITLIST);
    expect(screen.queryByText(/get started/i)).not.toBeInTheDocument();
    expect(document.querySelector('a[href*="mode=signup"]')).toBeNull();
  });
});
