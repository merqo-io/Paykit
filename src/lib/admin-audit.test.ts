import { beforeEach, describe, expect, it, vi } from "vitest";
const { client, insert } = vi.hoisted(() => ({
  client: vi.fn(),
  insert: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: client }));
import { recordAudit } from "./admin-audit";
import { recordPaymentAudit } from "./payment-audit";
beforeEach(() => {
  client.mockReset().mockResolvedValue({ from: () => ({ insert }) });
  insert.mockReset().mockResolvedValue({ error: null });
});
describe("audit action boundary", () => {
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
