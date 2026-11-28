import { describe, it, expect } from "vitest";
import { dollarsToCents } from "./money";

describe("dollarsToCents", () => {
  it.each([
    ["12.34", 1234],
    ["0.29", 29],
    ["1.005", 101],
    ["S$1,234.50", 123450],
  ])("converts %s", (raw, cents) => {
    expect(dollarsToCents(raw)).toBe(cents);
  });

  it.each(["", "bad", "-2.50", "Infinity", null, new File(["data"], "a.txt")])(
    "gives null for blank, invalid or non-text input (%s)",
    (raw) => {
      expect(dollarsToCents(raw)).toBeNull();
    },
  );
});
