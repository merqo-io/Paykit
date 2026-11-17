import { describe, it, expect } from "vitest";
import { weakPasswordMessage } from "./weak-password";

const CHARS_MESSAGE =
  "Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789, !@#$%^&*()_+-=[]{};':\"|<>?,./`~.";

describe("weakPasswordMessage", () => {
  it("names the minimum length when the message carries it", () => {
    expect(
      weakPasswordMessage({
        reasons: ["length"],
        message: "Password should be at least 12 characters.",
      }),
    ).toBe("Password is too short. Use at least 12 characters.");
  });

  it("falls back when the length has no number", () => {
    expect(
      weakPasswordMessage({ reasons: ["length"], message: "Too short." }),
    ).toBe("Password is too short. Use a longer one.");
  });

  it("lists the character classes the server names, with a symbol", () => {
    expect(
      weakPasswordMessage({ reasons: ["characters"], message: CHARS_MESSAGE }),
    ).toBe(
      "Password must include a lowercase letter, an uppercase letter, a number and a symbol.",
    );
  });

  it("omits the symbol when none is listed", () => {
    expect(
      weakPasswordMessage({
        reasons: ["characters"],
        message:
          "Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789",
      }),
    ).toBe(
      "Password must include a lowercase letter, an uppercase letter and a number.",
    );
  });

  it("falls back when the character classes cannot be parsed", () => {
    expect(
      weakPasswordMessage({ reasons: ["characters"], message: "nope" }),
    ).toBe(
      "Password needs a wider mix of characters, such as upper and lower case letters, numbers and symbols.",
    );
  });

  it("reports a breached password", () => {
    expect(weakPasswordMessage({ reasons: ["pwned"], message: "" })).toBe(
      "This password has appeared in a data breach. Choose a different one.",
    );
  });

  it("joins several reasons with one space", () => {
    expect(
      weakPasswordMessage({
        reasons: ["length", "pwned"],
        message: "Password should be at least 8 characters.",
      }),
    ).toBe(
      "Password is too short. Use at least 8 characters. This password has appeared in a data breach. Choose a different one.",
    );
  });

  it("infers the rule from the message when no reasons are given", () => {
    expect(
      weakPasswordMessage({
        message: "Password should be at least 8 characters.",
      }),
    ).toBe("Password is too short. Use at least 8 characters.");
    expect(weakPasswordMessage({ message: CHARS_MESSAGE })).toMatch(
      /^Password must include/,
    );
  });

  it("gives a generic line when nothing can be inferred", () => {
    expect(weakPasswordMessage({ reasons: [], message: "weak" })).toBe(
      "That password is too weak. Choose a longer, less common one.",
    );
  });
});
