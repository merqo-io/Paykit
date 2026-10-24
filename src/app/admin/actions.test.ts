import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  requireAdminMock,
  updateMock,
  pricingUpdateMock,
  insertMock,
  createServiceClientMock,
} = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  updateMock: vi.fn(),
  pricingUpdateMock: vi.fn(),
  insertMock: vi.fn(),
  createServiceClientMock: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: createServiceClientMock,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  requireAdminMock.mockReset().mockResolvedValue({ user: { id: "admin-1" } });
  updateMock.mockReset().mockReturnValue({
    eq: () => ({
      select: () => ({
        maybeSingle: () =>
          Promise.resolve({ data: { vendor_id: "v1" }, error: null }),
      }),
    }),
  });
  pricingUpdateMock.mockReset().mockReturnValue({
    eq: () => Promise.resolve({ error: null }),
  });
  insertMock.mockReset().mockResolvedValue({ error: null });
  createServiceClientMock.mockReset().mockResolvedValue({
    from: (table: string) => {
      if (table === "admin_audit") return { insert: insertMock };
      if (table === "pricing") return { update: pricingUpdateMock };
      return { update: updateMock };
    },
  });
});

describe("setVendorPlan", () => {
  it("404s (via requireAdmin) before writing anything for a non-admin", async () => {
    requireAdminMock.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
    const { setVendorPlan } = await import("./actions");

    await expect(
      setVendorPlan(formData({ vendorId: "v1", plan: "pro" })),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects invalid input without writing", async () => {
    const { setVendorPlan } = await import("./actions");

    const result = await setVendorPlan(
      formData({ vendorId: "not-a-uuid", plan: "pro" }),
    );

    expect(result).toEqual({ success: false, error: "Invalid input" });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects a plan value outside free/pro", async () => {
    const { setVendorPlan } = await import("./actions");

    const result = await setVendorPlan(
      formData({
        vendorId: "11111111-1111-1111-8111-111111111111",
        plan: "enterprise",
      }),
    );

    expect(result).toEqual({ success: false, error: "Invalid input" });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("updates the vendor's plan, records an audit row, and revalidates on success", async () => {
    const { setVendorPlan } = await import("./actions");
    const vendorId = "11111111-1111-1111-8111-111111111111";

    const result = await setVendorPlan(formData({ vendorId, plan: "pro" }));

    expect(result).toEqual({ success: true });
    expect(updateMock).toHaveBeenCalledWith({ plan: "pro" });
    expect(insertMock).toHaveBeenCalledWith({
      admin_id: "admin-1",
      action: "set_vendor_plan",
      target_id: vendorId,
      detail: { plan: "pro" },
    });
  });

  it("returns an error when no row is updated (vendor not found)", async () => {
    updateMock.mockReturnValue({
      eq: () => ({
        select: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    });
    const { setVendorPlan } = await import("./actions");

    const result = await setVendorPlan(
      formData({
        vendorId: "11111111-1111-1111-8111-111111111111",
        plan: "free",
      }),
    );

    expect(result).toEqual({
      success: false,
      error: "Could not update plan",
    });
  });

  it("does not fail the action when the audit insert fails", async () => {
    insertMock.mockResolvedValue({ error: { message: "audit down" } });
    const { setVendorPlan } = await import("./actions");

    const result = await setVendorPlan(
      formData({
        vendorId: "11111111-1111-1111-8111-111111111111",
        plan: "pro",
      }),
    );

    expect(result).toEqual({ success: true });
  });
});

describe("setPricing", () => {
  it("404s (via requireAdmin) before writing anything for a non-admin", async () => {
    requireAdminMock.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
    const { setPricing } = await import("./actions");
    await expect(setPricing({ monthly_cents: 499 })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("rejects a negative or oversized amount without writing", async () => {
    const { setPricing } = await import("./actions");
    expect(await setPricing({ monthly_cents: -1 })).toEqual({
      success: false,
      error: "Invalid input",
    });
    expect(await setPricing({ monthly_cents: 999_999 })).toEqual({
      success: false,
      error: "Invalid input",
    });
  });

  it("updates the pricing row, records an audit row, and revalidates on success", async () => {
    const { setPricing } = await import("./actions");
    const result = await setPricing({ monthly_cents: 499 });
    expect(result).toEqual({ success: true });
    expect(pricingUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ monthly_cents: 499 }),
    );
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        admin_id: "admin-1",
        action: "set_pricing",
        detail: { monthly_cents: 499 },
      }),
    );
  });

  it("returns an error when the update fails", async () => {
    pricingUpdateMock.mockReturnValue({
      eq: () => Promise.resolve({ error: { message: "db down" } }),
    });
    const { setPricing } = await import("./actions");
    expect(await setPricing({ monthly_cents: 499 })).toEqual({
      success: false,
      error: "Could not update pricing",
    });
  });
});
