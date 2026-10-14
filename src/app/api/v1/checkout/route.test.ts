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
  createServiceClientMock,
} = vi.hoisted(() => ({
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
          insert: () => ({ select: () => ({ single: insertSingle }) }),
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
  verifyKitAuthMock.mockReset().mockResolvedValue({ kitSlug: "qkit" });
  createServiceClientMock.mockReset().mockResolvedValue(fakeSupabase());
  auditInsert.mockReset().mockResolvedValue({ error: null });
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
        reference: "A-901",
      }),
      type: "qr",
    },
    error: null,
  });
  existingSingle.mockReset().mockResolvedValue({ data: null, error: null });
  rateLimitMock.mockReset().mockResolvedValue(true);
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
        vendor_id: "11111111-1111-1111-1111-111111111111",
        amount_cents: 450,
        order_ref: "A-001",
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      type: "qr",
      transaction_id: "tx1",
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
    const res = await POST(
      req({
        vendor_id: "11111111-1111-1111-1111-111111111111",
        amount_cents: 450,
        order_ref: "A-501",
      }),
    );
    expect(res.status).toBe(200);
  });

  it("creates a link checkout for a pointer-kind vendor", async () => {
    configMaybeSingle.mockResolvedValue({
      data: {
        vendor_id: "11111111-1111-1111-1111-111111111111",
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
        vendor_id: "11111111-1111-1111-1111-111111111111",
        amount_cents: 450,
        order_ref: "A-002",
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      type: "link",
      transaction_id: "tx2",
      url: "https://pay.example/kopitiam",
      label: "Pay with PayLah",
    });
  });

  it("422s when a pointer-kind vendor's config is incomplete", async () => {
    configMaybeSingle.mockResolvedValue({
      data: {
        vendor_id: "11111111-1111-1111-1111-111111111111",
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
        vendor_id: "11111111-1111-1111-1111-111111111111",
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
        vendor_id: "11111111-1111-1111-1111-111111111111",
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
        vendor_id: "11111111-1111-1111-1111-111111111111",
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
        vendor_id: "11111111-1111-1111-1111-111111111111",
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
        vendor_id: "11111111-1111-1111-1111-111111111111",
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
        vendor_id: "11111111-1111-1111-1111-111111111111",
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
        vendor_id: "11111111-1111-1111-1111-111111111111",
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
        vendor_id: "11111111-1111-1111-1111-111111111111",
        amount_cents: 450,
      },
      error: null,
    });

    const retry = await POST(
      req({
        vendor_id: "11111111-1111-1111-1111-111111111111",
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
        vendor_id: "11111111-1111-1111-1111-111111111111",
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
        vendor_id: "11111111-1111-1111-1111-111111111111",
        amount_cents: 450,
        order_ref: "A-001",
      }),
    );
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).not.toMatch(/connection reset/);
  });
});
