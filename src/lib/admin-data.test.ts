import { describe, it, expect, vi, beforeEach } from "vitest";

// Generic chainable/awaitable query-builder stub, keyed per table so a test
// can configure what each `.from(table)` call resolves to independently.
const { fromMock, listUsersMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  listUsersMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(async () => ({
    from: fromMock,
    auth: { admin: { listUsers: listUsersMock } },
  })),
}));

import {
  platformTotals,
  recentActivity,
  listVendors,
  auditLog,
  securityStats,
} from "@/lib/admin-data";

function builder(data: unknown, error: unknown = null) {
  const b: Record<string, unknown> = {
    select: vi.fn(() => b),
    eq: vi.fn(() => b),
    gte: vi.fn(() => b),
    order: vi.fn(() => b),
    range: (from: number, to: number) =>
      Promise.resolve({
        data: Array.isArray(data) ? data.slice(from, to + 1) : data,
        error,
      }),
    limit: vi.fn(() => b),
    in: vi.fn(() => b),
    maybeSingle: () => Promise.resolve({ data, error }),
    then: (
      resolve: (v: {
        data: unknown;
        error: unknown;
        count?: number | null;
      }) => unknown,
    ) =>
      resolve({ data, error, count: Array.isArray(data) ? data.length : null }),
  };
  return b;
}

function mockTables(tables: Record<string, unknown>) {
  fromMock.mockImplementation((table: string) => builder(tables[table] ?? []));
}

function paid(vendorId: string) {
  return {
    vendor_id: vendorId,
    tier: "paid",
    valid_until: null,
    event_pass_starts_at: null,
    event_pass_ends_at: null,
  };
}

const users = [
  { id: "v1", email: "vendor1@x.com" },
  { id: "v2", email: "vendor2@x.com" },
];

