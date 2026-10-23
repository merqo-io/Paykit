import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Text guards on the hand-written 0025 migration: the limits must match
// what the inquiry schemas let through, and the grants must stay narrow.
const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/0025_booking_inquiries.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

const statements = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

describe("0025_booking_inquiries.sql", () => {
  it("creates both tables with RLS on", () => {
    expect(statements).toMatch(/create table paykit\.inquiry_forms/);
    expect(statements).toMatch(/create table paykit\.inquiries/);
    expect(statements).toMatch(
      /alter table paykit\.inquiry_forms enable row level security/,
    );
    expect(statements).toMatch(
      /alter table paykit\.inquiries enable row level security/,
    );
  });

  it("gives a form a random 16-hex public id the vendor cannot write", () => {
    expect(statements).toMatch(/public_id ~ '\^\[0-9a-f\]\{16\}\$'/);
    const vendorGrants = statements.match(
      /grant (insert|update) \([^)]*\)\s+on paykit\.inquiry_forms to authenticated/g,
    );
    expect(vendorGrants).toHaveLength(2);
    for (const grant of vendorGrants ?? []) {
      expect(grant).not.toMatch(/public_id/);
    }
  });

  it("matches the app's limits", () => {
    expect(statements).toMatch(/char_length\(business_name\) between 1 and 80/);
    expect(statements).toMatch(/char_length\(customer_name\) between 1 and 80/);
    expect(statements).toMatch(/customer_phone ~ '\^\[0-9\+ -\]\{6,20\}\$'/);
    expect(statements).toMatch(/char_length\(message\) between 1 and 2000/);
    expect(statements).toMatch(/terms_url ~ '\^https:\/\/'/);
  });

  it("allows only the four inquiry statuses", () => {
    expect(statements).toMatch(
      /status in \('new', 'contacted', 'converted', 'declined'\)/,
    );
  });

  it("gives vendors no insert on inquiries and only status to update", () => {
    expect(statements).toMatch(
      /grant select, delete on paykit\.inquiries to authenticated/,
    );
    expect(statements).toMatch(
      /grant update \(status\) on paykit\.inquiries to authenticated/,
    );
    expect(statements).not.toMatch(
      /grant[^;]*insert[^;]*on paykit\.inquiries to authenticated/,
    );
    expect(statements).not.toMatch(/to anon/);
  });
});
