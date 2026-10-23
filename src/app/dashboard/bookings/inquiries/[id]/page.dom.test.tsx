// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Inquiry } from "@/lib/types";

const { getVendorSessionMock, getInquiryMock, notFoundMock } = vi.hoisted(
  () => ({
    getVendorSessionMock: vi.fn(),
    getInquiryMock: vi.fn(),
    notFoundMock: vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
    }),
  }),
);

vi.mock("@/lib/vendor-session", () => ({
  getVendorSession: getVendorSessionMock,
}));
vi.mock("@/lib/inquiry-inbox", () => ({ getInquiry: getInquiryMock }));
vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("../../inquiry-actions", () => ({
  setInquiryStatusAction: vi.fn(),
  deleteInquiryAction: vi.fn(),
}));
vi.mock("../../actions", () => ({ createBookingAction: vi.fn() }));

import InquiryDetailPage from "./page";

const INQUIRY: Inquiry = {
  id: "i1",
  vendor_id: "v1",
  customer_name: "Ah Hock",
  customer_phone: "9123 4567",
  event_date: "2026-12-12",
  message: "Birthday party\n40 guests",
  status: "new",
  terms_url: null,
  terms_version: null,
  terms_accepted_at: null,
  booking_id: null,
  created_at: "2026-10-24T01:00:00Z",
  updated_at: "2026-10-24T01:00:00Z",
};

async function renderPage(inquiry: Inquiry | null) {
  getInquiryMock.mockResolvedValue(inquiry);
  render(await InquiryDetailPage({ params: Promise.resolve({ id: "i1" }) }));
}

beforeEach(() => {
  getVendorSessionMock.mockResolvedValue({ supabase: {}, user: { id: "v1" } });
  getInquiryMock.mockReset();
});

describe("InquiryDetailPage", () => {
  it("404s for an inquiry that is not this vendor's", async () => {
    await expect(renderPage(null)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("shows the client, contact links, message and actions", async () => {
    await renderPage(INQUIRY);
    expect(
      screen.getByRole("heading", { name: "Ah Hock" }),
    ).toBeInTheDocument();
    expect(getInquiryMock).toHaveBeenCalledWith("v1", "i1");
    expect(screen.getByRole("link", { name: "9123 4567" })).toHaveAttribute(
      "href",
      "tel:91234567",
    );
    expect(screen.getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
      "href",
      "https://wa.me/6591234567",
    );
    expect(screen.getByText(/40 guests/)).toBeInTheDocument();
    expect(screen.getByText("Not asked")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Convert to booking" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mark contacted" }),
    ).toBeInTheDocument();
  });

  it("links to the booking once converted", async () => {
    await renderPage({ ...INQUIRY, status: "converted", booking_id: "b1" });
    expect(
      screen.getByRole("link", { name: "Open the booking" }),
    ).toHaveAttribute("href", "/dashboard/bookings/b1");
    expect(
      screen.queryByRole("button", { name: "Convert to booking" }),
    ).toBeNull();
  });

  it("shows Not given for a missing event date", async () => {
    await renderPage({ ...INQUIRY, event_date: null });
    expect(screen.getByText("Not given")).toBeInTheDocument();
  });
});
