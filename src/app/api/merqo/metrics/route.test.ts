import { describe, it, expect, beforeEach, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(async () => ({ from: fromMock })),
}));

import { GET } from "@/app/api/merqo/metrics/route";

function req(auth?: string) {
  return new Request("http://localhost/api/merqo/metrics", {
    headers: auth ? { Authorization: auth } : {},
  });
}

function mockTables(
  overrides: Record<string, { data: unknown; error: unknown }>,
) {
  fromMock.mockImplementation((table: string) => ({
    select: () => ({
      order: () => ({
        range: (from: number, to: number) => {
          const result = overrides[table] ?? { data: [], error: null };
          return Promise.resolve({
            ...result,
            data: Array.isArray(result.data)
              ? result.data.slice(from, to + 1)
              : result.data,
          });
        },
      }),
    }),
  }));
}

describe("GET /api/merqo/metrics (paykit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MERQO_METRICS_SECRET = "test-secret";
    mockTables({});
  });

  it("401 when the bearer is missing", async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("401 when the bearer is wrong", async () => {
    const res = await GET(req("Bearer nope"));
    expect(res.status).toBe(401);
  });

  it("returns a payload shaped for merqo's contract on success", async () => {
    mockTables({
      vendor_payment_config: {
        data: [
          {
            vendor_id: "v1",
            created_at: new Date().toISOString(),
          },
        ],
        error: null,
      },
      vendor_entitlements: {
        data: [
          {
            vendor_id: "v1",
            tier: "paid",
            valid_until: null,
            event_pass_starts_at: null,
            event_pass_ends_at: null,
          },
        ],
        error: null,
      },
      transactions: {
        data: [
          {
            vendor_id: "v1",
            amount_cents: 500,
            status: "confirmed",
            created_at: new Date().toISOString(),
          },
        ],
        error: null,
      },
    });

    const res = await GET(req("Bearer test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.product).toBe("paykit");
    expect(typeof body.generated_at).toBe("string");
    expect(body.total_vendors).toBe(1);
    expect(body.pro_vendors).toBe(1);
    expect(body.revenue_cents_all).toBe(500);
    expect(body.funnel).toEqual({
      signed_up: 1,
      with_booth: 1,
      with_order: 1,
      pro: 1,
    });
  });

  it("503 when the vendor-config read fails", async () => {
    mockTables({
      vendor_payment_config: { data: null, error: { message: "boom" } },
    });
    const res = await GET(req("Bearer test-secret"));
    expect(res.status).toBe(503);
  });

  it("503 when the entitlement read fails", async () => {
    mockTables({
      vendor_entitlements: { data: null, error: { message: "boom" } },
    });
    const res = await GET(req("Bearer test-secret"));
    expect(res.status).toBe(503);
  });

  it("503 when the transactions read fails", async () => {
    mockTables({
      transactions: { data: null, error: { message: "boom" } },
    });
    const res = await GET(req("Bearer test-secret"));
    expect(res.status).toBe(503);
  });
});

it("includes metrics beyond the server row cap", async () => {
  process.env.MERQO_METRICS_SECRET = "test-secret";
  mockTables({
    transactions: {
      data: Array.from({ length: 1001 }, () => ({
        vendor_id: "v1",
        amount_cents: 100,
        status: "confirmed",
        created_at: new Date().toISOString(),
      })),
      error: null,
    },
  });
  const response = await GET(req("Bearer test-secret"));
  expect(response.status).toBe(200);
  expect((await response.json()).revenue_cents_all).toBe(100100);
});
