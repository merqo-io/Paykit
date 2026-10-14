import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Text guards on the hand-written 0023 migration; CI's `db` job runs it
// against real Postgres.
const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/0023_transactions_expires_at.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

describe("0023_transactions_expires_at.sql", () => {
  it("adds a nullable expires_at with no default", () => {
    expect(sql).toMatch(
      /alter table paykit\.transactions\s+add column expires_at timestamptz;/,
    );
  });

  it("backfills only unpaid qkit rows, 30 minutes after creation", () => {
    expect(sql).toMatch(
      /set expires_at = created_at \+ interval '30 minutes'\s+where kit_slug = 'qkit'\s+and status <> 'confirmed'\s+and expires_at is null;/,
    );
  });

  it("changes no status and touches no other table", () => {
    expect(sql).not.toMatch(/set\s+status|drop |delete from/i);
    expect(sql.match(/paykit\.\w+/g)).toEqual([
      "paykit.transactions",
      "paykit.transactions",
    ]);
  });
});
