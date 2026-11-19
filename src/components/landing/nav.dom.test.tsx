// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Nav, navAccount } from "./nav";

vi.mock("@/app/actions/auth", () => ({ signOutAction: vi.fn() }));
vi.mock("@/app/actions/feedback", () => ({ submitFeedbackAction: vi.fn() }));
vi.mock("@/app/actions/support", () => ({
  submitSupportMessageAction: vi.fn(),
}));

describe("Nav", () => {
  it("links to the FAQ page on every screen size", () => {
    render(<Nav />);
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute(
      "href",
      "/faq",
    );
  });

  it("shows Sign in / Join the waitlist, not a Dashboard link, when signed out", () => {
    render(<Nav />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(
      screen.getByRole("link", { name: "Join the waitlist" }),
    ).toHaveAttribute("href", "https://merqo.io/waitlist?kit=paykit");
    expect(
      screen.queryByRole("link", { name: "Dashboard" }),
    ).not.toBeInTheDocument();
  });

  it("shows a Dashboard link, not Sign in / Join the waitlist, when authed", () => {
    render(<Nav authed />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(
      screen.queryByRole("link", { name: "Sign in" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Join the waitlist" }),
    ).not.toBeInTheDocument();
  });

  it("links to the About page", () => {
    render(<Nav />);
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute(
      "href",
      "/about",
    );
  });

  it("updates account links when the signed-in state changes", () => {
    const { rerender } = render(<Nav authed={false} />);
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    rerender(<Nav authed />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(
      screen.queryByRole("link", { name: "Sign in" }),
    ).not.toBeInTheDocument();
  });
});

describe("Nav account menu", () => {
  it("opens an account menu with Sign out by touch when authed", async () => {
    const user = userEvent.setup();
    render(<Nav authed account={{ name: "Ana's Stall" }} />);
    const trigger = screen.getByRole("button", { name: /account|ana/i });
    await user.pointer({ keys: "[TouchA]", target: trigger });
    expect(
      await screen.findByRole("menuitem", { name: /sign out/i }),
    ).toBeInTheDocument();
  });

  it("has no account menu when signed out", () => {
    render(<Nav />);
    expect(screen.queryByRole("button", { name: /account/i })).toBeNull();
  });
});

describe("navAccount", () => {
  it("prefers the full name and reads the avatar from metadata", () => {
    expect(
      navAccount({
        email: "a@b.co",
        user_metadata: { full_name: "Ana", avatar_url: "https://x/a.png" },
      }),
    ).toEqual({ name: "Ana", avatarUrl: "https://x/a.png" });
  });

  it("falls back to the email, then a generic label", () => {
    expect(navAccount({ email: "a@b.co" })).toEqual({
      name: "a@b.co",
      avatarUrl: undefined,
    });
    expect(navAccount({ user_metadata: { avatar_url: 3 } }).name).toBe(
      "Account",
    );
  });
});
