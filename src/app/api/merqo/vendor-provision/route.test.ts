import { describe, it, expect, beforeEach, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(async () => ({ from: fromMock })),
}));

const { recordAuditMock } = vi.hoisted(() => ({
  recordAuditMock: vi.fn(),
}));
vi.mock("@/lib/admin-audit", () => ({
  recordAudit: recordAuditMock,
}));

import { POST } from "@/app/api/merqo/vendor-provision/route";

const USER_ID = "11111111-1111-1111-8111-111111111111";

function req(body: unknown, auth?: string) {
  return new Request("http://localhost/api/merqo/vendor-provision", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: auth } : {}),
    },
    body: JSON.stringify(body),
  });
}

function configTable(
  row: { plan: string } | null,
  error: { message: string } | null = null,
) {
  return () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: row, error }),
      }),
    }),
  });
}

describe("POST /api/merqo/vendor-provision (paykit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MERQO_PROVISION_SECRET = "test-secret";
    recordAuditMock.mockResolvedValue(undefined);
  });

  it("401 when the bearer is missing", async () => {
    const res = await POST(req({ user_id: USER_ID }));
    expect(res.status).toBe(401);
  });

  it("400 on a malformed JSON body", async () => {
    const res = await POST(
      new Request("http://localhost/api/merqo/vendor-provision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-secret",
        },
        body: "{not valid json",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("400 when user_id fails schema validation", async () => {
    const res = await POST(
      req({ user_id: "not-a-uuid" }, "Bearer test-secret"),
    );
    expect(res.status).toBe(400);
  });

  it("reports needs_setup true and never writes to vendor_payment_config, but does audit", async () => {
    fromMock.mockImplementation(configTable(null));
    const res = await POST(req({ user_id: USER_ID }, "Bearer test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      already_existed: false,
      needs_setup: true,
      plan: null,
    });
    // Only ever reads vendor_payment_config once — no insert/update call of
    // any kind, since there is nothing safe to write.
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith("vendor_payment_config");
    expect(recordAuditMock).toHaveBeenCalledWith(
      USER_ID,
      "merqo_vendor_provision",
      USER_ID,
      {
        actor: "merqo_system",
        already_existed: false,
        needs_setup: true,
        plan: null,
      },
    );
  });

  it("reports needs_setup false with the real plan when a config row already exists, and audits it", async () => {
    fromMock.mockImplementation(configTable({ plan: "pro" }));
    const res = await POST(req({ user_id: USER_ID }, "Bearer test-secret"));
    expect(await res.json()).toEqual({
      ok: true,
      already_existed: true,
      needs_setup: false,
      plan: "pro",
    });
    expect(recordAuditMock).toHaveBeenCalledWith(
      USER_ID,
      "merqo_vendor_provision",
      USER_ID,
      {
        actor: "merqo_system",
        already_existed: true,
        needs_setup: false,
        plan: "pro",
      },
    );
  });

  it("500 when the config read errors, and never audits", async () => {
    fromMock.mockImplementation(configTable(null, { message: "boom" }));
    const res = await POST(req({ user_id: USER_ID }, "Bearer test-secret"));
    expect(res.status).toBe(500);
    expect(recordAuditMock).not.toHaveBeenCalled();
  });
});
