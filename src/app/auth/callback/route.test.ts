import { describe, it, expect, vi, beforeEach } from "vitest";

const { exchangeCodeForSessionMock, createServerClientMock } = vi.hoisted(
  () => ({
    exchangeCodeForSessionMock: vi.fn(),
    createServerClientMock: vi.fn(),
  }),
);

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: createServerClientMock,
}));

beforeEach(() => {
  exchangeCodeForSessionMock.mockReset();
  createServerClientMock.mockReset().mockResolvedValue({
    auth: { exchangeCodeForSession: exchangeCodeForSessionMock },
  });
});

function req(url: string) {
  return new Request(url);
}

describe("GET /auth/callback", () => {
  it("redirects to /login?error=oauth when no code param is present", async () => {
    const { GET } = await import("./route");
    const res = await GET(req("http://localhost/auth/callback"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost/login?error=oauth",
    );
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it("redirects to /dashboard by default on a successful exchange", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
    const { GET } = await import("./route");
    const res = await GET(req("http://localhost/auth/callback?code=abc"));
    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("abc");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/dashboard");
  });

  it("redirects to a safe relative ?next= path on success", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
    const { GET } = await import("./route");
    const res = await GET(
      req("http://localhost/auth/callback?code=abc&next=/settings"),
    );
    expect(res.headers.get("location")).toBe("http://localhost/settings");
  });

  it("falls back to /dashboard when ?next= is a protocol-relative open redirect (//evil.com)", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
    const { GET } = await import("./route");
    const res = await GET(
      req("http://localhost/auth/callback?code=abc&next=//evil.com"),
    );
    expect(res.headers.get("location")).toBe("http://localhost/dashboard");
  });

  it("falls back to /dashboard when ?next= is an absolute URL", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
    const { GET } = await import("./route");
    const res = await GET(
      req(
        "http://localhost/auth/callback?code=abc&next=" +
          encodeURIComponent("https://evil.com"),
      ),
    );
    expect(res.headers.get("location")).toBe("http://localhost/dashboard");
  });

  it.each([
    "/\t/evil.com",
    "/\n/evil.com",
    "/%2F%2Fevil.com",
    "/\\evil.com",
    "/%5Cevil.com",
  ])("falls back to /dashboard for hostile ?next= %j", async (hostile) => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
    const { GET } = await import("./route");
    const res = await GET(
      req(
        `http://localhost/auth/callback?code=abc&next=${encodeURIComponent(hostile)}`,
      ),
    );
    expect(res.headers.get("location")).toBe("http://localhost/dashboard");
  });

  it("keeps a double-encoded return_to inside ?next= as a same-origin path", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
    const { GET } = await import("./route");
    const next = `/dashboard/config?return_to=${encodeURIComponent("https://qkit.merqo.io/dashboard/booths/b1/qr")}`;
    const res = await GET(
      req(
        `http://localhost/auth/callback?code=abc&next=${encodeURIComponent(next)}`,
      ),
    );
    expect(res.headers.get("location")).toBe(`http://localhost${next}`);
  });

  it("redirects to /login?error=oauth when the code exchange fails", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      error: { message: "invalid code" },
    });
    const { GET } = await import("./route");
    const res = await GET(req("http://localhost/auth/callback?code=bad"));
    expect(res.headers.get("location")).toBe(
      "http://localhost/login?error=oauth",
    );
  });

  it("rejects an oversized authorization code without calling Supabase", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      req(`http://localhost/auth/callback?code=${"a".repeat(513)}`),
    );
    expect(res.headers.get("location")).toBe(
      "http://localhost/login?error=oauth",
    );
    expect(createServerClientMock).not.toHaveBeenCalled();
  });
});
