import { describe, it, expect, vi, beforeEach } from "vitest";

const { storeMock, amountCheckMock, callbackMock } = vi.hoisted(() => ({
  storeMock: vi.fn(),
  amountCheckMock: vi.fn(),
  callbackMock: vi.fn(),
}));

vi.mock("@/lib/payment-evidence", () => ({
  storeScreenshotEvidence: storeMock,
}));
vi.mock("@/lib/proof-amount-check", () => ({
  scheduleProofAmountCheck: amountCheckMock,
}));
vi.mock("@/lib/kit-callback", () => ({
  schedulePaymentStatusCallback: callbackMock,
}));

import { claimTransaction } from "@/lib/claim";
import type { ProofFile } from "@/lib/proof-file";
import type { Transaction } from "@/lib/types";

const ROW: Transaction = {
  id: "22222222-2222-2222-8222-222222222222",
  vendor_id: "11111111-1111-1111-8111-111111111111",
  kit_slug: "qkit",
  order_ref: "A-001",
  amount_cents: 450,
  status: "pending",
  qr_payload: "PAYLOAD",
  claimed_at: null,
  confirmed_at: null,
  created_at: "2026-10-13T00:00:00Z",
};
const CLAIMED: Transaction = {
  ...ROW,
  status: "claimed",
  claimed_at: "2026-10-13T00:01:00Z",
};
const PROOF: ProofFile = {
  bytes: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
  contentType: "image/jpeg",
};

const updateSingle = vi.fn();
const recheckMaybeSingle = vi.fn();
const auditInsert = vi.fn();
const updateMock = vi.fn((_patch: Record<string, unknown>) => ({
  eq: () => ({ eq: () => ({ select: () => ({ single: updateSingle }) }) }),
}));

type Client = Parameters<typeof claimTransaction>[0];
const supabase = {
  from: (table: string) =>
    table === "payment_audit"
      ? { insert: auditInsert }
      : {
          update: updateMock,
          select: () => ({ eq: () => ({ maybeSingle: recheckMaybeSingle }) }),
        },
} as unknown as Client;

const AUDIT = { kitSlug: "qkit" };

beforeEach(() => {
  storeMock.mockReset().mockResolvedValue(true);
  amountCheckMock.mockReset();
  callbackMock.mockReset();
  updateMock.mockClear();
  updateSingle.mockReset().mockResolvedValue({ data: CLAIMED, error: null });
  recheckMaybeSingle.mockReset().mockResolvedValue({ data: ROW, error: null });
  auditInsert.mockReset().mockResolvedValue({ error: null });
});

describe("claimTransaction", () => {
  it("claims a pending transaction, records it and schedules the callback", async () => {
    const outcome = await claimTransaction(supabase, ROW, null, AUDIT);
    expect(outcome).toEqual({ ok: true, row: CLAIMED });
    expect(updateMock.mock.calls[0]![0]).toMatchObject({ status: "claimed" });
    expect(auditInsert).toHaveBeenCalledWith({
      transaction_id: ROW.id,
      kit_slug: "qkit",
      action: "claimed",
      detail: null,
    });
    expect(callbackMock).toHaveBeenCalledWith(CLAIMED);
    expect(storeMock).not.toHaveBeenCalled();
  });

  it("passes the audit detail through", async () => {
    await claimTransaction(supabase, ROW, null, {
      kitSlug: "qkit",
      detail: { via: "pay_page" },
    });
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { via: "pay_page" } }),
    );
  });

  it("stores the screenshot before it claims", async () => {
    const order: string[] = [];
    storeMock.mockImplementation(async () => {
      order.push("store");
      return true;
    });
    updateSingle.mockImplementation(async () => {
      order.push("claim");
      return { data: CLAIMED, error: null };
    });
    await claimTransaction(supabase, ROW, PROOF, AUDIT);
    expect(order).toEqual(["store", "claim"]);
    expect(amountCheckMock).toHaveBeenCalledWith(supabase, ROW, PROOF);
  });

  it("claims nothing when the screenshot cannot be stored", async () => {
    storeMock.mockResolvedValue(false);
    const outcome = await claimTransaction(supabase, ROW, PROOF, AUDIT);
    expect(outcome).toEqual({
      ok: false,
      status: 503,
      error: "Could not store the payment proof",
    });
    expect(updateMock).not.toHaveBeenCalled();
    expect(auditInsert).not.toHaveBeenCalled();
    expect(callbackMock).not.toHaveBeenCalled();
    expect(amountCheckMock).not.toHaveBeenCalled();
  });

  it("replaces the screenshot of a claimed transaction without claiming again", async () => {
    const outcome = await claimTransaction(supabase, CLAIMED, PROOF, AUDIT);
    expect(outcome).toEqual({ ok: true, row: CLAIMED });
    expect(storeMock).toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
    expect(callbackMock).not.toHaveBeenCalled();
  });

  it("leaves the evidence of a confirmed transaction alone", async () => {
    const confirmed: Transaction = { ...CLAIMED, status: "confirmed" };
    const outcome = await claimTransaction(supabase, confirmed, PROOF, AUDIT);
    expect(outcome).toEqual({ ok: true, row: confirmed });
    expect(storeMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  describe("when the guarded update matches no row", () => {
    beforeEach(() => {
      updateSingle.mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      });
    });

    it("answers with the state a concurrent request left", async () => {
      recheckMaybeSingle.mockResolvedValue({ data: CLAIMED, error: null });
      expect(await claimTransaction(supabase, ROW, null, AUDIT)).toEqual({
        ok: true,
        row: CLAIMED,
      });
      expect(auditInsert).not.toHaveBeenCalled();
      expect(callbackMock).not.toHaveBeenCalled();
    });

    it.each([
      ["the transaction is still pending", { data: ROW, error: null }, 503],
      ["the re-read fails", { data: null, error: { message: "x" } }, 503],
      ["the transaction is gone", { data: null, error: null }, 404],
    ])("fails when %s", async (_name, recheck, status) => {
      recheckMaybeSingle.mockResolvedValue(recheck);
      expect(await claimTransaction(supabase, ROW, null, AUDIT)).toMatchObject({
        ok: false,
        status,
      });
    });
  });
});
