import { describe, it, expect, beforeEach, vi } from "vitest";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(async () => ({ rpc: rpcMock })),
}));

import { POST } from "@/app/api/merqo/entitlement/route";

const payload = {
  email: "vendor@business.sg",
  kit: "paykit",
  tier: "paid",
  founder: false,
  stats_window: "90d",
  event_pass: {
    starts_at: "2026-06-01T00:00:00Z",
    ends_at: "2026-06-03T00:00:00Z",
  },
  valid_until: "2026-12-01T00:00:00Z",
  issued_at: "2026-06-01T00:00:00Z",
};

function req(body: unknown, auth?: string) {
  return new Request("http://localhost/api/merqo/entitlement", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: auth } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/merqo/entitlement (paykit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MERQO_PROVISION_SECRET = "test-secret";
    rpcMock.mockResolvedValue({ data: "stored", error: null });
  });

  it("401 when the bearer is missing", async () => {
    expect((await POST(req(payload))).status).toBe(401);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("401 when the bearer is wrong", async () => {
    expect((await POST(req(payload, "Bearer nope"))).status).toBe(401);
  });

  it("401 when only the metrics secret is presented", async () => {
    process.env.MERQO_METRICS_SECRET = "metrics-secret";
    expect((await POST(req(payload, "Bearer metrics-secret"))).status).toBe(
      401,
    );
  });

  it("400 on a malformed JSON body", async () => {
    const res = await POST(req("{not json", "Bearer test-secret"));
    expect(res.status).toBe(400);
  });

  it("400 on a body that fails the contract", async () => {
    const res = await POST(
      req({ ...payload, tier: "gold" }, "Bearer test-secret"),
    );
    expect(res.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("400 when the tier is not valid for this kit's contract", async () => {
    const res = await POST(
      req({ ...payload, tier: "starter" }, "Bearer test-secret"),
    );
    expect(res.status).toBe(400);
  });

  it("400 when the payload is for another kit", async () => {
    const res = await POST(
      req({ ...payload, kit: "stockkit" }, "Bearer test-secret"),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "wrong_kit" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("404 unknown_vendor when no user matches the email", async () => {
    rpcMock.mockResolvedValue({ data: "unknown_vendor", error: null });
    const res = await POST(req(payload, "Bearer test-secret"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: "unknown_vendor" });
  });

  it("200 and passes every field to the atomic upsert", async () => {
    const res = await POST(req(payload, "Bearer test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(rpcMock).toHaveBeenCalledWith("apply_vendor_entitlement", {
      p_email: "vendor@business.sg",
      p_tier: "paid",
      p_founder: false,
      p_stats_window: "90d",
      p_event_pass_starts_at: "2026-06-01T00:00:00Z",
      p_event_pass_ends_at: "2026-06-03T00:00:00Z",
      p_valid_until: "2026-12-01T00:00:00Z",
      p_issued_at: "2026-06-01T00:00:00Z",
    });
  });

  it("sends null event pass columns when there is no pass", async () => {
    await POST(req({ ...payload, event_pass: null }, "Bearer test-secret"));
    expect(rpcMock).toHaveBeenCalledWith(
      "apply_vendor_entitlement",
      expect.objectContaining({
        p_event_pass_starts_at: null,
        p_event_pass_ends_at: null,
      }),
    );
  });

  it("200 as a no-op when the database reports a stale push", async () => {
    rpcMock.mockResolvedValue({ data: "stale", error: null });
    const res = await POST(req(payload, "Bearer test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("500 when the store fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await POST(req(payload, "Bearer test-secret"));
    expect(res.status).toBe(500);
    spy.mockRestore();
  });
});
