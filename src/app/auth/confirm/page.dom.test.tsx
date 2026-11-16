// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { createServerClientMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: createServerClientMock,
}));

import AuthConfirmPage, { metadata } from "./page";

async function renderPage(
  query: Record<string, string | string[] | undefined>,
) {
  render(await AuthConfirmPage({ searchParams: Promise.resolve(query) }));
}

describe("auth confirm page", () => {
  it("renders the continue form for a valid link without calling Supabase", async () => {
    await renderPage({ token_hash: "abc", type: "recovery" });

    expect(
      screen.getByRole("button", { name: "Continue" }),
    ).toBeInTheDocument();
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { token_hash: "abc" },
    { token_hash: "abc", type: "nope" },
    { token_hash: ["a", "b"], type: "signup" },
  ])("renders the invalid state for %j", async (query) => {
    await renderPage(query);

    expect(
      screen.getByText("This link is invalid or has expired."),
    ).toBeInTheDocument();
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it("is noindex and sends no referrer", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.referrer).toBe("no-referrer");
  });
});
