import { describe, it, expect } from "vitest";
import { buildPayNowPayload } from "@/lib/payments/paynow";
import { toLookupResponse, type CheckoutLookupRow } from "./checkout-lookup";
import {
  checkoutLookupResponseSchema,
  type CheckoutLookupResponse,
} from "./api-schemas";

const BASE: CheckoutLookupRow = {
  id: "22222222-2222-2222-2222-222222222222",
  status: "claimed",
  amount_cents: 450,
  order_ref: "A-001",
  kit_slug: "qkit",
  vendor_id: "11111111-1111-1111-1111-111111111111",
  claimed_at: "2026-07-15T00:01:00Z",
  confirmed_at: null,
  created_at: "2026-07-15T00:00:00Z",
  qr_payload: "https://pay.example/checkout/abc",
  checkout_kind: "link",
  checkout_label: "Pay with PayLah",
};

describe("toLookupResponse", () => {
  it("returns the status fields and the stored link view", () => {
    const body = toLookupResponse(BASE);
    expect(body).toMatchObject({
      transaction_id: BASE.id,
      status: "claimed",
      amount_cents: 450,
      order_ref: "A-001",
      kit_slug: "qkit",
      vendor_id: "11111111-1111-1111-1111-111111111111",
    });
    expect(body.view).toEqual({
      type: "link",
      url: "https://pay.example/checkout/abc",
      label: "Pay with PayLah",
    });
    expect(checkoutLookupResponseSchema.safeParse(body).success).toBe(true);
  });

  it("fails the response schema when vendor_id is missing", () => {
    const withoutVendor: Partial<CheckoutLookupResponse> =
      toLookupResponse(BASE);
    delete withoutVendor.vendor_id;
    expect(checkoutLookupResponseSchema.safeParse(withoutVendor).success).toBe(
      false,
    );
  });

  it("uses the fallback label for a link stored without one", () => {
    const body = toLookupResponse({ ...BASE, checkout_label: null });
    expect(body.view).toEqual({
      type: "link",
      url: "https://pay.example/checkout/abc",
      label: "Open payment link",
    });
  });

  it("returns an image view", () => {
    const body = toLookupResponse({
      ...BASE,
      checkout_kind: "image",
      checkout_label: null,
      qr_payload: "https://cdn.example/qr.png",
    });
    expect(body.view).toEqual({
      type: "image",
      url: "https://cdn.example/qr.png",
    });
  });

  it("returns a qr view for a stored PayNow payload", () => {
    const payload = buildPayNowPayload({
      uen: "53312345A",
      payeeName: "Kopitiam Cart",
      amountCents: 450,
      reference: "A-001",
    });
    const body = toLookupResponse({
      ...BASE,
      checkout_kind: "qr",
      checkout_label: null,
      qr_payload: payload,
    });
    expect(body.view).toEqual({ type: "qr", payload });
  });

  it("recognises a PayNow payload on a row that predates checkout_kind", () => {
    const payload = buildPayNowPayload({
      uen: "53312345A",
      payeeName: "Kopitiam Cart",
      amountCents: 450,
      reference: "A-001",
    });
    const body = toLookupResponse({
      ...BASE,
      checkout_kind: null,
      checkout_label: null,
      qr_payload: payload,
    });
    expect(body.view).toEqual({ type: "qr", payload });
  });

  it("returns a null view for an old URL row whose kind is unknown", () => {
    const body = toLookupResponse({
      ...BASE,
      checkout_kind: null,
      checkout_label: null,
    });
    expect(body.view).toBeNull();
    expect(checkoutLookupResponseSchema.safeParse(body).success).toBe(true);
  });
});
