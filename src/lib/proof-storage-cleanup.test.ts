import { describe, it, expect, vi, beforeEach } from "vitest";
import { drainProofDeletions } from "./proof-storage-cleanup";

type Row = { id: number; bucket: string; path: string; attempts: number };
type Err = { message: string } | null;

const BUCKET = "paykit-payment-proofs";

const selectResult = vi.fn<() => Promise<{ data: Row[] | null; error: Err }>>();
const removeResult = vi.fn<(paths: string[]) => Promise<{ error: Err }>>();
const deleteResult = vi.fn<() => Promise<{ error: Err }>>();
const updateResult = vi.fn<() => Promise<{ error: Err }>>();
const calls = {
  lt: [] as unknown[][],
  limit: [] as number[],
  deleteIn: [] as unknown[][],
  update: [] as unknown[],
  updateEq: [] as unknown[][],
  bucket: [] as string[],
};

function fakeClient() {
  return {
    from: () => ({
      select: () => ({
        lt: (...args: unknown[]) => {
          calls.lt.push(args);
          return {
            order: () => ({
              limit: (n: number) => {
                calls.limit.push(n);
                return selectResult();
              },
            }),
          };
        },
      }),
      delete: () => ({
        in: (...args: unknown[]) => {
          calls.deleteIn.push(args);
          return deleteResult();
        },
      }),
      update: (patch: unknown) => {
        calls.update.push(patch);
        return {
          eq: (...args: unknown[]) => {
            calls.updateEq.push(args);
            return updateResult();
          },
        };
      },
    }),
    storage: {
      from: (bucket: string) => {
        calls.bucket.push(bucket);
        return { remove: removeResult };
      },
    },
  } as unknown as Parameters<typeof drainProofDeletions>[0];
}

const rows: Row[] = [
  { id: 1, bucket: BUCKET, path: "v/t1", attempts: 0 },
  { id: 2, bucket: BUCKET, path: "v/t2", attempts: 2 },
];

beforeEach(() => {
  for (const list of Object.values(calls)) list.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
  selectResult.mockReset().mockResolvedValue({ data: rows, error: null });
  removeResult.mockReset().mockResolvedValue({ error: null });
  deleteResult.mockReset().mockResolvedValue({ error: null });
  updateResult.mockReset().mockResolvedValue({ error: null });
});

describe("drainProofDeletions", () => {
  it("removes the objects in one batch and clears their queue rows", async () => {
    const result = await drainProofDeletions(fakeClient(), 50);

    expect(result).toEqual({ removed: 2, failed: 0 });
    expect(calls.limit).toEqual([50]);
    expect(calls.bucket).toEqual([BUCKET]);
    expect(removeResult).toHaveBeenCalledWith(["v/t1", "v/t2"]);
    expect(calls.deleteIn).toEqual([["id", [1, 2]]]);
    expect(calls.update).toEqual([]);
  });

  it("skips rows that reached the attempts cap", async () => {
    await drainProofDeletions(fakeClient());
    expect(calls.lt).toEqual([["attempts", 5]]);
  });

  it("does nothing when the queue is empty", async () => {
    selectResult.mockResolvedValue({ data: [], error: null });
    const result = await drainProofDeletions(fakeClient());
    expect(result).toEqual({ removed: 0, failed: 0 });
    expect(removeResult).not.toHaveBeenCalled();
  });

  it("keeps rows and counts an attempt when the batch remove fails", async () => {
    removeResult.mockResolvedValue({ error: { message: "storage down" } });

    const result = await drainProofDeletions(fakeClient());

    expect(result).toEqual({ removed: 0, failed: 2 });
    expect(calls.deleteIn).toEqual([]);
    expect(calls.update).toEqual([
      { attempts: 1, last_error: "storage down" },
      { attempts: 3, last_error: "storage down" },
    ]);
    expect(calls.updateEq).toEqual([
      ["id", 1],
      ["id", 2],
    ]);
  });

  it("removes each bucket's paths separately and only clears the ones that succeeded", async () => {
    selectResult.mockResolvedValue({
      data: [
        { id: 1, bucket: "good", path: "a", attempts: 0 },
        { id: 2, bucket: "bad", path: "b", attempts: 0 },
      ],
      error: null,
    });
    removeResult.mockImplementation(async (paths) =>
      paths[0] === "b" ? { error: { message: "nope" } } : { error: null },
    );

    const result = await drainProofDeletions(fakeClient());

    expect(result).toEqual({ removed: 1, failed: 1 });
    expect(calls.deleteIn).toEqual([["id", [1]]]);
    expect(calls.updateEq).toEqual([["id", 2]]);
  });

  it("logs a failed attempts update and carries on", async () => {
    removeResult.mockResolvedValue({ error: { message: "storage down" } });
    updateResult.mockResolvedValue({ error: { message: "db down" } });

    await expect(drainProofDeletions(fakeClient())).resolves.toEqual({
      removed: 0,
      failed: 2,
    });

    expect(console.error).toHaveBeenCalledWith(
      "proof storage attempt update failed",
      "db down",
    );
    expect(calls.updateEq).toHaveLength(2);
  });

  it("logs a failed queue clear", async () => {
    deleteResult.mockResolvedValue({ error: { message: "db down" } });
    await drainProofDeletions(fakeClient());
    expect(console.error).toHaveBeenCalledWith(
      "proof storage queue clear failed",
      "db down",
    );
  });

  it("returns an empty result when the read fails", async () => {
    selectResult.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(drainProofDeletions(fakeClient())).resolves.toEqual({
      removed: 0,
      failed: 0,
    });
    expect(removeResult).not.toHaveBeenCalled();
  });

  it("never throws when storage throws", async () => {
    removeResult.mockRejectedValue(new Error("network"));
    await expect(drainProofDeletions(fakeClient())).resolves.toEqual({
      removed: 0,
      failed: 0,
    });
  });
});
