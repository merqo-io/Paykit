import { beforeEach, describe, expect, it, vi } from "vitest";
const { users, config, entitlement, eq, from } = vi.hoisted(() => ({
  entitlement: vi.fn(),
  users: vi.fn(),
  config: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: async () => ({
    from,
    auth: { admin: { listUsers: users } },
  }),
}));
import { GET } from "./route";
const request = (email = "vendor@example.com", auth = "Bearer secret") =>
  new Request(
    "http://localhost/api/merqo/vendor-status?email=" +
      encodeURIComponent(email),
    { headers: { Authorization: auth } },
  );
beforeEach(() => {
  process.env.MERQO_METRICS_SECRET = "secret";
  users.mockReset().mockResolvedValue({
    data: { users: [{ id: "late-vendor", email: "Vendor@example.com" }] },
    error: null,
  });
  config.mockReset().mockResolvedValue({
    data: { vendor_id: "late-vendor" },
    error: null,
  });
  entitlement.mockReset().mockResolvedValue({
    data: {
      tier: "paid",
      valid_until: null,
      event_pass_starts_at: null,
      event_pass_ends_at: null,
    },
    error: null,
  });
  eq.mockReset().mockReturnValue({ maybeSingle: config });
  from
    .mockReset()
    .mockImplementation((table: string) =>
      table === "vendor_entitlements"
        ? { select: () => ({ eq: () => ({ maybeSingle: entitlement }) }) }
        : { select: () => ({ eq }) },
    );
});
describe("vendor status direct lookup", () => {
  it("requires bearer authorization", async () => {
    expect((await GET(request("vendor@example.com", ""))).status).toBe(401);
    expect(users).not.toHaveBeenCalled();
  });
  it("validates the email", async () => {
    expect((await GET(request("invalid"))).status).toBe(400);
    expect(users).not.toHaveBeenCalled();
  });
  it("looks up the resolved vendor instead of scanning capped config rows", async () => {
    const response = await GET(request());
    expect(await response.json()).toEqual({ active: true, plan: "pro" });
    expect(eq).toHaveBeenCalledWith("vendor_id", "late-vendor");
  });
  it("does not query configs for an unknown user", async () => {
    users.mockResolvedValue({ data: { users: [] }, error: null });
    expect(await (await GET(request())).json()).toEqual({
      active: false,
      plan: null,
    });
    expect(from).not.toHaveBeenCalled();
  });
  it("reports inactive for a known user with no config", async () => {
    config.mockResolvedValue({ data: null, error: null });
    expect(await (await GET(request())).json()).toEqual({
      active: false,
      plan: null,
    });
  });
  it("reports a vendor with no entitlement row as free", async () => {
    entitlement.mockResolvedValue({ data: null, error: null });
    expect(await (await GET(request())).json()).toEqual({
      active: true,
      plan: "free",
    });
  });
  it.each(["users", "config", "entitlement"])(
    "fails closed when %s lookup errors",
    async (stage) => {
      const mock = { users, config, entitlement }[stage as "users"];
      mock.mockResolvedValue({
        data: null,
        error: { message: "offline" },
      });
      expect((await GET(request())).status).toBe(503);
    },
  );
});
