// @vitest-environment jsdom
//
// DashboardPage is an async Server Component, same pattern as
// layout.dom.test.tsx: await it directly and render the returned element
// tree with RTL. Covers the empty-state prompt, the payment-method summary
// card, the transaction count, and the durable tour-seen stamp (see page.tsx's own comment, and
// tour-actions.ts's stampTourSeen/markTourSeen) firing exactly when it
// should.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardPage from "./page";
import type { VendorPaymentConfig } from "@/lib/types";

const {
  getConfigMock,
  txCountThisMonthMock,
  claimedTxSummaryMock,
  confirmedCentsSinceMock,
  maybeSingleMock,
  stampTourSeenMock,
} = vi.hoisted(() => ({
  getConfigMock: vi.fn(),
  txCountThisMonthMock: vi.fn(),
  claimedTxSummaryMock: vi.fn(),
  confirmedCentsSinceMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  stampTourSeenMock: vi.fn(async () => {}),
}));

vi.mock("@/lib/vendor-session", () => ({
  getVendorSession: vi.fn(async () => ({
    supabase: {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: maybeSingleMock,
          }),
        }),
      }),
    },
    user: { id: "v1" },
  })),
}));
vi.mock("./config/actions", () => ({
  getConfig: getConfigMock,
}));
vi.mock("@/lib/transactions", () => ({
  txCountThisMonth: txCountThisMonthMock,
  claimedTxSummary: claimedTxSummaryMock,
  confirmedCentsSince: confirmedCentsSinceMock,
}));
vi.mock("@/lib/tour-prefs", () => ({
  stampTourSeen: stampTourSeenMock,
}));

const PAYNOW_CONFIG: VendorPaymentConfig = {
  vendor_id: "v1",
  kind: "paynow",
  uen: "53312345A",
  mobile: null,
  payee_name: "Kopitiam Cart",
  label: null,
  url: null,
  qr_image_url: null,
  verification_method: "manual",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const POINTER_CONFIG: VendorPaymentConfig = {
  ...PAYNOW_CONFIG,
  kind: "pointer",
  uen: null,
  payee_name: null,
  label: "Pay with PayLah",
  url: "https://example.com/pay",
};

beforeEach(() => {
  vi.clearAllMocks();
  maybeSingleMock.mockResolvedValue({
    data: { tour_seen_at: "2026-01-01T00:00:00Z" },
  });
  getConfigMock.mockResolvedValue(PAYNOW_CONFIG);
  txCountThisMonthMock.mockResolvedValue(0);
  claimedTxSummaryMock.mockResolvedValue({ count: 0, cents: 0 });
  confirmedCentsSinceMock.mockResolvedValue(0);
});

describe("DashboardPage", () => {
  it("shows only the setup prompt, with one action, when the vendor has no payment config yet", async () => {
    getConfigMock.mockResolvedValue(null);

    render(await DashboardPage());

    expect(
      screen.getByRole("link", { name: "Set up payments" }),
    ).toHaveAttribute("href", "/dashboard/config");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByText("Confirmed this month")).not.toBeInTheDocument();
  });

  it("hides the setup prompt once a config exists", async () => {
    txCountThisMonthMock.mockResolvedValue(10);

    render(await DashboardPage());

    expect(
      screen.queryByRole("link", { name: "Set up payments" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("10 payments this month")).toBeInTheDocument();
  });

  it("has no eyebrow above the title", async () => {
    render(await DashboardPage());

    expect(screen.queryByText("Overview")).not.toBeInTheDocument();
  });

  it("shows this month's confirmed amount next to the count", async () => {
    txCountThisMonthMock.mockResolvedValue(1);
    confirmedCentsSinceMock.mockResolvedValue(123450);

    render(await DashboardPage());

    expect(screen.getByText("$1,234.50")).toBeInTheDocument();
    expect(screen.getByText("1 payment this month")).toBeInTheDocument();
  });

  it("shows a masked PayNow summary with an edit link into config", async () => {
    const jsx = await DashboardPage();
    render(jsx);

    expect(screen.getByText("Payment method")).toBeInTheDocument();
    expect(screen.getByText("PayNow QR · 53••••5A")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Edit payment setup" }),
    ).toHaveAttribute("href", "/dashboard/config");
  });

  it("shows the pointer label (unmasked) for a BYO payment link/QR config", async () => {
    getConfigMock.mockResolvedValue(POINTER_CONFIG);

    const jsx = await DashboardPage();
    render(jsx);

    expect(
      screen.getByText("Payment link or QR image · Pay with PayLah"),
    ).toBeInTheDocument();
  });

  it("shows the amount waiting to be confirmed with a link to those payments", async () => {
    claimedTxSummaryMock.mockResolvedValue({ count: 2, cents: 1650 });

    render(await DashboardPage());

    expect(screen.getByText("$16.50")).toBeInTheDocument();
    expect(
      screen.getByText("2 payments marked paid by customers"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Review these payments" }),
    ).toHaveAttribute("href", "/dashboard/transactions");
  });

  it("uses the singular for one waiting payment", async () => {
    claimedTxSummaryMock.mockResolvedValue({ count: 1, cents: 450 });

    render(await DashboardPage());

    expect(
      screen.getByText("1 payment marked paid by customers"),
    ).toBeInTheDocument();
  });

  it("says nothing is waiting when there is nothing to confirm", async () => {
    render(await DashboardPage());

    expect(
      screen.getByText("Nothing to confirm right now."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View payments" })).toHaveAttribute(
      "href",
      "/dashboard/transactions",
    );
  });

  it("stamps tour_seen_at durably when the vendor hasn't seen the tour yet", async () => {
    maybeSingleMock.mockResolvedValue({ data: { tour_seen_at: null } });

    const jsx = await DashboardPage();
    render(jsx);

    expect(stampTourSeenMock).toHaveBeenCalledWith(expect.anything(), "v1");
  });

  it("stamps tour_seen_at when no vendor_prefs row exists yet", async () => {
    maybeSingleMock.mockResolvedValue({ data: null });

    const jsx = await DashboardPage();
    render(jsx);

    expect(stampTourSeenMock).toHaveBeenCalledWith(expect.anything(), "v1");
  });

  it("does not re-stamp once the tour has already been seen", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { tour_seen_at: "2026-01-01T00:00:00Z" },
    });

    const jsx = await DashboardPage();
    render(jsx);

    expect(stampTourSeenMock).not.toHaveBeenCalled();
  });
});
