import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const {
  verifyKitAuthMock,
  readMaybeSingle,
  updateSingle,
  auditInsert,
  rateLimitMock,
  createServiceClientMock,
} = vi.hoisted(() => ({
  verifyKitAuthMock: vi.fn(),
  readMaybeSingle: vi.fn(),
  updateSingle: vi.fn(),
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
  PER_ROUTE_LIMIT: 60,
  PER_ROUTE_WINDOW_SECONDS: 60,
  rateLimit: rateLimitMock,
}));

const { scheduleCallbackMock } = vi.hoisted(() => ({
  scheduleCallbackMock: vi.fn(),
}));
vi.mock("@/lib/kit-callback", () => ({
  schedulePaymentStatusCallback: scheduleCallbackMock,
}));
beforeEach(() => {
  scheduleCallbackMock.mockReset();
});

const TX_ID = "22222222-2222-2222-2222-222222222222";

const ROW = {
  id: TX_ID,
  status: "pending",
  amount_cents: 450,
  order_ref: "A-001",
  kit_slug: "qkit",
  claimed_at: null,
  confirmed_at: null,
  created_at: "2026-07-15T00:00:00Z",
};

function fakeSupabase() {
  return {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: readMaybeSingle }) }),
      update: () => ({
        eq: () => ({
          eq: () => ({ select: () => ({ single: updateSingle }) }),
        }),
      }),
      insert: auditInsert,
    }),
  };
}

beforeEach(() => {
  verifyKitAuthMock.mockReset().mockResolvedValue({ kitSlug: "qkit" });
  createServiceClientMock.mockReset().mockResolvedValue(fakeSupabase());
  readMaybeSingle.mockReset().mockResolvedValue({ data: ROW, error: null });
  updateSingle.mockReset().mockResolvedValue({
    data: { ...ROW, status: "claimed", claimed_at: "2026-07-15T00:01:00Z" },
    error: null,
  });
  auditInsert.mockReset().mockResolvedValue({ error: null });
  rateLimitMock.mockReset().mockResolvedValue(true);
});

function req() {
  return new Request(`http://localhost/api/v1/checkout/${TX_ID}/claim`, {
    method: "POST",
    headers: { authorization: "Bearer qkit:secret" },
  });
}
function ctx(id: string = TX_ID) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/v1/checkout/[id]/claim", () => {
  it("claims a pending transaction", async () => {
    const res = await POST(req(), ctx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("claimed");
    expect(json.claimed_at).toBe("2026-07-15T00:01:00Z");
    expect(auditInsert).toHaveBeenCalledWith({
      transaction_id: TX_ID,
      kit_slug: "qkit",
      action: "claimed",
      detail: null,
    });
  });

  it("is idempotent on an already-claimed transaction (no update call, no audit row)", async () => {
    readMaybeSingle.mockResolvedValue({
      data: { ...ROW, status: "claimed" },
      error: null,
    });
    const res = await POST(req(), ctx());
    expect(res.status).toBe(200);
    expect(updateSingle).not.toHaveBeenCalled();
    expect(auditInsert).not.toHaveBeenCalled();
  });

  it("401s when unauthorized", async () => {
    verifyKitAuthMock.mockResolvedValue(null);
    expect((await POST(req(), ctx())).status).toBe(401);
  });

  it("429s when the rate limit is exceeded, without querying the DB", async () => {
    rateLimitMock.mockResolvedValue(false);
    const res = await POST(req(), ctx());
    expect(res.status).toBe(429);
    expect(readMaybeSingle).not.toHaveBeenCalled();
  });

  it("404s for an unknown transaction", async () => {
    readMaybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await POST(req(), ctx())).status).toBe(404);
  });

  it("400s for a malformed (non-uuid) id, without querying the DB", async () => {
    const res = await POST(req(), ctx("not-a-uuid"));
    expect(res.status).toBe(400);
    expect(readMaybeSingle).not.toHaveBeenCalled();
  });

  it("503s when the initial DB read fails", async () => {
    readMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "connection reset" },
    });
    const res = await POST(req(), ctx());
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).not.toMatch(/connection reset/);
  });

  it("lost the race (already claimed by a concurrent request): recheck returns the current state, not a 4xx/5xx", async () => {
    readMaybeSingle
      .mockReset()
      .mockResolvedValueOnce({ data: ROW, error: null }) // initial read: pending
      .mockResolvedValueOnce({
        data: { ...ROW, status: "claimed", claimed_at: "2026-07-15T00:01:00Z" },
        error: null,
      }); // recheck: someone else already claimed it
    updateSingle.mockResolvedValue({
      data: null,
      error: { message: "no rows matched the conditional update" },
    });
    const res = await POST(req(), ctx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("claimed");
    expect(readMaybeSingle).toHaveBeenCalledTimes(2);
    expect(auditInsert).not.toHaveBeenCalled();
  });

  it("row was deleted between the read and the conditional update: recheck 404s", async () => {
    readMaybeSingle
      .mockReset()
      .mockResolvedValueOnce({ data: ROW, error: null }) // initial read: pending
      .mockResolvedValueOnce({ data: null, error: null }); // recheck: gone
    updateSingle.mockResolvedValue({
      data: null,
      error: { message: "no rows matched the conditional update" },
    });
    const res = await POST(req(), ctx());
    expect(res.status).toBe(404);
  });
});

