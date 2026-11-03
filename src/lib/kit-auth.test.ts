import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { hashApiKey } from "./kit-auth";

const {
  maybeSingleMock,
  updateEqMock,
  insertMock,
  rpcMock,
  fromMock,
  createServiceClientMock,
} = vi.hoisted(() => ({
  maybeSingleMock: vi.fn(),
  updateEqMock: vi.fn(),
  insertMock: vi.fn(),
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
  createServiceClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: createServiceClientMock,
}));

beforeEach(async () => {
  maybeSingleMock.mockReset();
  updateEqMock.mockReset().mockResolvedValue({ error: null });
  insertMock.mockReset().mockResolvedValue({ error: null });
  rpcMock.mockReset().mockResolvedValue({ data: true, error: null });
  fromMock.mockReset().mockImplementation(() => ({
    select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
    update: () => ({ eq: updateEqMock }),
    insert: insertMock,
  }));
  createServiceClientMock
    .mockReset()
    .mockResolvedValue({ from: fromMock, rpc: rpcMock });
});

function req(authorization?: string, ip?: string) {
  const headers: Record<string, string> = {};
  if (authorization) headers.authorization = authorization;
  if (ip) headers["x-forwarded-for"] = ip;
  return new Request("http://localhost/api/v1/checkout", { headers });
}

describe("hashApiKey", () => {
  it("is deterministic and hex-encoded", () => {
    const h = hashApiKey("s3cret");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiKey("s3cret")).toBe(h);
  });
  it("differs for different secrets", () => {
    expect(hashApiKey("a")).not.toBe(hashApiKey("b"));
  });
});

