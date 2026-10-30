import { describe, it, expect, beforeEach, vi } from "vitest";

const { fromMock, listUsersMock, summarizeIncidentsMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  listUsersMock: vi.fn(),
  summarizeIncidentsMock: vi.fn(),
}));
vi.mock("@/lib/ops-events", () => ({
  summarizeIncidents: summarizeIncidentsMock,
}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(async () => ({
    from: fromMock,
    auth: { admin: { listUsers: listUsersMock } },
  })),
}));

import { vendorActivityPayloadSchema } from "@merqo/ui/contracts";
import { GET } from "@/app/api/merqo/vendor-activity/route";

function req(url: string, auth?: string) {
  return new Request(url, {
    headers: auth ? { Authorization: auth } : {},
  });
}

type TableResult = { data: unknown; error: { message: string } | null };

function paged(result: TableResult) {
  return {
    order: () => ({
      range: (from: number, to: number) =>
        Promise.resolve({
          ...result,
          data: Array.isArray(result.data)
            ? result.data.slice(from, to + 1)
            : result.data,
        }),
    }),
  };
}
function mockTables(overrides: {
  config?: TableResult;
  transactions?: TableResult;
  refunds?: TableResult;
}) {
  const config = overrides.config ?? { data: null, error: null };
  const transactions = overrides.transactions ?? { data: [], error: null };
  const refunds = overrides.refunds ?? { data: [], error: null };

  fromMock.mockImplementation((table: string) => {
    if (table === "vendor_payment_config") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve(config),
          }),
        }),
      };
    }
    if (table === "transactions") {
      return {
        select: () => ({
          eq: () => paged(transactions),
        }),
      };
    }
    if (table === "refunds") {
      return {
        select: () => ({
          in: () => paged(refunds),
        }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
}

describe("GET /api/merqo/vendor-activity (paykit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MERQO_METRICS_SECRET = "test-secret";
    listUsersMock.mockResolvedValue({
      data: { users: [{ id: "u1", email: "vendor@business.sg" }] },
      error: null,
    });
    summarizeIncidentsMock.mockResolvedValue({ incidents: [], recent: [] });
    mockTables({});
  });

  it("401 when the bearer is missing", async () => {
    const res = await GET(
      req("http://localhost/api/merqo/vendor-activity?email=v@business.sg"),
    );
    expect(res.status).toBe(401);
  });

  it("401 when the bearer is wrong", async () => {
    const res = await GET(
      req(
        "http://localhost/api/merqo/vendor-activity?email=v@business.sg",
        "Bearer nope",
      ),
    );
    expect(res.status).toBe(401);
  });

  it("400 when email is missing", async () => {
    const res = await GET(
      req("http://localhost/api/merqo/vendor-activity", "Bearer test-secret"),
    );
    expect(res.status).toBe(400);
  });

  it("404 when the vendor has no auth user in this kit at all", async () => {
    listUsersMock.mockResolvedValue({ data: { users: [] }, error: null });
    const res = await GET(
      req(
        "http://localhost/api/merqo/vendor-activity?email=ghost@business.sg",
        "Bearer test-secret",
      ),
    );
    expect(res.status).toBe(404);
  });

  it("200 with active:false for a known user with no payment config row", async () => {
    const res = await GET(
      req(
        "http://localhost/api/merqo/vendor-activity?email=vendor@business.sg",
        "Bearer test-secret",
      ),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      active: false,
      plan: null,
      status: null,
      metrics: [],
      lastActivityAt: null,
      incidents: [],
      recent: [],
    });
  });

  it("reports the vendor's incidents in the shared contract shape", async () => {
    const incidents = [
      {
        kind: "payment_callback_failed",
        count: 2,
        lastAt: "2026-10-29T10:00:00.000Z",
      },
      {
        kind: "payment_claim_stuck",
        count: 1,
        lastAt: "2026-10-29T09:00:00.000Z",
      },
    ];
    const recent = [
      {
        kind: "payment_callback_failed",
        ref: "t1",
        code: "http_502",
        at: "2026-10-29T10:00:00.000Z",
      },
    ];
    summarizeIncidentsMock.mockResolvedValue({ incidents, recent });
    const res = await GET(
      req(
        "http://localhost/api/merqo/vendor-activity?email=vendor@business.sg",
        "Bearer test-secret",
      ),
    );
    expect(res.status).toBe(200);
    const body = vendorActivityPayloadSchema.parse(await res.json());
    expect(body.incidents).toEqual(incidents);
    expect(body.recent).toEqual(recent);
    expect(summarizeIncidentsMock).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
    );
  });

  it("503 when the incidents read fails", async () => {
    summarizeIncidentsMock.mockRejectedValue(new Error("boom"));
    const res = await GET(
      req(
        "http://localhost/api/merqo/vendor-activity?email=vendor@business.sg",
        "Bearer test-secret",
      ),
    );
    expect(res.status).toBe(503);
  });

  it("200 with real activity for a vendor with a config row and confirmed transactions", async () => {
    const now = new Date().toISOString();
    mockTables({
      config: { data: { plan: "pro", created_at: now }, error: null },
      transactions: {
        data: [
          {
            id: "t1",
            status: "confirmed",
            amount_cents: 1000,
            created_at: now,
            confirmed_at: now,
          },
        ],
        error: null,
      },
      refunds: { data: [], error: null },
    });
    const res = await GET(
      req(
        "http://localhost/api/merqo/vendor-activity?email=vendor@business.sg",
        "Bearer test-secret",
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.active).toBe(true);
    expect(body.plan).toBe("pro");
    expect(body.status).toBe("healthy");
    expect(body.metrics).toEqual([
      { label: "Transactions (30d)", value: "1" },
      { label: "Volume (30d)", value: "$10.00" },
      { label: "Refund rate (30d)", value: "0%" },
    ]);
    expect(body.lastActivityAt).toBe(now);
  });

  it("never queries refunds when the vendor has zero transactions", async () => {
    mockTables({
      config: {
        data: { plan: "free", created_at: new Date().toISOString() },
        error: null,
      },
      transactions: { data: [], error: null },
    });
    const res = await GET(
      req(
        "http://localhost/api/merqo/vendor-activity?email=vendor@business.sg",
        "Bearer test-secret",
      ),
    );
    expect(res.status).toBe(200);
    expect(fromMock).not.toHaveBeenCalledWith("refunds");
  });

  it("503 when the auth-users read fails", async () => {
    listUsersMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await GET(
      req(
        "http://localhost/api/merqo/vendor-activity?email=vendor@business.sg",
        "Bearer test-secret",
      ),
    );
    expect(res.status).toBe(503);
  });

  it("503 when the config read fails", async () => {
    mockTables({ config: { data: null, error: { message: "boom" } } });
    const res = await GET(
      req(
        "http://localhost/api/merqo/vendor-activity?email=vendor@business.sg",
        "Bearer test-secret",
      ),
    );
    expect(res.status).toBe(503);
  });

  it("503 when the transactions read fails", async () => {
    mockTables({ transactions: { data: null, error: { message: "boom" } } });
    const res = await GET(
      req(
        "http://localhost/api/merqo/vendor-activity?email=vendor@business.sg",
        "Bearer test-secret",
      ),
    );
    expect(res.status).toBe(503);
  });

  it("503 when the refunds read fails", async () => {
    mockTables({
      config: {
        data: { plan: "free", created_at: new Date().toISOString() },
        error: null,
      },
      transactions: {
        data: [
          {
            id: "t1",
            status: "confirmed",
            amount_cents: 1000,
            created_at: new Date().toISOString(),
            confirmed_at: new Date().toISOString(),
          },
        ],
        error: null,
      },
      refunds: { data: null, error: { message: "boom" } },
    });
    const res = await GET(
      req(
        "http://localhost/api/merqo/vendor-activity?email=vendor@business.sg",
        "Bearer test-secret",
      ),
    );
    expect(res.status).toBe(503);
  });
});

it("includes all vendor activity and batches refund filters", async () => {
  process.env.MERQO_METRICS_SECRET = "test-secret";
  vi.clearAllMocks();
  summarizeIncidentsMock.mockResolvedValue({ incidents: [], recent: [] });
  listUsersMock.mockResolvedValue({
    data: { users: [{ id: "u1", email: "vendor@business.sg" }] },
    error: null,
  });
  mockTables({
    config: {
      data: { plan: "pro", created_at: new Date().toISOString() },
      error: null,
    },
    transactions: {
      data: Array.from({ length: 1001 }, (_, i) => ({
        id: String(i),
        status: "confirmed",
        amount_cents: 100,
        created_at: new Date().toISOString(),
        confirmed_at: null,
      })),
      error: null,
    },
  });
  const response = await GET(
    req(
      "http://localhost/api/merqo/vendor-activity?email=vendor@business.sg",
      "Bearer test-secret",
    ),
  );
  expect(response.status).toBe(200);
  expect((await response.json()).metrics).toContainEqual({
    label: "Transactions (30d)",
    value: "1001",
  });
  expect(
    fromMock.mock.calls.filter((call) => call[0] === "refunds"),
  ).toHaveLength(11);
});
