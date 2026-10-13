import { describe, it, expect } from "vitest";
import {
  checkoutRequestSchema,
  checkoutResponseSchema,
  transactionStatusResponseSchema,
  vendorConfigResponseSchema,
  toStatusResponse,
  MAX_EXPIRES_AHEAD_MS,
} from "./api-schemas";

describe("checkoutRequestSchema", () => {
  it("accepts a valid request", () => {
    const parsed = checkoutRequestSchema.safeParse({
      vendor_id: "11111111-1111-1111-1111-111111111111",
      amount_cents: 450,
      order_ref: "A-001",
    });
    expect(parsed.success).toBe(true);
  });

  const base = {
    vendor_id: "11111111-1111-1111-1111-111111111111",
    amount_cents: 450,
    order_ref: "A-001",
  };

  it("accepts expires_at with an offset, and null", () => {
    const soon = new Date(Date.now() + 30 * 60_000).toISOString();
    expect(
      checkoutRequestSchema.safeParse({ ...base, expires_at: soon }).success,
    ).toBe(true);
    expect(
      checkoutRequestSchema.safeParse({
        ...base,
        expires_at: "2020-10-13T21:00:00+08:00",
      }).success,
    ).toBe(true);
    expect(
      checkoutRequestSchema.safeParse({ ...base, expires_at: null }).success,
    ).toBe(true);
  });

  it("accepts an expires_at already past", () => {
    const parsed = checkoutRequestSchema.safeParse({
      ...base,
      expires_at: "2020-01-01T00:00:00Z",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an expires_at that is not an ISO 8601 time with an offset", () => {
    for (const bad of ["tomorrow", "2026-10-13", "2026-10-13T21:00:00", 5]) {
      const parsed = checkoutRequestSchema.safeParse({
        ...base,
        expires_at: bad,
      });
      expect(parsed.success, String(bad)).toBe(false);
    }
  });

  it("rejects an expires_at more than 7 days ahead, and accepts one just inside", () => {
    const at = (ms: number) => new Date(Date.now() + ms).toISOString();
    const far = checkoutRequestSchema.safeParse({
      ...base,
      expires_at: at(MAX_EXPIRES_AHEAD_MS + 60_000),
    });
    expect(far.success).toBe(false);
    expect(far.error?.issues[0]?.message).toBe(
      "expires_at is more than 7 days ahead",
    );
    expect(
      checkoutRequestSchema.safeParse({
        ...base,
        expires_at: at(MAX_EXPIRES_AHEAD_MS - 60_000),
      }).success,
    ).toBe(true);
  });

  it("rejects a non-uuid vendor_id", () => {
    expect(
      checkoutRequestSchema.safeParse({
        vendor_id: "not-a-uuid",
        amount_cents: 450,
        order_ref: "A-001",
      }).success,
    ).toBe(false);
  });

  it("rejects a non-positive amount", () => {
    expect(
      checkoutRequestSchema.safeParse({
        vendor_id: "11111111-1111-1111-1111-111111111111",
        amount_cents: 0,
        order_ref: "A-001",
      }).success,
    ).toBe(false);
  });

  it("rejects an empty order_ref", () => {
    expect(
      checkoutRequestSchema.safeParse({
        vendor_id: "11111111-1111-1111-1111-111111111111",
        amount_cents: 450,
        order_ref: "",
      }).success,
    ).toBe(false);
  });
});

describe("checkoutResponseSchema / transactionStatusResponseSchema / vendorConfigResponseSchema", () => {
  it("accept well-formed payloads", () => {
    expect(
      checkoutResponseSchema.safeParse({
        type: "qr",
        transaction_id: "11111111-1111-1111-1111-111111111111",
        payload: "00020101...6304ABCD",
      }).success,
    ).toBe(true);
    expect(
      transactionStatusResponseSchema.safeParse({
        transaction_id: "11111111-1111-1111-1111-111111111111",
        status: "pending",
        amount_cents: 450,
        order_ref: "A-001",
        kit_slug: "qkit",
        claimed_at: null,
        confirmed_at: null,
        created_at: "2026-07-15T00:00:00Z",
        expires_at: null,
      }).success,
    ).toBe(true);
    expect(
      vendorConfigResponseSchema.safeParse({
        has_config: true,
        display_name: "Kopitiam Cart",
      }).success,
    ).toBe(true);
  });
});

describe("toStatusResponse", () => {
  it("maps a DB row to the wire shape", () => {
    const mapped = toStatusResponse({
      id: "tx1",
      status: "claimed",
      amount_cents: 450,
      order_ref: "A-001",
      kit_slug: "qkit",
      claimed_at: "2026-07-15T00:00:00Z",
      confirmed_at: null,
      created_at: "2026-07-15T00:00:00Z",
    });
    expect(mapped).toEqual({
      transaction_id: "tx1",
      status: "claimed",
      amount_cents: 450,
      order_ref: "A-001",
      kit_slug: "qkit",
      claimed_at: "2026-07-15T00:00:00Z",
      confirmed_at: null,
      created_at: "2026-07-15T00:00:00Z",
      expires_at: null,
    });
  });

  it("passes a stored expires_at through", () => {
    const mapped = toStatusResponse({
      id: "tx1",
      status: "pending",
      amount_cents: 450,
      order_ref: "A-001",
      kit_slug: "qkit",
      claimed_at: null,
      confirmed_at: null,
      created_at: "2026-07-15T00:00:00Z",
      expires_at: "2026-07-15T00:30:00Z",
    });
    expect(mapped.expires_at).toBe("2026-07-15T00:30:00Z");
  });
});
