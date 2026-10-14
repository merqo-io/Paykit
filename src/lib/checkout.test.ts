import { buildPayNowPayload } from "./payments/paynow";
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  configMaybeSingle,
  insertSingle,
  existingSingle,
  auditInsert,
  hostedUpdateSelect,
  createServiceClientMock,
} = vi.hoisted(() => ({
  hostedUpdateSelect: vi.fn(),
  configMaybeSingle: vi.fn(),
  insertSingle: vi.fn(),
  existingSingle: vi.fn(),
  auditInsert: vi.fn(),
  createServiceClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: createServiceClientMock,
}));

const transactionInsert = vi.fn((_row: Record<string, unknown>) => ({
  select: () => ({ single: insertSingle }),
}));

const hostedUpdateEq = vi.fn((_column: string, _value: string) => ({
  select: hostedUpdateSelect,
}));
const transactionUpdate = vi.fn((_patch: Record<string, unknown>) => ({
  eq: hostedUpdateEq,
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
          update: transactionUpdate,
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
  transactionUpdate.mockClear();
  hostedUpdateEq.mockClear();
  hostedUpdateSelect
    .mockReset()
    .mockResolvedValue({ data: [{ id: "tx1" }], error: null });
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
      status: "pending",
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
      status: "pending",
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

describe("createCheckout for the hosted pay page", () => {
  const INPUT = {
    vendorId: "11111111-1111-1111-1111-111111111111",
    kitSlug: "qkit",
    orderRef: "booking:b1:deposit",
    amountCents: 450,
  };
  const HOSTED = {
    returnUrl: "https://qkit.merqo.io/order/b1/pay?t=abc",
    title: "Order from Kopitiam Cart",
  };
  const EXISTING = {
    id: "tx1",
    status: "claimed",
    checkout_kind: "qr",
    checkout_label: null,
    vendor_id: "11111111-1111-1111-1111-111111111111",
    amount_cents: 450,
    qr_payload: buildPayNowPayload({
      uen: "53312345A",
      payeeName: "Kopitiam Cart",
      amountCents: 450,
      reference: "booking:b1:deposit",
    }),
  };

  function replay(row: Record<string, unknown> = EXISTING) {
    insertSingle.mockResolvedValue({ data: null, error: { code: "23505" } });
    existingSingle.mockResolvedValue({ data: row, error: null });
  }

  it("writes no pay page column and mints no token without hostedPay", async () => {
    const { createCheckout } = await import("./checkout");
    const result = await createCheckout(INPUT);
    expect(result).not.toHaveProperty("payToken");
    const inserted = transactionInsert.mock.calls[0]![0];
    expect(inserted).not.toHaveProperty("pay_token_hash");
    expect(inserted).not.toHaveProperty("return_url");
    expect(inserted).not.toHaveProperty("pay_title");
  });

  it("leaves the pay page of a replayed row alone without hostedPay", async () => {
    replay();
    const { createCheckout } = await import("./checkout");
    const result = await createCheckout(INPUT);
    expect(result).toMatchObject({ ok: true, status: "claimed" });
    expect(result).not.toHaveProperty("payToken");
    expect(transactionUpdate).not.toHaveBeenCalled();
  });

  it("stores the hash of the token it returns, with the address and title", async () => {
    const { createCheckout } = await import("./checkout");
    const { hashPayToken } = await import("./pay-token");
    const result = await createCheckout({ ...INPUT, hostedPay: HOSTED });
    if (!result.ok || !result.payToken) throw new Error("expected a token");
    expect(result.status).toBe("pending");
    const inserted = transactionInsert.mock.calls[0]![0];
    expect(inserted).toMatchObject({
      pay_token_hash: hashPayToken(result.payToken),
      return_url: HOSTED.returnUrl,
      pay_title: HOSTED.title,
    });
    expect(JSON.stringify(inserted)).not.toContain(result.payToken);
    expect(transactionUpdate).not.toHaveBeenCalled();
  });

  it("stores a null title when none was given", async () => {
    const { createCheckout } = await import("./checkout");
    await createCheckout({
      ...INPUT,
      hostedPay: { returnUrl: HOSTED.returnUrl, title: null },
    });
    expect(transactionInsert.mock.calls[0]![0]).toMatchObject({
      pay_title: null,
    });
  });

  it("replaces the stored hash on a replay and reports the status the row holds", async () => {
    replay();
    const { createCheckout } = await import("./checkout");
    const { hashPayToken } = await import("./pay-token");
    const first = await createCheckout({ ...INPUT, hostedPay: HOSTED });
    const second = await createCheckout({ ...INPUT, hostedPay: HOSTED });
    if (!first.ok || !second.ok) throw new Error("expected two checkouts");
    if (!first.payToken || !second.payToken) throw new Error("no token");
    expect(first.payToken).not.toBe(second.payToken);
    expect(second.status).toBe("claimed");
    expect(transactionUpdate).toHaveBeenLastCalledWith({
      pay_token_hash: hashPayToken(second.payToken),
      return_url: HOSTED.returnUrl,
      pay_title: HOSTED.title,
    });
    expect(hostedUpdateEq).toHaveBeenLastCalledWith("id", "tx1");
    expect(auditInsert).not.toHaveBeenCalled();
  });

  it.each([
    ["the write errors", { data: null, error: { message: "boom" } }],
    ["the write matches no row", { data: [], error: null }],
  ])("answers 503 with no token when %s", async (_name, outcome) => {
    replay();
    hostedUpdateSelect.mockResolvedValue(outcome);
    const { createCheckout } = await import("./checkout");
    const result = await createCheckout({ ...INPUT, hostedPay: HOSTED });
    expect(result).toEqual({
      ok: false,
      status: 503,
      error: "Could not create checkout",
    });
  });

  it("writes nothing when the replay conflicts", async () => {
    replay({ ...EXISTING, amount_cents: 999 });
    const { createCheckout } = await import("./checkout");
    const result = await createCheckout({ ...INPUT, hostedPay: HOSTED });
    expect(result).toMatchObject({ ok: false, status: 409 });
    expect(transactionUpdate).not.toHaveBeenCalled();
  });

  it("reads an unknown stored status as pending", async () => {
    replay({ ...EXISTING, status: "refunded" });
    const { createCheckout } = await import("./checkout");
    expect(await createCheckout(INPUT)).toMatchObject({ status: "pending" });
  });
});
