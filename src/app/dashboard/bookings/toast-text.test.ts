import { describe, it, expect } from "vitest";
import { toastText } from "./toast-text";

describe("toastText", () => {
  it("drops a trailing period only", () => {
    expect(toastText("Could not save. Try again.")).toBe(
      "Could not save. Try again",
    );
    expect(toastText("Saved")).toBe("Saved");
    expect(toastText(undefined)).toBe("");
  });
});