it("returns 503 when a failed update leaves the transaction unchanged", async () => {
  updateSingle.mockResolvedValue({
    data: null,
    error: { message: "database unavailable" },
  });
  const response = await POST(req(), ctx());
  expect(response.status).toBe(503);
  expect(auditInsert).not.toHaveBeenCalled();
});
it("returns 503 when the race recheck itself fails", async () => {
  readMaybeSingle
    .mockResolvedValueOnce({ data: ROW, error: null })
    .mockResolvedValueOnce({
      data: null,
      error: { message: "database unavailable" },
    });
  updateSingle.mockResolvedValue({
    data: null,
    error: { message: "conditional update returned no row" },
  });
  expect((await POST(req(), ctx())).status).toBe(503);
});

describe("payment-status callback on claim", () => {
  const CLAIMED = {
    ...ROW,
    status: "claimed",
    claimed_at: "2026-07-15T00:01:00Z",
  };

  it("schedules one callback with the updated row after a real claim", async () => {
    updateSingle.mockResolvedValue({ data: CLAIMED, error: null });
    const res = await POST(req(), ctx());
    expect(res.status).toBe(200);
    expect(scheduleCallbackMock).toHaveBeenCalledTimes(1);
    expect(scheduleCallbackMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: TX_ID,
        kit_slug: "qkit",
        order_ref: "A-001",
        status: "claimed",
      }),
    );
  });

  it("schedules nothing for an idempotent no-op", async () => {
    readMaybeSingle.mockResolvedValue({ data: CLAIMED, error: null });
    await POST(req(), ctx());
    expect(scheduleCallbackMock).not.toHaveBeenCalled();
  });

  it("schedules nothing when a concurrent request won the race", async () => {
    readMaybeSingle
      .mockReset()
      .mockResolvedValueOnce({ data: ROW, error: null })
      .mockResolvedValueOnce({ data: CLAIMED, error: null });
    updateSingle.mockResolvedValue({
      data: null,
      error: { message: "no rows matched the conditional update" },
    });
    const res = await POST(req(), ctx());
    expect(res.status).toBe(200);
    expect(scheduleCallbackMock).not.toHaveBeenCalled();
  });

  it("schedules nothing when the update fails", async () => {
    updateSingle.mockResolvedValue({
      data: null,
      error: { message: "database unavailable" },
    });
    const res = await POST(req(), ctx());
    expect(res.status).toBe(503);
    expect(scheduleCallbackMock).not.toHaveBeenCalled();
  });

  it("schedules nothing when unauthorized or rate limited", async () => {
    verifyKitAuthMock.mockResolvedValue(null);
    await POST(req(), ctx());
    verifyKitAuthMock.mockResolvedValue({ kitSlug: "qkit" });
    rateLimitMock.mockResolvedValue(false);
    await POST(req(), ctx());
    expect(scheduleCallbackMock).not.toHaveBeenCalled();
  });
});
