// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { loadMock, notFoundMock } = vi.hoisted(() => ({
  loadMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: async () => ({}),
}));
vi.mock("@/lib/inquiries", () => ({
  loadPublicForm: loadMock,
  formRenderedAt: () => 1_700_000_000_000,
}));
vi.mock("next/navigation", () => ({ notFound: notFoundMock }));
vi.mock("./actions", () => ({ submitInquiryAction: vi.fn() }));

import InquirePage, { metadata } from "./page";

const params = Promise.resolve({ publicId: "0123456789abcdef" });

beforeEach(() => loadMock.mockReset());

describe("InquirePage", () => {
  it("is kept out of search results", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("404s for an unknown or disabled form", async () => {
    loadMock.mockResolvedValue(null);
    await expect(InquirePage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders the vendor's form with their terms", async () => {
    loadMock.mockResolvedValue({
      vendor_id: "v1",
      business_name: "Kopi Cart Co",
      terms_url: "https://example.com/t",
      terms_version: "v1",
    });
    render(await InquirePage({ params }));
    expect(
      screen.getByRole("heading", { name: "Kopi Cart Co" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });
});
