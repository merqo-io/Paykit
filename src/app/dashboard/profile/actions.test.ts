import { describe, it, expect, vi, beforeEach } from "vitest";

const { getUserMock, rpcMock, schemaMock, createServerClientMock } = vi.hoisted(
  () => ({
    getUserMock: vi.fn(),
    rpcMock: vi.fn(),
    schemaMock: vi.fn(),
    createServerClientMock: vi.fn(),
  }),
);

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: createServerClientMock,
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const PROFILE = {
  vendor_id: "v1",
  stall_name: "Kopitiam Cart",
  social_links: { website: "https://kopitiam.example" },
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: "v1" } } });
  rpcMock.mockReset().mockResolvedValue({ data: PROFILE, error: null });
  schemaMock.mockReset().mockReturnValue({ rpc: rpcMock });
  createServerClientMock.mockReset().mockResolvedValue({
    auth: { getUser: getUserMock },
    schema: schemaMock,
  });
});

describe("updateStallName", () => {
  it("patches the shared profile name without overwriting its links", async () => {
    const { updateStallName } = await import("./actions");
    const result = await updateStallName({ name: "New Cart Name" });
    expect(result).toEqual({ success: true });
    expect(rpcMock).toHaveBeenCalledExactlyOnceWith("patch_vendor_profile", {
      p_vendor_id: "v1",
      p_stall_name: "New Cart Name",
      p_social_links: null,
    });
  });

  it("returns plain copy when the RPC fails", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { updateStallName } = await import("./actions");
    const result = await updateStallName({ name: "New Cart Name" });
    expect(result).toEqual({
      success: false,
      error: "Could not save business name. Try again.",
    });
    spy.mockRestore();
  });

  it("returns an error for an empty name without calling the RPC", async () => {
    const { updateStallName } = await import("./actions");
    const result = await updateStallName({ name: "" });
    expect(result.success).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("updateSocialLinks", () => {
  it("patches the shared profile links without overwriting its name", async () => {
    const { updateSocialLinks } = await import("./actions");
    const result = await updateSocialLinks({
      website: "https://new.example",
    });
    expect(result).toEqual({ success: true });
    expect(rpcMock).toHaveBeenCalledExactlyOnceWith("patch_vendor_profile", {
      p_vendor_id: "v1",
      p_stall_name: null,
      p_social_links: { website: "https://new.example" },
    });
  });

  it("returns plain copy when the RPC fails", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { updateSocialLinks } = await import("./actions");
    const result = await updateSocialLinks({ website: "https://new.example" });
    expect(result).toEqual({
      success: false,
      error: "Could not save links. Try again.",
    });
    spy.mockRestore();
  });

  it("returns an error for an invalid URL without calling the RPC", async () => {
    const { updateSocialLinks } = await import("./actions");
    const result = await updateSocialLinks({ website: "not-a-url" });
    expect(result.success).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
