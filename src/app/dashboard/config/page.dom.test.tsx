// @vitest-environment jsdom
//
// ConfigPage is an async Server Component, same pattern as
// layout.dom.test.tsx: await it directly and render the returned element
// tree with RTL. `PaymentConfigForm` has its own full DOM coverage
// (payment-config-form.dom.test.tsx), so it's stubbed here to keep this
// test focused on ConfigPage's own job: fetching the vendor + config and
// wiring them into props.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ConfigPage from "./page";
import type { VendorPaymentConfig } from "@/lib/types";

const { getVendorSessionMock, getConfigMock, PaymentConfigFormMock } =
  vi.hoisted(() => ({
    getVendorSessionMock: vi.fn(),
    getConfigMock: vi.fn(),
    PaymentConfigFormMock: vi.fn(() => (
      <div data-testid="payment-config-form" />
    )),
  }));

vi.mock("@/lib/vendor-session", () => ({
  getVendorSession: getVendorSessionMock,
}));
vi.mock("./actions", () => ({ getConfig: getConfigMock }));
vi.mock("./payment-config-form", () => ({
  PaymentConfigForm: PaymentConfigFormMock,
}));

beforeEach(() => {
  getVendorSessionMock.mockReset().mockResolvedValue({
    supabase: {},
    user: { id: "v1" },
  });
  getConfigMock.mockReset();
  PaymentConfigFormMock.mockClear();
});

describe("ConfigPage", () => {
  it("renders the setup heading and passes vendorId + null initial config through", async () => {
    getConfigMock.mockResolvedValue(null);

    const jsx = await ConfigPage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(
      screen.getByRole("heading", { name: "Payment setup" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("payment-config-form")).toBeInTheDocument();
    expect(PaymentConfigFormMock).toHaveBeenCalledWith(
      expect.objectContaining({ vendorId: "v1", initial: null }),
      undefined,
    );
  });

  it("passes an existing config through to the form unchanged", async () => {
    const config: VendorPaymentConfig = {
      vendor_id: "v1",
      kind: "paynow",
      uen: "53312345A",
      mobile: null,
      payee_name: "Kopitiam Cart",
      label: null,
      url: null,
      qr_image_url: null,
      verification_method: "manual",
      plan: "free",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    getConfigMock.mockResolvedValue(config);

    const jsx = await ConfigPage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(PaymentConfigFormMock).toHaveBeenCalledWith(
      expect.objectContaining({ vendorId: "v1", initial: config }),
      undefined,
    );
  });

  it.each([
    [
      "a family address",
      "https://qkit.merqo.io/dashboard/booths/b1",
      "https://qkit.merqo.io/dashboard/booths/b1",
    ],
    ["an address outside the family", "https://evil.example/x", null],
    [
      "a repeated address",
      ["https://qkit.merqo.io/a", "https://qkit.merqo.io/b"],
      null,
    ],
    ["no address", undefined, null],
  ])("passes %s to the form as the way back", async (_, raw, expected) => {
    getConfigMock.mockResolvedValue(null);

    render(
      await ConfigPage({ searchParams: Promise.resolve({ return_to: raw }) }),
    );

    expect(PaymentConfigFormMock).toHaveBeenCalledWith(
      expect.objectContaining({ returnTo: expected }),
      undefined,
    );
  });
});
