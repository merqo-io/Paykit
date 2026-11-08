import type { createServiceClient } from "@/lib/supabase/server";
import { PROOF_BUCKET } from "@/lib/proof-file";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

// Payment screenshots are deleted with the evidence row that points at them.
// A trigger queues each deleted row's object path because Postgres cannot
// remove Storage objects; this drains that queue. It never throws: a failed
// drain leaves rows queued, a leaked object rather than a correctness problem.
// Storage returns no error for a missing object, so only `!error` is success.

// Rows that keep failing stay in the table for manual inspection instead of
// starving newer rows out of each batch.
const MAX_ATTEMPTS = 5;

export type DrainResult = { removed: number; failed: number };

type QueueRow = { id: number; bucket: string; path: string; attempts: number };

async function clearQueueRows(supabase: ServiceClient, rows: QueueRow[]) {
  const { error } = await supabase
    .from("proof_storage_deletions")
    .delete()
    .in(
      "id",
      rows.map((r) => r.id),
    );
  if (error) console.error("proof storage queue clear failed", error.message);
}

// A queued path can be live again if a row was deleted by hand and a new
// evidence row later reused the path. Removing it would destroy proof, so those
// queue rows are dropped without touching Storage. Returns null when the check
// itself failed, in which case nothing may be removed.
async function dropLivePaths(
  supabase: ServiceClient,
  rows: QueueRow[],
): Promise<QueueRow[] | null> {
  const { data: live, error } = await supabase
    .from("payment_evidence")
    .select("storage_path")
    .in(
      "storage_path",
      rows.map((r) => r.path),
    );
  if (error) {
    console.error("proof storage live check failed", error.message);
    return null;
  }
  const livePaths = new Set((live ?? []).map((r) => r.storage_path));
  const isLive = (r: QueueRow) =>
    r.bucket === PROOF_BUCKET && livePaths.has(r.path);
  const stale = rows.filter(isLive);
  if (stale.length > 0) await clearQueueRows(supabase, stale);
  return rows.filter((r) => !isLive(r));
}

async function recordFailure(
  supabase: ServiceClient,
  group: QueueRow[],
  message: string,
) {
  for (const row of group) {
    const { error } = await supabase
      .from("proof_storage_deletions")
      .update({ attempts: row.attempts + 1, last_error: message })
      .eq("id", row.id);
    if (error)
      console.error("proof storage attempt update failed", error.message);
  }
}

export async function drainProofDeletions(
  supabase: ServiceClient,
  limit = 100,
): Promise<DrainResult> {
  const result: DrainResult = { removed: 0, failed: 0 };
  try {
    const { data: rows, error } = await supabase
      .from("proof_storage_deletions")
      .select("id, bucket, path, attempts")
      .lt("attempts", MAX_ATTEMPTS)
      .order("id", { ascending: true })
      .limit(limit);
    if (error) {
      console.error("proof storage drain read failed", error.message);
      return result;
    }
    if (!rows || rows.length === 0) return result;

    const removable = await dropLivePaths(supabase, rows);
    if (!removable) return result;

    const byBucket = new Map<string, QueueRow[]>();
    for (const row of removable) {
      byBucket.set(row.bucket, [...(byBucket.get(row.bucket) ?? []), row]);
    }

    for (const [bucket, group] of byBucket) {
      const { error: removeError } = await supabase.storage
        .from(bucket)
        .remove(group.map((r) => r.path));

      if (!removeError) {
        result.removed += group.length;
        await clearQueueRows(supabase, group);
        continue;
      }

      result.failed += group.length;
      console.error("proof storage drain failed", removeError.message);
      await recordFailure(supabase, group, removeError.message);
    }
  } catch (error) {
    console.error("proof storage drain failed", error);
  }
  return result;
}
