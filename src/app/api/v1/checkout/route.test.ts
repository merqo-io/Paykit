import { buildPayNowPayload } from "@/lib/payments/paynow";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const {
  verifyKitAuthMock,
  configMaybeSingle,
  insertSingle,
  existingSingle,
  auditInsert,
  rateLimitMock,
  kitKeyMaybeSingle,
  insertMock,
  hostedUpdateSelect,
  createServiceClientMock,
} = vi.hoisted(() => ({
  kitKeyMaybeSingle: vi.fn(),
  insertMock: vi.fn(),
  hostedUpdateSelect: vi.fn(),
  verifyKitAuthMock: vi.fn(),
  configMaybeSingle: vi.fn(),
  insertSingle: vi.fn(),
  existingSingle: vi.fn(),
  auditInsert: vi.fn(),
  rateLimitMock: vi.fn(),
  createServiceClientMock: vi.fn(),
}));

vi.mock("@/lib/kit-auth", () => ({ verifyKitAuth: verifyKitAuthMock }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: createServiceClientMock,
}));
vi.mock("@/lib/rate-limit", () => ({
  clientIp: () => "203.0.113.5",
  rateLimit: rateLimitMock,
  PER_ROUTE_LIMIT: 60,
  PER_ROUTE_WINDOW_SECONDS: 60,
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
          insert: (row: Record<string, unknown>) => {
            insertMock(row);
            return { select: () => ({ single: insertSingle }) };
          },
          update: () => ({ eq: () => ({ select: hostedUpdateSelect }) }),
          select: () => ({
            eq: () => ({ eq: () => ({ single: existingSingle }) }),
          }),
        };
      }
      if (table === "payment_audit") {
        return { insert: auditInsert };
      }
      if (table === "kit_api_keys") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: kitKeyMaybeSingle }) }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

beforeEach(() => {
  verifyKitAuthMock.mockReset().mockResolvedValue({ kitSlug: "qkit" });
  createServiceClientMock.mockReset().mockResolvedValue(fakeSupabase());
  auditInsert.mockReset().mockResolvedValue({ error: null });
  configMaybeSingle.mockReset().mockResolvedValue({
    data: {
      vendor_id: "11111111-1111-1111-8111-111111111111",
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
        reference: "A-901",
      }),
      type: "qr",
    },
    error: null,
  });
  existingSingle.mockReset().mockResolvedValue({ data: null, error: null });
  rateLimitMock.mockReset().mockResolvedValue(true);
  insertMock.mockReset();
  hostedUpdateSelect
    .mockReset()
    .mockResolvedValue({ data: [{ id: "tx1" }], error: null });
  kitKeyMaybeSingle.mockReset().mockResolvedValue({
    data: { return_origin: "https://qkit.merqo.io" },
    error: null,
  });
});

