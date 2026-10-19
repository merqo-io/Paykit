// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AboutPage from "./page";

const { createServerClientMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: createServerClientMock,
}));

vi.mock("@/components/landing/nav", () => ({ Nav: () => <div /> }));
vi.mock("@/components/site-footer", () => ({ SiteFooter: () => <div /> }));

beforeEach(() => {
  createServerClientMock.mockReset().mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
  });
});

describe("AboutPage", () => {
  it("renders the shared origin story and a link back to paykit", async () => {
    const jsx = await AboutPage();
    render(jsx);

    expect(screen.getByText("Why Merqo")).toBeInTheDocument();
    expect(
      screen.getByText(/wedding, in the queue for a coffee cart/),
    ).toBeInTheDocument();
    expect(screen.getByText(/reading this on paykit/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "See how paykit works" }),
    ).toHaveAttribute("href", "/#how");
  });
});
