import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { checkoutEvidenceResponseSchema } from "@/lib/api-schemas";

const {
  verifyKitAuthMock,
  maybeSingleMock,
  eqMock,
  rateLimitMock,
  createServiceClientMock,
  loadEvidenceMock,
} = vi.hoisted(() => ({
  verifyKitAuthMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  eqMock: vi.fn(),
  rateLimitMock: vi.fn(),
  createServiceClientMock: vi.fn(),
  loadEvidenceMock: vi.fn(),
}));

vi.mock("@/lib/kit-auth", () => ({ verifyKitAuth: verifyKitAuthMock }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: createServiceClientMock,
}));
vi.mock("@/lib/rate-limit", () => ({
  clientIp: () => "203.0.113.5",
  PER_ROUTE_LIMIT: 60,
  PER_ROUTE_WINDOW_SECONDS: 60,
  rateLimit: rateLimitMock,
}));
vi.mock("@/lib/payment-evidence", () => ({
  loadCheckoutEvidence: loadEvidenceMock,
}));

const TX_ID = "22222222-2222-2222-2222-222222222222";
const VENDOR_ID = "00000000-0000-0000-0000-00000000000a";

const EVIDENCE = {
  proof_url: "https://storage.example/signed?token=abc",
  signals: {
    duplicate_of: { order_ref: "order-2", kit_slug: "qkit" },
    amount_match: null,
  },
};

function fakeSupabase() {
  const chain = { eq: eqMock, maybeSingle: maybeSingleMock };
  eqMock.mockImplementation(() => chain);
  return { from: vi.fn(() => ({ select: () => chain })) };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  verifyKitAuthMock.mockReset().mockResolvedValue({ kitSlug: "qkit" });
  eqMock.mockReset();
  createServiceClientMock.mockReset().mockResolvedValue(fakeSupabase());
  maybeSingleMock.mockReset().mockResolvedValue({
    data: { id: TX_ID, vendor_id: VENDOR_ID },
    error: null,
  });
  rateLimitMock.mockReset().mockResolvedValue(true);
  loadEvidenceMock.mockReset().mockResolvedValue(EVIDENCE);
});

function req() {
  return new Request(`http://localhost/api/v1/checkout/${TX_ID}/evidence`, {
    headers: { authorization: "Bearer qkit:secret" },
  });
}
function ctx(id: string = TX_ID) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/v1/checkout/[id]/evidence", () => {
  it("returns the evidence in the contract shape, uncacheable", async () => {
    const res = await GET(req(), ctx());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(checkoutEvidenceResponseSchema.safeParse(body).success).toBe(true);
    expect(body).toEqual(EVIDENCE);
    expect(loadEvidenceMock).toHaveBeenCalledWith(expect.anything(), {
      id: TX_ID,
      vendor_id: VENDOR_ID,
    });
  });

  it("reads the transaction by id and by the calling kit", async () => {
    verifyKitAuthMock.mockResolvedValue({ kitSlug: "loopkit" });
    await GET(req(), ctx());
    expect(eqMock.mock.calls).toEqual([
      ["id", TX_ID],
      ["kit_slug", "loopkit"],
    ]);
  });

  it("limits by kit and caller address", async () => {
    await GET(req(), ctx());
    expect(rateLimitMock).toHaveBeenCalledWith(
      expect.anything(),
      "evidence:qkit:203.0.113.5",
      60,
      60,
    );
  });

  it("401s when unauthorized, without touching the database", async () => {
    verifyKitAuthMock.mockResolvedValue(null);
    expect((await GET(req(), ctx())).status).toBe(401);
    expect(createServiceClientMock).not.toHaveBeenCalled();
  });

  it("429s when the rate limit is exceeded, without reading", async () => {
    rateLimitMock.mockResolvedValue(false);
    expect((await GET(req(), ctx())).status).toBe(429);
    expect(maybeSingleMock).not.toHaveBeenCalled();
  });

  it("400s for a malformed id, without reading", async () => {
    expect((await GET(req(), ctx("not-a-uuid"))).status).toBe(400);
    expect(maybeSingleMock).not.toHaveBeenCalled();
  });

  it("404s for a transaction this kit does not own, without loading evidence", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    expect((await GET(req(), ctx())).status).toBe(404);
    expect(loadEvidenceMock).not.toHaveBeenCalled();
  });

  it("503s when the transaction read fails, without leaking the cause", async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: "connection reset" },
    });
    const res = await GET(req(), ctx());
    expect(res.status).toBe(503);
    expect((await res.json()).error).not.toMatch(/connection reset/);
  });

  it("503s when the evidence cannot be loaded", async () => {
    loadEvidenceMock.mockResolvedValue(null);
    expect((await GET(req(), ctx())).status).toBe(503);
  });
});
