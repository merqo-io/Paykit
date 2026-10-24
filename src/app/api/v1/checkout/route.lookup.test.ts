import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const {
  verifyKitAuthMock,
  maybeSingleMock,
  eqMock,
  selectMock,
  rateLimitMock,
  createServiceClientMock,
} = vi.hoisted(() => ({
  verifyKitAuthMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  eqMock: vi.fn(),
  selectMock: vi.fn(),
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
vi.mock("@/lib/checkout", () => ({ createCheckout: vi.fn() }));

const TX_ID = "22222222-2222-2222-8222-222222222222";
const ROW = {
  id: TX_ID,
  status: "claimed",
  amount_cents: 450,
  order_ref: "A-001",
  kit_slug: "qkit",
  vendor_id: "11111111-1111-1111-8111-111111111111",
  claimed_at: "2026-07-15T00:01:00Z",
  confirmed_at: null,
  created_at: "2026-07-15T00:00:00Z",
  expires_at: "2026-07-15T00:30:00Z",
  qr_payload: "https://pay.example/checkout/abc",
  checkout_kind: "link",
  checkout_label: "Pay with PayLah",
};

beforeEach(() => {
  verifyKitAuthMock.mockReset().mockResolvedValue({ kitSlug: "qkit" });
  rateLimitMock.mockReset().mockResolvedValue(true);
  maybeSingleMock.mockReset().mockResolvedValue({ data: ROW, error: null });
  const chain = { eq: eqMock, maybeSingle: maybeSingleMock };
  eqMock.mockReset().mockReturnValue(chain);
  selectMock.mockReset().mockReturnValue(chain);
  createServiceClientMock.mockReset().mockResolvedValue({
    from: (table: string) => {
      if (table !== "transactions")
        throw new Error(`unexpected table ${table}`);
      return { select: selectMock };
    },
  });
});

function req(query: string) {
  return new Request(`http://localhost/api/v1/checkout${query}`, {
    headers: { authorization: "Bearer qkit:secret" },
  });
}

describe("GET /api/v1/checkout?order_ref=", () => {
  it("returns the transaction and its stored view", async () => {
    const res = await GET(req("?order_ref=A-001"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      transaction_id: TX_ID,
      status: "claimed",
      amount_cents: 450,
      order_ref: "A-001",
      kit_slug: "qkit",
      vendor_id: "11111111-1111-1111-8111-111111111111",
      claimed_at: "2026-07-15T00:01:00Z",
      confirmed_at: null,
      created_at: "2026-07-15T00:00:00Z",
      expires_at: "2026-07-15T00:30:00Z",
      view: {
        type: "link",
        url: "https://pay.example/checkout/abc",
        label: "Pay with PayLah",
      },
    });
  });

  it("reads only the calling kit's transaction for that order_ref", async () => {
    verifyKitAuthMock.mockResolvedValue({ kitSlug: "loopkit" });
    await GET(req("?order_ref=A-001"));
    expect(eqMock.mock.calls).toEqual([
      ["kit_slug", "loopkit"],
      ["order_ref", "A-001"],
    ]);
  });

  it("401s when the bearer token is missing or invalid", async () => {
    verifyKitAuthMock.mockResolvedValue(null);
    const res = await GET(req("?order_ref=A-001"));
    expect(res.status).toBe(401);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("429s when the rate limit is exceeded, without reading transactions", async () => {
    rateLimitMock.mockResolvedValue(false);
    const res = await GET(req("?order_ref=A-001"));
    expect(res.status).toBe(429);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", ""],
    ["empty", "?order_ref="],
    ["blank", "?order_ref=%20%20"],
    ["too long", `?order_ref=${"x".repeat(201)}`],
  ])("400s for a %s order_ref, without reading transactions", async (_, q) => {
    const res = await GET(req(q));
    expect(res.status).toBe(400);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("404s when this kit has no transaction for the order_ref", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    const res = await GET(req("?order_ref=A-404"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });

  it("503s without leaking the database error", async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: "connection reset" },
    });
    const res = await GET(req("?order_ref=A-001"));
    expect(res.status).toBe(503);
    expect((await res.json()).error).not.toMatch(/connection reset/);
  });
});
