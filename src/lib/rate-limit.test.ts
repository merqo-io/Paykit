import { beforeEach, describe, expect, it, vi } from "vitest";
import { clientIp, rateLimit, rateLimitStrict } from "./rate-limit";

function hdrs(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe("clientIp", () => {
  it("prefers x-vercel-forwarded-for over every other header", () => {
    expect(
      clientIp(
        hdrs({
          "x-vercel-forwarded-for": "198.51.100.9",
          "x-real-ip": "198.51.100.7",
          "x-forwarded-for": "6.6.6.6, 203.0.113.5",
        }),
      ),
    ).toBe("198.51.100.9");
  });

  it("uses x-real-ip before x-forwarded-for", () => {
    expect(
      clientIp(
        hdrs({ "x-real-ip": "198.51.100.7", "x-forwarded-for": "6.6.6.6" }),
      ),
    ).toBe("198.51.100.7");
  });

  it("ignores a spoofed first x-forwarded-for hop and takes the last", () => {
    expect(clientIp(hdrs({ "x-forwarded-for": "6.6.6.6, 70.41.3.18" }))).toBe(
      "70.41.3.18",
    );
  });

  it("trims whitespace around the last hop", () => {
    expect(
      clientIp(hdrs({ "x-forwarded-for": "6.6.6.6 ,  70.41.3.18  " })),
    ).toBe("70.41.3.18");
  });

  it("falls back to x-forwarded-for when x-real-ip is empty", () => {
    expect(
      clientIp(hdrs({ "x-forwarded-for": "70.41.3.18", "x-real-ip": "" })),
    ).toBe("70.41.3.18");
  });

  it("returns 'unknown' when no header is present", () => {
    expect(clientIp(hdrs({}))).toBe("unknown");
  });
});

function supabaseStub(data: unknown, error: unknown = null) {
  return {
    rpc: vi.fn(() => Promise.resolve({ data, error })),
  } as unknown as Parameters<typeof rateLimit>[0];
}

describe("rateLimit", () => {
  it("calls check_rate_limit with the given key/limit/window", async () => {
    const supabase = supabaseStub(true);
    await rateLimit(supabase, "checkout:qkit:1.2.3.4", 60, 60);
    expect(supabase.rpc).toHaveBeenCalledWith("check_rate_limit", {
      p_key: "checkout:qkit:1.2.3.4",
      p_limit: 60,
      p_window_seconds: 60,
    });
  });

  it("returns true when the limiter allows the call", async () => {
    const supabase = supabaseStub(true);
    await expect(rateLimit(supabase, "k", 1, 1)).resolves.toBe(true);
  });

  it("returns false when the limiter denies the call", async () => {
    const supabase = supabaseStub(false);
    await expect(rateLimit(supabase, "k", 1, 1)).resolves.toBe(false);
  });

  it("fails open (returns true) when the limiter errors", async () => {
    const supabase = supabaseStub(null, { message: "connection reset" });
    await expect(rateLimit(supabase, "k", 1, 1)).resolves.toBe(true);
  });
});

it("preserves fail-open policy when limiter transport rejects", async () => {
  const client = {
    rpc: vi.fn().mockRejectedValue(new Error("network")),
  } as unknown as Parameters<typeof rateLimit>[0];
  await expect(rateLimit(client, "key", 1, 1)).resolves.toBe(true);
});

describe("rateLimitStrict", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("denies when the limiter returns an error", async () => {
    const supabase = supabaseStub(null, { message: "down" });
    await expect(rateLimitStrict(supabase, "k", 1, 1)).resolves.toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  it("denies when the limiter transport rejects", async () => {
    const client = {
      rpc: vi.fn().mockRejectedValue(new Error("network")),
    } as unknown as Parameters<typeof rateLimit>[0];
    await expect(rateLimitStrict(client, "k", 1, 1)).resolves.toBe(false);
  });

  it("still allows when the limiter says yes", async () => {
    await expect(rateLimitStrict(supabaseStub(true), "k", 1, 1)).resolves.toBe(
      true,
    );
  });

  it("logs the error when failing open", async () => {
    const supabase = supabaseStub(null, { message: "down" });
    await expect(rateLimit(supabase, "k", 1, 1)).resolves.toBe(true);
    expect(console.error).toHaveBeenCalled();
  });
});
