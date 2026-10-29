import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { recordOpsEvent, summarizeIncidents } from "./ops-events";

type Result = { data: unknown; error: { message: string } | null };

const VENDOR = "11111111-1111-4111-8111-111111111111";
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  errorSpy.mockRestore();
  vi.useRealTimers();
});

function insertClient(insert: (row: unknown) => Promise<Result>) {
  const from = vi.fn(() => ({ insert }));
  return { client: { from } as never, from };
}

describe("recordOpsEvent", () => {
  it("inserts the event as one row", async () => {
    const insert = vi.fn().mockResolvedValue({ data: null, error: null });
    const { client, from } = insertClient(insert);
    await recordOpsEvent(client, {
      vendorId: VENDOR,
      kind: "payment_callback_failed",
      ref: "tx-1",
      code: "http_502",
    });
    expect(from).toHaveBeenCalledWith("ops_events");
    expect(insert).toHaveBeenCalledWith({
      vendor_id: VENDOR,
      kind: "payment_callback_failed",
      ref: "tx-1",
      code: "http_502",
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("resolves and logs the code when the insert returns an error", async () => {
    const insert = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "denied" } });
    const { client } = insertClient(insert);
    await expect(
      recordOpsEvent(client, {
        vendorId: VENDOR,
        kind: "payment_callback_failed",
        ref: "tx-1",
        code: "timeout",
      }),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      "ops_events insert failed",
      "timeout",
    );
  });

  it("resolves when the client throws", async () => {
    const insert = vi.fn().mockRejectedValue(new Error("down"));
    const { client } = insertClient(insert);
    await expect(
      recordOpsEvent(client, {
        vendorId: VENDOR,
        kind: "payment_callback_failed",
        ref: "tx-1",
        code: "timeout",
      }),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      "ops_events insert failed",
      "timeout",
    );
  });
});

function readClient(events: Result, stuck: Result) {
  const calls: { table: string; ops: unknown[][] }[] = [];
  const from = vi.fn((table: string) => {
    const ops: unknown[][] = [];
    calls.push({ table, ops });
    const result = table === "ops_events" ? events : stuck;
    const chain: Record<string, unknown> = {};
    for (const name of ["select", "eq", "gte", "lt", "not", "order"]) {
      chain[name] = (...args: unknown[]) => {
        ops.push([name, ...args]);
        return chain;
      };
    }
    chain.range = (lo: number, hi: number) =>
      Promise.resolve({
        ...result,
        data: Array.isArray(result.data)
          ? result.data.slice(lo, hi + 1)
          : result.data,
      });
    return chain;
  });
  return { client: { from } as never, calls };
}

describe("summarizeIncidents", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-29T12:00:00Z"));
  });

  it("groups by kind with counts and lastAt, and lists recent newest first", async () => {
    const { client, calls } = readClient(
      {
        data: [
          {
            kind: "payment_callback_failed",
            ref: "tx-2",
            code: "timeout",
            created_at: "2026-10-29T10:00:00.000Z",
          },
          {
            kind: "payment_callback_failed",
            ref: "tx-1",
            code: "http_502",
            created_at: "2026-10-28T10:00:00.000Z",
          },
        ],
        error: null,
      },
      {
        data: [{ id: "tx-9", expires_at: "2026-10-29T11:00:00.000Z" }],
        error: null,
      },
    );
    const out = await summarizeIncidents(client, VENDOR);

    expect(out.incidents).toEqual([
      {
        kind: "payment_claim_stuck",
        count: 1,
        lastAt: "2026-10-29T11:00:00.000Z",
      },
      {
        kind: "payment_callback_failed",
        count: 2,
        lastAt: "2026-10-29T10:00:00.000Z",
      },
    ]);
    expect(out.recent).toEqual([
      {
        kind: "payment_claim_stuck",
        ref: "tx-9",
        code: "expired",
        at: "2026-10-29T11:00:00.000Z",
      },
      {
        kind: "payment_callback_failed",
        ref: "tx-2",
        code: "timeout",
        at: "2026-10-29T10:00:00.000Z",
      },
      {
        kind: "payment_callback_failed",
        ref: "tx-1",
        code: "http_502",
        at: "2026-10-28T10:00:00.000Z",
      },
    ]);

    const since = "2026-10-26T12:00:00.000Z";
    const events = calls.find((c) => c.table === "ops_events")!.ops;
    expect(events).toContainEqual(["eq", "vendor_id", VENDOR]);
    expect(events).toContainEqual(["gte", "created_at", since]);
    const stuck = calls.find((c) => c.table === "transactions")!.ops;
    expect(stuck).toContainEqual(["eq", "vendor_id", VENDOR]);
    expect(stuck).toContainEqual(["eq", "status", "claimed"]);
    expect(stuck).toContainEqual(["gte", "expires_at", since]);
    expect(stuck).toContainEqual([
      "lt",
      "expires_at",
      "2026-10-29T12:00:00.000Z",
    ]);
  });

  it("caps recent at 10", async () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      kind: "payment_callback_failed",
      ref: `tx-${i}`,
      code: "timeout",
      created_at: new Date(Date.UTC(2026, 9, 29, 11, 0, 59 - i)).toISOString(),
    }));
    const { client } = readClient(
      { data: rows, error: null },
      { data: [], error: null },
    );
    const out = await summarizeIncidents(client, VENDOR, 24);
    expect(out.recent).toHaveLength(10);
    expect(out.recent[0].ref).toBe("tx-0");
    expect(out.incidents).toEqual([
      {
        kind: "payment_callback_failed",
        count: 12,
        lastAt: rows[0].created_at,
      },
    ]);
  });

  it("returns nothing for a quiet vendor", async () => {
    const { client } = readClient(
      { data: [], error: null },
      { data: [], error: null },
    );
    expect(await summarizeIncidents(client, VENDOR)).toEqual({
      incidents: [],
      recent: [],
    });
  });

  it.each([
    ["ops_events", { data: null, error: { message: "boom" } }, null],
    ["transactions", null, { data: null, error: { message: "boom" } }],
  ])("throws when the %s read fails", async (_, events, stuck) => {
    const ok = { data: [], error: null };
    const { client } = readClient(events ?? ok, stuck ?? ok);
    await expect(summarizeIncidents(client, VENDOR)).rejects.toThrow();
  });
});
