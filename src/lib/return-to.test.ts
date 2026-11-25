import { afterEach, describe, expect, it, vi } from "vitest";
import {
  familyReturnUrl,
  loginRedirectPath,
  pathWithReturnTo,
} from "./return-to";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("familyReturnUrl", () => {
  it.each([
    [
      "a kit's booth page",
      "https://qkit.merqo.io/dashboard/booths/b1",
      "https://qkit.merqo.io/dashboard/booths/b1",
    ],
    [
      "a path with a query",
      "https://qkit.merqo.io/dashboard/booths/new?mode=event",
      "https://qkit.merqo.io/dashboard/booths/new?mode=event",
    ],
    ["the apex host", "https://merqo.io/x", "https://merqo.io/x"],
    ["a mixed-case host", "https://QKIT.Merqo.IO/x", "https://qkit.merqo.io/x"],
    [
      "a backslash, which the parser reads as a path",
      "https://qkit.merqo.io\\@evil.example/x",
      "https://qkit.merqo.io/@evil.example/x",
    ],
  ])("accepts %s", (_, raw, expected) => {
    expect(familyReturnUrl(raw)).toBe(expected);
  });

  it.each([
    [
      "a host that only starts with the family name",
      "https://merqo.io.evil.example/x",
    ],
    ["a host that only ends with the letters", "https://evilmerqo.io/x"],
    [
      "credentials that hide the real host",
      "https://qkit.merqo.io@evil.example/x",
    ],
    ["credentials on a family host", "https://user:pw@qkit.merqo.io/x"],
    ["a scheme-relative URL", "//evil.example/x"],
    ["a relative path", "/dashboard/booths/b1"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a data: URL", "data:text/html,x"],
    ["plain http on a family host", "http://qkit.merqo.io/x"],
    ["an explicit port", "https://qkit.merqo.io:8443/x"],
    ["a trailing-dot host", "https://qkit.merqo.io./x"],
    ["a preview host", "https://qkit-git-x-team.vercel.app/x"],
    ["an empty string", ""],
    [
      "a repeated parameter",
      ["https://qkit.merqo.io/x", "https://qkit.merqo.io/y"],
    ],
    ["nothing", undefined],
    ["a number", 42],
    ["an overlong value", `https://qkit.merqo.io/${"a".repeat(2000)}`],
  ])("rejects %s", (_, raw) => {
    expect(familyReturnUrl(raw)).toBeNull();
  });

  it("accepts a kit's booth QR page on staging", () => {
    const url = "https://qkit-staging.merqo.io/dashboard/booths/abc/qr";
    expect(familyReturnUrl(url)).toBe(url);
  });

  it("rejects the hostile forms in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const raw of [
      "https://evil.com",
      "https://merqo.io.evil.com",
      "//evil.com",
      "javascript:alert(1)",
      "https://user:pass@qkit.merqo.io",
      "https://qkit.merqo.io:8443",
      "http://qkit.merqo.io",
    ]) {
      expect(familyReturnUrl(raw)).toBeNull();
    }
  });

  it("accepts a local kit outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(familyReturnUrl("http://localhost:3000/dashboard/booths/b1")).toBe(
      "http://localhost:3000/dashboard/booths/b1",
    );
    expect(familyReturnUrl("http://127.0.0.1:3000/x")).toBe(
      "http://127.0.0.1:3000/x",
    );
  });

  it("rejects localhost in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(familyReturnUrl("http://localhost:3000/x")).toBeNull();
    expect(familyReturnUrl("https://localhost/x")).toBeNull();
  });
});

describe("pathWithReturnTo", () => {
  it("keeps a valid return_to, encoded", () => {
    const url = "https://qkit.merqo.io/dashboard/booths/b1/qr";
    expect(pathWithReturnTo("/dashboard/config", url)).toBe(
      `/dashboard/config?return_to=${encodeURIComponent(url)}`,
    );
  });

  it.each([
    "https://evil.com",
    "//evil.com",
    "javascript:alert(1)",
    undefined,
    ["https://qkit.merqo.io/x", "https://evil.com"],
  ])("drops an invalid return_to (%s)", (raw) => {
    expect(pathWithReturnTo("/dashboard/config", raw)).toBe(
      "/dashboard/config",
    );
  });
});

describe("loginRedirectPath", () => {
  it("keeps a same-origin relative next", () => {
    expect(loginRedirectPath("/dashboard/config?return_to=x")).toBe(
      "/login?next=%2Fdashboard%2Fconfig%3Freturn_to%3Dx",
    );
  });

  it.each([
    undefined,
    "",
    "//evil.com",
    "/\\evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    `/${"a".repeat(600)}`,
  ])("drops an unsafe next (%s)", (next) => {
    expect(loginRedirectPath(next)).toBe("/login");
  });
});
