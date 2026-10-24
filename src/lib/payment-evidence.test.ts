import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  hashProof,
  loadCheckoutEvidence,
  proofPath,
  storeScreenshotEvidence,
} from "./payment-evidence";
import type { ProofFile } from "./proof-file";

const VENDOR = "00000000-0000-4000-8000-00000000000a";
const TX = { id: "11111111-1111-1111-8111-111111111111", vendor_id: VENDOR };
const OTHER_TX = "22222222-2222-2222-8222-222222222222";
const PATH = `${VENDOR}/${TX.id}`;
const HASH = "a".repeat(64);

const PROOF: ProofFile = {
  bytes: Buffer.from("fake image bytes"),
  contentType: "image/png",
};

type Result = { data: unknown; error: { message: string } | null };

const upload = vi.fn();
const createSignedUrl = vi.fn();
const upsert = vi.fn();
const evidenceRow = vi.fn<() => Promise<Result>>();
const duplicateRows = vi.fn<() => Promise<Result>>();
const duplicateTransaction = vi.fn<() => Promise<Result>>();
const calls: { table: string; method: string; args: unknown[] }[] = [];

/** A query builder that records every call and resolves from the mocks. */
function builder(table: string) {
  let limited = false;
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ table, method, args });
      if (method === "limit") limited = true;
      return chain;
    };
  const chain: Record<string, unknown> = {
    select: record("select"),
    eq: record("eq"),
    neq: record("neq"),
    in: record("in"),
    order: record("order"),
    limit: record("limit"),
    upsert: (...args: unknown[]) => {
      calls.push({ table, method: "upsert", args });
      return upsert(...args);
    },
    maybeSingle: () =>
      table === "transactions" ? duplicateTransaction() : evidenceRow(),
    then: (
      resolve: (value: Result) => unknown,
      reject: (reason: unknown) => unknown,
    ) => {
      if (!limited) throw new Error(`unexpected await on ${table}`);
      return duplicateRows().then(resolve, reject);
    },
  };
  return chain;
}

function fakeSupabase() {
  return {
    from: (table: string) => builder(table),
    storage: { from: () => ({ upload, createSignedUrl }) },
  } as unknown as Parameters<typeof storeScreenshotEvidence>[0];
}

function argsOf(table: string, method: string) {
  return calls
    .filter((call) => call.table === table && call.method === method)
    .map((call) => call.args);
}

beforeEach(() => {
  calls.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
  upload.mockReset().mockResolvedValue({ error: null });
  upsert.mockReset().mockResolvedValue({ error: null });
  createSignedUrl.mockReset().mockResolvedValue({
    data: { signedUrl: "https://storage.example/signed" },
    error: null,
  });
  evidenceRow.mockReset().mockResolvedValue({
    data: { storage_path: PATH, content_hash: HASH, detail: {} },
    error: null,
  });
  duplicateRows.mockReset().mockResolvedValue({ data: [], error: null });
  duplicateTransaction
    .mockReset()
    .mockResolvedValue({ data: null, error: null });
});

describe("hashProof and proofPath", () => {
  it("hashes to 64 lower-case hex characters, the same for the same bytes", () => {
    const hash = hashProof(Buffer.from("abc"));
    expect(hash).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(hashProof(Buffer.from("abd"))).not.toBe(hash);
  });

  it("puts the object in the vendor's folder, named by the transaction", () => {
    expect(proofPath(TX)).toBe(PATH);
  });
});

describe("storeScreenshotEvidence", () => {
  it("uploads the file, then writes one row keyed on the transaction and kind", async () => {
    expect(await storeScreenshotEvidence(fakeSupabase(), TX, PROOF)).toBe(true);
    expect(upload).toHaveBeenCalledWith(PATH, PROOF.bytes, {
      upsert: true,
      contentType: "image/png",
    });
    expect(upsert).toHaveBeenCalledTimes(1);
    const [row, options] = upsert.mock.calls[0];
    expect(row).toMatchObject({
      transaction_id: TX.id,
      kind: "screenshot",
      storage_path: PATH,
      content_hash: hashProof(PROOF.bytes),
      detail: {},
    });
    expect(typeof row.created_at).toBe("string");
    expect(options).toEqual({ onConflict: "transaction_id,kind" });
    expect(upload.mock.invocationCallOrder[0]).toBeLessThan(
      upsert.mock.invocationCallOrder[0],
    );
  });

  it("writes no row when the upload fails", async () => {
    upload.mockResolvedValue({ error: { message: "bucket not found" } });
    expect(await storeScreenshotEvidence(fakeSupabase(), TX, PROOF)).toBe(
      false,
    );
    expect(upsert).not.toHaveBeenCalled();
  });

  it("reports failure when the row write fails", async () => {
    upsert.mockResolvedValue({ error: { message: "relation missing" } });
    expect(await storeScreenshotEvidence(fakeSupabase(), TX, PROOF)).toBe(
      false,
    );
  });

  it("reports failure instead of throwing when storage throws", async () => {
    upload.mockRejectedValue(new Error("network down"));
    expect(await storeScreenshotEvidence(fakeSupabase(), TX, PROOF)).toBe(
      false,
    );
  });
});

