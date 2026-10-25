import { beforeEach, describe, expect, it, vi } from "vitest";
const { client, insert, guard } = vi.hoisted(() => ({
  client: vi.fn(),
  insert: vi.fn(),
  guard: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: client }));
vi.mock("@/lib/admin", () => ({ requireAdmin: guard }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { recordAudit } from "./admin-audit";
import { recordPaymentAudit } from "./payment-audit";
import * as publicActions from "@/app/admin/actions";
beforeEach(() => {
  client.mockReset().mockResolvedValue({ from: () => ({ insert }) });
  insert.mockReset().mockResolvedValue({ error: null });
  guard.mockReset();
});
describe("audit action boundary", () => {
  it("does not expose the internal writer as a callable server action", () => {
    expect(Object.keys(publicActions).sort()).toEqual([
      "setPricing",
      "setVendorPlan",
    ]);
  });
  it("rejects unsigned calls before any service client or write", async () => {
    guard.mockRejectedValue(new Error("NEXT_NOT_FOUND"));
    await expect(
      publicActions.setPricing({ monthly_cents: 1 }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    const form = new FormData();
    form.set("vendorId", "11111111-1111-1111-8111-111111111111");
    form.set("plan", "pro");
    await expect(publicActions.setVendorPlan(form)).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(client).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });
  it("records the internal caller's authenticated actor and details", async () => {
    await recordAudit("actor", "record_refund", "tx", { amount: 100 });
    expect(insert).toHaveBeenCalledWith({
      admin_id: "actor",
      action: "record_refund",
      target_id: "tx",
      detail: { amount: 100 },
    });
  });
  it.each(["client", "insert", "returned"])(
    "keeps audit %s failure best effort",
    async (stage) => {
      if (stage === "client") client.mockRejectedValue(new Error("offline"));
      if (stage === "insert") insert.mockRejectedValue(new Error("offline"));
      if (stage === "returned")
        insert.mockResolvedValue({ error: { message: "offline" } });
      await expect(
        recordAudit("actor", "event", null, null),
      ).resolves.toBeUndefined();
    },
  );
  it("does not turn a committed payment into a failed response when its audit rejects", async () => {
    insert.mockRejectedValue(new Error("offline"));
    const service = { from: () => ({ insert }) } as unknown as Parameters<
      typeof recordPaymentAudit
    >[0];
    await expect(
      recordPaymentAudit(service, {
        transactionId: "tx",
        kitSlug: "qkit",
        action: "confirmed",
      }),
    ).resolves.toBeUndefined();
  });
});
