import { describe, it, expect, vi } from "vitest";
import {
  readAllVendorPlans,
  readVendorPlan,
  resolvePlan,
  type EntitlementRow,
} from "./vendor-entitlement";

const NOW = new Date("2026-06-01T00:00:00Z");

function row(over: Partial<EntitlementRow> = {}): EntitlementRow {
  return {
    tier: "paid",
    valid_until: null,
    event_pass_starts_at: null,
    event_pass_ends_at: null,
    ...over,
  };
}

describe("resolvePlan", () => {
  it("treats a paid row with no expiry as pro", () => {
    expect(resolvePlan(row(), NOW)).toBe("pro");
  });

  it("treats a paid row with a future expiry as pro", () => {
    expect(resolvePlan(row({ valid_until: "2026-07-01T00:00:00Z" }), NOW)).toBe(
      "pro",
    );
  });

  it("treats an expired paid row as free", () => {
    expect(resolvePlan(row({ valid_until: "2026-05-01T00:00:00Z" }), NOW)).toBe(
      "free",
    );
  });

  it("treats a free row with a running event pass as pro", () => {
    expect(
      resolvePlan(
        row({
          tier: "free",
          event_pass_starts_at: "2026-05-31T00:00:00Z",
          event_pass_ends_at: "2026-06-02T00:00:00Z",
        }),
        NOW,
      ),
    ).toBe("pro");
  });

  it("treats a free row with an ended event pass as free", () => {
    expect(
      resolvePlan(
        row({
          tier: "free",
          event_pass_starts_at: "2026-05-01T00:00:00Z",
          event_pass_ends_at: "2026-06-01T00:00:00Z",
        }),
        NOW,
      ),
    ).toBe("free");
  });

  it("treats a free row with a not-yet-started pass as free", () => {
    expect(
      resolvePlan(
        row({
          tier: "free",
          event_pass_starts_at: "2026-06-02T00:00:00Z",
          event_pass_ends_at: "2026-06-03T00:00:00Z",
        }),
        NOW,
      ),
    ).toBe("free");
  });

  it("lets a running pass cover an expired paid row", () => {
    expect(
      resolvePlan(
        row({
          valid_until: "2026-05-01T00:00:00Z",
          event_pass_starts_at: "2026-05-31T00:00:00Z",
          event_pass_ends_at: "2026-06-02T00:00:00Z",
        }),
        NOW,
      ),
    ).toBe("pro");
  });

  it("treats no row as free", () => {
    expect(resolvePlan(null, NOW)).toBe("free");
  });
});

describe("readVendorPlan", () => {
  function client(result: {
    data: unknown;
    error: { message: string } | null;
  }) {
    return {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve(result) }),
        }),
      }),
    } as unknown as Parameters<typeof readVendorPlan>[0];
  }

  it("resolves the stored row", async () => {
    await expect(
      readVendorPlan(client({ data: row(), error: null }), "v1", NOW),
    ).resolves.toBe("pro");
  });

  it("reads a vendor with no row as free", async () => {
    await expect(
      readVendorPlan(client({ data: null, error: null }), "v1", NOW),
    ).resolves.toBe("free");
  });

  it("returns null when the read fails so callers can fail closed", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      readVendorPlan(
        client({ data: null, error: { message: "boom" } }),
        "v1",
        NOW,
      ),
    ).resolves.toBeNull();
    spy.mockRestore();
  });
});

describe("readAllVendorPlans", () => {
  function client(data: unknown[] | null, error: { message: string } | null) {
    return {
      from: () => ({
        select: () => ({
          order: () => ({
            range: (from: number, to: number) =>
              Promise.resolve({
                data: data ? data.slice(from, to + 1) : null,
                error,
              }),
          }),
        }),
      }),
    } as unknown as Parameters<typeof readAllVendorPlans>[0];
  }

  it("maps every cached vendor to its resolved plan", async () => {
    const res = await readAllVendorPlans(
      client(
        [
          { vendor_id: "a", ...row() },
          { vendor_id: "b", ...row({ valid_until: "2026-05-01T00:00:00Z" }) },
        ],
        null,
      ),
      NOW,
    );
    expect(res.error).toBeNull();
    expect(res.plans.get("a")).toBe("pro");
    expect(res.plans.get("b")).toBe("free");
    expect(res.plans.has("c")).toBe(false);
  });

  it("reports a read failure", async () => {
    const res = await readAllVendorPlans(client(null, { message: "x" }), NOW);
    expect(res.error).not.toBeNull();
    expect(res.plans.size).toBe(0);
  });
});
