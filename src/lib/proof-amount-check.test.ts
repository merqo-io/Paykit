import { describe, it, expect, vi, beforeEach } from "vitest";

const { afterMock, recognizeTextMock, updateMock, eqMock, updateResult } =
  vi.hoisted(() => ({
    afterMock: vi.fn(),
    recognizeTextMock: vi.fn(),
    updateMock: vi.fn(),
    eqMock: vi.fn(),
    updateResult: { value: { error: null as { message: string } | null } },
  }));

vi.mock("next/server", () => ({ after: afterMock }));
vi.mock("@/lib/proof-ocr", () => ({ recognizeText: recognizeTextMock }));

import {
  amountInRaisedCentsText,
  amountInText,
  checkProofAmount,
  scheduleProofAmountCheck,
} from "./proof-amount-check";
import { hashProof } from "./payment-evidence";
import type { ProofFile } from "./proof-file";

const TX = { id: "11111111-1111-1111-8111-111111111111", amount_cents: 1250 };
const PROOF: ProofFile = {
  bytes: Buffer.from("fake image bytes"),
  contentType: "image/webp",
};

function fakeSupabase() {
  const chain = {
    eq: (...args: unknown[]) => {
      eqMock(...args);
      return chain;
    },
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(updateResult.value).then(resolve),
  };
  return {
    from: (table: string) => ({
      update: (patch: unknown) => {
        updateMock(table, patch);
        return chain;
      },
    }),
  } as unknown as Parameters<typeof checkProofAmount>[0];
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  afterMock.mockReset();
  recognizeTextMock.mockReset().mockResolvedValue("Transfer\nSGD 12.50\n");
  updateMock.mockReset();
  eqMock.mockReset();
  updateResult.value = { error: null };
});

describe("amountInText", () => {
  it.each([
    ["12.50", 1250, true],
    ["PAID $12.50 to stall", 1250, true],
    ["Ref 99.00\nSGD 12.50", 1250, true],
    ["S$1,250.00", 125000, true],
    ["1250.00", 125000, true],
    ["$5.00", 500, true],
    ["0.50", 50, true],
    ["PAID $112.50", 1250, false],
    ["12.505", 1250, false],
    ["12.50.1", 1250, false],
    ["12,50", 1250, false],
    ["12.5", 1250, false],
    ["twelve fifty", 1250, false],
    ["", 1250, false],
    ["12.50", 1251, false],
  ])("%j for %i cents is %j", (text, cents, expected) => {
    expect(amountInText(text, cents)).toBe(expected);
  });
});

describe("amountInRaisedCentsText", () => {
  it.each([
    ["sGb 8-50", 850, true],
    ["SGD 11-00", 1100, true],
    ["$8.50", 850, true],
    ["S$1,250-00", 125000, true],
    ["8-90", 850, false],
    ["2026-10-26", 1026, false],
    ["10-26-2026", 1026, false],
    ["112-50", 1250, false],
    ["8-5", 850, false],
  ])("%j for %i cents is %j", (text, cents, expected) => {
    expect(amountInRaisedCentsText(text, cents)).toBe(expected);
  });
});

describe("checkProofAmount", () => {
  it("reads the stored bytes and records a match on this screenshot's row", async () => {
    await checkProofAmount(fakeSupabase(), TX, PROOF);
    expect(recognizeTextMock).toHaveBeenCalledWith(PROOF.bytes);
    expect(updateMock).toHaveBeenCalledWith("payment_evidence", {
      detail: { amount_match: true },
    });
    expect(eqMock.mock.calls).toEqual([
      ["transaction_id", TX.id],
      ["kind", "screenshot"],
      ["content_hash", hashProof(PROOF.bytes)],
    ]);
  });

  it("records a mismatch when neither read finds the amount", async () => {
    recognizeTextMock.mockResolvedValue("SGD 2.50");
    await checkProofAmount(fakeSupabase(), TX, PROOF);
    expect(recognizeTextMock).toHaveBeenNthCalledWith(
      2,
      PROOF.bytes,
      "highContrast",
    );
    expect(updateMock).toHaveBeenCalledWith("payment_evidence", {
      detail: { amount_match: false },
    });
  });

  it("skips the high-contrast read when the plain read finds the amount", async () => {
    await checkProofAmount(fakeSupabase(), TX, PROOF);
    expect(recognizeTextMock).toHaveBeenCalledTimes(1);
  });

  it("matches raised cents through the high-contrast read", async () => {
    recognizeTextMock
      .mockResolvedValueOnce("SGD &-50")
      .mockResolvedValueOnce("sGb 12-50");
    await checkProofAmount(fakeSupabase(), TX, PROOF);
    expect(updateMock).toHaveBeenCalledWith("payment_evidence", {
      detail: { amount_match: true },
    });
  });

  it("does not take a dash from the plain read", async () => {
    recognizeTextMock
      .mockResolvedValueOnce("SGD 12-50")
      .mockResolvedValueOnce("nothing");
    await checkProofAmount(fakeSupabase(), TX, PROOF);
    expect(updateMock).toHaveBeenCalledWith("payment_evidence", {
      detail: { amount_match: false },
    });
  });

  it("keeps the plain read's answer when the high-contrast read fails", async () => {
    recognizeTextMock
      .mockResolvedValueOnce("SGD 2.50")
      .mockRejectedValueOnce(new Error("unreadable"));
    await checkProofAmount(fakeSupabase(), TX, PROOF);
    expect(updateMock).toHaveBeenCalledWith("payment_evidence", {
      detail: { amount_match: false },
    });
  });

  it("writes nothing, and does not throw, when the image cannot be read", async () => {
    recognizeTextMock.mockRejectedValue(new Error("unreadable"));
    await expect(
      checkProofAmount(fakeSupabase(), TX, PROOF),
    ).resolves.toBeUndefined();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("does not throw when the write fails", async () => {
    updateResult.value = { error: { message: "down" } };
    await expect(
      checkProofAmount(fakeSupabase(), TX, PROOF),
    ).resolves.toBeUndefined();
  });

  it("does not throw when something other than an Error is thrown", async () => {
    recognizeTextMock.mockRejectedValue("boom");
    await expect(
      checkProofAmount(fakeSupabase(), TX, PROOF),
    ).resolves.toBeUndefined();
  });
});

describe("scheduleProofAmountCheck", () => {
  it("hands the check to after() and does not run it inline", async () => {
    scheduleProofAmountCheck(fakeSupabase(), TX, PROOF);
    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(recognizeTextMock).not.toHaveBeenCalled();
    await afterMock.mock.calls[0][0]();
    expect(recognizeTextMock).toHaveBeenCalledWith(PROOF.bytes);
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it("does not throw where there is no request to outlive", () => {
    afterMock.mockImplementation(() => {
      throw new Error("after called outside a request scope");
    });
    expect(() =>
      scheduleProofAmountCheck(fakeSupabase(), TX, PROOF),
    ).not.toThrow();
  });
});
