import { describe, it, expect } from "vitest";
import { renderCheckout, autoVerify } from "./adapter";
import type { VendorPaymentConfig } from "@/lib/types";

const BASE = {
  vendor_id: "11111111-1111-1111-8111-111111111111",
  verification_method: "manual" as const,
  plan: "free" as const,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const paynowConfig: VendorPaymentConfig = {
  ...BASE,
  kind: "paynow",
  uen: "53312345A",
  mobile: null,
  payee_name: "Kopitiam Cart",
  label: null,
  url: null,
  qr_image_url: null,
};

describe("renderCheckout — paynow", () => {
  it("renders a QR checkout view from a UEN config", () => {
    const view = renderCheckout(paynowConfig, {
      amountCents: 450,
      orderRef: "order-1",
    });
    expect(view).not.toBeNull();
    expect(view?.type).toBe("qr");
    expect((view as { payload: string }).payload).toContain("SG.PAYNOW");
    expect((view as { payload: string }).payload).toContain("53312345A");
  });

  it("renders a QR checkout view from a mobile config", () => {
    const view = renderCheckout(
      { ...paynowConfig, uen: null, mobile: "+6591234567" },
      { amountCents: 100, orderRef: "order-2" },
    );
    expect((view as { payload: string }).payload).toContain("+6591234567");
  });
});

describe("renderCheckout — pointer", () => {
  const pointerBase: VendorPaymentConfig = {
    ...BASE,
    kind: "pointer",
    uen: null,
    mobile: null,
    payee_name: null,
    label: "Pay with PayLah",
    url: null,
    qr_image_url: null,
  };

  it("renders a link checkout view when url is set", () => {
    const view = renderCheckout(
      { ...pointerBase, url: "https://pay.example/kopitiam" },
      { amountCents: 450, orderRef: "order-3" },
    );
    expect(view).toEqual({
      type: "link",
      url: "https://pay.example/kopitiam",
      label: "Pay with PayLah",
    });
  });

  it("renders an image checkout view when qr_image_url is set", () => {
    const view = renderCheckout(
      { ...pointerBase, qr_image_url: "https://cdn.example/qr.webp" },
      { amountCents: 450, orderRef: "order-4" },
    );
    expect(view).toEqual({
      type: "image",
      url: "https://cdn.example/qr.webp",
    });
  });

  it("returns null when neither url nor qr_image_url is set", () => {
    const view = renderCheckout(pointerBase, {
      amountCents: 450,
      orderRef: "order-5",
    });
    expect(view).toBeNull();
  });
});

describe("autoVerify", () => {
  it("throws — schema-reserved, not enabled in v1", () => {
    expect(() => autoVerify()).toThrow("auto-verify not enabled");
  });
});
