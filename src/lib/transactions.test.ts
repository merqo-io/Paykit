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

describe("searchTerm", () => {
  it("strips filter metacharacters and collapses spaces", async () => {
    const { searchTerm } = await import("./transactions");
    expect(searchTerm(`a,b(c)*"'\\  d`)).toBe("a b c d");
  });

  it("escapes ILIKE wildcards so % and _ match literally", async () => {
    const { searchTerm } = await import("./transactions");
    expect(searchTerm("ORD_12%")).toBe("ORD\\_12\\%");
  });
});

describe("queryTransactions", () => {
  function recorder(...results: unknown[]) {
    let call = 0;
    const calls: [string, unknown[]][] = [];
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "gte", "lt", "or", "order"]) {
      chain[m] = (...args: unknown[]) => {
        calls.push([m, args]);
        return chain;
      };
    }
    chain.range = (...args: unknown[]) => {
      calls.push(["range", args]);
      return Promise.resolve(results[Math.min(call++, results.length - 1)]);
    };
    createServerClientMock.mockResolvedValue({ from: () => chain });
    return calls;
  }

  it("applies the window, status and search, and pages with a range", async () => {
    const calls = recorder({ data: [{ id: "tx1" }], count: 51, error: null });
    const { queryTransactions } = await import("./transactions");
    const page = await queryTransactions("v1", {
      gteIso: "2026-10-26T00:00:00.000Z",
      ltIso: "2026-11-25T00:00:00.000Z",
      status: "claimed",
      search: "A-001",
      page: 3,
      pageSize: 25,
    });
    expect(page).toEqual({ rows: [{ id: "tx1" }], total: 51, failed: false });
    expect(calls).toContainEqual([
      "gte",
      ["created_at", "2026-10-26T00:00:00.000Z"],
    ]);
    expect(calls).toContainEqual([
      "lt",
      ["created_at", "2026-11-25T00:00:00.000Z"],
    ]);
    expect(calls).toContainEqual(["eq", ["status", "claimed"]]);
    expect(calls).toContainEqual([
      "or",
      ["order_ref.ilike.%A-001%,pay_title.ilike.%A-001%"],
    ]);
    expect(calls).toContainEqual(["range", [50, 74]]);
  });

  it("adds no optional filters when none are given", async () => {
    const calls = recorder({ data: null, count: null, error: null });
    const { queryTransactions } = await import("./transactions");
    expect(
      await queryTransactions("v1", { page: 1, pageSize: 25, search: ",()" }),
    ).toEqual({ rows: [], total: 0, failed: false });
    const names = calls.map(([m]) => m);
    expect(names).not.toContain("gte");
    expect(names).not.toContain("lt");
    expect(names).not.toContain("or");
    expect(calls).toContainEqual(["range", [0, 24]]);
  });

  it("treats a page past the end as empty and still returns the total", async () => {
    const calls = recorder(
      { data: null, count: null, error: { code: "PGRST103", message: "416" } },
      { data: [{ id: "tx1" }], count: 30, error: null },
    );
    const { queryTransactions } = await import("./transactions");
    expect(await queryTransactions("v1", { page: 9, pageSize: 25 })).toEqual({
      rows: [],
      total: 30,
      failed: false,
    });
    expect(calls).toContainEqual(["range", [200, 224]]);
    expect(calls).toContainEqual(["range", [0, 0]]);
  });

  it("fails when the out-of-range probe also errors", async () => {
    recorder(
      { data: null, count: null, error: { code: "PGRST103", message: "416" } },
      { data: null, count: null, error: { message: "boom" } },
    );
    const { queryTransactions } = await import("./transactions");
    expect(await queryTransactions("v1", { page: 9, pageSize: 25 })).toEqual({
      rows: [],
      total: 0,
      failed: true,
    });
  });

  it("reports a failed read", async () => {
    recorder({ data: null, count: null, error: { message: "boom" } });
    const { queryTransactions } = await import("./transactions");
    expect(await queryTransactions("v1", { page: 1, pageSize: 25 })).toEqual({
      rows: [],
      total: 0,
      failed: true,
    });
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
  const claimedClient = (pages: unknown[]) => {
    const rangeMock = vi.fn();
    for (const page of pages) rangeMock.mockResolvedValueOnce(page);
    const statusEq = vi.fn(() => ({ order: () => ({ range: rangeMock }) }));
    createServerClientMock.mockResolvedValue({
      from: () => ({
        select: () => ({ eq: () => ({ eq: statusEq }) }),
      }),
    });
    return { statusEq, rangeMock };
  };

  it("counts and sums the claimed rows", async () => {
    const { statusEq } = claimedClient([
      { data: [{ amount_cents: 450 }, { amount_cents: 1200 }], error: null },
      { data: [], error: null },
    ]);
    const { claimedTxSummary } = await import("./transactions");
    expect(await claimedTxSummary("v1")).toEqual({ count: 2, cents: 1650 });
    expect(statusEq).toHaveBeenCalledWith("status", "claimed");
  });

  it("reads past the 1000-row API cap", async () => {
    const full = Array.from({ length: 1000 }, () => ({ amount_cents: 100 }));
    const { rangeMock } = claimedClient([
      { data: full, error: null },
      { data: [{ amount_cents: 250 }], error: null },
      { data: [], error: null },
    ]);
    const { claimedTxSummary } = await import("./transactions");
    expect(await claimedTxSummary("v1")).toEqual({
      count: 1001,
      cents: 100_250,
    });
    expect(rangeMock).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it("logs and returns zeros on a query error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    claimedClient([{ data: null, error: { message: "boom" } }]);
    const { claimedTxSummary } = await import("./transactions");
    expect(await claimedTxSummary("v1")).toEqual({ count: 0, cents: 0 });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("confirmedSince", () => {
  const confirmedClient = (pages: unknown[]) => {
    const rangeMock = vi.fn();
    for (const page of pages) rangeMock.mockResolvedValueOnce(page);
    const gte = vi.fn(() => ({ order: () => ({ range: rangeMock }) }));
    createServerClientMock.mockResolvedValue({
      from: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ gte }) }) }),
      }),
    });
    return gte;
  };

  it("returns count and cents from the same confirmed_at-filtered rows", async () => {
    const gte = confirmedClient([
      { data: [{ amount_cents: 300 }, { amount_cents: 700 }], error: null },
      { data: [], error: null },
    ]);
    const { confirmedSince } = await import("./transactions");
    expect(await confirmedSince("v1", "2026-10-31T16:00:00.000Z")).toEqual({
      count: 2,
      cents: 1000,
    });
    expect(gte).toHaveBeenCalledWith(
      "confirmed_at",
      "2026-10-31T16:00:00.000Z",
    );
  });

  it("keeps count and amount in step for a payment created before the month edge and confirmed after it", async () => {
    // Created 31 Oct, confirmed 2 Nov: the query keys on confirmed_at only, so
    // this row is in both figures and nothing created in October is counted
    // without its amount.
    confirmedClient([
      { data: [{ amount_cents: 450 }], error: null },
      { data: [], error: null },
    ]);
    const { confirmedSince } = await import("./transactions");
    const result = await confirmedSince("v1", "2026-10-31T16:00:00.000Z");
    expect(result).toEqual({ count: 1, cents: 450 });
  });

  it("logs and returns zeros when the read fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    confirmedClient([{ data: null, error: { message: "boom" } }]);
    const { confirmedSince } = await import("./transactions");
    expect(await confirmedSince("v1", "x")).toEqual({ count: 0, cents: 0 });
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
