import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as loginLayout from "./login/layout";
import { NONCE_PREFIXES } from "@/lib/security-headers";

// A nonce CSP only works on pages rendered per request; a prerendered page
// has no nonce on its scripts and would be blocked.
describe("nonce routes render per request", () => {
  it("the login layout forces dynamic rendering", () => {
    expect(loginLayout.dynamic).toBe("force-dynamic");
  });

  it("lists only routes that exist", () => {
    for (const prefix of NONCE_PREFIXES) {
      expect(existsSync(`src/app${prefix}`)).toBe(true);
    }
  });
});