describe("admin-data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listUsersMock.mockResolvedValue({ data: { users }, error: null });
  });

  describe("platformTotals", () => {
    it("sums totals across vendor_payment_config, transactions, and refunds", async () => {
      const now = Date.now();
      const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
      mockTables({
        vendor_payment_config: [
          { vendor_id: "v1" },
          { vendor_id: "v2" },
          { vendor_id: "v3" },
        ],
        vendor_entitlements: [
          paid("v2"),
          // Expired paid row reads as free.
          { ...paid("v1"), valid_until: "2000-01-01T00:00:00Z" },
          // A running event pass counts as Pro.
          {
            ...paid("v3"),
            tier: "free",
            valid_until: null,
            event_pass_starts_at: "2000-01-01T00:00:00Z",
            event_pass_ends_at: "2999-01-01T00:00:00Z",
          },
        ],
        transactions: [
          {
            id: "t1",
            status: "confirmed",
            amount_cents: 500,
            created_at: iso(0),
            confirmed_at: iso(0),
          },
          {
            id: "t2",
            status: "confirmed",
            amount_cents: 700,
            created_at: iso(0),
            confirmed_at: iso(0),
          },
          {
            id: "t3",
            status: "pending",
            amount_cents: 300,
            created_at: iso(0),
            confirmed_at: null,
          },
        ],
        refunds: [{ refunded_amount_cents: 200, created_at: iso(0) }],
      });

      const totals = await platformTotals();

      expect(totals).toEqual({
        vendors: 3,
        free_vendors: 1,
        pro_vendors: 2,
        transactions: 3,
        confirmed_transactions: 2,
        confirmed_volume_cents: 1200,
        confirmed_7d: 2,
        confirmed_prev_7d: 0,
        confirmed_volume_cents_30d: 1200,
        confirmed_volume_cents_prev_30d: 0,
        refund_count_30d: 1,
        refund_volume_cents_30d: 200,
      });
    });

    it("throws when a read errors", async () => {
      fromMock.mockReturnValueOnce(builder(null, { message: "boom" }));
      await expect(platformTotals()).rejects.toThrow(
        "Could not load complete query results",
      );
    });
  });

  describe("securityStats", () => {
    it("counts trailing-24h auth_failures and distinct kit_slugs under rate-limit pressure", async () => {
      mockTables({
        auth_failures: [{ id: "f1" }, { id: "f2" }],
        rate_limits: [
          { key: "checkout:qkit:1.2.3.4" },
          { key: "claim:qkit:5.6.7.8" },
          { key: "confirm:loopkit:9.9.9.9" },
        ],
      });

      await expect(securityStats()).resolves.toEqual({
        failed_auth_24h: 2,
        rate_limited_kits_24h: 2,
      });
    });

    it("throws when the auth_failures read errors", async () => {
      fromMock.mockImplementation((table: string) =>
        table === "auth_failures"
          ? builder(null, { message: "boom" })
          : builder([]),
      );
      await expect(securityStats()).rejects.toThrow("securityStats");
    });
  });

  describe("recentActivity", () => {
    it("resolves vendor email onto each transaction, most recent first", async () => {
      mockTables({
        transactions: [
          {
            id: "t1",
            vendor_id: "v1",
            kit_slug: "qkit",
            amount_cents: 500,
            status: "confirmed",
            created_at: "2026-07-01T00:00:00Z",
          },
        ],
      });

      const rows = await recentActivity();

      expect(rows).toEqual([
        {
          id: "t1",
          vendor_id: "v1",
          email: "vendor1@x.com",
          kit_slug: "qkit",
          amount_cents: 500,
          status: "confirmed",
          created_at: "2026-07-01T00:00:00Z",
        },
      ]);
    });

    it("resolves a missing auth user to a null email", async () => {
      mockTables({
        transactions: [
          {
            id: "t1",
            vendor_id: "unknown",
            kit_slug: "qkit",
            amount_cents: 500,
            status: "pending",
            created_at: "2026-07-01T00:00:00Z",
          },
        ],
      });

      const rows = await recentActivity();

      expect(rows[0].email).toBeNull();
    });

    it("returns an empty list when there are no transactions", async () => {
      mockTables({ transactions: [] });
      const rows = await recentActivity();
      expect(rows).toEqual([]);
    });

    it("throws when the read errors", async () => {
      fromMock.mockReturnValueOnce(builder(null, { message: "boom" }));
      await expect(recentActivity()).rejects.toThrow("recentActivity");
    });
  });

  describe("listVendors", () => {
    it("counts transactions per vendor, resolves email, and attaches a triage status", async () => {
      const now = Date.now();
      const daysAgo = (n: number) =>
        new Date(now - n * 86_400_000).toISOString();
      mockTables({
        vendor_payment_config: [
          {
            vendor_id: "v2",
            kind: "pointer",
            payee_name: null,
            label: "Pay with PayLah",
            created_at: daysAgo(1),
          },
          {
            vendor_id: "v1",
            kind: "paynow",
            payee_name: "Kopitiam Cart",
            label: null,
            created_at: daysAgo(30),
          },
        ],
        vendor_entitlements: [paid("v1")],
        transactions: [
          {
            id: "t1",
            vendor_id: "v1",
            status: "confirmed",
            created_at: daysAgo(5),
            confirmed_at: daysAgo(5),
          },
          {
            id: "t2",
            vendor_id: "v1",
            status: "confirmed",
            created_at: daysAgo(2),
            confirmed_at: daysAgo(2),
          },
          {
            id: "t3",
            vendor_id: "v2",
            status: "pending",
            created_at: daysAgo(1),
            confirmed_at: null,
          },
        ],
        refunds: [],
      });

      const rows = await listVendors();

      // v2 is "new" (rank 3) and v1 is "healthy" (rank 4) — new sorts first.
      expect(rows).toEqual([
        {
          vendor_id: "v2",
          email: "vendor2@x.com",
          plan: "free",
          kind: "pointer",
          payee_name: null,
          label: "Pay with PayLah",
          transaction_count: 1,
          created_at: daysAgo(1),
          status: "new",
        },
        {
          vendor_id: "v1",
          email: "vendor1@x.com",
          plan: "pro",
          kind: "paynow",
          payee_name: "Kopitiam Cart",
          label: null,
          transaction_count: 2,
          created_at: daysAgo(30),
          status: "healthy",
        },
      ]);
    });

    it("gives a vendor with no transactions a zero count", async () => {
      mockTables({
        vendor_payment_config: [
          {
            vendor_id: "v1",
            kind: "paynow",
            payee_name: "Kopitiam Cart",
            label: null,
            created_at: "2026-07-01T00:00:00Z",
          },
        ],
        transactions: [],
        refunds: [],
      });

      const rows = await listVendors();

      expect(rows[0].transaction_count).toBe(0);
    });

    it("sorts most-urgent status first, ties keeping the newest signup on top", async () => {
      const now = Date.now();
      const daysAgo = (n: number) =>
        new Date(now - n * 86_400_000).toISOString();
      mockTables({
        vendor_payment_config: [
          {
            vendor_id: "healthy-old",
            kind: "paynow",
            payee_name: "A",
            label: null,
            created_at: daysAgo(30),
          },
          {
            vendor_id: "attention",
            kind: "paynow",
            payee_name: "B",
            label: null,
            created_at: daysAgo(30),
          },
        ],
        transactions: [
          {
            id: "t1",
            vendor_id: "healthy-old",
            status: "confirmed",
            created_at: daysAgo(1),
            confirmed_at: daysAgo(1),
          },
          ...Array.from({ length: 5 }, (_, i) => ({
            id: `at${i}`,
            vendor_id: "attention",
            status: "confirmed",
            created_at: daysAgo(1),
            confirmed_at: daysAgo(1),
          })),
        ],
        refunds: [
          { transaction_id: "at0", created_at: daysAgo(1) },
          { transaction_id: "at1", created_at: daysAgo(1) },
          { transaction_id: "at2", created_at: daysAgo(1) },
        ],
      });

      const rows = await listVendors();
      expect(rows.map((r) => r.vendor_id)).toEqual([
        "attention",
        "healthy-old",
      ]);
      expect(rows[0].status).toBe("attention");
    });

    it("throws when a read errors", async () => {
      fromMock.mockReturnValueOnce(builder(null, { message: "boom" }));
      await expect(listVendors()).rejects.toThrow(
        "Could not load complete query results",
      );
    });
  });

  describe("auditLog", () => {
    it("resolves admin email onto each row, most recent first", async () => {
      mockTables({
        admin_audit: [
          {
            id: "a1",
            admin_id: "v1",
            action: "set_vendor_plan",
            target_id: "v2",
            detail: { plan: "pro" },
            created_at: "2026-07-02T00:00:00Z",
          },
        ],
      });

      const rows = await auditLog();

      expect(rows).toEqual([
        {
          id: "a1",
          admin_id: "v1",
          email: "vendor1@x.com",
          action: "set_vendor_plan",
          target_id: "v2",
          detail: { plan: "pro" },
          created_at: "2026-07-02T00:00:00Z",
        },
      ]);
    });

    it("resolves a missing auth user to a null email", async () => {
      mockTables({
        admin_audit: [
          {
            id: "a1",
            admin_id: "unknown",
            action: "set_pricing",
            target_id: null,
            detail: null,
            created_at: "2026-07-02T00:00:00Z",
          },
        ],
      });

      const rows = await auditLog();

      expect(rows[0].email).toBeNull();
    });

    it("returns an empty list when there are no rows", async () => {
      mockTables({ admin_audit: [] });
      const rows = await auditLog();
      expect(rows).toEqual([]);
    });

    it("throws when the read errors", async () => {
      fromMock.mockReturnValueOnce(builder(null, { message: "boom" }));
      await expect(auditLog()).rejects.toThrow("auditLog");
    });
  });
});

it("includes transactions beyond the first API page in totals", async () => {
  listUsersMock.mockResolvedValue({ data: { users: [] }, error: null });
  mockTables({
    vendor_payment_config: [],
    refunds: [],
    transactions: Array.from({ length: 1001 }, (_, i) => ({
      id: String(i),
      status: "confirmed",
      amount_cents: 100,
      created_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
    })),
  });
  const totals = await platformTotals();
  expect(totals.transactions).toBe(1001);
  expect(totals.confirmed_volume_cents).toBe(100100);
});

it("includes rate-limited kits beyond a thousand windows", async () => {
  mockTables({
    rate_limits: [
      ...Array.from({ length: 1000 }, () => ({ key: "checkout:qkit:ip" })),
      { key: "checkout:loopkit:ip" },
    ],
  });
  expect((await securityStats()).rate_limited_kits_24h).toBe(2);
});
