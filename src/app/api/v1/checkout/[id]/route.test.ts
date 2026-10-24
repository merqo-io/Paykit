import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const { verifyKitAuthMock, maybeSingleMock, createServiceClientMock } =
  vi.hoisted(() => ({
    verifyKitAuthMock: vi.fn(),
    maybeSingleMock: vi.fn(),
    createServiceClientMock: vi.fn(),
  }));

vi.mock("@/lib/kit-auth", () => ({ verifyKitAuth: verifyKitAuthMock }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: createServiceClientMock,
}));

const TX_ID = "22222222-2222-2222-8222-222222222222";

beforeEach(() => {
  verifyKitAuthMock.mockReset().mockResolvedValue({ kitSlug: "qkit" });
  createServiceClientMock.mockReset().mockResolvedValue({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
    }),
  });
  maybeSingleMock.mockReset().mockResolvedValue({
    data: {
      id: TX_ID,
      status: "confirmed",
      amount_cents: 450,
      order_ref: "A-001",
      kit_slug: "qkit",
      claimed_at: "2026-07-15T00:01:00Z",
      confirmed_at: "2026-07-15T00:02:00Z",
      created_at: "2026-07-15T00:00:00Z",
    },
    error: null,
  });
});

function req() {
  return new Request(`http://localhost/api/v1/checkout/${TX_ID}`, {
    headers: { authorization: "Bearer qkit:secret" },
  });
}
function ctx(id: string = TX_ID) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/v1/checkout/[id]", () => {
  it("returns the current status", async () => {
    const res = await GET(req(), ctx());
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("confirmed");
  });
  it("401s when unauthorized", async () => {
    verifyKitAuthMock.mockResolvedValue(null);
    expect((await GET(req(), ctx())).status).toBe(401);
  });
  it("404s for an unknown transaction", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    expect((await GET(req(), ctx())).status).toBe(404);
  });
  it("400s for a malformed (non-uuid) id, without querying the DB", async () => {
    const res = await GET(req(), ctx("not-a-uuid"));
    expect(res.status).toBe(400);
    expect(maybeSingleMock).not.toHaveBeenCalled();
  });
  it("503s when the DB read fails", async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: "connection reset" },
    });
    const res = await GET(req(), ctx());
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).not.toMatch(/connection reset/);
  });
});