describe("loadCheckoutEvidence", () => {
  it("answers with nothing when the transaction has no evidence", async () => {
    evidenceRow.mockResolvedValue({ data: null, error: null });
    expect(await loadCheckoutEvidence(fakeSupabase(), TX)).toEqual({
      proof_url: null,
      signals: { duplicate_of: null, amount_match: null },
    });
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("signs the photo for 300 seconds", async () => {
    const result = await loadCheckoutEvidence(fakeSupabase(), TX);
    expect(createSignedUrl).toHaveBeenCalledWith(PATH, 300);
    expect(result).toEqual({
      proof_url: "https://storage.example/signed",
      signals: { duplicate_of: null, amount_match: null },
    });
  });

  it("reads this transaction's screenshot row only", async () => {
    await loadCheckoutEvidence(fakeSupabase(), TX);
    expect(argsOf("payment_evidence", "eq")).toEqual(
      expect.arrayContaining([
        ["transaction_id", TX.id],
        ["kind", "screenshot"],
      ]),
    );
  });

  it("still reports the signals when signing fails", async () => {
    createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: "object missing" },
    });
    duplicateRows.mockResolvedValue({
      data: [{ transaction_id: OTHER_TX }],
      error: null,
    });
    duplicateTransaction.mockResolvedValue({
      data: { order_ref: "order-2", kit_slug: "qkit" },
      error: null,
    });
    expect(await loadCheckoutEvidence(fakeSupabase(), TX)).toEqual({
      proof_url: null,
      signals: {
        duplicate_of: { order_ref: "order-2", kit_slug: "qkit" },
        amount_match: null,
      },
    });
  });

  it("looks for the same hash on other transactions of the same vendor, oldest first", async () => {
    duplicateRows.mockResolvedValue({
      data: [{ transaction_id: OTHER_TX }],
      error: null,
    });
    duplicateTransaction.mockResolvedValue({
      data: { order_ref: "order-2", kit_slug: "loopkit" },
      error: null,
    });
    const result = await loadCheckoutEvidence(fakeSupabase(), TX);
    expect(result?.signals.duplicate_of).toEqual({
      order_ref: "order-2",
      kit_slug: "loopkit",
    });
    expect(argsOf("payment_evidence", "eq")).toContainEqual([
      "content_hash",
      HASH,
    ]);
    expect(argsOf("payment_evidence", "neq")).toEqual([
      ["transaction_id", TX.id],
    ]);
    expect(argsOf("transactions", "in")).toEqual([["id", [OTHER_TX]]]);
    expect(argsOf("transactions", "eq")).toEqual([["vendor_id", VENDOR]]);
    expect(argsOf("transactions", "eq")).not.toContainEqual([
      "kit_slug",
      expect.anything(),
    ]);
    expect(argsOf("transactions", "order")).toEqual([
      ["created_at", { ascending: true }],
    ]);
  });

  it("reports no duplicate when the same hash belongs only to another vendor", async () => {
    duplicateRows.mockResolvedValue({
      data: [{ transaction_id: OTHER_TX }],
      error: null,
    });
    duplicateTransaction.mockResolvedValue({ data: null, error: null });
    const result = await loadCheckoutEvidence(fakeSupabase(), TX);
    expect(result?.signals.duplicate_of).toBeNull();
  });

  it("does not query transactions when no other row shares the hash", async () => {
    await loadCheckoutEvidence(fakeSupabase(), TX);
    expect(duplicateTransaction).not.toHaveBeenCalled();
  });

  it.each([
    [
      "the hash scan",
      () =>
        duplicateRows.mockResolvedValue({
          data: null,
          error: { message: "boom" },
        }),
    ],
    [
      "the vendor lookup",
      () => {
        duplicateRows.mockResolvedValue({
          data: [{ transaction_id: OTHER_TX }],
          error: null,
        });
        duplicateTransaction.mockResolvedValue({
          data: null,
          error: { message: "boom" },
        });
      },
    ],
  ])("keeps the photo when %s fails", async (_name, arrange) => {
    arrange();
    expect(await loadCheckoutEvidence(fakeSupabase(), TX)).toEqual({
      proof_url: "https://storage.example/signed",
      signals: { duplicate_of: null, amount_match: null },
    });
  });

  it.each([
    [{ amount_match: true }, true],
    [{ amount_match: false }, false],
    [{ amount_match: "yes" }, null],
    [{}, null],
    [null, null],
    ["text", null],
  ])("reads amount_match from detail %j as %j", async (detail, expected) => {
    evidenceRow.mockResolvedValue({
      data: { storage_path: PATH, content_hash: HASH, detail },
      error: null,
    });
    const result = await loadCheckoutEvidence(fakeSupabase(), TX);
    expect(result?.signals.amount_match).toBe(expected);
  });

  it("returns null when the evidence row cannot be read", async () => {
    evidenceRow.mockResolvedValue({ data: null, error: { message: "down" } });
    expect(await loadCheckoutEvidence(fakeSupabase(), TX)).toBeNull();
  });

  it("returns null instead of throwing when the client throws", async () => {
    evidenceRow.mockRejectedValue(new Error("network down"));
    expect(await loadCheckoutEvidence(fakeSupabase(), TX)).toBeNull();
  });
});