function req(body: unknown, authorization = "Bearer qkit:secret") {
  return new Request("http://localhost/api/v1/checkout", {
    method: "POST",
    headers: { authorization },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/checkout", () => {
  it("creates a checkout and returns a QR payload", async () => {
    const res = await POST(
      req({
        vendor_id: "11111111-1111-1111-8111-111111111111",
        amount_cents: 450,
        order_ref: "A-001",
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      type: "qr",
      transaction_id: "tx1",
      status: "pending",
      payload: buildPayNowPayload({
        uen: "53312345A",
        payeeName: "Kopitiam Cart",
        amountCents: 450,
        reference: "A-901",
      }),
    });
  });

  it("creates a checkout for a free-tier vendor", async () => {
    configMaybeSingle.mockResolvedValue({
      data: {
        vendor_id: "11111111-1111-1111-8111-111111111111",
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
    const res = await POST(
      req({
        vendor_id: "11111111-1111-1111-8111-111111111111",
        amount_cents: 450,
        order_ref: "A-501",
      }),
    );
    expect(res.status).toBe(200);
  });

  it("creates a link checkout for a pointer-kind vendor", async () => {
    configMaybeSingle.mockResolvedValue({
      data: {
        vendor_id: "11111111-1111-1111-8111-111111111111",
        kind: "pointer",
        uen: null,
        mobile: null,
        payee_name: null,
        label: "Pay with PayLah",
        url: "https://pay.example/kopitiam",
        qr_image_url: null,
        verification_method: "manual",
        plan: "free",
      },
      error: null,
    });
    insertSingle.mockResolvedValue({
      data: {
        id: "tx2",
        qr_payload: "https://pay.example/kopitiam",
        type: "link",
      },
      error: null,
    });
    const res = await POST(
      req({
        vendor_id: "11111111-1111-1111-8111-111111111111",
        amount_cents: 450,
        order_ref: "A-002",
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      type: "link",
      transaction_id: "tx2",
      status: "pending",
      url: "https://pay.example/kopitiam",
      label: "Pay with PayLah",
    });
  });

  it("422s when a pointer-kind vendor's config is incomplete", async () => {
    configMaybeSingle.mockResolvedValue({
      data: {
        vendor_id: "11111111-1111-1111-8111-111111111111",
        kind: "pointer",
        uen: null,
        mobile: null,
        payee_name: null,
        label: "Pay with PayLah",
        url: null,
        qr_image_url: null,
        verification_method: "manual",
        plan: "free",
      },
      error: null,
    });
    const res = await POST(
      req({
        vendor_id: "11111111-1111-1111-8111-111111111111",
        amount_cents: 450,
        order_ref: "A-003",
      }),
    );
    expect(res.status).toBe(422);
  });

  it("401s when the bearer token is missing/invalid", async () => {
    verifyKitAuthMock.mockResolvedValue(null);
    const res = await POST(
      req({
        vendor_id: "11111111-1111-1111-8111-111111111111",
        amount_cents: 450,
        order_ref: "A-001",
      }),
    );
    expect(res.status).toBe(401);
  });

  it("429s when the rate limit is exceeded", async () => {
    rateLimitMock.mockResolvedValue(false);
    const res = await POST(
      req({
        vendor_id: "11111111-1111-1111-8111-111111111111",
        amount_cents: 450,
        order_ref: "A-001",
      }),
    );
    expect(res.status).toBe(429);
    expect(insertSingle).not.toHaveBeenCalled();
  });

  it("422s when the vendor has no PayNow config", async () => {
    configMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await POST(
      req({
        vendor_id: "11111111-1111-1111-8111-111111111111",
        amount_cents: 450,
        order_ref: "A-001",
      }),
    );
    expect(res.status).toBe(422);
  });

  it("400s on an invalid request body", async () => {
    const res = await POST(
      req({ vendor_id: "not-a-uuid", amount_cents: -1, order_ref: "" }),
    );
    expect(res.status).toBe(400);
  });

  it("400s on an expires_at that is not a time, before any insert", async () => {
    const res = await POST(
      req({
        vendor_id: "11111111-1111-1111-8111-111111111111",
        amount_cents: 450,
        order_ref: "A-001",
        expires_at: "in half an hour",
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "expires_at must be an ISO 8601 time",
    });
    expect(insertSingle).not.toHaveBeenCalled();
  });

  it("503s when the config read fails", async () => {
    configMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "connection reset" },
    });
    const res = await POST(
      req({
        vendor_id: "11111111-1111-1111-8111-111111111111",
        amount_cents: 450,
        order_ref: "A-001",
      }),
    );
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).not.toMatch(/connection reset/);
  });

  it("replays the original transaction after a retry hits the unique constraint", async () => {
    const first = await POST(
      req({
        vendor_id: "11111111-1111-1111-8111-111111111111",
        amount_cents: 450,
        order_ref: "A-901",
      }),
    );
    expect(first.status).toBe(200);
    const firstBody = await first.json();

    // The retry hits the transactions_kit_slug_order_ref_key unique
    // constraint (0007_paykit_checkout_idempotency.sql) instead of creating
    // a duplicate row.
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
          reference: "A-901",
        }),
        vendor_id: "11111111-1111-1111-8111-111111111111",
        amount_cents: 450,
      },
      error: null,
    });

    const retry = await POST(
      req({
        vendor_id: "11111111-1111-1111-8111-111111111111",
        amount_cents: 450,
        order_ref: "A-901",
      }),
    );
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual(firstBody);
  });

  it("503s when the idempotent re-read fails after a unique-violation", async () => {
    insertSingle.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });
    existingSingle.mockResolvedValue({
      data: null,
      error: { message: "connection reset" },
    });
    const res = await POST(
      req({
        vendor_id: "11111111-1111-1111-8111-111111111111",
        amount_cents: 450,
        order_ref: "A-901",
      }),
    );
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).not.toMatch(/connection reset/);
  });

  it("503s when the transaction insert fails", async () => {
    insertSingle.mockResolvedValue({
      data: null,
      error: { message: "connection reset" },
    });
    const res = await POST(
      req({
        vendor_id: "11111111-1111-1111-8111-111111111111",
        amount_cents: 450,
        order_ref: "A-001",
      }),
    );
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).not.toMatch(/connection reset/);
  });
});

