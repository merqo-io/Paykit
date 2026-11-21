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
});
