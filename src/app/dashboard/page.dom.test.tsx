// @vitest-environment jsdom
//
// DashboardPage is an async Server Component, same pattern as
// layout.dom.test.tsx: await it directly and render the returned element
// tree with RTL. Covers the empty-state prompt, the payment-method summary
// card, the transaction count, and the onboarding checklist's visibility.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardPage from "./page";
import type { VendorPaymentConfig } from "@/lib/types";

const {
  getConfigMock,
  claimedTxSummaryMock,
  confirmedSinceMock,
  maybeSingleMock,
  confirmedRowsMock,
  queryTransactionsMock,
  readVendorPlanMock,
} = vi.hoisted(() => ({
  getConfigMock: vi.fn(),
  claimedTxSummaryMock: vi.fn(),
  confirmedSinceMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  confirmedRowsMock: vi.fn(),
  queryTransactionsMock: vi.fn(),
  readVendorPlanMock: vi.fn(),
}));
vi.mock("@/lib/vendor-entitlement", () => ({
  readVendorPlan: readVendorPlanMock,
}));

vi.mock("@/lib/vendor-session", () => ({
  getVendorSession: vi.fn(async () => ({
    supabase: {
      from: (table: string) => ({
        select: () => ({
          eq: () =>
            table === "vendor_prefs"
              ? { maybeSingle: maybeSingleMock }
              : { eq: () => ({ limit: confirmedRowsMock }) },
        }),
      }),
    },
    user: { id: "v1" },
  })),
}));
vi.mock("./onboarding-actions", () => ({
  dismissOnboarding: vi.fn(async () => {}),
}));
vi.mock("./config/actions", () => ({
  getConfig: getConfigMock,
}));
vi.mock("@/lib/transactions", () => ({
  claimedTxSummary: claimedTxSummaryMock,
  confirmedSince: confirmedSinceMock,
  queryTransactions: queryTransactionsMock,
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
  readVendorPlanMock.mockResolvedValue("pro");
  maybeSingleMock.mockResolvedValue({
    data: { tour_seen_at: "2026-01-01T00:00:00Z" },
  });
  confirmedRowsMock.mockResolvedValue({ data: [] });
  getConfigMock.mockResolvedValue(PAYNOW_CONFIG);
  claimedTxSummaryMock.mockResolvedValue({ count: 0, cents: 0 });
  confirmedSinceMock.mockResolvedValue({ count: 0, cents: 0 });
  queryTransactionsMock.mockResolvedValue({
    rows: [],
    total: 0,
    failed: false,
  });
});

describe("DashboardPage", () => {
  it("shows only the setup prompt, with one action, when the vendor has no payment config yet", async () => {
    getConfigMock.mockResolvedValue(null);

    render(await DashboardPage());

    expect(
      screen.getByRole("link", { name: "Set up payments" }),
    ).toHaveAttribute("href", "/dashboard/config");
    expect(screen.queryByText("Confirmed this month")).not.toBeInTheDocument();
  });

  it("hides the setup prompt once a config exists", async () => {
    confirmedSinceMock.mockResolvedValue({ count: 10, cents: 0 });

    render(await DashboardPage());

    expect(
      screen.queryByRole("link", { name: "Set up payments" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("10 confirmed payments")).toBeInTheDocument();
  });

  it("starts the month at midnight Singapore time, by confirmation time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-02T03:00:00Z"));
    try {
      render(await DashboardPage());
    } finally {
      vi.useRealTimers();
    }

    expect(confirmedSinceMock).toHaveBeenCalledWith(
      "v1",
      "2026-10-31T16:00:00.000Z",
    );
  });

  it("titles the page Home, matching its nav label", async () => {
    getConfigMock.mockResolvedValue(null);
    const { unmount } = render(await DashboardPage());
    expect(
      screen.getByRole("heading", { level: 1, name: "Home" }),
    ).toBeInTheDocument();
    unmount();

    render(await DashboardPage());
    expect(
      screen.getByRole("heading", { level: 1, name: "Home" }),
    ).toBeInTheDocument();
  });

  it("has no eyebrow above the title", async () => {
    render(await DashboardPage());

    expect(screen.queryByText("Overview")).not.toBeInTheDocument();
  });

  it("shows this month's confirmed amount next to the count", async () => {
    confirmedSinceMock
      .mockResolvedValueOnce({ count: 1, cents: 123450 })
      .mockResolvedValueOnce({ count: 0, cents: 0 });

    render(await DashboardPage());

    expect(screen.getByText("S$1,234.50")).toBeInTheDocument();
    expect(screen.getByText("1 confirmed payment")).toBeInTheDocument();
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

    expect(screen.getByText("S$16.50")).toBeInTheDocument();
    expect(
      screen.getByText("2 payments marked paid by customers"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Review these payments" }),
    ).toHaveAttribute("href", "/dashboard/transactions?status=claimed");
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

  it("shows the Get set up card above the content for a new vendor", async () => {
    maybeSingleMock.mockResolvedValue({ data: null });

    render(await DashboardPage());

    expect(screen.getByText("Get set up")).toBeInTheDocument();
    expect(screen.getByText("1 of 3 done")).toBeInTheDocument();
    expect(screen.getByText("Payment method")).toBeInTheDocument();
  });

  it("counts the stored preview stamp and a confirmed payment", async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        tour_seen_at: null,
        onboarding_dismissed_at: null,
        qr_previewed_at: "2026-01-01T00:00:00Z",
      },
    });
    confirmedRowsMock.mockResolvedValue({ data: [{ id: "t1" }] });

    render(await DashboardPage());

    expect(screen.getByText("You're set up")).toBeInTheDocument();
  });

  it("hides the card once dismissed", async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        tour_seen_at: null,
        onboarding_dismissed_at: "2026-01-01T00:00:00Z",
        qr_previewed_at: null,
      },
    });

    render(await DashboardPage());

    expect(screen.queryByText("Get set up")).not.toBeInTheDocument();
  });

  it("hides the card for an existing vendor whose payment setup is done", async () => {
    render(await DashboardPage());

    expect(screen.queryByText("Get set up")).not.toBeInTheDocument();
  });

  it("shows an existing vendor the card when payment setup is missing", async () => {
    getConfigMock.mockResolvedValue(null);

    render(await DashboardPage());

    expect(screen.getByText("Get set up")).toBeInTheDocument();
  });

  it("starts today at midnight Singapore time for the Confirmed today card", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-02T20:00:00Z"));
    try {
      render(await DashboardPage());
    } finally {
      vi.useRealTimers();
    }

    expect(confirmedSinceMock).toHaveBeenCalledWith(
      "v1",
      "2026-11-02T16:00:00.000Z",
    );
    expect(screen.getByText("Confirmed today")).toBeInTheDocument();
  });

  it("lists recent payments linking to the ledger, with a View all link", async () => {
    queryTransactionsMock.mockResolvedValue({
      rows: [
        {
          id: "t1",
          kit_slug: "qkit",
          order_ref: "ORD-1",
          amount_cents: 1250,
          status: "confirmed",
          created_at: "2026-11-27T02:00:00Z",
        },
      ],
      total: 1,
      failed: false,
    });

    render(await DashboardPage());

    expect(queryTransactionsMock).toHaveBeenCalledWith("v1", {
      page: 1,
      pageSize: 5,
    });
    expect(
      screen.getByRole("heading", { name: "Recent payments" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /12\.50/ })).toHaveAttribute(
      "href",
      "/dashboard/transactions?q=ORD-1",
    );
    expect(
      screen.getByRole("link", { name: "View all payments" }),
    ).toHaveAttribute("href", "/dashboard/transactions");
  });

  it("links Free-plan rows to the plain ledger, since search is paid-only", async () => {
    readVendorPlanMock.mockResolvedValue("free");
    queryTransactionsMock.mockResolvedValue({
      rows: [
        {
          id: "t1",
          kit_slug: "qkit",
          order_ref: "ORD-1",
          amount_cents: 1250,
          status: "confirmed",
          created_at: "2026-11-27T02:00:00Z",
        },
      ],
      total: 1,
      failed: false,
    });

    render(await DashboardPage());

    expect(screen.getByRole("link", { name: /12[.]50/ })).toHaveAttribute(
      "href",
      "/dashboard/transactions",
    );
  });

  it("shows a quiet empty line when there are no payments yet", async () => {
    render(await DashboardPage());

    expect(screen.getByText("No payments yet.")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "View all payments" }),
    ).not.toBeInTheDocument();
  });
});
