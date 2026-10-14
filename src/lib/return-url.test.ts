import { afterEach, describe, it, expect, vi } from "vitest";
import { kitReturnUrl, RETURN_URL_MAX } from "@/lib/return-url";

const ORIGIN = "https://qkit.merqo.io";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("kitReturnUrl", () => {
  it("returns the parsed address when it is on the registered origin", () => {
    expect(kitReturnUrl(`${ORIGIN}/order/b1/pay?t=abc`, ORIGIN)).toBe(
      "https://qkit.merqo.io/order/b1/pay?t=abc",
    );
  });

  it("accepts a registered origin written with a trailing slash or path", () => {
    expect(kitReturnUrl(`${ORIGIN}/x`, `${ORIGIN}/`)).toBe(`${ORIGIN}/x`);
    expect(kitReturnUrl(`${ORIGIN}/x`, `${ORIGIN}/anything`)).toBe(
      `${ORIGIN}/x`,
    );
  });

  it("compares hosts without regard to letter case", () => {
    expect(kitReturnUrl("https://QKIT.Merqo.io/x", ORIGIN)).toBe(`${ORIGIN}/x`);
  });

  it("treats a backslash as a path separator, as a browser does", () => {
    expect(kitReturnUrl("https://qkit.merqo.io\\@evil.com/x", ORIGIN)).toBe(
      "https://qkit.merqo.io/@evil.com/x",
    );
  });

  it.each([
    ["a host that only begins with it", "https://qkit.merqo.io.evil.com/"],
    ["the origin as credentials", "https://qkit.merqo.io@evil.com/"],
    ["credentials on the right host", "https://user:pw@qkit.merqo.io/x"],
    ["the origin in a query", "https://evil.com/?https://qkit.merqo.io"],
    ["the origin in a path", "https://evil.com/https://qkit.merqo.io/"],
    ["the origin in a fragment", "https://evil.com/#https://qkit.merqo.io"],
    ["a scheme-relative address", "//qkit.merqo.io/x"],
    ["a path only", "/order/b1/pay"],
    ["a script address", "javascript:alert(1)"],
    ["a data address", "data:text/html,<p>x</p>"],
    ["another port", "https://qkit.merqo.io:8443/x"],
    ["plain http", "http://qkit.merqo.io/x"],
    ["a trailing dot on the host", "https://qkit.merqo.io./x"],
    ["a sibling subdomain", "https://paykit.merqo.io/x"],
    ["the parent domain", "https://merqo.io/x"],
    ["a deeper subdomain", "https://a.qkit.merqo.io/x"],
    ["a lookalike with a hyphen", "https://qkit-merqo.io/x"],
    ["nothing", ""],
    ["text that is not an address", "not a url"],
  ])("refuses %s", (_name, value) => {
    expect(kitReturnUrl(value, ORIGIN)).toBeNull();
  });

  it.each([
    ["a number", 42],
    ["null", null],
    ["undefined", undefined],
    ["an object", { href: `${ORIGIN}/x` }],
  ])("refuses %s", (_name, value) => {
    expect(kitReturnUrl(value, ORIGIN)).toBeNull();
  });

  it.each([
    ["none", null],
    ["undefined", undefined],
    ["an empty string", ""],
    ["text that is not an address", "qkit.merqo.io"],
    ["plain http", "http://qkit.merqo.io"],
  ])("refuses everything when the registered origin is %s", (_n, origin) => {
    expect(kitReturnUrl(`${ORIGIN}/x`, origin)).toBeNull();
    expect(kitReturnUrl("http://qkit.merqo.io/x", origin)).toBeNull();
  });

  it("refuses an address longer than the column allows", () => {
    const long = `${ORIGIN}/${"a".repeat(RETURN_URL_MAX)}`;
    expect(kitReturnUrl(long, ORIGIN)).toBeNull();
    const fits = `${ORIGIN}/${"a".repeat(RETURN_URL_MAX - ORIGIN.length - 1)}`;
    expect(fits).toHaveLength(RETURN_URL_MAX);
    expect(kitReturnUrl(fits, ORIGIN)).toBe(fits);
  });

  it("refuses an address that only fits before it is normalised", () => {
    const spaces = " ".repeat(700);
    const raw = `${ORIGIN}/${"a".repeat(1200)}?q=${spaces}x`;
    expect(raw.length).toBeLessThanOrEqual(RETURN_URL_MAX);
    expect(kitReturnUrl(raw, ORIGIN)).toBeNull();
  });

  describe("localhost over http", () => {
    const LOCAL = "http://localhost:3000";

    it("is accepted outside production", () => {
      vi.stubEnv("NODE_ENV", "test");
      expect(kitReturnUrl(`${LOCAL}/order/b1/pay`, LOCAL)).toBe(
        `${LOCAL}/order/b1/pay`,
      );
      expect(
        kitReturnUrl("http://127.0.0.1:3000/x", "http://127.0.0.1:3000"),
      ).toBe("http://127.0.0.1:3000/x");
    });

    it("still needs the same port", () => {
      vi.stubEnv("NODE_ENV", "test");
      expect(kitReturnUrl("http://localhost:4000/x", LOCAL)).toBeNull();
    });

    it("is refused in production", () => {
      vi.stubEnv("NODE_ENV", "production");
      expect(kitReturnUrl(`${LOCAL}/x`, LOCAL)).toBeNull();
    });
  });
});
