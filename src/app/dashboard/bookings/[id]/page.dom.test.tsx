// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Booking, Transaction } from "@/lib/types";

const {
  getVendorSessionMock,
  getBookingMock,
  getTransactionMock,
  notFoundMock,
  getInquiryForBookingMock,
} = vi.hoisted(() => ({
  getInquiryForBookingMock: vi.fn(),
  getVendorSessionMock: vi.fn(),
  getBookingMock: vi.fn(),
  getTransactionMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/lib/vendor-session", () => ({
  getVendorSession: getVendorSessionMock,
}));
vi.mock("@/lib/bookings", () => ({ getBooking: getBookingMock }));
vi.mock("@/lib/transactions", () => ({ getTransaction: getTransactionMock }));
vi.mock("next/navigation", () => ({ notFound: notFoundMock }));
vi.mock("@/lib/inquiry-inbox", () => ({
  getInquiryForBooking: getInquiryForBookingMock,
}));

import BookingDetailPage from "./page";

const BOOKING: Booking = {
  id: "b1",
  vendor_id: "v1",
  customer_name: "Jane Tan",
  customer_phone: "+6591234567",
  event_date: "2026-12-01",
  total_amount_cents: 100000,
  deposit_amount_cents: 30000,
  balance_amount_cents: 70000,
  balance_due_date: "2026-11-24",
  status: "deposit_paid",
  deposit_transaction_id: "tx-deposit",
  balance_transaction_id: null,
  created_at: "2026-08-20T00:00:00Z",
  updated_at: "2026-08-20T00:00:00Z",
};

const DEPOSIT_TX: Transaction = {
  id: "tx-deposit",
  vendor_id: "v1",
  kit_slug: "paykit",
  order_ref: "booking:b1:deposit",
  amount_cents: 30000,
  status: "confirmed",
  qr_payload: "0002...",
  checkout_kind: "qr",
  checkout_label: null,
  claimed_at: "2026-08-20T00:01:00Z",
  confirmed_at: "2026-08-20T00:02:00Z",
  created_at: "2026-08-20T00:00:00Z",
};

beforeEach(() => {
  getVendorSessionMock
    .mockReset()
    .mockResolvedValue({ supabase: {}, user: { id: "v1" } });
  getBookingMock.mockReset();
  getTransactionMock.mockReset().mockResolvedValue(null);
  notFoundMock.mockClear();
  getInquiryForBookingMock.mockReset().mockResolvedValue(null);
});

describe("BookingDetailPage", () => {
  it("shows the client's terms acceptance when it came from an inquiry", async () => {
    getBookingMock.mockResolvedValue(BOOKING);
    getInquiryForBookingMock.mockResolvedValue({
      terms_url: "https://example.com/terms.pdf",
      terms_version: "v2",
      terms_accepted_at: "2026-10-24T06:05:00Z",
    });
    render(await BookingDetailPage({ params: Promise.resolve({ id: "b1" }) }));
    expect(getInquiryForBookingMock).toHaveBeenCalledWith("v1", "b1");
    expect(screen.getByText("Booking terms")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "version v2" })).toHaveAttribute(
      "href",
      "https://example.com/terms.pdf",
    );
    expect(screen.getByText(/24 Oct 2026, 2:05/)).toBeInTheDocument();
  });

  it("shows no terms line for a booking made directly", async () => {
    getBookingMock.mockResolvedValue(BOOKING);
    render(await BookingDetailPage({ params: Promise.resolve({ id: "b1" }) }));
    expect(screen.queryByText("Booking terms")).toBeNull();
  });

  it("404s when the booking doesn't exist (or isn't this vendor's)", async () => {
    getBookingMock.mockResolvedValue(null);
    await expect(
      BookingDetailPage({ params: Promise.resolve({ id: "missing" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("renders the booking's details and its deposit transaction", async () => {
    getBookingMock.mockResolvedValue(BOOKING);
    getTransactionMock.mockImplementation(
      async (_vendorId: string, id: string) =>
        id === "tx-deposit" ? DEPOSIT_TX : null,
    );
    const jsx = await BookingDetailPage({
      params: Promise.resolve({ id: "b1" }),
    });
    const { container } = render(jsx);

    expect(
      screen.getByRole("heading", { name: "Jane Tan" }),
    ).toBeInTheDocument();
    // The deposit's qr_payload is rendered server-side by @merqo/ui's qrSvg
    // and embedded as markup; the balance transaction has none yet, so
    // exactly one QR should be present.
    expect(container.querySelectorAll("svg[shape-rendering]")).toHaveLength(1);
    expect(screen.getByText("Deposit paid")).toBeInTheDocument();
    expect(screen.getByText("confirmed")).toBeInTheDocument();
    expect(screen.getByText("Not yet created.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /print/i })).toBeInTheDocument();
    expect(screen.getByText("b1")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copy booking id/i }),
    ).toBeInTheDocument();
  });

  it("offers Create balance checkout once the deposit exists and balance doesn't yet", async () => {
    getBookingMock.mockResolvedValue(BOOKING);
    const jsx = await BookingDetailPage({
      params: Promise.resolve({ id: "b1" }),
    });
    render(jsx);
    expect(
      screen.getByRole("button", { name: /create balance checkout/i }),
    ).toBeInTheDocument();
  });

  it("hides Create balance checkout once the balance checkout already exists", async () => {
    getBookingMock.mockResolvedValue({
      ...BOOKING,
      balance_transaction_id: "tx-balance",
    });
    const jsx = await BookingDetailPage({
      params: Promise.resolve({ id: "b1" }),
    });
    render(jsx);
    expect(
      screen.queryByRole("button", { name: /create balance checkout/i }),
    ).not.toBeInTheDocument();
  });

  it("hides both actions once the booking is cancelled", async () => {
    getBookingMock.mockResolvedValue({ ...BOOKING, status: "cancelled" });
    const jsx = await BookingDetailPage({
      params: Promise.resolve({ id: "b1" }),
    });
    render(jsx);
    expect(
      screen.queryByRole("button", { name: /create balance checkout/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel booking" }),
    ).not.toBeInTheDocument();
  });

  it("keeps Print available even on a cancelled booking", async () => {
    getBookingMock.mockResolvedValue({ ...BOOKING, status: "cancelled" });
    const jsx = await BookingDetailPage({
      params: Promise.resolve({ id: "b1" }),
    });
    render(jsx);
    expect(screen.getByRole("button", { name: /print/i })).toBeInTheDocument();
  });
});

describe("immutable payment display", () => {
  it.each(["image", "link", null] as const)(
    "renders stored %s without encoding its URL as a QR",
    async (checkout_kind) => {
      getBookingMock.mockResolvedValue(BOOKING);
      getTransactionMock.mockResolvedValue({
        ...DEPOSIT_TX,
        checkout_kind,
        checkout_label: checkout_kind === "link" ? "Original provider" : null,
        qr_payload: "https://pay.example/original.png",
      });
      const { container } = render(
        await BookingDetailPage({ params: Promise.resolve({ id: "b1" }) }),
      );
      expect(container.querySelectorAll("svg[shape-rendering]")).toHaveLength(
        0,
      );
      if (checkout_kind === "image")
        expect(screen.getByAltText("Deposit payment QR code")).toHaveAttribute(
          "src",
          "https://pay.example/original.png",
        );
      else if (checkout_kind === "link")
        expect(
          screen.getByRole("link", { name: "Original provider" }),
        ).toHaveAttribute("href", "https://pay.example/original.png");
      else
        expect(
          screen.getByText(/Original payment display unavailable/),
        ).toBeInTheDocument();
    },
  );
});
