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

export type RateLimitVerdict = "ok" | "limited" | "error";

/**
 * Fixed-window check via the DB limiter (`check_rate_limit`) that tells a
 * denied call ("limited") apart from a limiter that could not answer
 * ("error"), so a caller that fails closed can say which one happened.
 */
export async function rateLimitCheck(
  supabase: Supabase,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitVerdict> {
  try {
    const { data: allowed, error } = await supabase.rpc("check_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("rateLimit degraded", error.message);
      return "error";
    }
    return allowed === false ? "limited" : "ok";
  } catch {
    console.error("rateLimit unavailable");
    return "error";
  }
}

async function check(
  supabase: Supabase,
  args: { key: string; limit: number; windowSeconds: number },
  failClosed: boolean,
): Promise<boolean> {
  const verdict = await rateLimitCheck(
    supabase,
    args.key,
    args.limit,
    args.windowSeconds,
  );
  if (verdict === "error") return !failClosed;
  return verdict === "ok";
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
