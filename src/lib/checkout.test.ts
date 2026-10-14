import { buildPayNowPayload } from "./payments/paynow";
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  configMaybeSingle,
  insertSingle,
  existingSingle,
  auditInsert,
  createServiceClientMock,
} = vi.hoisted(() => ({
  configMaybeSingle: vi.fn(),
  insertSingle: vi.fn(),
  existingSingle: vi.fn(),
  auditInsert: vi.fn(),
  createServiceClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: createServiceClientMock,
}));

const transactionInsert = vi.fn(() => ({
  select: () => ({ single: insertSingle }),
}));

function fakeSupabase() {
  return {
    from: (table: string) => {
      if (table === "vendor_payment_config") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: configMaybeSingle }) }),
        };
      }
      if (table === "transactions") {
        return {
          insert: transactionInsert,
          select: () => ({
            eq: () => ({ eq: () => ({ single: existingSingle }) }),
          }),
        };
      }
      if (table === "payment_audit") {
        return { insert: auditInsert };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

beforeEach(() => {
  transactionInsert.mockClear();
  createServiceClientMock.mockReset().mockResolvedValue(fakeSupabase());
  configMaybeSingle.mockReset().mockResolvedValue({
    data: {
      vendor_id: "11111111-1111-1111-1111-111111111111",
      kind: "paynow",
      uen: "53312345A",
      mobile: null,
      payee_name: "Kopitiam Cart",
      label: null,
      url: null,
      qr_image_url: null,
      verification_method: "manual",
      plan: "free",
    },
    error: null,
  });
  insertSingle.mockReset().mockResolvedValue({
    data: {
      id: "tx1",
      qr_payload: buildPayNowPayload({
        uen: "53312345A",
        payeeName: "Kopitiam Cart",
        amountCents: 450,
        reference: "booking:b1:deposit",
      }),
      vendor_id: "11111111-1111-1111-1111-111111111111",
      amount_cents: 450,
    },
    error: null,
  });
  existingSingle.mockReset().mockResolvedValue({ data: null, error: null });
  auditInsert.mockReset().mockResolvedValue({ error: null });
});

describe("createCheckout expires_at", () => {
  const input = {
    vendorId: "11111111-1111-1111-1111-111111111111",
    kitSlug: "qkit",
    orderRef: "order-1",
    amountCents: 450,
  };

  it("stores expires_at on a new checkout, as a UTC instant", async () => {
    const { createCheckout } = await import("./checkout");
    await createCheckout({ ...input, expiresAt: "2026-10-13T21:30:00+08:00" });
    expect(transactionInsert).toHaveBeenCalledWith(
      expect.objectContaining({ expires_at: "2026-10-13T13:30:00.000Z" }),
    );
  });

  it("inserts no expires_at key when the caller sends none or null", async () => {
    const { createCheckout } = await import("./checkout");
    await createCheckout(input);
    await createCheckout({ ...input, expiresAt: null });
    expect(transactionInsert).toHaveBeenCalledTimes(2);
    for (const call of transactionInsert.mock.calls as unknown[][]) {
      expect(Object.keys(call[0] as object)).not.toContain("expires_at");
    }
  });
});

describe("createCheckout", () => {
  it("creates a checkout and returns a QR payload", async () => {
    const { createCheckout } = await import("./checkout");
    const result = await createCheckout({
      vendorId: "11111111-1111-1111-1111-111111111111",
      kitSlug: "paykit",
      orderRef: "booking:b1:deposit",
      amountCents: 450,
    });
    expect(result).toEqual({
      ok: true,
      type: "qr",
      transaction_id: "tx1",
      payload: buildPayNowPayload({
        uen: "53312345A",
        payeeName: "Kopitiam Cart",
        amountCents: 450,
        reference: "booking:b1:deposit",
      }),
    });
    expect(auditInsert).toHaveBeenCalledWith({
      transaction_id: "tx1",
      kit_slug: "paykit",
      action: "checkout_created",
      detail: null,
    });
  });

  it("returns a 422 when the vendor has no config", async () => {
    configMaybeSingle.mockResolvedValue({ data: null, error: null });
    const { createCheckout } = await import("./checkout");
    const result = await createCheckout({
      vendorId: "11111111-1111-1111-1111-111111111111",
      kitSlug: "paykit",
      orderRef: "booking:b1:deposit",
      amountCents: 450,
    });
    expect(result).toEqual({
      ok: false,
      status: 422,
      error: "vendor has no PayNow config",
    });
  });

  it("returns a 503 when the config read fails", async () => {
    configMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "connection reset" },
    });
    const { createCheckout } = await import("./checkout");
    const result = await createCheckout({
      vendorId: "11111111-1111-1111-1111-111111111111",
      kitSlug: "paykit",
      orderRef: "booking:b1:deposit",
      amountCents: 450,
    });
    expect(result).toEqual({
      ok: false,
      status: 503,
      error: "Upstream unavailable",
    });
  });

  it("re-reads and returns the existing transaction on a (kit_slug, order_ref) retry", async () => {
    insertSingle.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });
    existingSingle.mockResolvedValue({
      data: {
        checkout_kind: "qr",
        checkout_label: null,
        id: "tx1",
        qr_payload: buildPayNowPayload({
          uen: "53312345A",
          payeeName: "Kopitiam Cart",
          amountCents: 450,
          reference: "booking:b1:deposit",
        }),
        vendor_id: "11111111-1111-1111-1111-111111111111",
        amount_cents: 450,
      },
      error: null,
    });
    const { createCheckout } = await import("./checkout");
    const result = await createCheckout({
      vendorId: "11111111-1111-1111-1111-111111111111",
      kitSlug: "paykit",
      orderRef: "booking:b1:deposit",
      amountCents: 450,
    });
    expect(result).toEqual({
      ok: true,
      type: "qr",
      transaction_id: "tx1",
      payload: buildPayNowPayload({
        uen: "53312345A",
        payeeName: "Kopitiam Cart",
        amountCents: 450,
        reference: "booking:b1:deposit",
      }),
    });
    expect(auditInsert).not.toHaveBeenCalled();
  });

  it("returns a 503 when the insert fails for a reason other than a unique violation", async () => {
    insertSingle.mockResolvedValue({
      data: null,
      error: { message: "connection reset" },
    });
    const { createCheckout } = await import("./checkout");
    const result = await createCheckout({
      vendorId: "11111111-1111-1111-1111-111111111111",
      kitSlug: "paykit",
      orderRef: "booking:b1:deposit",
      amountCents: 450,
    });
    expect(result).toEqual({
      ok: false,
      status: 503,
      error: "Could not create checkout",
    });
  });
});

