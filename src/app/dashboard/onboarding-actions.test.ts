import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getUserMock,
  upsertMock,
  maybeSingleMock,
  fromMock,
  createServerClientMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  upsertMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  fromMock: vi.fn(),
  createServerClientMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: createServerClientMock,
}));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import {
  dismissOnboarding,
  markQrPreviewed,
  reopenOnboarding,
} from "./onboarding-actions";

beforeEach(() => {
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: "v1" } } });
  upsertMock.mockReset().mockResolvedValue({ error: null });
  maybeSingleMock.mockReset().mockResolvedValue({ data: null });
  revalidatePathMock.mockReset();
  fromMock.mockReset().mockReturnValue({
    upsert: upsertMock,
    select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
  });
  createServerClientMock.mockReset().mockResolvedValue({
    auth: { getUser: getUserMock },
    from: fromMock,
  });
});

describe("dismissOnboarding", () => {
  it("stamps onboarding_dismissed_at for the signed-in vendor only", async () => {
    await dismissOnboarding();

    expect(fromMock).toHaveBeenCalledWith("vendor_prefs");
    expect(upsertMock).toHaveBeenCalledWith({
      vendor_id: "v1",
      onboarding_dismissed_at: expect.any(String),
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard");
  });

  it("does nothing when no user is signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    await dismissOnboarding();

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("logs but does not throw when the write fails", async () => {
    upsertMock.mockResolvedValue({ error: { message: "RLS denied" } });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(dismissOnboarding()).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledWith(
      "onboarding pref write failed",
      "RLS denied",
    );
    expect(revalidatePathMock).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe("reopenOnboarding", () => {
  it("clears onboarding_dismissed_at", async () => {
    await reopenOnboarding();

    expect(upsertMock).toHaveBeenCalledWith({
      vendor_id: "v1",
      onboarding_dismissed_at: null,
    });
  });
});

describe("markQrPreviewed", () => {
  it("stamps qr_previewed_at the first time", async () => {
    await markQrPreviewed();

    expect(upsertMock).toHaveBeenCalledWith({
      vendor_id: "v1",
      qr_previewed_at: expect.any(String),
    });
  });

  it("leaves the original time once already stamped", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { qr_previewed_at: "2026-01-01T00:00:00Z" },
    });

    await markQrPreviewed();

    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("does nothing when no user is signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    await markQrPreviewed();

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("does not throw when the client is unavailable", async () => {
    createServerClientMock.mockRejectedValue(new Error("down"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(markQrPreviewed()).resolves.toBeUndefined();
    consoleError.mockRestore();
  });
});
