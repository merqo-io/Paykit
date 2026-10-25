import { describe, it, expect, vi, beforeEach } from "vitest";

const { fromMock, getUserMock, getAalMock, redirectMock, notFoundMock } =
  vi.hoisted(() => ({
    fromMock: vi.fn(),
    getUserMock: vi.fn(),
    getAalMock: vi.fn(),
    redirectMock: vi.fn((path: string) => {
      throw new Error(`REDIRECT ${path}`);
    }),
    notFoundMock: vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
    }),
  }));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({
    from: fromMock,
    auth: {
      getUser: getUserMock,
      mfa: { getAuthenticatorAssuranceLevel: getAalMock },
    },
  })),
}));
vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}));

import { isAdmin, requireAdmin, requireAdminMember } from "@/lib/admin";

const aal = (currentLevel: string, nextLevel = "aal2") => ({
  data: { currentLevel, nextLevel },
  error: null,
});

function builder(data: unknown) {
  const b: Record<string, unknown> = {
    select: vi.fn(() => b),
    eq: vi.fn(() => b),
    maybeSingle: () => Promise.resolve({ data, error: null }),
  };
  return b;
}

describe("isAdmin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("true when the admins table returns a row", async () => {
    fromMock.mockReturnValue(builder({ user_id: "u1" }));
    expect(await isAdmin("u1")).toBe(true);
  });

  it("false when the admins table returns no row (RLS hides it from a non-admin)", async () => {
    fromMock.mockReturnValue(builder(null));
    expect(await isAdmin("u1")).toBe(false);
  });
});

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAalMock.mockResolvedValue(aal("aal2"));
  });

  it("returns the user when signed in and an admin", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    fromMock.mockReturnValue(builder({ user_id: "u1" }));

    const result = await requireAdmin();

    expect(result).toEqual({ user: { id: "u1" } });
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("404s when signed out", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    await expect(requireAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("404s when signed in but not an admin", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    fromMock.mockReturnValue(builder(null));
    await expect(requireAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("sends a password-only (aal1) admin to the MFA page", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    fromMock.mockReturnValue(builder({ user_id: "u1" }));
    getAalMock.mockResolvedValue(aal("aal1"));
    await expect(requireAdmin()).rejects.toThrow("REDIRECT /mfa");
  });

  it("sends an admin with no factor enrolled to the MFA page", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    fromMock.mockReturnValue(builder({ user_id: "u1" }));
    getAalMock.mockResolvedValue(aal("aal1", "aal1"));
    await expect(requireAdmin()).rejects.toThrow("REDIRECT /mfa");
  });

  it("fails closed when the assurance level cannot be read", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    fromMock.mockReturnValue(builder({ user_id: "u1" }));
    getAalMock.mockResolvedValue({ data: null, error: { message: "down" } });
    await expect(requireAdmin()).rejects.toThrow("REDIRECT /mfa");
  });

  it("keeps a non-admin on a 404 before any MFA prompt", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    fromMock.mockReturnValue(builder(null));
    await expect(requireAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getAalMock).not.toHaveBeenCalled();
  });
});

describe("requireAdminMember", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lets the MFA page check admin membership without aal2", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    fromMock.mockReturnValue(builder({ user_id: "u1" }));
    getAalMock.mockResolvedValue(aal("aal1"));
    expect(await requireAdminMember()).toEqual({ user: { id: "u1" } });
  });
});
