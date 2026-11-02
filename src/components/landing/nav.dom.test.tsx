// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Nav } from "./nav";

describe("Nav", () => {
  it("shows an FAQ link jumping to the #faq section", () => {
    render(<Nav />);
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute(
      "href",
      "#faq",
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