describe("verifyKitAuth", () => {
  it("rate limits by client IP before any lookup", async () => {
    rpcMock.mockResolvedValue({ data: false, error: null });
    const { verifyKitAuth } = await import("./kit-auth");
    expect(
      await verifyKitAuth(req("Bearer qkit:s3cret", "6.6.6.6, 203.0.113.5")),
    ).toBeNull();
    expect(rpcMock).toHaveBeenCalledWith(
      "check_rate_limit",
      expect.objectContaining({ p_key: "kit-auth:203.0.113.5" }),
    );
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects an over-long kit slug without touching the database", async () => {
    const { verifyKitAuth } = await import("./kit-auth");
    expect(
      await verifyKitAuth(req(`Bearer ${"a".repeat(65)}:s3cret`)),
    ).toBeNull();
    expect(maybeSingleMock).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns null with no Authorization header", async () => {
    const { verifyKitAuth } = await import("./kit-auth");
    expect(await verifyKitAuth(req())).toBeNull();
  });

  it("returns null for a malformed bearer token (no kit_slug:secret split)", async () => {
    const { verifyKitAuth } = await import("./kit-auth");
    expect(await verifyKitAuth(req("Bearer justasecret"))).toBeNull();
  });

  it("returns null when the secret half is empty", async () => {
    const { verifyKitAuth } = await import("./kit-auth");
    expect(await verifyKitAuth(req("Bearer qkit:"))).toBeNull();
  });

  it("returns null when the kit_slug is unknown", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { verifyKitAuth } = await import("./kit-auth");
    expect(await verifyKitAuth(req("Bearer qkit:s3cret"))).toBeNull();
  });

  it("returns null when the secret hash does not match", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { secret_hash: hashApiKey("different-secret") },
      error: null,
    });
    const { verifyKitAuth } = await import("./kit-auth");
    expect(await verifyKitAuth(req("Bearer qkit:s3cret"))).toBeNull();
  });

  it("returns the kit slug when the secret hash matches", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { secret_hash: hashApiKey("s3cret") },
      error: null,
    });
    const { verifyKitAuth } = await import("./kit-auth");
    expect(await verifyKitAuth(req("Bearer qkit:s3cret"))).toEqual({
      kitSlug: "qkit",
    });
  });

  it("touches last_used_at for the kit_slug on a successful auth", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { secret_hash: hashApiKey("s3cret") },
      error: null,
    });
    const { verifyKitAuth } = await import("./kit-auth");
    await verifyKitAuth(req("Bearer qkit:s3cret"));
    expect(updateEqMock).toHaveBeenCalledWith("kit_slug", "qkit");
  });

  it("does not touch last_used_at when auth fails", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { verifyKitAuth } = await import("./kit-auth");
    await verifyKitAuth(req("Bearer qkit:s3cret"));
    expect(updateEqMock).not.toHaveBeenCalled();
  });

  it("still returns success even when the last_used_at write fails", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { secret_hash: hashApiKey("s3cret") },
      error: null,
    });
    updateEqMock.mockResolvedValue({ error: { message: "connection reset" } });
    const { verifyKitAuth } = await import("./kit-auth");
    expect(await verifyKitAuth(req("Bearer qkit:s3cret"))).toEqual({
      kitSlug: "qkit",
    });
  });

  describe("failed-auth logging", () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    });
    afterEach(() => {
      warnSpy.mockRestore();
    });

    it("logs a warning with no Authorization header, no secret in the log", async () => {
      const { verifyKitAuth } = await import("./kit-auth");
      await verifyKitAuth(req());
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).not.toContain("s3cret");
    });

    it("logs a warning for a malformed bearer token, no secret in the log", async () => {
      const { verifyKitAuth } = await import("./kit-auth");
      await verifyKitAuth(req("Bearer justasecret"));
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).not.toContain("justasecret");
    });

    it("logs the kit_slug (never the secret) when the kit_slug is unknown", async () => {
      maybeSingleMock.mockResolvedValue({ data: null, error: null });
      const { verifyKitAuth } = await import("./kit-auth");
      await verifyKitAuth(req("Bearer ghostkit:s3cret"));
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain("ghostkit");
      expect(warnSpy.mock.calls[0][0]).not.toContain("s3cret");
    });

    it("logs the kit_slug (never the secret) on a secret mismatch", async () => {
      maybeSingleMock.mockResolvedValue({
        data: { secret_hash: hashApiKey("different-secret") },
        error: null,
      });
      const { verifyKitAuth } = await import("./kit-auth");
      await verifyKitAuth(req("Bearer qkit:s3cret"));
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain("qkit");
      expect(warnSpy.mock.calls[0][0]).not.toContain("s3cret");
    });

    it("does not log anything on a successful auth", async () => {
      maybeSingleMock.mockResolvedValue({
        data: { secret_hash: hashApiKey("s3cret") },
        error: null,
      });
      const { verifyKitAuth } = await import("./kit-auth");
      await verifyKitAuth(req("Bearer qkit:s3cret"));
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe("auth_failures persistence", () => {
    it("inserts a null-kit_slug row with the ip for a missing Authorization header", async () => {
      const { verifyKitAuth } = await import("./kit-auth");
      await verifyKitAuth(req(undefined, "203.0.113.5"));
      expect(insertMock).toHaveBeenCalledWith({
        kit_slug: null,
        reason: "missing/malformed Authorization header",
        ip: "203.0.113.5",
      });
    });

    it("inserts a null-kit_slug row for a malformed bearer token", async () => {
      const { verifyKitAuth } = await import("./kit-auth");
      await verifyKitAuth(req("Bearer justasecret"));
      expect(insertMock).toHaveBeenCalledWith({
        kit_slug: null,
        reason: "malformed bearer token",
        ip: "unknown",
      });
    });

    it("inserts the kit_slug for an unknown kit_slug", async () => {
      maybeSingleMock.mockResolvedValue({ data: null, error: null });
      const { verifyKitAuth } = await import("./kit-auth");
      await verifyKitAuth(req("Bearer ghostkit:s3cret"));
      expect(insertMock).toHaveBeenCalledWith({
        kit_slug: "ghostkit",
        reason: "unknown kit_slug",
        ip: "unknown",
      });
    });

    it("inserts the kit_slug for a secret mismatch", async () => {
      maybeSingleMock.mockResolvedValue({
        data: { secret_hash: hashApiKey("different-secret") },
        error: null,
      });
      const { verifyKitAuth } = await import("./kit-auth");
      await verifyKitAuth(req("Bearer qkit:s3cret"));
      expect(insertMock).toHaveBeenCalledWith({
        kit_slug: "qkit",
        reason: "secret mismatch",
        ip: "unknown",
      });
    });

    it("does not insert anything on a successful auth", async () => {
      maybeSingleMock.mockResolvedValue({
        data: { secret_hash: hashApiKey("s3cret") },
        error: null,
      });
      const { verifyKitAuth } = await import("./kit-auth");
      await verifyKitAuth(req("Bearer qkit:s3cret"));
      expect(insertMock).not.toHaveBeenCalled();
    });

    it("still returns null (never throws) when the auth_failures insert itself fails", async () => {
      insertMock.mockResolvedValue({ error: { message: "connection reset" } });
      const { verifyKitAuth } = await import("./kit-auth");
      expect(await verifyKitAuth(req())).toBeNull();
    });
  });
});
it("keeps failed authentication denied when audit transport rejects", async () => {
  insertMock.mockRejectedValueOnce(new Error("transport failure"));
  const { verifyKitAuth } = await import("./kit-auth");
  await expect(verifyKitAuth(req())).resolves.toBeNull();
});
it("preserves valid authentication when usage telemetry rejects", async () => {
  maybeSingleMock.mockResolvedValue({
    data: { secret_hash: hashApiKey("s3cret") },
    error: null,
  });
  updateEqMock.mockRejectedValueOnce(new Error("transport failure"));
  const { verifyKitAuth } = await import("./kit-auth");
  await expect(verifyKitAuth(req("Bearer qkit:s3cret"))).resolves.toEqual({
    kitSlug: "qkit",
  });
});
