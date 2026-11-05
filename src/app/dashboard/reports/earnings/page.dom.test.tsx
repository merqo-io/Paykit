import { describe, expect, it, vi, beforeEach } from "vitest";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string): never => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import EarningsRedirect from "./page";

beforeEach(() => {
  redirectMock.mockClear();
});

describe("EarningsRedirect", () => {
  it("keeps a valid year when moving to the Earnings tab", async () => {
    await expect(
      EarningsRedirect({ searchParams: Promise.resolve({ year: "2025" }) }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith(
      "/dashboard/reports?tab=earnings&year=2025",
    );
  });

  it("omits the year when none was given", async () => {
    await expect(
      EarningsRedirect({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith(
      "/dashboard/reports?tab=earnings",
    );
  });

  it("falls back to the current year for a bad year", async () => {
    await expect(
      EarningsRedirect({ searchParams: Promise.resolve({ year: "abc" }) }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith(
      `/dashboard/reports?tab=earnings&year=${new Date().getUTCFullYear()}`,
    );
  });
});
