import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(path.join(__dirname, file), "utf8");

// Vitest has no React Server Components runtime, so the boundary rule is
// asserted on the source: `next/link` handed to `LandingAccountNav` from a
// Server Component made every signed-in landing page return HTTP 500.
describe("landing account nav client boundary", () => {
  it("wires LandingAccountNav inside a Client Component", () => {
    expect(read("account-nav.tsx").trimStart()).toMatch(/^"use client";/);
    expect(read("account-nav.tsx")).not.toContain("LinkComponent");
  });

  it("keeps nav.tsx (a Server Component) from passing props to LandingAccountNav", () => {
    const nav = read("nav.tsx");
    expect(nav).not.toMatch(/^"use client"/);
    expect(nav).not.toContain("LandingAccountNav");
    expect(nav).not.toContain("LinkComponent");
  });
});
