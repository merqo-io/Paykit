import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PROOF_BUCKET, PROOF_MAX_BYTES } from "@/lib/proof-file";

// Text guards on the hand-written 0022 migration. They catch drift between
// the SQL and the constants the app uses; what Postgres actually permits is
// proven by supabase/tests/payment-evidence.test.sql in CI's `db` job.
const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/0022_payment_evidence.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

describe("0022_payment_evidence.sql", () => {
  it("creates the private bucket the app writes to, with the app's size limit", () => {
    expect(sql).toContain(
      `'${PROOF_BUCKET}', '${PROOF_BUCKET}', false, ${PROOF_MAX_BYTES},`,
    );
  });

  it("names a bucket other than qkit's payment-proofs", () => {
    expect(PROOF_BUCKET).not.toBe("payment-proofs");
    expect(sql).not.toMatch(/'payment-proofs'/);
  });

  it("scopes object reads to the vendor's own folder", () => {
    expect(sql).toMatch(
      /on storage\.objects for select to authenticated[\s\S]*bucket_id = 'paykit-payment-proofs'[\s\S]*storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/,
    );
  });

  it("creates table paykit.payment_evidence with RLS", () => {
    expect(sql).toMatch(/create table paykit\.payment_evidence\b/);
    expect(sql).toMatch(
      /alter table paykit\.payment_evidence enable row level security/,
    );
  });

  it("keeps one row per transaction and kind, which the upsert relies on", () => {
    expect(sql).toMatch(/unique \(transaction_id, kind\)/);
  });

  it("lets a vendor read through their own transactions only", () => {
    expect(sql).toMatch(
      /payment_evidence_vendor_select[\s\S]*select id from paykit\.transactions where vendor_id = \(select auth\.uid\(\)\)/,
    );
  });

  it("grants read to authenticated and writes to the service role only", () => {
    expect(sql).toMatch(
      /revoke all on paykit\.payment_evidence\s+from public, anon, authenticated, service_role/,
    );
    expect(sql).toMatch(
      /grant select on paykit\.payment_evidence to authenticated/,
    );
    expect(sql).toMatch(
      /grant select, insert, update on paykit\.payment_evidence to service_role/,
    );
  });
});