describe("POST /api/v1/checkout for the hosted pay page", () => {
  const BODY = {
    vendor_id: "11111111-1111-1111-8111-111111111111",
    amount_cents: 450,
    order_ref: "A-001",
  };
  const RETURN_URL = "https://qkit.merqo.io/order/b1/pay?t=abc";

  function payReq(body: unknown) {
    return new Request("https://paykit.example/api/v1/checkout", {
      method: "POST",
      headers: { authorization: "Bearer qkit:secret" },
      body: JSON.stringify(body),
    });
  }

  it("answers no pay_url, and reads no origin, without return_url", async () => {
    const res = await POST(payReq(BODY));
    expect(res.status).toBe(200);
    expect(await res.json()).not.toHaveProperty("pay_url");
    expect(kitKeyMaybeSingle).not.toHaveBeenCalled();
    expect(insertMock.mock.calls[0]![0]).not.toHaveProperty("pay_token_hash");
  });

  it("answers a pay_url on its own origin whose token hashes to what was stored", async () => {
    const { hashPayToken, payTokenSchema } = await import("@/lib/pay-token");
    const res = await POST(
      payReq({ ...BODY, return_url: RETURN_URL, title: "  Order from A  " }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("pending");
    const url = new URL(json.pay_url);
    expect(url.origin).toBe("https://paykit.example");
    expect(url.pathname).toBe("/pay/tx1");
    const token = url.searchParams.get("k") ?? "";
    expect(payTokenSchema.safeParse(token).success).toBe(true);
    expect(insertMock.mock.calls[0]![0]).toMatchObject({
      pay_token_hash: hashPayToken(token),
      return_url: RETURN_URL,
      pay_title: "Order from A",
    });
  });

  it.each([
    ["another site", "https://evil.example/x"],
    ["a host that only begins with it", "https://qkit.merqo.io.evil.com/"],
    ["the origin as credentials", "https://qkit.merqo.io@evil.com/"],
    ["a script address", "javascript:alert(1)"],
    ["plain http", "http://qkit.merqo.io/x"],
  ])("400s and creates nothing when return_url is %s", async (_n, value) => {
    const res = await POST(payReq({ ...BODY, return_url: value }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "return_url is not allowed for this kit",
    });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("400s for a kit with no registered origin", async () => {
    kitKeyMaybeSingle.mockResolvedValue({
      data: { return_origin: null },
      error: null,
    });
    const res = await POST(payReq({ ...BODY, return_url: RETURN_URL }));
    expect(res.status).toBe(400);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("503s and creates nothing when the origin cannot be read", async () => {
    kitKeyMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "connection reset" },
    });
    const res = await POST(payReq({ ...BODY, return_url: RETURN_URL }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).not.toMatch(/connection reset/);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it.each([
    ["an empty return_url", { return_url: "" }],
    [
      "a return_url over 2000 characters",
      { return_url: `https://qkit.merqo.io/${"a".repeat(2000)}` },
    ],
    ["a return_url that is not text", { return_url: 5 }],
    ["a blank title", { return_url: RETURN_URL, title: "   " }],
    [
      "a title over 120 characters",
      { return_url: RETURN_URL, title: "a".repeat(121) },
    ],
  ])("400s on %s", async (_name, extra) => {
    const res = await POST(payReq({ ...BODY, ...extra }));
    expect(res.status).toBe(400);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("reports the real status of a replayed transaction with a fresh pay_url", async () => {
    insertSingle.mockResolvedValue({ data: null, error: { code: "23505" } });
    existingSingle.mockResolvedValue({
      data: {
        id: "tx1",
        status: "confirmed",
        checkout_kind: "qr",
        checkout_label: null,
        vendor_id: BODY.vendor_id,
        amount_cents: 450,
        qr_payload: buildPayNowPayload({
          uen: "53312345A",
          payeeName: "Kopitiam Cart",
          amountCents: 450,
          reference: "A-001",
        }),
      },
      error: null,
    });
    const res = await POST(payReq({ ...BODY, return_url: RETURN_URL }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("confirmed");
    expect(new URL(json.pay_url).pathname).toBe("/pay/tx1");
  });
});
