import { describe, expect, it } from "vitest";
import {
  computeVendorActivity,
  type VAConfig,
  type VATransaction,
} from "./merqo-vendor-activity";
import { MS_PER_DAY } from "./utils";

const NOW = Date.parse("2026-08-27T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW - n * MS_PER_DAY).toISOString();

function tx(over: Partial<VATransaction> = {}): VATransaction {
  return {
    status: "confirmed",
    amount_cents: 1000,
    created_at: daysAgo(1),
    confirmed_at: daysAgo(1),
    ...over,
  };
}

function config(over: Partial<VAConfig> = {}): VAConfig {
  return { plan: "free", created_at: daysAgo(60), ...over };
}

describe("computeVendorActivity", () => {
  it("reports inactive with empty fields when there is no config row", () => {
    expect(computeVendorActivity(null, [], [], NOW)).toEqual({
      active: false,
      plan: null,
      status: null,
      metrics: [],
      lastActivityAt: null,
    });
  });

  it("reports active with plan, status, metrics, and last activity for a vendor with history", () => {
    const result = computeVendorActivity(
      config({ plan: "pro" }),
      [tx({ amount_cents: 500 }), tx({ amount_cents: 1500 })],
      [],
      NOW,
    );
    expect(result.active).toBe(true);
    expect(result.plan).toBe("pro");
    expect(result.status).toBe("healthy");
    expect(result.metrics).toEqual([
      { label: "Transactions (30d)", value: "2" },
      { label: "Volume (30d)", value: "S$20.00" },
      { label: "Refund rate (30d)", value: "0%" },
    ]);
    expect(result.lastActivityAt).toBe(daysAgo(1));
  });

  it("counts a confirmed transaction only in the trailing-30d window, not before it", () => {
    const result = computeVendorActivity(
      config(),
      [tx({ created_at: daysAgo(40), confirmed_at: daysAgo(40) })],
      [],
      NOW,
    );
    expect(result.metrics).toEqual([
      { label: "Transactions (30d)", value: "0" },
      { label: "Volume (30d)", value: "S$0.00" },
      { label: "Refund rate (30d)", value: "0%" },
    ]);
  });

  it("excludes pending/claimed transactions from the confirmed-based metrics but still counts them for lastActivityAt", () => {
    const result = computeVendorActivity(
      config(),
      [
        tx({
          status: "confirmed",
          created_at: daysAgo(10),
          confirmed_at: daysAgo(10),
        }),
        tx({ status: "pending", created_at: daysAgo(1), confirmed_at: null }),
      ],
      [],
      NOW,
    );
    expect(result.metrics[0]).toEqual({
      label: "Transactions (30d)",
      value: "1",
    });
    expect(result.lastActivityAt).toBe(daysAgo(1));
  });

  it("computes a refund rate against the same trailing-30d confirmed count used for status", () => {
    const result = computeVendorActivity(
      config(),
      [tx(), tx(), tx(), tx(), tx()],
      [{ created_at: daysAgo(1) }, { created_at: daysAgo(2) }],
      NOW,
    );
    expect(result.metrics[2]).toEqual({
      label: "Refund rate (30d)",
      value: "40%",
    });
    expect(result.status).toBe("attention");
  });

  it("ignores a refund outside the trailing-30d window", () => {
    const result = computeVendorActivity(
      config(),
      [tx()],
      [{ created_at: daysAgo(40) }],
      NOW,
    );
    expect(result.metrics[2]).toEqual({
      label: "Refund rate (30d)",
      value: "0%",
    });
  });
});
