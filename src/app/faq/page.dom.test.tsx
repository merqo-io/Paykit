// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FaqRoute from "./page";
import { FAQ_GROUPS } from "./faq-content";

const { createServerClientMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: createServerClientMock,
}));

vi.mock("@/components/landing/nav", () => ({
  Nav: () => <nav data-testid="nav" />,
}));
vi.mock("@/components/site-footer", () => ({
  SiteFooter: () => <footer data-testid="footer" />,
}));

beforeEach(() => {
  createServerClientMock.mockReset().mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
  });
});

describe("FAQ page", () => {
  it("renders the title, intro, three groups and nine rows with nav and footer", async () => {
    const { container } = render(await FaqRoute());

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Frequently asked questions",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/It is in build and not yet tried with vendors/),
    ).toBeInTheDocument();
    for (const name of [
      "How paying works",
      "Setting up",
      "Cost and your data",
    ]) {
      expect(
        screen.getByRole("heading", { level: 2, name }),
      ).toBeInTheDocument();
    }
    expect(container.querySelectorAll("details")).toHaveLength(9);
    expect(screen.getByTestId("nav")).toBeInTheDocument();
    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });

  it("uses the confirmed answer for how a payment is known and omits refunds", async () => {
    const { container } = render(await FaqRoute());

    expect(
      screen.getByText(
        /uploads a screenshot of the payment and marks the order as paid/,
      ),
    ).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/refund/i);
    expect(
      screen.queryByText(/Questions about your data/),
    ).not.toBeInTheDocument();
    expect(container.querySelector("hr")).toBeNull();
  });

  it("emits FAQPage JSON-LD for every row", async () => {
    const { container } = render(await FaqRoute());
    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );
    expect(script).not.toBeNull();
    const data = JSON.parse(script!.textContent ?? "{}");
    expect(data["@type"]).toBe("FAQPage");
    expect(data.mainEntity).toHaveLength(9);
  });

  it("opens a row by touch", async () => {
    const user = userEvent.setup();
    const { container } = render(await FaqRoute());
    const first = container.querySelector("details")!;
    expect(first.open).toBe(false);
    await user.pointer({
      keys: "[TouchA]",
      target: first.querySelector("summary")!,
    });
    expect(first.open).toBe(true);
  });
});

describe("FAQ copy guardrails", () => {
  const text = JSON.stringify(FAQ_GROUPS);

  it("has no em dash, dollar sign or exclamation mark", () => {
    expect(text).not.toMatch(/[\u2014$!]/);
  });

  it("never implies paykit is live and names no plans or prices", () => {
    expect(text).not.toMatch(/\b(live|now available|proven)\b/i);
    expect(text).not.toMatch(/\b(pro|free plan|starter|premium)\b/i);
  });
});
