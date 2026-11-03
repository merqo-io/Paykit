import type { createServiceClient } from "@/lib/supabase/server";

/** Every `/api/v1/checkout*` route shares this per-route fixed-window limit. */
export const PER_ROUTE_LIMIT = 60;
/** Window length (seconds) the limit above applies over. */
export const PER_ROUTE_WINDOW_SECONDS = 60;

/**
 * Resolve a best-effort client IP. Precedence: `x-vercel-forwarded-for` (set by
 * Vercel's edge, overwrites anything the client sent), then `x-real-ip`, then
 * the LAST `x-forwarded-for` hop (the one a proxy appended; earlier hops are
 * client-controlled and never used). Falls back to the literal "unknown".
 */
export function clientIp(hdrs: Headers): string {
  const vercel = hdrs.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel) return vercel;
  const real = hdrs.get("x-real-ip")?.trim();
  if (real) return real;
  const hops = hdrs.get("x-forwarded-for")?.split(",");
  return hops?.[hops.length - 1]?.trim() || "unknown";
}

type Supabase = Awaited<ReturnType<typeof createServiceClient>>;

async function check(
  supabase: Supabase,
  args: { key: string; limit: number; windowSeconds: number },
  failClosed: boolean,
): Promise<boolean> {
  const mode = failClosed ? "failing closed" : "failing open";
  try {
    const { data: allowed, error } = await supabase.rpc("check_rate_limit", {
      p_key: args.key,
      p_limit: args.limit,
      p_window_seconds: args.windowSeconds,
    });
    if (error) {
      console.error(`rateLimit degraded (${mode})`, error.message);
      return !failClosed;
    }
    return allowed !== false;
  } catch {
    console.error(`rateLimit unavailable (${mode})`);
    return !failClosed;
  }
}

/**
 * Fixed-window rate-limit check via the DB limiter (`check_rate_limit`). Returns
 * true when the call is allowed. Fails OPEN so a degraded limiter never blocks
 * a legitimate calling kit; the error is logged. Paths that take payment claims
 * use `rateLimitStrict` instead.
 */
export function rateLimit(
  supabase: Supabase,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  return check(supabase, { key, limit, windowSeconds }, false);
}

/**
 * Same check as `rateLimit` but fails CLOSED: a limiter error denies the call,
 * so an outage cannot be used to bypass the limit on pay and claim paths.
 */
export function rateLimitStrict(
  supabase: Supabase,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  return check(supabase, { key, limit, windowSeconds }, true);
}
