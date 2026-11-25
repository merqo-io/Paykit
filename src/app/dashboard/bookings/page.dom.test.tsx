// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import BookingsPage from "./page";
import type { Booking, Inquiry } from "@/lib/types";

const {
  getVendorSessionMock,
  searchBookingsMock,
  listOpenInquiriesMock,
  getInquiryFormMock,
  redirectMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  getVendorSessionMock: vi.fn(),
  searchBookingsMock: vi.fn(),
  listOpenInquiriesMock: vi.fn(),
  getInquiryFormMock: vi.fn(),
}));

vi.mock("@/lib/vendor-session", () => ({
  getVendorSession: getVendorSessionMock,
}));
vi.mock("@/lib/bookings", () => ({ searchBookings: searchBookingsMock }));
vi.mock("@/lib/inquiry-inbox", () => ({
  listOpenInquiries: listOpenInquiriesMock,
  getInquiryForm: getInquiryFormMock,
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("./inquiry-actions", () => ({ saveInquiryFormAction: vi.fn() }));

const PAGE_PROPS = { searchParams: Promise.resolve({}) };

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
  searchBookingsMock
    .mockReset()
    .mockResolvedValue({ ok: true, rows: [], total: 0 });
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
  it("passes its own path and query to the vendor gate as returnTo", async () => {
    render(
      await BookingsPage({
        searchParams: Promise.resolve({ q: "ah hock", page: "1" }),
      }),
    );
    expect(getVendorSessionMock).toHaveBeenCalledWith(
      "/dashboard/bookings?q=ah+hock&page=1",
    );
  });

  it("lists open inquiries with an Inquiry badge and a set-up button", async () => {
    searchBookingsMock.mockResolvedValue({ ok: true, rows: [], total: 0 });
    listOpenInquiriesMock.mockResolvedValue([INQUIRY]);
    render(await BookingsPage(PAGE_PROPS));
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
    searchBookingsMock.mockResolvedValue({ ok: true, rows: [], total: 0 });
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
    render(await BookingsPage(PAGE_PROPS));
    expect(
      screen.getByRole("button", { name: /copy inquiry link/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Inquiry form" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No open inquiries.")).toBeInTheDocument();
  });

  it("shows the empty state with no bookings", async () => {
    searchBookingsMock.mockResolvedValue({ ok: true, rows: [], total: 0 });
    const jsx = await BookingsPage(PAGE_PROPS);
    render(jsx);
    expect(
      screen.getByRole("heading", { name: "Bookings" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/no bookings yet/i)).toBeInTheDocument();
  });

  it("renders the vendor's bookings and a New booking trigger", async () => {
    searchBookingsMock.mockResolvedValue({
      ok: true,
      rows: [BOOKING],
      total: 1,
    });
    const jsx = await BookingsPage(PAGE_PROPS);
    render(jsx);
    expect(screen.getByText("Jane Tan")).toBeInTheDocument();
    expect(searchBookingsMock).toHaveBeenCalledWith(
      "v1",
      expect.objectContaining({ page: 1 }),
    );
    expect(
      screen.getByRole("button", { name: "New booking" }),
    ).toBeInTheDocument();
  });

  it("passes parsed search and status to the query and prefills the filters", async () => {
    searchBookingsMock.mockResolvedValue({
      ok: true,
      rows: [BOOKING],
      total: 25,
    });
    render(
      await BookingsPage({
        searchParams: Promise.resolve({
          q: " Jane ",
          status: "deposit_paid",
          page: "2",
        }),
      }),
    );
    expect(searchBookingsMock).toHaveBeenCalledWith("v1", {
      q: "Jane",
      status: "deposit_paid",
      page: 2,
      pageSize: 20,
    });
    expect(screen.getByLabelText("Search")).toHaveValue("Jane");
    expect(screen.getByLabelText("Status")).toHaveValue("deposit_paid");
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      "/dashboard/bookings",
    );
  });

  it("shows No bookings match with a clear link when filters find nothing", async () => {
    render(await BookingsPage({ searchParams: Promise.resolve({ q: "zzz" }) }));
    expect(screen.getByText("No bookings match")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Clear filters" }).length,
    ).toBeGreaterThan(0);
  });

  it("shows counts for inquiries and bookings and pages the list", async () => {
    searchBookingsMock.mockResolvedValue({
      ok: true,
      rows: [BOOKING],
      total: 45,
    });
    listOpenInquiriesMock.mockResolvedValue([INQUIRY]);
    render(
      await BookingsPage({
        searchParams: Promise.resolve({ status: "cancelled", page: "2" }),
      }),
    );
    expect(
      screen.getByRole("heading", { name: /Inquiries.*\(1\)/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Your bookings.*\(45\)/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/dashboard/bookings?status=cancelled",
    );
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/dashboard/bookings?status=cancelled&page=3",
    );
  });

  it("redirects a page past the end to the last valid page", async () => {
    searchBookingsMock.mockResolvedValue({ ok: true, rows: [], total: 45 });
    await expect(
      BookingsPage({
        searchParams: Promise.resolve({ status: "cancelled", page: "9" }),
      }),
    ).rejects.toThrow("REDIRECT:/dashboard/bookings?status=cancelled&page=3");
  });

  it("redirects to the unpaged list when nothing matches past page 1", async () => {
    await expect(
      BookingsPage({ searchParams: Promise.resolve({ page: "4" }) }),
    ).rejects.toThrow("REDIRECT:/dashboard/bookings");
  });

  it("shows an error with a retry link, not the empty state, when the query fails", async () => {
    searchBookingsMock.mockResolvedValue({ ok: false });
    render(
      await BookingsPage({ searchParams: Promise.resolve({ q: "jane" }) }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn’t load bookings",
    );
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/dashboard/bookings?q=jane",
    );
    expect(screen.queryByText(/no bookings yet/i)).toBeNull();
    expect(screen.queryByRole("navigation", { name: /pages/i })).toBeNull();
  });
});
