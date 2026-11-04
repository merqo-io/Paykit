import { describe, it, expect } from "vitest";
import { friendlyAuthError } from "./auth-errors";

describe("friendlyAuthError", () => {
  it("maps invalid credentials on sign in", () => {
    expect(friendlyAuthError({ code: "invalid_credentials" }, "signin")).toBe(
      "Wrong email or password. Try again.",
    );
    expect(
      friendlyAuthError({ message: "Invalid login credentials" }, "signin"),
    ).toBe("Wrong email or password. Try again.");
  });

  it("maps rate limits by code, status and message", () => {
    const expected = "Too many attempts. Wait a minute and try again.";
    expect(
      friendlyAuthError({ code: "over_request_rate_limit" }, "reset"),
    ).toBe(expected);
    expect(friendlyAuthError({ status: 429 }, "signin")).toBe(expected);
    expect(friendlyAuthError({ message: "Too many requests" }, "reset")).toBe(
      expected,
    );
  });

  it("maps an unconfirmed email", () => {
    expect(friendlyAuthError({ code: "email_not_confirmed" }, "signin")).toBe(
      "Confirm your email first. Check your inbox for the link.",
    );
  });

  it("maps signup-only cases", () => {
    expect(friendlyAuthError({ code: "user_already_exists" }, "signup")).toBe(
      "An account with this email already exists. Sign in instead.",
    );
    expect(friendlyAuthError({ code: "weak_password" }, "signup")).toBe(
      "Choose a longer password and try again.",
    );
    expect(friendlyAuthError({ code: "user_already_exists" }, "signin")).toBe(
      "Could not sign in. Try again.",
    );
  });

  it("falls back to a generic sentence and never echoes raw messages", () => {
    expect(friendlyAuthError({ message: "db exploded" }, "signin")).toBe(
      "Could not sign in. Try again.",
    );
    expect(friendlyAuthError({ message: "x" }, "signup")).toBe(
      "Could not create your account. Try again.",
    );
    expect(friendlyAuthError({ message: "x" }, "reset")).toBe(
      "Could not send the reset link. Try again.",
    );
    expect(friendlyAuthError({ message: "x" }, "oauth")).toBe(
      "Could not sign in with Google. Try again.",
    );
  });
});
