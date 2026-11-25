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
  it("strips filter and pattern metacharacters and collapses spaces", async () => {
    const { searchTerm } = await import("./transactions");
    expect(searchTerm(`a,b(c)%_*"'  d`)).toBe("a b c d");
  });
});

describe("queryTransactions", () => {
  function recorder(result: unknown) {
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
      return Promise.resolve(result);
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

describe("claimedTxCount", () => {
  const headCountClient = (result: {
    count: number | null;
    error: { message: string } | null;
  }) => {
    const statusEq = vi.fn().mockResolvedValue(result);
    const selectMock = vi.fn(() => ({ eq: () => ({ eq: statusEq }) }));
    createServerClientMock.mockResolvedValue({
      from: () => ({ select: selectMock }),
    });
    return { statusEq, selectMock };
  };

  it("returns the head count of claimed rows", async () => {
    const { statusEq, selectMock } = headCountClient({
      count: 3,
      error: null,
    });
    const { claimedTxCount } = await import("./transactions");
    expect(await claimedTxCount("v1")).toBe(3);
    expect(selectMock).toHaveBeenCalledWith("id", {
      count: "exact",
      head: true,
    });
    expect(statusEq).toHaveBeenCalledWith("status", "claimed");
  });

  it("returns 0 when the count is null", async () => {
    headCountClient({ count: null, error: null });
    const { claimedTxCount } = await import("./transactions");
    expect(await claimedTxCount("v1")).toBe(0);
  });

  it("logs and returns 0 on a query error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    headCountClient({ count: null, error: { message: "boom" } });
    const { claimedTxCount } = await import("./transactions");
    expect(await claimedTxCount("v1")).toBe(0);
    expect(errorSpy).toHaveBeenCalledWith("claimedTxCount failed", "boom");
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
