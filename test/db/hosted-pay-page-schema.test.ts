import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { hashPayToken, mintPayToken } from "@/lib/pay-token";
import { PAY_TITLE_MAX } from "@/lib/api-schemas";
import { RETURN_URL_MAX } from "@/lib/return-url";

// Text guards on the hand-written 0024 migration. They catch drift between
// the SQL and the limits the app enforces before it writes.
const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/0024_hosted_pay_page.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

const statements = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

describe("0024_hosted_pay_page.sql", () => {
  it("stores the pay token as a sha256 hex digest, never as given", () => {
    expect(statements).toMatch(
      /add column pay_token_hash text[\s\S]*pay_token_hash ~ '\^\[0-9a-f\]\{64\}\$'/,
    );
    expect(statements).not.toMatch(/add column pay_token\b/);
  });

  it("accepts the hash the app writes", () => {
    const { token, hash } = mintPayToken();
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashPayToken(token)).toBe(hash);
  });

  it("bounds the return address and the title as the request schema does", () => {
    expect(statements).toContain(
      `length(return_url) between 1 and ${RETURN_URL_MAX}`,
    );
    expect(statements).toContain(
      `length(pay_title) between 1 and ${PAY_TITLE_MAX}`,
    );
  });

  it("adds the origin a kit's return address must be on", () => {
    expect(statements).toMatch(
      /alter table paykit\.kit_api_keys\s+add column return_origin text/,
    );
  });

  it("opens nothing: no grant and no policy", () => {
    expect(statements).not.toMatch(/\bgrant\b/i);
    expect(statements).not.toMatch(/\bpolicy\b/i);
  });
});
