// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteFooter } from "./site-footer";

describe("SiteFooter", () => {
  it("renders the wordmark, tagline, copyright line, and sign-in link matching qkit's single-row layout", () => {
    render(<SiteFooter showSignIn />);

    expect(screen.getByRole("link", { name: "paykit home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.getByText("The Merqo family's shared vendor payment engine."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`© ${new Date().getFullYear()} paykit · a Merqo kit`),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Vendor sign in →" }),
    ).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute(
      "href",
      "/legal/terms",
    );
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute(
      "href",
      "/legal/privacy",
    );
  });

  it("links to the About page", () => {
    render(<SiteFooter showSignIn />);
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute(
      "href",
      "/about",
    );
  });
});

describe("SiteFooter in the dashboard", () => {
  it("leaves the sign-in link off by default", () => {
    render(<SiteFooter />);
    expect(
      screen.queryByRole("link", { name: "Vendor sign in →" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "About" })).toBeInTheDocument();
  });
});
