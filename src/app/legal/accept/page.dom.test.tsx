// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LegalAcceptPage from "./page";

vi.mock("./actions", () => ({ acceptLegalTerms: vi.fn() }));

describe("LegalAcceptPage", () => {
  it("renders the interstitial with a hidden safe-redirect next value", async () => {
    render(
      await LegalAcceptPage({
        searchParams: Promise.resolve({ next: "/admin" }),
      }),
    );
    expect(screen.getByText("Our terms have changed")).toBeInTheDocument();
    const nextField = document.querySelector('input[name="next"]');
    expect(nextField).toHaveValue("/admin");
  });

  it("falls back to /dashboard for an unsafe next value", async () => {
    render(
      await LegalAcceptPage({
        searchParams: Promise.resolve({ next: "https://evil.example" }),
      }),
    );
    const nextField = document.querySelector('input[name="next"]');
    expect(nextField).toHaveValue("/dashboard");
  });

  it("keeps submit disabled until the terms box is ticked", async () => {
    render(await LegalAcceptPage({ searchParams: Promise.resolve({}) }));
    const submit = screen.getByRole("button", { name: "Continue" });
    expect(submit).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox"));
    expect(submit).toBeEnabled();
  });

  it("says the check failed, not that terms changed, on reason=unavailable", async () => {
    render(
      await LegalAcceptPage({
        searchParams: Promise.resolve({
          reason: "unavailable",
          next: "/dashboard/transactions",
        }),
      }),
    );
    expect(
      screen.getByText("We couldn't check the terms right now"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Our terms have changed")).toBeNull();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/dashboard/transactions",
    );
  });

  it("points the retry link at a safe path when next is an open redirect", async () => {
    render(
      await LegalAcceptPage({
        searchParams: Promise.resolve({
          reason: "unavailable",
          next: "//evil.example",
        }),
      }),
    );
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });

  it("falls back to the terms-changed copy for an unknown reason", async () => {
    render(
      await LegalAcceptPage({
        searchParams: Promise.resolve({ reason: "bogus" }),
      }),
    );
    expect(screen.getByText("Our terms have changed")).toBeInTheDocument();
  });
});