it("persists checkout representation with the original payload", async () => {
  const { createCheckout } = await import("./checkout");
  await createCheckout({
    vendorId: "11111111-1111-1111-1111-111111111111",
    kitSlug: "paykit",
    orderRef: "booking:b1:deposit",
    amountCents: 450,
  });
  expect(transactionInsert).toHaveBeenCalledWith(
    expect.objectContaining({
      checkout_kind: "qr",
      checkout_label: null,
      qr_payload: expect.stringContaining("SG.PAYNOW"),
    }),
  );
});
it("keeps canonical historical PayNow retries usable without a kind backfill", async () => {
  insertSingle.mockResolvedValue({ data: null, error: { code: "23505" } });
  existingSingle.mockResolvedValue({
    data: {
      id: "legacy",
      vendor_id: "11111111-1111-1111-1111-111111111111",
      amount_cents: 450,
      checkout_kind: null,
      checkout_label: null,
      qr_payload: buildPayNowPayload({
        uen: "53312345A",
        payeeName: "Kopitiam Cart",
        amountCents: 450,
        reference: "booking:b1:deposit",
      }),
    },
    error: null,
  });
  const { createCheckout } = await import("./checkout");
  expect(
    await createCheckout({
      vendorId: "11111111-1111-1111-1111-111111111111",
      kitSlug: "paykit",
      orderRef: "booking:b1:deposit",
      amountCents: 450,
    }),
  ).toMatchObject({ ok: true, type: "qr", transaction_id: "legacy" });
});
