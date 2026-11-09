import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { drainMock, client } = vi.hoisted(() => ({
  drainMock: vi.fn(),
  client: { marker: "service-client" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(async () => client),
}));
vi.mock("@/lib/proof-storage-cleanup", () => ({
  drainProofDeletions: drainMock,
}));

import { GET } from "@/app/api/cron/proof-storage-drain/route";

function req(auth?: string) {
  return new Request("http://localhost/api/cron/proof-storage-drain", {
    headers: auth ? { Authorization: auth } : {},
  });
}

describe("GET /api/cron/proof-storage-drain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret";
    drainMock.mockResolvedValue({ removed: 2, failed: 0 });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("returns 401 without an Authorization header", async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(drainMock).not.toHaveBeenCalled();
  });

  it("returns 401 for a wrong secret", async () => {
    const res = await GET(req("Bearer wrong-secret"));
    expect(res.status).toBe(401);
    expect(drainMock).not.toHaveBeenCalled();
  });

  it("returns 401 when CRON_SECRET is unset, even for an empty bearer", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(req("Bearer "));
    expect(res.status).toBe(401);
    expect(drainMock).not.toHaveBeenCalled();
  });

  it("drains the queue and returns the result for the right secret", async () => {
    const res = await GET(req("Bearer cron-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ removed: 2, failed: 0 });
    expect(drainMock).toHaveBeenCalledWith(client);
  });

  it("returns a JSON 500 when the service client cannot be created", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { createServiceClient } = await import("@/lib/supabase/server");
    vi.mocked(createServiceClient).mockRejectedValueOnce(new Error("no env"));
    const res = await GET(req("Bearer cron-secret"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Drain unavailable" });
  });
});
