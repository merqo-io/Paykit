import { describe, it, expect, vi, beforeEach } from "vitest";

const { orderMock, gteMock, rpcMock, maybeSingleMock, createServerClientMock } =
  vi.hoisted(() => ({
    orderMock: vi.fn(),
    gteMock: vi.fn(),
    rpcMock: vi.fn(),
    maybeSingleMock: vi.fn(),
    createServerClientMock: vi.fn(),
  }));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: createServerClientMock,
}));

beforeEach(() => {
  orderMock
    .mockReset()
    .mockResolvedValue({ data: [{ id: "tx1" }], error: null });
  gteMock.mockReset().mockReturnValue({ order: () => ({ limit: orderMock }) });
  rpcMock.mockReset().mockResolvedValue({ data: 7, error: null });
  maybeSingleMock
    .mockReset()
    .mockResolvedValue({ data: { id: "tx1" }, error: null });
  createServerClientMock.mockReset().mockResolvedValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({ limit: orderMock }),
          gte: gteMock,
          eq: () => ({ maybeSingle: maybeSingleMock }),
        }),
      }),
    }),
    rpc: rpcMock,
  });
});

describe("listTransactions", () => {
  it("returns the vendor's transactions", async () => {
    const { listTransactions } = await import("./transactions");
    expect(await listTransactions("v1")).toEqual([{ id: "tx1" }]);
    expect(gteMock).not.toHaveBeenCalled();
  });

  it("filters to rows created on or after `since` when given", async () => {
    const { listTransactions } = await import("./transactions");
    expect(await listTransactions("v1", "2026-10-17T00:00:00.000Z")).toEqual([
      { id: "tx1" },
    ]);
    expect(gteMock).toHaveBeenCalledWith(
      "created_at",
      "2026-10-17T00:00:00.000Z",
    );
  });
});

describe("getTransaction", () => {
  it("returns the vendor's own transaction by id", async () => {
    const { getTransaction } = await import("./transactions");
    expect(await getTransaction("v1", "tx1")).toEqual({ id: "tx1" });
  });

  it("returns null on a read error", async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: "connection reset" },
    });
    const { getTransaction } = await import("./transactions");
    expect(await getTransaction("v1", "tx1")).toBeNull();
  });

  it("returns null when no matching transaction exists", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { getTransaction } = await import("./transactions");
    expect(await getTransaction("v1", "missing")).toBeNull();
  });
});

describe("txCountThisMonth", () => {
  it("returns the RPC count", async () => {
    const { txCountThisMonth } = await import("./transactions");
    expect(await txCountThisMonth("v1")).toBe(7);
    expect(rpcMock).toHaveBeenCalledWith("tx_count_this_month", {
      p_vendor: "v1",
    });
  });
});

describe("claimedTxSummary", () => {
  const claimedClient = (result: {
    data: { amount_cents: number }[] | null;
    error: { message: string } | null;
  }) => {
    const statusEq = vi.fn().mockResolvedValue(result);
    const selectMock = vi.fn(() => ({ eq: () => ({ eq: statusEq }) }));
    createServerClientMock.mockResolvedValue({
      from: () => ({ select: selectMock }),
    });
    return { statusEq, selectMock };
  };

  it("counts and sums the claimed rows", async () => {
    const { statusEq, selectMock } = claimedClient({
      data: [{ amount_cents: 450 }, { amount_cents: 1200 }],
      error: null,
    });
    const { claimedTxSummary } = await import("./transactions");
    expect(await claimedTxSummary("v1")).toEqual({ count: 2, cents: 1650 });
    expect(selectMock).toHaveBeenCalledWith("amount_cents");
    expect(statusEq).toHaveBeenCalledWith("status", "claimed");
  });

  it("returns zeros when there is no data", async () => {
    claimedClient({ data: null, error: null });
    const { claimedTxSummary } = await import("./transactions");
    expect(await claimedTxSummary("v1")).toEqual({ count: 0, cents: 0 });
  });

  it("logs and returns zeros on a query error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    claimedClient({ data: null, error: { message: "boom" } });
    const { claimedTxSummary } = await import("./transactions");
    expect(await claimedTxSummary("v1")).toEqual({ count: 0, cents: 0 });
    expect(errorSpy).toHaveBeenCalledWith("claimedTxSummary failed", "boom");
    errorSpy.mockRestore();
  });
});

describe("confirmedCentsSince", () => {
  const confirmedClient = (pages: unknown[]) => {
    const rangeMock = vi.fn();
    for (const page of pages) rangeMock.mockResolvedValueOnce(page);
    const gteMock2 = vi.fn(() => ({ order: () => ({ range: rangeMock }) }));
    createServerClientMock.mockResolvedValue({
      from: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ gte: gteMock2 }) }) }),
      }),
    });
    return gteMock2;
  };

  it("sums confirmed rows created since the cutoff", async () => {
    const gte = confirmedClient([
      { data: [{ amount_cents: 300 }, { amount_cents: 700 }], error: null },
      { data: [], error: null },
    ]);
    const { confirmedCentsSince } = await import("./transactions");
    expect(await confirmedCentsSince("v1", "2026-11-01T00:00:00Z")).toBe(1000);
    expect(gte).toHaveBeenCalledWith("created_at", "2026-11-01T00:00:00Z");
  });

  it("logs and returns 0 when the read fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    confirmedClient([{ data: null, error: { message: "boom" } }]);
    const { confirmedCentsSince } = await import("./transactions");
    expect(await confirmedCentsSince("v1", "x")).toBe(0);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("countTransactionsBefore", () => {
  const ltClient = (result: {
    count: number | null;
    error: { message: string } | null;
  }) => {
    const ltMock = vi.fn().mockResolvedValue(result);
    createServerClientMock.mockResolvedValue({
      from: () => ({
        select: () => ({ eq: () => ({ lt: ltMock }) }),
      }),
    });
    return ltMock;
  };

  it("head-counts rows older than the cutoff", async () => {
    const ltMock = ltClient({ count: 4, error: null });
    const { countTransactionsBefore } = await import("./transactions");
    expect(await countTransactionsBefore("v1", "2026-10-17T00:00:00Z")).toBe(4);
    expect(ltMock).toHaveBeenCalledWith("created_at", "2026-10-17T00:00:00Z");
  });

  it("logs and returns 0 on a query error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    ltClient({ count: null, error: { message: "boom" } });
    const { countTransactionsBefore } = await import("./transactions");
    expect(await countTransactionsBefore("v1", "x")).toBe(0);
    expect(errorSpy).toHaveBeenCalledWith(
      "countTransactionsBefore failed",
      "boom",
    );
    errorSpy.mockRestore();
  });
});

describe("listConfirmedBetween", () => {
  it("bounds confirmed rows to [start, end)", async () => {
    const rangeMock = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: "tx1" }], error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    const calls: [string, ...unknown[]][] = [];
    const chain: Record<string, unknown> = {};
    for (const name of ["select", "eq", "gte", "lt", "order"]) {
      chain[name] = (...args: unknown[]) => {
        calls.push([name, ...args]);
        return chain;
      };
    }
    chain.range = rangeMock;
    createServerClientMock.mockResolvedValue({ from: () => chain });
    const { listConfirmedBetween } = await import("./transactions");
    expect(await listConfirmedBetween("v1", "S", "E")).toEqual([{ id: "tx1" }]);
    expect(calls).toContainEqual(["eq", "status", "confirmed"]);
    expect(calls).toContainEqual(["gte", "created_at", "S"]);
    expect(calls).toContainEqual(["lt", "created_at", "E"]);
  });
});
