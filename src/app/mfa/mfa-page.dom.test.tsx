// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  requireAdminMember: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
  getLevel: vi.fn(),
  listFactors: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/admin", () => ({
  requireAdminMember: mocks.requireAdminMember,
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: mocks.getLevel,
        listFactors: mocks.listFactors,
      },
    },
  }),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

import MfaPage from "./page";

describe("MfaPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminMember.mockResolvedValue({ user: {} });
    mocks.getLevel.mockResolvedValue({ data: { currentLevel: "aal1" } });
    mocks.listFactors.mockResolvedValue({
      data: { totp: [{ id: "f1" }], all: [] },
    });
  });

  it("shows the two-step heading for an admin on aal1", async () => {
    render(await MfaPage());
    expect(
      screen.getByRole("heading", { level: 1, name: "Two-step sign-in" }),
    ).toBeInTheDocument();
  });

  it("sends an admin who is already aal2 on to /admin", async () => {
    mocks.getLevel.mockResolvedValue({ data: { currentLevel: "aal2" } });
    await expect(MfaPage()).rejects.toThrow("REDIRECT /admin");
  });

  it("stops at the membership gate for non-admins", async () => {
    mocks.requireAdminMember.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(MfaPage()).rejects.toThrow("NOT_FOUND");
    expect(mocks.getLevel).not.toHaveBeenCalled();
  });
});
