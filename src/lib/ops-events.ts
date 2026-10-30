import type { IncidentKind } from "@merqo/ui/contracts";
import type { createServiceClient } from "@/lib/supabase/server";
import { readAllRows } from "@/lib/read-all-rows";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

/** The kinds paykit writes; anything else is computed, never stored. */
export type WrittenKind = Extract<IncidentKind, "payment_callback_failed">;

export type OpsEventInput = {
  vendorId: string;
  kind: WrittenKind;
  ref: string;
  code: string;
};

export type Incident = { kind: IncidentKind; count: number; lastAt: string };
export type RecentIncident = {
  kind: IncidentKind;
  ref: string;
  code: string;
  at: string;
};

const RECENT_LIMIT = 10;

/** Best effort: a failure to record a failure is logged and swallowed. */
export async function recordOpsEvent(
  supabase: ServiceClient,
  e: OpsEventInput,
): Promise<void> {
  try {
    const { error } = await supabase.from("ops_events").insert({
      vendor_id: e.vendorId,
      kind: e.kind,
      ref: e.ref,
      code: e.code,
    });
    if (error) console.error("ops_events insert failed", e.code);
  } catch {
    console.error("ops_events insert failed", e.code);
  }
}

/**
 * Written failures plus claims still unconfirmed past their expiry, both
 * within the last `sinceHours`. Throws when either read fails.
 */
export async function summarizeIncidents(
  supabase: ServiceClient,
  vendorId: string,
  sinceHours = 72,
): Promise<{ incidents: Incident[]; recent: RecentIncident[] }> {
  const now = Date.now();
  const since = new Date(now - sinceHours * 3_600_000).toISOString();

  const [events, stuck] = await Promise.all([
    readAllRows<{
      kind: WrittenKind;
      ref: string;
      code: string;
      created_at: string;
    }>((from, to) =>
      supabase
        .from("ops_events")
        .select("kind, ref, code, created_at")
        .eq("vendor_id", vendorId)
        .gte("created_at", since)
        .order("id")
        .range(from, to),
    ),
    readAllRows((from, to) =>
      supabase
        .from("transactions")
        .select("id, expires_at")
        .eq("vendor_id", vendorId)
        .eq("status", "claimed")
        .gte("expires_at", since)
        .lt("expires_at", new Date(now).toISOString())
        .order("id")
        .range(from, to),
    ),
  ]);

  const all: RecentIncident[] = [
    ...events.map((r) => ({
      kind: r.kind,
      ref: r.ref,
      code: r.code,
      at: r.created_at,
    })),
    ...stuck.flatMap((t) =>
      t.expires_at
        ? [
            {
              kind: "payment_claim_stuck" as const,
              ref: t.id,
              code: "expired",
              at: t.expires_at,
            },
          ]
        : [],
    ),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  const byKind = new Map<IncidentKind, Incident>();
  for (const r of all) {
    const seen = byKind.get(r.kind);
    if (seen) seen.count += 1;
    else byKind.set(r.kind, { kind: r.kind, count: 1, lastAt: r.at });
  }

  return {
    incidents: [...byKind.values()],
    recent: all.slice(0, RECENT_LIMIT),
  };
}
