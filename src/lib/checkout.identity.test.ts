import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCheckout } from "./checkout";

const { existing, client } = vi.hoisted(() => ({
  existing: vi.fn(),
  client: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: client }));
vi.mock("@/lib/payment-audit", () => ({ recordPaymentAudit: vi.fn() }));
const vendorId = "11111111-1111-1111-1111-111111111111";
const input = {
  vendorId,
  kitSlug: "qkit",
  orderRef: "order1",
  amountCents: 450,
};
beforeEach(() => {
  existing.mockReset();
  client.mockResolvedValue({
    from: (table: string) =>
      table === "vendor_payment_config"
        ? {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    kind: "pointer",
                    url: "https://pay.example/checkout",
                    label: "Pay",
                  },
                  error: null,
                }),
              }),
            }),
          }
        : {
            insert: () => ({
              select: () => ({
                single: async () => ({ data: null, error: { code: "23505" } }),
              }),
            }),
            select: () => ({
              eq: () => ({ eq: () => ({ single: existing }) }),
            }),
          },
  });
});
describe("checkout idempotency identity", () => {
  it.each([
    { vendor_id: "22222222-2222-2222-2222-222222222222", amount_cents: 450 },
    { vendor_id: vendorId, amount_cents: 999 },
  ])("rejects conflicting checkout identity %j", async (identity) => {
    existing.mockResolvedValue({
      data: {
        checkout_kind: "link",
        checkout_label: "Pay",
        id: "existing",
        qr_payload: "https://pay.example/checkout",
        ...identity,
      },
      error: null,
    });
    expect(await createCheckout(input)).toMatchObject({
      ok: false,
      status: 409,
    });
  });
  it("replays the same vendor and amount", async () => {
    existing.mockResolvedValue({
      data: {
        checkout_kind: "link",
        checkout_label: "Pay",
        id: "existing",
        qr_payload: "https://pay.example/checkout",
        vendor_id: vendorId,
        amount_cents: 450,
      },
      error: null,
    });
    expect(await createCheckout(input)).toMatchObject({
      ok: true,
      type: "link",
      transaction_id: "existing",
      url: "https://pay.example/checkout",
      label: "Pay",
    });
  });
});

it("rejects changed payment configuration instead of reinterpreting the stored payload", async () => {
  existing.mockResolvedValue({
    data: {
      checkout_kind: "link",
      checkout_label: "Pay",
      id: "existing",
      qr_payload: "000201-old-paynow-payload",
      vendor_id: vendorId,
      amount_cents: 450,
    },
    error: null,
  });
  expect(await createCheckout(input)).toMatchObject({ ok: false, status: 409 });
});

it.each(["image", null])(
  "rejects same URL with incompatible or unknown stored kind %s",
  async (checkout_kind) => {
    existing.mockResolvedValue({
      data: {
        id: "existing",
        vendor_id: vendorId,
        amount_cents: 450,
        qr_payload: "https://pay.example/checkout",
        checkout_kind,
        checkout_label: null,
      },
      error: null,
    });
    expect(await createCheckout(input)).toMatchObject({
      ok: false,
      status: 409,
    });
  },
);
it("replays the immutable link label despite current config label changes", async () => {
  existing.mockResolvedValue({
    data: {
      id: "existing",
      vendor_id: vendorId,
      amount_cents: 450,
      qr_payload: "https://pay.example/checkout",
      checkout_kind: "link",
      checkout_label: "Original provider",
    },
    error: null,
  });
  expect(await createCheckout(input)).toMatchObject({
    ok: true,
    type: "link",
    label: "Original provider",
  });
});
