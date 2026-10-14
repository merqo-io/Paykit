import { describe, it, expect } from "vitest";
import {
  hashPayToken,
  mintPayToken,
  payTokenKey,
  payTokenMatches,
  payTokenSchema,
} from "@/lib/pay-token";

describe("mintPayToken", () => {
  it("mints 43 base64url characters and a 64 hex hash of them", () => {
    const { token, hash } = mintPayToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(payTokenSchema.safeParse(token).success).toBe(true);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashPayToken(token));
    expect(hash).not.toContain(token);
  });

  it("mints a different token every time", () => {
    const seen = new Set(
      Array.from({ length: 50 }, () => mintPayToken().token),
    );
    expect(seen.size).toBe(50);
  });
});

describe("payTokenSchema", () => {
  it.each([
    ["empty", ""],
    ["one short", "a".repeat(42)],
    ["one long", "a".repeat(44)],
    ["padding", `${"a".repeat(42)}=`],
    ["a slash", `${"a".repeat(42)}/`],
    ["a space", `${"a".repeat(42)} `],
  ])("refuses %s", (_name, value) => {
    expect(payTokenSchema.safeParse(value).success).toBe(false);
  });
});

describe("payTokenMatches", () => {
  const { token, hash } = mintPayToken();

  it("accepts the token the hash was made from", () => {
    expect(payTokenMatches(token, hash)).toBe(true);
  });

  it("refuses a token that differs in its last character", () => {
    const last = token.endsWith("A") ? "B" : "A";
    expect(payTokenMatches(token.slice(0, -1) + last, hash)).toBe(false);
  });

  it("refuses another transaction's token", () => {
    expect(payTokenMatches(mintPayToken().token, hash)).toBe(false);
  });

  it.each([
    ["nothing stored", null],
    ["undefined", undefined],
    ["an empty string", ""],
    ["a short digest", "ab12"],
    ["the token itself", token],
    ["an upper-case digest", hash.toUpperCase()],
  ])("refuses when the stored value is %s", (_name, stored) => {
    expect(payTokenMatches(token, stored)).toBe(false);
  });
});

describe("payTokenKey", () => {
  it("is 16 hex characters, stable for a token, and not the token", () => {
    const { token } = mintPayToken();
    const key = payTokenKey(token);
    expect(key).toMatch(/^[0-9a-f]{16}$/);
    expect(payTokenKey(token)).toBe(key);
    expect(token).not.toContain(key);
  });
});
