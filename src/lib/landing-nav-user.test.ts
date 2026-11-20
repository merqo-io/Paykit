import { describe, it, expect, vi } from "vitest";
import { landingNavUser } from "./landing-nav-user";

const state = vi.hoisted(() => ({
  stallName: "Ana's Stall",
  fail: false,
  calls: [] as unknown[][],
}));
vi.mock("@/lib/merqo-vendor-profile", () => ({
  getOrCreateVendorProfile: async (...args: unknown[]) => {
    state.calls.push(args);
    if (state.fail) throw new Error("down");
    return { stall_name: state.stallName };
  },
}));

const supabase = {} as never;
const user = { id: "u1", email: "ana@b.co", user_metadata: {} };

describe("landingNavUser", () => {
  it("is null when signed out", async () => {
    expect(await landingNavUser(supabase, null)).toBeNull();
    expect(state.calls).toHaveLength(0);
  });

  it("uses the vendor stall name", async () => {
    const nav = await landingNavUser(supabase, user);
    expect(nav?.name).toBe("Ana's Stall");
    expect(state.calls[0]).toEqual([supabase, "u1", null]);
  });

  it("falls back to the auth user when the profile lookup fails", async () => {
    state.fail = true;
    const nav = await landingNavUser(supabase, user);
    expect(nav?.name).toBe("ana");
  });
});
