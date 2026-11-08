import type { createServiceClient } from "@/lib/supabase/server";

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

    const byBucket = new Map<string, typeof rows>();
    for (const row of rows) {
      byBucket.set(row.bucket, [...(byBucket.get(row.bucket) ?? []), row]);
    }

    for (const [bucket, group] of byBucket) {
      const { error: removeError } = await supabase.storage
        .from(bucket)
        .remove(group.map((r) => r.path));

      if (!removeError) {
        result.removed += group.length;
        const { error: deleteError } = await supabase
          .from("proof_storage_deletions")
          .delete()
          .in(
            "id",
            group.map((r) => r.id),
          );
        if (deleteError)
          console.error(
            "proof storage queue clear failed",
            deleteError.message,
          );
        continue;
      }

      result.failed += group.length;
      console.error("proof storage drain failed", removeError.message);
      for (const row of group) {
        const { error: updateError } = await supabase
          .from("proof_storage_deletions")
          .update({
            attempts: row.attempts + 1,
            last_error: removeError.message,
          })
          .eq("id", row.id);
        if (updateError)
          console.error(
            "proof storage attempt update failed",
            updateError.message,
          );
      }
    }
  } catch (error) {
    console.error("proof storage drain failed", error);
  }
  return result;
}
