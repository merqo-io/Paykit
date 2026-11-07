import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  conditionalTransition,
  noBody,
  runTransition,
  type TransitionContext,
} from "./payment-transition";
import { confirmTransition } from "./tx-state";
import type { Transaction } from "./types";

const { verifyKitAuthMock, auditMock, callbackMock, readMock, updateMock } =
  vi.hoisted(() => ({
    verifyKitAuthMock: vi.fn(),
    auditMock: vi.fn(),
    callbackMock: vi.fn(),
    readMock: vi.fn(),
    updateMock: vi.fn(),
  }));

vi.mock("@/lib/kit-auth", () => ({ verifyKitAuth: verifyKitAuthMock }));
vi.mock("@/lib/payment-audit", () => ({ recordPaymentAudit: auditMock }));
vi.mock("@/lib/kit-callback", () => ({
  schedulePaymentStatusCallback: callbackMock,
}));
vi.mock("@/lib/rate-limit", () => ({
  clientIp: () => "203.0.113.5",
  PER_ROUTE_LIMIT: 60,
  PER_ROUTE_WINDOW_SECONDS: 60,
}));

const supabase = {
  from: () => {
    const c = {
      select: () => c,
      update: () => c,
      eq: () => c,
      in: () => c,
      maybeSingle: readMock,
      single: updateMock,
    };
    return c;
  },
};
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: async () => supabase,
}));

const ID = "22222222-2222-2222-8222-222222222222";
const ROW = { id: ID, kit_slug: "qkit", status: "claimed" } as Transaction;
const params = Promise.resolve({ id: ID });
const request = new Request("http://localhost/x", { method: "POST" });

const limiter = vi.fn();
const apply = vi.fn();
const spec = { action: "test", limiter, readBody: noBody, apply };

beforeEach(() => {
  verifyKitAuthMock.mockReset().mockResolvedValue({ kitSlug: "qkit" });
  limiter.mockReset().mockResolvedValue(true);
  apply.mockReset().mockResolvedValue(new Response("applied"));
  readMock.mockReset().mockResolvedValue({ data: ROW, error: null });
  updateMock.mockReset();
  auditMock.mockReset();
  callbackMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("runTransition", () => {
  it("hands the scoped row to apply", async () => {
    const res = await runTransition(request, params, spec);
    expect(await res.text()).toBe("applied");
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({ kitSlug: "qkit", id: ID, current: ROW }),
    );
  });

  it("keys the limiter by action, kit and address", async () => {
    await runTransition(request, params, spec);
    expect(limiter).toHaveBeenCalledWith(
      supabase,
      "test:qkit:203.0.113.5",
      60,
      60,
    );
  });

  it("401s before touching anything else", async () => {
    verifyKitAuthMock.mockResolvedValue(null);
    const res = await runTransition(request, params, spec);
    expect(res.status).toBe(401);
    expect(limiter).not.toHaveBeenCalled();
  });

  it("429s when limited", async () => {
    limiter.mockResolvedValue(false);
    const res = await runTransition(request, params, spec);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "Too many requests" });
    expect(readMock).not.toHaveBeenCalled();
  });

  it("400s for a non-uuid id", async () => {
    const res = await runTransition(
      request,
      Promise.resolve({ id: "nope" }),
      spec,
    );
    expect(res.status).toBe(400);
    expect(readMock).not.toHaveBeenCalled();
  });

  it("returns the body reader's refusal before reading the row", async () => {
    const res = await runTransition(request, params, {
      ...spec,
      readBody: async () => ({ ok: false, error: "too big", status: 413 }),
    });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "too big" });
    expect(readMock).not.toHaveBeenCalled();
  });

  it("passes the body through to apply", async () => {
    await runTransition(request, params, {
      ...spec,
      readBody: async () => ({ ok: true, body: "payload" }),
    });
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({ body: "payload" }),
    );
  });

  it("503s and logs when the read fails", async () => {
    readMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await runTransition(request, params, spec);
    expect(res.status).toBe(503);
    expect(console.error).toHaveBeenCalledWith("test: read failed", "boom");
    expect(apply).not.toHaveBeenCalled();
  });

  it("404s for a missing row", async () => {
    readMock.mockResolvedValue({ data: null, error: null });
    expect((await runTransition(request, params, spec)).status).toBe(404);
    expect(apply).not.toHaveBeenCalled();
  });
});

describe("conditionalTransition", () => {
  const run = conditionalTransition({
    transition: confirmTransition,
    from: ["pending", "claimed"],
    patch: (status) => ({ status }),
    audit: "confirmed",
  });
  const ctx = (current: Transaction): TransitionContext<undefined> => ({
    supabase: supabase as unknown as TransitionContext<undefined>["supabase"],
    kitSlug: "qkit",
    id: ID,
    current,
    body: undefined,
  });

  it("returns the row untouched when nothing changes", async () => {
    const res = await run(ctx({ ...ROW, status: "confirmed" }));
    expect(res.status).toBe(200);
    expect(updateMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("audits, schedules the callback and returns the updated row", async () => {
    const updated = { ...ROW, status: "confirmed" };
    updateMock.mockResolvedValue({ data: updated, error: null });
    const res = await run(ctx(ROW));
    expect((await res.json()).status).toBe("confirmed");
    expect(auditMock).toHaveBeenCalledWith(supabase, {
      transactionId: ID,
      kitSlug: "qkit",
      action: "confirmed",
    });
    expect(callbackMock).toHaveBeenCalledWith(updated);
  });

  it("returns the winner's row after a lost write, without side effects", async () => {
    updateMock.mockResolvedValue({ data: null, error: null });
    readMock.mockResolvedValue({
      data: { ...ROW, status: "confirmed" },
      error: null,
    });
    const res = await run(ctx(ROW));
    expect((await res.json()).status).toBe("confirmed");
    expect(auditMock).not.toHaveBeenCalled();
    expect(callbackMock).not.toHaveBeenCalled();
  });

  it("404s when the row vanished", async () => {
    updateMock.mockResolvedValue({ data: null, error: null });
    readMock.mockResolvedValue({ data: null, error: null });
    expect((await run(ctx(ROW))).status).toBe(404);
  });

  it("503s when the row is unchanged or the recheck fails", async () => {
    updateMock.mockResolvedValue({ data: null, error: { message: "x" } });
    expect((await run(ctx(ROW))).status).toBe(503);
    readMock.mockResolvedValue({ data: null, error: { message: "y" } });
    expect((await run(ctx(ROW))).status).toBe(503);
  });
});
