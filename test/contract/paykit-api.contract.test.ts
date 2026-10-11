import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  checkoutResponseSchema,
  checkoutLookupResponseSchema,
  transactionStatusResponseSchema,
  vendorConfigResponseSchema,
  bookingStatusResponseSchema,
} from "@/lib/api-schemas";

function loadSample(name: string) {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), "utf8"),
  );
}

describe("paykit /api/v1 contract", () => {
  it("POST /api/v1/checkout response satisfies checkoutResponseSchema", () => {
    const parsed = checkoutResponseSchema.safeParse(
      loadSample("checkout-response.sample.json"),
    );
    expect(parsed.success, JSON.stringify(parsed.error?.format())).toBe(true);
  });

  it("claim/confirm/status responses satisfy transactionStatusResponseSchema", () => {
    const parsed = transactionStatusResponseSchema.safeParse(
      loadSample("transaction-status.sample.json"),
    );
    expect(parsed.success, JSON.stringify(parsed.error?.format())).toBe(true);
  });

  it("GET /api/v1/vendors/{vendor_id}/config response satisfies vendorConfigResponseSchema", () => {
    const parsed = vendorConfigResponseSchema.safeParse(
      loadSample("vendor-config.sample.json"),
    );
    expect(parsed.success, JSON.stringify(parsed.error?.format())).toBe(true);
  });

  it("POST /api/v1/vendors/{vendor_id}/config response satisfies vendorConfigResponseSchema", () => {
    const sample = loadSample("vendor-config.sample.json");
    const parsed = vendorConfigResponseSchema.safeParse({
      has_config: sample.has_config,
      display_name: sample.display_name,
    });
    expect(parsed.success, JSON.stringify(parsed.error?.format())).toBe(true);
  });
  it("GET /api/v1/bookings/{booking_id} response satisfies bookingStatusResponseSchema", () => {
    const parsed = bookingStatusResponseSchema.safeParse(
      loadSample("booking-status.sample.json"),
    );
    expect(parsed.success, JSON.stringify(parsed.error?.format())).toBe(true);
  });

  it("GET /api/v1/checkout?order_ref= response satisfies checkoutLookupResponseSchema", () => {
    const parsed = checkoutLookupResponseSchema.safeParse(
      loadSample("checkout-lookup.sample.json"),
    );
    expect(parsed.success, JSON.stringify(parsed.error?.format())).toBe(true);
  });

  it("the lookup response also satisfies the plain transaction status contract", () => {
    const parsed = transactionStatusResponseSchema.safeParse(
      loadSample("checkout-lookup.sample.json"),
    );
    expect(parsed.success, JSON.stringify(parsed.error?.format())).toBe(true);
  });

  it("vendor-config sample matches GET's full editable-config wire shape", () => {
    const sample = loadSample("vendor-config.sample.json");
    expect(Object.keys(sample).sort()).toEqual(
      [
        "display_name",
        "has_config",
        "kind",
        "label",
        "mobile",
        "payee_name",
        "qr_image_url",
        "uen",
        "url",
      ].sort(),
    );
  });
});
