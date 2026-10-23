// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import BookingsPage from "./page";
import type { Booking, Inquiry } from "@/lib/types";

const {
  getVendorSessionMock,
  listBookingsMock,
  listOpenInquiriesMock,
  getInquiryFormMock,
} = vi.hoisted(() => ({
  getVendorSessionMock: vi.fn(),
  listBookingsMock: vi.fn(),
  listOpenInquiriesMock: vi.fn(),
  getInquiryFormMock: vi.fn(),
}));

vi.mock("@/lib/vendor-session", () => ({
  getVendorSession: getVendorSessionMock,
}));
vi.mock("@/lib/bookings", () => ({ listBookings: listBookingsMock }));
vi.mock("@/lib/inquiry-inbox", () => ({
  listOpenInquiries: listOpenInquiriesMock,
  getInquiryForm: getInquiryFormMock,
}));
vi.mock("./inquiry-actions", () => ({ saveInquiryFormAction: vi.fn() }));

const BOOKING: Booking = {
  id: "b1",
  vendor_id: "v1",
  customer_name: "Jane Tan",
  customer_phone: null,
  event_date: "2026-12-01",
  total_amount_cents: 100000,
  deposit_amount_cents: 30000,
  balance_amount_cents: 70000,
  balance_due_date: "2026-11-24",
  status: "pending_deposit",
  deposit_transaction_id: "tx-deposit",
  balance_transaction_id: null,
  created_at: "2026-08-20T00:00:00Z",
  updated_at: "2026-08-20T00:00:00Z",
};

beforeEach(() => {
  getVendorSessionMock
    .mockReset()
    .mockResolvedValue({ supabase: {}, user: { id: "v1" } });
  listBookingsMock.mockReset();
  listOpenInquiriesMock.mockReset().mockResolvedValue([]);
  getInquiryFormMock.mockReset().mockResolvedValue(null);
});

const INQUIRY: Inquiry = {
  id: "i1",
  vendor_id: "v1",
  customer_name: "Ah Hock",
  customer_phone: "91234567",
  event_date: null,
  message: "Birthday",
  status: "new",
  terms_url: null,
  terms_version: null,
  terms_accepted_at: null,
  booking_id: null,
  created_at: "2026-10-24T01:00:00Z",
  updated_at: "2026-10-24T01:00:00Z",
};

describe("BookingsPage", () => {
  it("lists open inquiries with an Inquiry badge and a set-up button", async () => {
    listBookingsMock.mockResolvedValue([]);
    listOpenInquiriesMock.mockResolvedValue([INQUIRY]);
    render(await BookingsPage());
    expect(screen.getByRole("link", { name: "Ah Hock" })).toHaveAttribute(
      "href",
      "/dashboard/bookings/inquiries/i1",
    );
    expect(screen.getByText("Inquiry")).toBeInTheDocument();
    expect(screen.getByText("Not given")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Set up inquiry form" }),
    ).toBeInTheDocument();
    expect(listOpenInquiriesMock).toHaveBeenCalledWith("v1");
  });

  it("shows the copy-link button once the form is on", async () => {
    listBookingsMock.mockResolvedValue([]);
    getInquiryFormMock.mockResolvedValue({
      vendor_id: "v1",
      public_id: "0123456789abcdef",
      business_name: "Kopi Cart Co",
      enabled: true,
      terms_url: null,
      terms_version: null,
      created_at: "",
      updated_at: "",
    });
    render(await BookingsPage());
    expect(
      screen.getByRole("button", { name: /copy inquiry link/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Inquiry form" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No open inquiries.")).toBeInTheDocument();
  });

  it("shows the empty state with no bookings", async () => {
    listBookingsMock.mockResolvedValue([]);
    const jsx = await BookingsPage();
    render(jsx);
    expect(
      screen.getByRole("heading", { name: "Bookings" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/no bookings yet/i)).toBeInTheDocument();
  });

  it("renders the vendor's bookings and a New booking trigger", async () => {
    listBookingsMock.mockResolvedValue([BOOKING]);
    const jsx = await BookingsPage();
    render(jsx);
    expect(screen.getByText("Jane Tan")).toBeInTheDocument();
    expect(listBookingsMock).toHaveBeenCalledWith("v1");
    expect(
      screen.getByRole("button", { name: "New booking" }),
    ).toBeInTheDocument();
  });
});
