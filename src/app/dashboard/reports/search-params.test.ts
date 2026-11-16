import { describe, expect, it } from "vitest";
import { parseReportsParams } from "./search-params";

describe("parseReportsParams", () => {
  it("defaults the year to the Singapore year", () => {
    const after = new Date("2026-12-31T16:00:00Z");
    const before = new Date("2026-12-31T15:59:00Z");
    expect(parseReportsParams({}, after).year).toBe(2027);
    expect(parseReportsParams({}, before).year).toBe(2026);
  });
});
