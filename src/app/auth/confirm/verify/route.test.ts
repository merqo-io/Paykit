import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyOtpMock, createServerClientMock } = vi.hoisted(() => ({
  verifyOtpMock: vi.fn(),
  createServerClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: createServerClientMock,
}));

import * as routeModule from "./route";
import { POST } from "./route";

function post(
  fields: Record<string, string>,
  headers: Record<string, string> = { origin: "http://localhost" },
) {
  return new Request("http://localhost/auth/confirm/verify", {
    method: "POST",
    headers,
    body: new URLSearchParams(fields),
  });
}

beforeEach(() => {
  verifyOtpMock.mockReset().mockResolvedValue({ data: {}, error: null });
  createServerClientMock
    .mockReset()
    .mockReturnValue({ auth: { verifyOtp: verifyOtpMock } });
});

describe("POST /auth/confirm/verify", () => {
  it("verifies the token and lands on /dashboard by default", async () => {
    const res = await POST(post({ token_hash: "abc", type: "signup" }));

    expect(verifyOtpMock).toHaveBeenCalledWith({
      token_hash: "abc",
      type: "signup",
    });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost/dashboard");
  });

  it("follows a safe next path", async () => {
    const res = await POST(
      post({ token_hash: "abc", type: "magiclink", next: "/dashboard/plan" }),
    );

    expect(res.headers.get("location")).toBe("http://localhost/dashboard/plan");
  });

  it("sends a recovery link to /dashboard/profile", async () => {
    const res = await POST(
      post({ token_hash: "abc", type: "recovery", next: "/dashboard/plan" }),
    );

    expect(res.headers.get("location")).toBe(
      "http://localhost/dashboard/profile",
    );
  });

  it("goes to /login?error=link when verification fails", async () => {
    verifyOtpMock.mockResolvedValue({ data: null, error: new Error("bad") });

    const res = await POST(post({ token_hash: "abc", type: "signup" }));

    expect(res.headers.get("location")).toBe(
      "http://localhost/login?error=link",
    );
  });

  it("rejects a cross-origin POST without verifying", async () => {
    const res = await POST(
      post(
        { token_hash: "abc", type: "signup" },
        { origin: "https://evil.example" },
      ),
    );

    expect(verifyOtpMock).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe(
      "http://localhost/login?error=link",
    );
  });

  it("exports no GET handler", () => {
    expect("GET" in routeModule).toBe(false);
  });
});
